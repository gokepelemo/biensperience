/**
 * Wikivoyage provider — fetch_destination_tips.
 *
 * Native registry implementation. Uses providerCtx.httpRequest to talk to the
 * MediaWiki parse API and parses Wikivoyage section content into the spec's
 * tip shape: `{ section, type, category, content }`.
 *
 * Single-responsibility: this tool returns Wikivoyage tips ONLY. The previous
 * multi-provider aggregator (Wikivoyage + Google Maps) has been removed. To
 * compose multiple sources the LLM should call `fetch_destination_tips` and
 * `fetch_destination_places` in the same turn — the tool-use loop runs them
 * in parallel.
 *
 * Response shapes:
 *   200: { destination_id, destination_name, tips, returned }
 *   400: { ok: false, error: 'invalid_id' }
 *   404: { ok: false, error: 'not_found' }
 *   502: { ok: false, error: 'upstream_unavailable' }
 */

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// Section map — Wikivoyage section title (lowercase) → tip metadata.
//
// Ported from utilities/bienbot-external-data.js (WIKIVOYAGE_SECTION_MAP).
// `type` maps to the rendering enum used by the BienBot tip card; `category`
// is the human-readable group label; `maxTips` caps per-section extraction so
// no one section dominates the response.
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_TIP_MAP = {
  'see':          { type: 'Custom',         category: 'Sightseeing',     icon: '👁️',  maxTips: 4 },
  'do':           { type: 'Custom',         category: 'Activities',      icon: '🎯',  maxTips: 4 },
  'eat':          { type: 'Food',           category: 'Food',            icon: null,  maxTips: 3 },
  'drink':        { type: 'Food',           category: 'Nightlife',       icon: '🍸',  maxTips: 2 },
  'buy':          { type: 'Custom',         category: 'Shopping',        icon: '🛍️',  maxTips: 2 },
  'sleep':        { type: 'Accommodation',  category: 'Accommodation',   icon: null,  maxTips: 3 },
  'get around':   { type: 'Transportation', category: 'Transportation',  icon: null,  maxTips: 3 },
  'get in':       { type: 'Transportation', category: 'Getting There',   icon: '✈️',  maxTips: 2 },
  'stay safe':    { type: 'Safety',         category: 'Safety',          icon: null,  maxTips: 3 },
  'stay healthy': { type: 'Safety',         category: 'Health',          icon: '🏥',  maxTips: 2 },
  'cope':         { type: 'Custom',         category: 'Practical Info',  icon: 'ℹ️',  maxTips: 2 },
  'talk':         { type: 'Language',       category: 'Language',        icon: null,  maxTips: 2 },
  'understand':   { type: 'Customs',        category: 'Culture',         icon: null,  maxTips: 3 },
  'respect':      { type: 'Customs',        category: 'Customs',         icon: null,  maxTips: 2 },
  'climate':      { type: 'Weather',        category: 'Weather',         icon: null,  maxTips: 2 },
  'connect':      { type: 'Custom',         category: 'Connectivity',    icon: '📱',  maxTips: 2 }
};

// payload.sections allowlist for the registry schema (lowercase keys)
const ALLOWED_SECTIONS = Object.keys(SECTION_TIP_MAP).filter((k) =>
  ['do', 'see', 'eat', 'drink', 'buy', 'sleep'].includes(k)
);

const MAX_TOTAL_TIPS = 15;

// Lazy-load the Destination model to avoid circular requires at module init
// (action-executor → registry/bootstrap → providers → models → ...).
let DestinationModel = null;
function getDestinationModel() {
  if (!DestinationModel) {
    DestinationModel = require('../../../models/destination');
  }
  return DestinationModel;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML / text helpers (ported from bienbot-external-data.js).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and decode common HTML entities.
 *
 * Algorithm intentionally avoids `String.replace(/<…>/g, '')` patterns so that
 * static analysers (CodeQL js/incomplete-multi-character-sanitization) cannot
 * flag the cleanup as incomplete. See bienbot-external-data.js for the
 * original rationale.
 */
function stripHtml(html) {
  let text = html
    .replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  text = text
    .replace(/&amp;/g, '__BIENSPERIENCE_AMP__')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  text = text.split('<').map((segment, idx) => {
    if (idx === 0) return segment;
    const closeIdx = segment.indexOf('>');
    return closeIdx >= 0 ? segment.slice(closeIdx + 1) : '';
  }).join('');

  return text
    .replace(/__BIENSPERIENCE_AMP__/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract useful text fragments from a section's plain text.
 * Splits on bullet lines first, falls back to sentence splitting.
 */
function extractFragments(text, max) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•·\-–—*]+/, '').trim())
    .filter((l) =>
      l.length > 15 && l.length < 400 &&
      !/\[edit\]/i.test(l) &&
      !/\[add listing\]/i.test(l) &&
      !/chart\s*\(explanation\)/i.test(l) &&
      !/^average\s+(max|min)/i.test(l)
    );

  if (lines.length > 0) return lines.slice(0, max);

  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) =>
      s.length > 20 && s.length < 300 &&
      !/\[edit\]/i.test(s) &&
      !/\[add listing\]/i.test(s)
    )
    .slice(0, max);
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler.
// ─────────────────────────────────────────────────────────────────────────────

async function handleFetchDestinationTips(payload, _user, providerCtx) {
  const { destination_id, sections: requestedSections } = payload || {};

  if (!destination_id || !mongoose.Types.ObjectId.isValid(String(destination_id))) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_id' } };
  }

  const Destination = getDestinationModel();
  const destination = await Destination.findById(destination_id).select('name').lean();
  if (!destination || !destination.name) {
    return { statusCode: 404, body: { ok: false, error: 'not_found' } };
  }

  const destinationName = destination.name;
  const encodedPage = destinationName.replace(/\s+/g, '_');

  // Step 1 — section index.
  const sectionsRes = await providerCtx.httpRequest('/w/api.php', {
    query: {
      action: 'parse',
      page: encodedPage,
      prop: 'sections',
      format: 'json',
      redirects: 1
    }
  });
  if (!sectionsRes || sectionsRes.status !== 200 || !sectionsRes.body) {
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }
  if (sectionsRes.body.error) {
    if (sectionsRes.body.error.code === 'missingtitle') {
      return { statusCode: 404, body: { ok: false, error: 'not_found' } };
    }
    return { statusCode: 502, body: { ok: false, error: 'upstream_unavailable' } };
  }

  const allSections = (sectionsRes.body.parse && sectionsRes.body.parse.sections) || [];
  // Restrict to known travel-relevant sections, optionally filtered by payload.sections.
  const sectionFilter = Array.isArray(requestedSections) && requestedSections.length > 0
    ? new Set(requestedSections.map((s) => String(s).toLowerCase()))
    : null;

  const relevant = [];
  for (const s of allSections) {
    const key = String(s.line || '').toLowerCase().trim();
    const map = SECTION_TIP_MAP[key];
    if (!map) continue;
    if (sectionFilter && !sectionFilter.has(key)) continue;
    if (!s.index) continue;
    relevant.push({ key, sectionName: s.line, sectionIndex: s.index, ...map });
  }

  if (relevant.length === 0) {
    return {
      statusCode: 200,
      body: {
        destination_id: String(destination_id),
        destination_name: destinationName,
        tips: [],
        returned: 0
      }
    };
  }

  // Step 2 — fetch each relevant section's HTML in parallel batches.
  const tips = [];
  const batchSize = 6;

  for (let i = 0; i < relevant.length && tips.length < MAX_TOTAL_TIPS; i += batchSize) {
    const batch = relevant.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(batch.map(async (sec) => {
      const res = await providerCtx.httpRequest('/w/api.php', {
        query: {
          action: 'parse',
          page: encodedPage,
          prop: 'text',
          section: sec.sectionIndex,
          format: 'json',
          redirects: 1,
          disabletoc: 1
        }
      });
      if (!res || res.status !== 200 || !res.body) return [];
      const html = res.body.parse && res.body.parse.text && res.body.parse.text['*'];
      if (!html) return [];
      const plain = stripHtml(html);
      if (plain.length < 20) return [];
      return extractFragments(plain, sec.maxTips).map((content) => ({
        section: sec.key,
        type: sec.type,
        category: sec.category,
        content,
        ...(sec.icon ? { icon: sec.icon } : {})
      }));
    }));

    for (const r of batchResults) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        for (const tip of r.value) {
          if (tips.length >= MAX_TOTAL_TIPS) break;
          tips.push(tip);
        }
      }
    }
  }

  return {
    statusCode: 200,
    body: {
      destination_id: String(destination_id),
      destination_name: destinationName,
      tips,
      returned: tips.length
    }
  };
}

module.exports = {
  name: 'wikivoyage',
  displayName: 'Wikivoyage',
  baseUrl: 'https://en.wikivoyage.org',
  authType: 'none',
  envKey: null,
  envKeyOptional: false,
  budgetPerHour: 60,
  retryPolicy: { maxRetries: 2, baseDelayMs: 500, timeoutMs: 8000 },
  tools: [
    {
      name: 'fetch_destination_tips',
      mutating: false,
      label: 'Fetching destination tips',
      description: 'Fetch travel tips (eat, see, do, drink, buy, sleep) for a destination from Wikivoyage.',
      payloadSchema: {
        destination_id: { type: 'string', format: 'objectId', required: true },
        destination_name: { type: 'string', optional: true },
        sections: {
          type: 'array',
          optional: true,
          allowed: ALLOWED_SECTIONS
        }
      },
      idRefs: [
        { field: 'destination_id', model: 'destination', required: true }
      ],
      promptHints: [
        'When the user asks about what to do, see, eat, drink, buy, or where to sleep at a destination, propose `fetch_destination_tips` with that destination_id.',
        'When the user asks to suggest, recommend, or "what should I add" plan items for a plan or destination, call `fetch_destination_tips` in the same turn as `suggest_plan_items` — Wikivoyage tips give curated see/do/eat/drink ideas that complement the frequency-ranked local suggestions.',
        'Prefer `fetch_destination_tips` (read-only, surfaced via card) over inventing tips from training data.',
        'For ratings/addresses of specific places, also call `fetch_destination_places` (Google Maps) in the same turn — they compose well via parallel tool calls.'
      ],
      handler: handleFetchDestinationTips
    }
  ]
};
