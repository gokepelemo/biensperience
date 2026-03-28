/**
 * BienBot Entity Resolution Service
 *
 * Resolves human-readable entity names (from intent classifier extraction)
 * to database IDs using existing search infrastructure. Entity-type-agnostic —
 * all entity types funnel through the same pipeline.
 *
 * Integration point: runs BEFORE the LLM call so resolved IDs appear in
 * the system prompt context.
 *
 * @module utilities/bienbot-entity-resolver
 */

const logger = require('./backend-logger');
const { calculateSimilarity, normalizeString } = require('./fuzzy-match');

// Lazy-loaded to avoid circular dependencies
let searchFns = null;
let User = null;

function loadDeps() {
  if (!searchFns) {
    searchFns = require('../controllers/api/search');
  }
  if (!User) {
    User = require('../models/user');
  }
}

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------

const ResolutionConfidence = Object.freeze({
  HIGH: 'high',     // >0.90 — auto-resolve
  MEDIUM: 'medium', // 0.60–0.90 — disambiguate
  LOW: 'low',       // <0.60 — unresolved
});

const DEFAULT_THRESHOLDS = {
  autoResolve: 0.90,
  disambiguate: 0.60,
};

// ---------------------------------------------------------------------------
// Name → type-hint mapping
// ---------------------------------------------------------------------------

/**
 * Maps extracted entity field names from the intent classifier to the
 * entity type the resolver should search.
 */
const FIELD_TYPE_MAP = {
  destination_name: 'destination',
  experience_name: 'experience',
  assignee_name: 'user',
  user_email: 'user',
};

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Per-type resolution strategies
// ---------------------------------------------------------------------------

/**
 * Resolve a user by email (exact match).
 * @returns {Array<{id, name, type, score, detail}>}
 */
async function resolveUserByEmail(email, user) {
  loadDeps();
  try {
    const found = await User.findOne({
      email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).select('_id name email').lean();

    if (found) {
      return [{
        id: found._id.toString(),
        name: found.name,
        type: 'user',
        score: 1.0,
        detail: found.email,
      }];
    }
  } catch (err) {
    logger.warn('[entity-resolver] Email lookup failed', { email, error: err.message });
  }
  return [];
}

/**
 * Resolve a user by name (search + scoring).
 */
async function resolveUserByName(name, user, options = {}) {
  loadDeps();
  const candidates = [];

  try {
    const results = await searchFns.searchUsersInternal(name, 10, user);
    for (const r of results) {
      const similarity = calculateSimilarity(normalize(name), normalize(r.name));
      const score = similarity / 100; // convert 0-100 to 0-1
      candidates.push({
        id: r._id.toString(),
        name: r.name,
        type: 'user',
        score,
        detail: r.email || null,
      });
    }
  } catch (err) {
    logger.warn('[entity-resolver] User name search failed', { name, error: err.message });
  }

  // Also check collaborators on the current entity if context is provided
  if (options.collaborators && Array.isArray(options.collaborators)) {
    for (const collab of options.collaborators) {
      const collabName = collab.name || '';
      if (!collabName) continue;
      const similarity = calculateSimilarity(normalize(name), normalize(collabName));
      const score = similarity / 100;
      // Boost collaborator context matches slightly
      const boostedScore = Math.min(score + 0.05, 1.0);
      const existing = candidates.find(c => c.id === collab._id?.toString());
      if (existing) {
        existing.score = Math.max(existing.score, boostedScore);
      } else if (boostedScore >= DEFAULT_THRESHOLDS.disambiguate) {
        candidates.push({
          id: collab._id.toString(),
          name: collabName,
          type: 'user',
          score: boostedScore,
          detail: collab.email || null,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Resolve a destination by name.
 */
async function resolveDestination(name, user) {
  loadDeps();
  const candidates = [];

  try {
    const results = await searchFns.searchDestinationsInternal(name, 10, user);
    for (const r of results) {
      const displayName = [r.name, r.city, r.country].filter(Boolean).join(', ');
      // Score using the primary name field
      const similarity = calculateSimilarity(normalize(name), normalize(r.name));
      let score = similarity / 100;

      // Boost if city or country also matches
      if (r.city && normalize(name).includes(normalize(r.city))) {
        score = Math.min(score + 0.05, 1.0);
      }
      if (r.country && normalize(name).includes(normalize(r.country))) {
        score = Math.min(score + 0.03, 1.0);
      }

      candidates.push({
        id: r._id.toString(),
        name: displayName,
        type: 'destination',
        score,
      });
    }
  } catch (err) {
    logger.warn('[entity-resolver] Destination search failed', { name, error: err.message });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Resolve an experience by name.
 * Prioritises experiences within the current destination context.
 */
async function resolveExperience(name, user, options = {}) {
  loadDeps();
  const candidates = [];

  try {
    const results = await searchFns.searchExperiencesInternal(name, 10, user);
    for (const r of results) {
      const similarity = calculateSimilarity(normalize(name), normalize(r.name));
      let score = similarity / 100;

      // Boost if in the same destination as the current context
      if (options.destinationId && r.destination) {
        const destId = typeof r.destination === 'object'
          ? (r.destination._id?.toString() || r.destination.toString())
          : r.destination.toString();
        if (destId === options.destinationId) {
          score = Math.min(score + 0.08, 1.0);
        }
      }

      const destLabel = r.destination?.name
        ? `in ${[r.destination.name, r.destination.city, r.destination.country].filter(Boolean).join(', ')}`
        : null;

      candidates.push({
        id: r._id.toString(),
        name: r.name,
        type: 'experience',
        score,
        detail: destLabel,
      });
    }
  } catch (err) {
    logger.warn('[entity-resolver] Experience search failed', { name, error: err.message });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Resolve a plan by associated experience name.
 */
async function resolvePlan(name, user) {
  loadDeps();
  const candidates = [];

  try {
    const results = await searchFns.searchPlansInternal(name, 10, user);
    for (const r of results) {
      const expName = r.experience?.title || r.experience?.description || '';
      const similarity = calculateSimilarity(normalize(name), normalize(expName));
      const score = similarity / 100;

      candidates.push({
        id: r._id.toString(),
        name: expName || 'Untitled Plan',
        type: 'plan',
        score,
        detail: r.experience?.destination ? `experience: ${expName}` : null,
      });
    }
  } catch (err) {
    logger.warn('[entity-resolver] Plan search failed', { name, error: err.message });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Type dispatch
// ---------------------------------------------------------------------------

const TYPE_RESOLVERS = {
  user: async (name, user, options) => {
    // Email takes priority
    if (options._isEmail) {
      const emailResults = await resolveUserByEmail(name, user);
      if (emailResults.length > 0) return emailResults;
    }
    return resolveUserByName(name, user, options);
  },
  destination: resolveDestination,
  experience: resolveExperience,
  plan: resolvePlan,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a single entity name to one or more candidates.
 *
 * @param {string} name - The name/text to resolve
 * @param {string} typeHint - Entity type: 'user', 'destination', 'experience', 'plan'
 * @param {object} user - The authenticated user (for permission scoping)
 * @param {object} [options] - Additional context
 * @param {string} [options.destinationId] - Current destination context
 * @param {Array}  [options.collaborators] - Current collaborator list for boosting
 * @param {object} [options.thresholds] - Override confidence thresholds
 * @returns {Promise<{candidates: Array, confidence: string}>}
 */
async function resolveEntity(name, typeHint, user, options = {}) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { candidates: [], confidence: ResolutionConfidence.LOW };
  }

  const resolverFn = TYPE_RESOLVERS[typeHint];
  if (!resolverFn) {
    logger.warn('[entity-resolver] Unknown type hint', { typeHint, name });
    return { candidates: [], confidence: ResolutionConfidence.LOW };
  }

  const thresholds = options.thresholds || DEFAULT_THRESHOLDS;
  const candidates = await resolverFn(name, user, options);

  if (candidates.length === 0) {
    return { candidates: [], confidence: ResolutionConfidence.LOW };
  }

  const topScore = candidates[0].score;

  let confidence;
  if (topScore >= thresholds.autoResolve) {
    confidence = ResolutionConfidence.HIGH;
  } else if (topScore >= thresholds.disambiguate) {
    confidence = ResolutionConfidence.MEDIUM;
  } else {
    confidence = ResolutionConfidence.LOW;
  }

  return {
    candidates: candidates.slice(0, 5), // cap at 5 candidates
    confidence,
  };
}

/**
 * Batch-resolve all extracted entity names from the intent classifier.
 *
 * @param {object} extractedNames - Entity name fields from intent classifier
 *   e.g. { destination_name: "Tokyo", assignee_name: "Sarah", user_email: "sarah@ex.com" }
 * @param {object} user - The authenticated user
 * @param {object} [options] - Additional context
 * @param {string} [options.destinationId] - Current destination context
 * @param {Array}  [options.collaborators] - Collaborator list for user resolution boosting
 * @param {object} [options.thresholds] - Override confidence thresholds
 * @returns {Promise<{resolved: object, ambiguous: object, unresolved: Array<string>}>}
 */
async function resolveEntities(extractedNames, user, options = {}) {
  if (!extractedNames || typeof extractedNames !== 'object') {
    return { resolved: {}, ambiguous: {}, unresolved: [] };
  }

  const resolved = {};
  const ambiguous = {};
  const unresolved = [];

  // Collect resolution tasks
  const tasks = [];
  for (const [field, value] of Object.entries(extractedNames)) {
    if (!value || !FIELD_TYPE_MAP[field]) continue;

    const typeHint = FIELD_TYPE_MAP[field];
    const resolveOptions = { ...options };

    // Flag email fields
    if (field === 'user_email') {
      resolveOptions._isEmail = true;
    }

    tasks.push({ field, value, typeHint, resolveOptions });
  }

  // Run all resolutions in parallel
  const results = await Promise.all(
    tasks.map(async ({ field, value, typeHint, resolveOptions }) => {
      try {
        const result = await resolveEntity(value, typeHint, user, resolveOptions);
        return { field, value, result };
      } catch (err) {
        logger.error('[entity-resolver] Resolution failed for field', {
          field,
          value,
          error: err.message,
        });
        return { field, value, result: { candidates: [], confidence: ResolutionConfidence.LOW } };
      }
    })
  );

  // Classify results
  for (const { field, value, result } of results) {
    const { candidates, confidence } = result;

    if (confidence === ResolutionConfidence.HIGH && candidates.length > 0) {
      resolved[field] = candidates[0];
    } else if (confidence === ResolutionConfidence.MEDIUM && candidates.length > 0) {
      ambiguous[field] = candidates.slice(0, 3);
    } else {
      unresolved.push(field);
    }
  }

  logger.info('[entity-resolver] Batch resolution complete', {
    resolvedCount: Object.keys(resolved).length,
    ambiguousCount: Object.keys(ambiguous).length,
    unresolvedCount: unresolved.length,
    fields: tasks.map(t => t.field),
  });

  return { resolved, ambiguous, unresolved };
}

/**
 * Format resolution results as a text block for injection into the LLM system prompt.
 *
 * @param {object} resolutionResult - Output of resolveEntities()
 * @param {object} extractedNames - Original extracted names (for display)
 * @returns {string|null} - Formatted block or null if nothing to inject
 */
/**
 * Format resolved entities as a structured JSON array for LLM context injection.
 * Each resolved entity becomes { type, _id, name, detail? } — the LLM can reference
 * these in entity_refs in its response so the frontend renders rich cards.
 *
 * @param {object} resolutionResult - Output of resolveEntities()
 * @returns {Array<{ type: string, _id: string, name: string, detail?: string }>}
 */
function formatResolutionObjects(resolutionResult) {
  const { resolved } = resolutionResult;
  const objects = [];
  for (const entry of Object.values(resolved)) {
    const obj = { type: entry.type, _id: entry.id, name: entry.name };
    if (entry.detail) obj.detail = entry.detail;
    objects.push(obj);
  }
  return objects;
}

function formatResolutionBlock(resolutionResult, extractedNames) {
  const { resolved, ambiguous, unresolved } = resolutionResult;

  const hasContent =
    Object.keys(resolved).length > 0 ||
    Object.keys(ambiguous).length > 0 ||
    unresolved.length > 0;

  if (!hasContent) return null;

  const lines = ['[Entity Resolution]'];

  // Resolved entries
  for (const [field, entry] of Object.entries(resolved)) {
    const originalName = extractedNames[field] || field;
    const detail = entry.detail ? ` (${entry.detail})` : '';
    lines.push(
      `✓ "${originalName}" → ${entry.type}:${entry.id} (${entry.name}${detail}) [confidence: ${entry.score.toFixed(2)}]`
    );
  }

  // Ambiguous entries
  for (const [field, candidates] of Object.entries(ambiguous)) {
    const originalName = extractedNames[field] || field;
    lines.push(`? "${originalName}" → ambiguous, ${candidates.length} matches:`);
    candidates.forEach((c, i) => {
      const detail = c.detail ? ` ${c.detail}` : '';
      lines.push(`  ${i + 1}. ${c.type}:${c.id} "${c.name}"${detail} [${c.score.toFixed(2)}]`);
    });
  }

  // Unresolved entries
  for (const field of unresolved) {
    const originalName = extractedNames[field] || field;
    lines.push(`✗ "${originalName}" → unresolved, no matches`);
  }

  lines.push('');
  lines.push('Rules:');
  lines.push('- Use resolved IDs directly in action payloads (do not fabricate IDs).');
  lines.push('- For ambiguous matches: ask the user to pick, or use context clues to choose.');
  lines.push('- For unresolved names: ask the user to clarify, or propose creating a new entity.');

  return lines.join('\n');
}

module.exports = {
  resolveEntities,
  resolveEntity,
  formatResolutionBlock,
  formatResolutionObjects,
  ResolutionConfidence,
  DEFAULT_THRESHOLDS,
  FIELD_TYPE_MAP,
  // Exposed for testing
  _resolveUserByEmail: resolveUserByEmail,
  _resolveUserByName: resolveUserByName,
  _resolveDestination: resolveDestination,
  _resolveExperience: resolveExperience,
  _resolvePlan: resolvePlan,
};
