/**
 * Wikivoyage provider — fetch_destination_tips.
 *
 * First migration to the BienBot tool registry. Currently delegates to the
 * legacy `fetchDestinationTips` helper in `bienbot-external-data.js` to
 * preserve exact response shape for existing card-producing callers
 * (controllers/api/bienbot.js relies on `body.data.tips`,
 * `body.data.destination_id`, `body.data.destination_name`,
 * `body.data.provider_count`).
 *
 * The legacy helper internally calls `fetchTravelData()` which fans out to
 * Wikivoyage and Google Maps. T11 will move parser internals into this
 * provider file and partition the multi-source aggregation across the
 * per-provider manifests (T8 Google Maps).
 *
 * The provider manifest itself describes Wikivoyage so that:
 *   - prompt schema / decision rules are surfaced under "via Wikivoyage"
 *   - the registry's verifier-entries / labels / bootstrap wiring picks it up
 *   - providerCtx is created with the Wikivoyage baseUrl + retry policy
 *     (the legacy helper has its own withRetry; the providerCtx is reserved
 *     for the T11 cleanup that will replace those raw `fetch` calls).
 */

// Lazy-loaded to avoid circular requires at module init time
// (bienbot-action-executor → bienbot-tool-registry/bootstrap → providers →
//  bienbot-external-data → ai-gateway → ...).
function getLegacyFetchDestinationTips() {
  const { fetchDestinationTips } = require('../../bienbot-external-data');
  return fetchDestinationTips;
}

async function handleFetchDestinationTips(payload, user, _providerCtx) {
  // Delegate to the existing implementation. It already:
  //   - validates ObjectId format and returns { statusCode: 400, body: { success: false, error } }
  //   - looks up the destination and returns { statusCode: 404, ... } if missing
  //   - calls Wikivoyage's MediaWiki section API with retry/timeout
  //   - parses sections via WIKIVOYAGE_SECTION_MAP + extractFragments + stripHtml
  //   - falls back to the page-summary REST endpoint when section parsing is empty
  //   - dedups against the destination's existing travel_tips
  //   - returns { statusCode: 200, body: { success: true, data: { tips, destination_id, destination_name, provider_count } } }
  //
  // Returning that exact { statusCode, body } shape directly is what
  // executeRegisteredTool expects (it wraps in { success, statusCode, body, errors }).
  const fetchDestinationTips = getLegacyFetchDestinationTips();
  return fetchDestinationTips(payload, user);
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
          allowed: ['do', 'see', 'eat', 'drink', 'buy', 'sleep']
        }
      },
      idRefs: [
        { field: 'destination_id', model: 'destination', required: true }
      ],
      promptHints: [
        'When the user asks about what to do, see, eat, drink, buy, or where to sleep at a destination, propose `fetch_destination_tips` with that destination_id.',
        'Prefer `fetch_destination_tips` (read-only, surfaced via card) over inventing tips from training data.'
      ],
      handler: handleFetchDestinationTips
    }
  ]
};
