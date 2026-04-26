/**
 * BienBot Discovery Pipeline
 *
 * Collaborative-filtering and popularity-based experience discovery for BienBot.
 * Extracted from bienbot-context-builders.js — no logic changes, mechanical move only.
 *
 * Exports constants, ranking helpers, and the main discovery functions used by
 * BienBot to surface relevant experiences to users.
 *
 * @module utilities/bienbot-discovery
 */

const { Types } = require('mongoose');
const logger = require('./backend-logger');
const { validateObjectId } = require('./controller-helpers');
const {
  applySignalDecay,
  signalsToNaturalLanguage,
  computePopularityScore,
  computeAffinityScore,
  processSignalEvent,
  DIMENSIONS,
  NEUTRAL
} = require('./hidden-signals');
const signalsConfig = require('./signals-config');
const affinityCache = require('./affinity-cache');
const { getCacheKey, createDiscoveryCache } = require('./discovery-cache');

// Token budget helpers (local copies — avoids circular dep with context-builders)
const CHARS_PER_TOKEN = 4;
const DEFAULT_TOKEN_BUDGET = 1500;

function trimToTokenBudget(text, tokenBudget = DEFAULT_TOKEN_BUDGET) {
  const maxChars = tokenBudget * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}

// Lazy-loaded models (resolved on first use — avoids requiring mongoose models
// at import time, which matters for test isolation and tree-shaking).
let Experience, Plan, Destination, Photo;
function loadModels() {
  if (!Experience) {
    Experience = require('../models/experience');
    Plan = require('../models/plan');
    Destination = require('../models/destination');
    Photo = require('../models/photo');
  }
}

/**
 * Resolve filters.destination_name to a destination ObjectId via a single
 * case-insensitive lookup on the (small) destinations collection, so the
 * downstream Plans aggregation can use an indexed $match on exp.destination
 * instead of an anchorless regex $lookup against destinations.
 *
 * If filters already carries destination_id, that wins. Otherwise we do one
 * Destination lookup; if it misses, callers fall back to the (still-safe)
 * regex $lookup path so name substring matches keep working.
 *
 * Returns null when nothing resolves or resolution is not needed.
 *
 * Note on indexes: the `name` index on Destination (see models/destination.js)
 * is declared without a collation, so this collation query scans destinations
 * rather than using the index. That is still a net win vs. the previous
 * anchorless regex inside the Plans aggregation (small collection, one-time
 * per discovery call). If destination count grows, add a matching-collation
 * index to make this lookup index-backed.
 *
 * @param {Object} filters
 * @returns {Promise<import('mongoose').Types.ObjectId|null>}
 */
async function resolveFilterDestinationId(filters) {
  if (filters.destination_id) {
    try {
      return new Types.ObjectId(String(filters.destination_id));
    } catch {
      return null;
    }
  }
  if (!filters.destination_name) return null;
  loadModels();
  try {
    // strength 2 = case + diacritic insensitive
    const dest = await Destination
      .findOne({ name: filters.destination_name })
      .collation({ locale: 'en', strength: 2 })
      .select('_id')
      .lean();
    return dest ? dest._id : null;
  } catch (err) {
    logger.debug('[bienbot-context] resolveFilterDestinationId failed', { error: err.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Discovery helpers
// ---------------------------------------------------------------------------

/**
 * Maps semantic category keywords to plan item activity_type values.
 * 14 categories including the original 5 plus 9 new ones.
 */
const SEMANTIC_ACTIVITY_MAP = {
  // Existing
  culinary:          ['food', 'drinks', 'coffee', 'market', 'local'],
  adventure:         ['adventure', 'nature', 'sports', 'tour'],
  cultural:          ['museum', 'sightseeing', 'religious', 'local'],
  wellness:          ['wellness', 'health', 'rest'],
  nightlife:         ['nightlife', 'drinks', 'entertainment'],
  // New
  'family-friendly': ['sightseeing', 'nature', 'entertainment', 'class', 'tour'],
  budget:            ['food', 'local', 'nature', 'sightseeing'],
  romantic:          ['food', 'drinks', 'wellness', 'sightseeing', 'entertainment'],
  solo:              ['museum', 'nature', 'coffee', 'adventure', 'photography'],
  photography:       ['photography', 'sightseeing', 'nature', 'museum'],
  historical:        ['museum', 'sightseeing', 'religious', 'tour'],
  beach:             ['nature', 'sports', 'wellness', 'rest', 'adventure'],
  mountain:          ['nature', 'adventure', 'sports', 'tour', 'photography'],
  urban:             ['sightseeing', 'food', 'nightlife', 'shopping', 'entertainment']
};

// ---------------------------------------------------------------------------
// Ranking helper constants
// ---------------------------------------------------------------------------

const DEFAULT_DISCOVERY_WEIGHTS = {
  plan_count:      0.30,
  completion_rate: 0.25,
  recency:         0.20,
  collaborators:   0.10,
  cost_alignment:  0.15
};

const WEIGHT_FLOOR = 0.05;
const WEIGHT_SWAP_DELTA = 0.10; // Symmetric +delta/-delta applied per dimension in computeAdaptiveWeights
const SIGNAL_THRESHOLD = 0.7;
const MIN_CONFIDENCE = 0.2;
const RECENCY_HALF_LIFE_DAYS = 174; // e^(-ln2 * 90/174) ≈ 0.70 at 90 days, per spec

// Aggregation limits: keep separate so it's clear why each cap exists.
const MAX_SIMILAR_USERS = 50;           // Stage-1 pool: top-K users with matching activity types
const MAX_CANDIDATES_PER_STAGE = 20;    // Stage-2 + popularity: raw candidates per aggregation
const DEFAULT_DISCOVERY_LIMIT = 8;      // Scored results returned to caller
const SIMILAR_EXPERIENCES_LIMIT = 5;    // buildSimilarExperiencesContext post-plan suggestions

// Max delta between user and entity on a dimension to count as "top aligned".
// Mirrors the threshold used by computeAndCacheAffinity in hidden-signals.js.
const AFFINITY_TOP_DIM_DELTA = 0.3;
const AFFINITY_TOP_DIM_LIMIT = 3;

/**
 * Given an array of aggregated candidate rows that each carry a `photos` array
 * ([{ photo: ObjectId, default: Boolean }]), resolve the default-photo URL for
 * each row in one batch query. Mutates each row's `default_photo_url` field in
 * place to the resolved URL (or null).
 *
 * Replaces an in-pipeline nested $lookup + $let + $arrayElemAt + $filter,
 * which is the most expensive aggregation lookup pattern MongoDB supports.
 *
 * @param {Array<Object>} rows - Aggregation rows; each has a `photos` array.
 * @returns {Promise<void>}
 */
async function hydrateDefaultPhotoUrls(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const photoIds = [];
  const rowPhotoId = new Map(); // row -> photoId to resolve
  for (const row of rows) {
    const photos = row.photos;
    if (!Array.isArray(photos) || photos.length === 0) continue;
    const defaultEntry = photos.find(p => p?.default) || photos[0];
    const photoId = defaultEntry?.photo;
    if (!photoId) continue;
    rowPhotoId.set(row, photoId);
    photoIds.push(photoId);
  }

  if (photoIds.length === 0) return;

  // One round-trip for all rows. $in is index-backed on _id.
  loadModels();
  const photos = await Photo.find({ _id: { $in: photoIds } }).select('url').lean();
  const urlById = new Map(photos.map(p => [p._id.toString(), p.url]));

  for (const row of rows) {
    const photoId = rowPhotoId.get(row);
    row.default_photo_url = photoId ? (urlById.get(photoId.toString()) || null) : null;
  }
}

/**
 * Build an affinity cache entry from pre-decayed user + entity signal vectors.
 * Mirrors the output shape of hidden-signals.computeAndCacheAffinity so batch
 * writes and single writes produce identical stored entries.
 *
 * @param {string|ObjectId} experienceId
 * @param {Object} decayedUser
 * @param {Object} decayedEntity
 * @returns {Object}
 */
function buildAffinityEntry(experienceId, decayedUser, decayedEntity) {
  const score = computeAffinityScore(decayedUser, decayedEntity);
  const dimEntries = DIMENSIONS.map((dim) => {
    const userVal   = typeof decayedUser[dim]   === 'number' ? decayedUser[dim]   : NEUTRAL;
    const entityVal = typeof decayedEntity[dim] === 'number' ? decayedEntity[dim] : NEUTRAL;
    const delta     = Math.abs(userVal - entityVal);
    return { dim, user_val: userVal, entity_val: entityVal, delta };
  });
  const top_dims = dimEntries
    .filter(d => d.delta < AFFINITY_TOP_DIM_DELTA)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, AFFINITY_TOP_DIM_LIMIT);
  return {
    experience_id: experienceId,
    score,
    top_dims,
    computed_at: new Date()
  };
}

// Match-reason phrase tables hoisted to module scope — previously re-allocated per candidate.
const CATEGORY_PHRASES = {
  culinary: 'culinary travelers',
  adventure: 'adventure seekers',
  cultural: 'culture enthusiasts',
  wellness: 'wellness travelers',
  nightlife: 'nightlife enthusiasts',
  'family-friendly': 'families',
  budget: 'budget travelers',
  romantic: 'couples',
  solo: 'solo travelers',
  photography: 'photographers',
  historical: 'history buffs',
  beach: 'beach lovers',
  mountain: 'mountain explorers',
  urban: 'city explorers'
};

const MATCH_REASON_TEMPLATES = {
  plan_count:      (c) => `Planned by ${c.co_occurrence_count} similar travelers`,
  completion_rate: (c) => `${Math.round((c.avg_completion_rate || 0) * 100)}% plan completion rate`,
  recency:         () => 'Recently trending among travelers',
  collaborators:   (c) => `Popular group activity - ${c.collaborator_count} collaborators`,
  cost_alignment:  () => 'Good budget fit for your travel style'
};

// ---------------------------------------------------------------------------
// Ranking helpers
// ---------------------------------------------------------------------------

/**
 * Expand semantic categories (e.g., 'culinary') to concrete activity types.
 * Unknown types pass through as-is for direct activity_type matching.
 * @param {string[]} categories
 * @returns {string[]}
 */
function expandActivityTypes(categories) {
  if (!categories || !categories.length) return [];
  const types = new Set();
  for (const cat of categories) {
    if (SEMANTIC_ACTIVITY_MAP[cat]) {
      SEMANTIC_ACTIVITY_MAP[cat].forEach(t => types.add(t));
    } else {
      types.add(cat); // pass through as raw activity_type
    }
  }
  return [...types];
}

/**
 * Compute signal-adaptive ranking weights based on user's hidden signals.
 * Returns DEFAULT_DISCOVERY_WEIGHTS if signals are absent or low-confidence.
 * Symmetric +0.10/-0.10 swaps per dimension. Enforces 0.05 floor. Re-normalizes to 1.0.
 * @param {Object|null} signals
 * @returns {Object}
 */
function computeAdaptiveWeights(signals) {
  const weights = { ...DEFAULT_DISCOVERY_WEIGHTS };

  if (!signals || (signals.confidence || 0) < MIN_CONFIDENCE) return weights;

  // Symmetric swaps: strong signal on dimension X boosts one weight and
  // decrements another by WEIGHT_SWAP_DELTA so the sum is preserved pre-floor.
  if ((signals.budget_sensitivity || 0) > SIGNAL_THRESHOLD) {
    weights.cost_alignment += WEIGHT_SWAP_DELTA;
    weights.plan_count     -= WEIGHT_SWAP_DELTA;
  }
  if ((signals.social || 0) > SIGNAL_THRESHOLD) {
    weights.collaborators  += WEIGHT_SWAP_DELTA;
    weights.recency        -= WEIGHT_SWAP_DELTA;
  }
  if ((signals.structure || 0) > SIGNAL_THRESHOLD) {
    weights.completion_rate += WEIGHT_SWAP_DELTA;
    weights.plan_count      -= WEIGHT_SWAP_DELTA;
  }
  if ((signals.novelty || 0) > SIGNAL_THRESHOLD) {
    weights.recency         += WEIGHT_SWAP_DELTA;
    weights.completion_rate -= WEIGHT_SWAP_DELTA;
  }

  // Enforce minimum floor
  Object.keys(weights).forEach(k => {
    weights[k] = Math.max(weights[k], WEIGHT_FLOOR);
  });

  // Re-normalize to sum to 1.0
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  Object.keys(weights).forEach(k => { weights[k] /= sum; });

  return weights;
}

/**
 * Map a cost value to its percentile within a candidate set.
 * Returns 0.0 (cheapest) to 1.0 (most expensive). Neutral 0.5 for edge cases.
 *
 * Accepts either a raw or a pre-sorted candidate-cost array. If the array is
 * not pre-sorted, this call sorts a copy. Callers that invoke this in a hot
 * loop (once per candidate) should sort once and pass the sorted array to
 * avoid O(n^2 log n) behavior.
 *
 * @param {number} cost
 * @param {number[]} allCandidateCosts - Raw or pre-sorted ascending.
 * @param {boolean} [isSorted=false] - True if the input is already ascending.
 * @returns {number}
 */
function normalizeCostToPercentile(cost, allCandidateCosts, isSorted = false) {
  if (!allCandidateCosts || allCandidateCosts.length <= 1) return 0.5;
  const sorted = isSorted ? allCandidateCosts : [...allCandidateCosts].sort((a, b) => a - b);

  // Binary search for the first index where sorted[i] >= cost.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] >= cost) hi = mid;
    else lo = mid + 1;
  }
  return lo === sorted.length ? 1.0 : lo / (sorted.length - 1);
}

/**
 * Compute cost alignment between an experience cost and user's budget sensitivity.
 * 1.0 = perfect fit, 0.0 = worst mismatch, 0.5 = neutral.
 * @param {number|null} experienceCost
 * @param {Object|null} signals
 * @param {number[]} allCandidateCosts - Raw or pre-sorted ascending.
 * @param {boolean} [isSorted=false] - True if the input is already ascending.
 * @returns {number}
 */
function computeCostAlignment(experienceCost, signals, allCandidateCosts, isSorted = false) {
  if (!experienceCost || !signals) return 0.5;
  const userBudgetLevel = 1 - (signals.budget_sensitivity || 0.5);
  const costPercentile = normalizeCostToPercentile(experienceCost, allCandidateCosts || [], isSorted);
  return 1 - Math.abs(userBudgetLevel - costPercentile);
}

/**
 * Exponential decay recency score.
 * ~1.0 for today, ~0.7 for 90 days, ~0.3 for 180+ days.
 * Uses ln(2)/RECENCY_HALF_LIFE_DAYS as decay constant.
 * @param {Date|null} date
 * @returns {number}
 */
function computeRecencyScore(date) {
  if (!date) return 0;
  const daysSince = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
  // Future-dated activity (planned upcoming trip) is treated as maximally "recent".
  // This is intentional: planned_date is the trip date, not the creation date.
  if (daysSince < 0) return 1;
  return Math.exp(-Math.LN2 * daysSince / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Normalize a count value to [0, 1] using the max in the candidate set.
 * @param {number} value
 * @param {number} maxValue
 * @returns {number}
 */
function normalizeCount(value, maxValue) {
  if (!maxValue || maxValue === 0) return 0;
  return Math.min(value / maxValue, 1);
}

/**
 * Generate a human-readable match_reason from the dominant ranking signal.
 * Finds the dominant signal (highest weighted contribution) and fills a template.
 * Prepends a category phrase when categories are provided.
 * @param {Object} candidate
 * @param {Object} weights
 * @param {string[]} categories
 * @returns {string}
 */
function generateMatchReason(candidate, weights, categories) {
  // Find dominant signal (highest weighted contribution)
  const contributions = {
    plan_count:      (weights.plan_count || 0) * (candidate.co_occurrence_count ? 1 : 0),
    completion_rate: (weights.completion_rate || 0) * (candidate.avg_completion_rate || 0),
    recency:         (weights.recency || 0) * (candidate.recency_score || 0),
    collaborators:   (weights.collaborators || 0) * (candidate.collaborator_count ? 1 : 0),
    cost_alignment:  (weights.cost_alignment || 0) * 0.5 // neutral default
  };

  const dominant = Object.entries(contributions)
    .sort(([, a], [, b]) => b - a)[0][0];

  const catPhrase = (categories || [])
    .map(c => CATEGORY_PHRASES[c] || c)
    .filter(Boolean)[0];

  const signalPhrase = MATCH_REASON_TEMPLATES[dominant](candidate);
  return catPhrase
    ? `Popular among ${catPhrase} - ${signalPhrase}`
    : signalPhrase;
}

/**
 * Map dimension names to qualitative natural-language driver descriptions.
 * Each entry describes what a strong alignment on that dimension means for the
 * user ↔ entity relationship. Used by both the [AFFINITY] block and discovery
 * results so the LLM can compose coherent dialogue without numeric terms.
 */
const DIM_DRIVER_DESCRIPTIONS = {
  energy:             'shared preference for activity level',
  novelty:            'mutual interest in novel, off-the-beaten-path experiences',
  budget_sensitivity: 'aligned budget expectations',
  social:             'similar social orientation for group or solo travel',
  structure:          'compatible need for planning and structure',
  food_focus:         'shared interest in food and culinary experiences',
  cultural_depth:     'mutual appreciation for cultural depth and local immersion',
  comfort_zone:       'similar comfort zone and willingness to try new things'
};

/**
 * Convert an array of top_dims entries (or bare dimension names) into a
 * comma-separated list of human-readable driver descriptions.
 *
 * @param {Array<{dim: string}|string>} dims - top_dims entries or dimension name strings.
 * @returns {string} Comma-separated qualitative descriptions, or '' if empty.
 */
function describeDimDrivers(dims) {
  if (!Array.isArray(dims) || dims.length === 0) return '';
  return dims
    .map(d => {
      const name = typeof d === 'string' ? d : d?.dim;
      return DIM_DRIVER_DESCRIPTIONS[name] || name;
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Build a discovery context block for cross-dimensional queries.
 *
 * Uses collaborative filtering to discover experiences planned by similar users.
 * Two-stage pipeline: find similar users → find co-occurring experiences → rank.
 *
 * @param {Object} filters - { activity_types, destination_id, destination_name, max_cost, cross_destination, min_plans }
 * @param {string} userId - Querying user's ID
 * @param {Object} [options] - { limit }
 * @returns {Promise<Object|null>} { contextBlock, results, query_metadata } or null if no results
 */
async function buildDiscoveryContext(filters = {}, userId, options = {}) {
  const UserModel = require('../models/user');
  const ExperienceModel = require('../models/experience');

  const limit = options.limit || DEFAULT_DISCOVERY_LIMIT;
  const cacheKey = getCacheKey(filters);
  const cache = createDiscoveryCache();

  try {
    // User signals fetch does not depend on candidates — kick it off immediately
    // so it runs in parallel with cache.get + candidate discovery. `.catch` here
    // neutralises rejections so the promise is safe to await later without
    // producing an unhandled-rejection warning on the early-bail paths.
    const userSignalsPromise = userId
      ? UserModel.findById(userId).select('hidden_signals').lean()
          .then(u => (u?.hidden_signals ? applySignalDecay(u.hidden_signals) : null))
          .catch(err => {
            logger.warn('[bienbot-context] Failed to fetch user signals for ranking', { userId, error: err.message });
            return null;
          })
      : Promise.resolve(null);

    // Check cache
    let candidates = await cache.get(cacheKey);
    let cacheHit = !!candidates;

    if (!candidates) {
      // Stage 1: Find similar users (requires activity_types)
      const similarUsers = await findSimilarUsers(filters, userId);

      if (similarUsers.length > 0) {
        // Stage 2: Find co-occurring experiences
        candidates = await findCoOccurringExperiences(similarUsers, filters, userId);
        if (candidates.length > 0) {
          logger.debug('[bienbot-context] Collaborative filtering produced candidates', { count: candidates.length });
        } else {
          logger.debug('[bienbot-context] No co-occurring experiences found, falling back to popularity', { filters, userId });
        }
      } else {
        logger.debug('[bienbot-context] No similar users found, falling back to popularity', { filters, userId });
      }

      // Fallback: popularity-based discovery when collaborative filtering yields nothing
      // (happens when activity_types are omitted or data is sparse)
      if (!candidates || !candidates.length) {
        candidates = await findPopularExperiences(filters, userId);
        // Graceful degradation: findPopularExperiences applies the activity_type
        // filter so relevant intent isn't drowned by unrelated popularity. But if
        // the caller supplied types that don't match anything in the catalogue,
        // we'd otherwise return empty — breaking the "fallback always finds
        // something" contract. Retry once without activity_types in that case.
        if (!candidates.length && filters.activity_types?.length) {
          candidates = await findPopularExperiences(
            { ...filters, activity_types: [] },
            userId
          );
        }
      }

      if (!candidates.length) {
        logger.debug('[bienbot-context] No experiences found for filters', { filters, userId });
        // Drain the in-flight user signals promise so it cannot log as unhandled.
        await userSignalsPromise;
        return null;
      }

      await cache.set(cacheKey, candidates);
    }

    // Pre-sort candidate costs once — consumed via binary search per candidate in
    // computeCostAlignment. Previously this was sorted inside the per-candidate
    // loop (O(n^2 log n)).
    const allCostsSorted = candidates.map(c => c.cost_estimate).filter(Boolean).sort((a, b) => a - b);
    const maxCoOccurrence = candidates.reduce((m, c) => Math.max(m, c.co_occurrence_count || 0), 1);
    const maxCollaborators = candidates.reduce((m, c) => Math.max(m, c.collaborator_count || 0), 1);
    const candidateIds = candidates.map(c => c.experience_id).filter(Boolean);

    // Three independent reads — user signals (already in-flight), stored content
    // signals (keyed by candidate IDs), and the affinity map (keyed by userId).
    // Run them concurrently; each has its own failure handler that degrades to a
    // neutral default so one slow/failing read does not block the others.
    const storedSignalsPromise = ExperienceModel
      .find({ _id: { $in: candidateIds } })
      .select('signals hidden_signals')
      .lean()
      .catch(err => {
        logger.warn('[bienbot-context] Failed to load stored content signals; falling back to neutral', { error: err.message });
        return [];
      });

    const affinityMapPromise = userId
      ? affinityCache.getAffinityMap(userId).catch(affinityErr => {
          logger.warn('[bienbot-context] Failed to load affinity map for discovery ranking', { userId, error: affinityErr.message });
          return new Map();
        })
      : Promise.resolve(new Map());

    const [signals, storedSignalDocs, affinityMap] = await Promise.all([
      userSignalsPromise,
      storedSignalsPromise,
      affinityMapPromise
    ]);

    // Compute adaptive weights (personalized by user behavioral signals)
    const weights = computeAdaptiveWeights(signals);

    const experienceSignalsMap = new Map();
    for (const doc of storedSignalDocs) {
      if (doc._id) experienceSignalsMap.set(doc._id.toString(), {
        signals: doc.signals || null,
        hidden_signals: doc.hidden_signals || null
      });
    }

    // Compute per-candidate-set maximums for popularity normalisation in a
    // single pass. Floor at 1 so the ratio in computePopularityScore never
    // divides by zero. Makes popularity relative to the destination context
    // rather than a global absolute.
    const maxPopularity = { planCount: 1, planCountWithActivity: 1, completedPlanCount: 1 };
    for (const entry of experienceSignalsMap.values()) {
      const p = entry?.signals?.popularity;
      if (!p) continue;
      if (p.planCount > maxPopularity.planCount) maxPopularity.planCount = p.planCount;
      if (p.planCountWithActivity > maxPopularity.planCountWithActivity) maxPopularity.planCountWithActivity = p.planCountWithActivity;
      if (p.completedPlanCount > maxPopularity.completedPlanCount) maxPopularity.completedPlanCount = p.completedPlanCount;
    }

    const formula = signalsConfig.formula;

    // affinityMap is already loaded above via Promise.all (empty Map on failure).
    // Cache misses collected during scoring, flushed in one round-trip after.
    const affinityMisses = [];

    // Score and rank
    const scored = candidates.map(c => {
      const recencyScore = computeRecencyScore(c.latest_planned_date);

      // Adaptive score: existing multi-factor formula personalized by user behavioral signals.
      // Weights are re-normalized internally by computeAdaptiveWeights.
      const adaptiveScore =
        weights.plan_count      * normalizeCount(c.co_occurrence_count, maxCoOccurrence) +
        weights.completion_rate * (c.avg_completion_rate || 0) +
        weights.recency         * recencyScore +
        weights.collaborators   * normalizeCount(c.collaborator_count, maxCollaborators) +
        weights.cost_alignment  * computeCostAlignment(c.cost_estimate, signals, allCostsSorted, true);

      // Stored content signals — neutral defaults for experiences not yet computed.
      // trustScore null → 0.5 (unknown, not penalised); popularity absent → 0.
      const storedEntry    = experienceSignalsMap.get(c.experience_id.toString());
      const storedSignals  = storedEntry?.signals   || null;
      const entityBehavior = storedEntry?.hidden_signals || null;
      const trustScore     = storedSignals?.trustScore ?? 0.5;
      const popularityNorm = computePopularityScore(
        storedSignals?.popularity || {},
        maxPopularity
      );

      // Affinity: use pre-loaded cache entry when available; fall back to live
      // computation for cold-cache candidates (avoids per-candidate DB round-trips).
      // Cache misses are collected into affinityMisses and flushed as a single
      // batch write after the scoring loop completes (see below) so we do not
      // fan out N async writes — one per candidate — for every cold request.
      const cachedAffinity = affinityMap.get(c.experience_id.toString());
      let affinityScore;
      let affinityDrivers = '';
      if (cachedAffinity) {
        affinityScore = cachedAffinity.score;
        if (cachedAffinity.top_dims?.length) {
          affinityDrivers = describeDimDrivers(cachedAffinity.top_dims);
        }
      } else {
        // Live score uses the signals we already have, matching historical
        // behavior. The batch-written cache entry applies decay to the entity
        // signals to match computeAndCacheAffinity's canonical shape — so a
        // subsequent read sees the same score that hidden-signals would cache.
        affinityScore = computeAffinityScore(signals, entityBehavior);
        if (userId && entityBehavior) {
          affinityMisses.push({
            experienceId: c.experience_id,
            decayedEntity: applySignalDecay(entityBehavior)
          });
        }
      }

      // Blended formula: formula coefficients from signalsConfig (SIGNALS_CONFIG env var).
      // recencyBoost is always computed fresh — not stored — so it stays accurate between
      // signal update events.
      const relevanceScore =
        formula.adaptiveFactor * adaptiveScore   +
        formula.trustScore     * trustScore      +
        formula.popularity     * popularityNorm  +
        formula.recencyBoost   * recencyScore    +
        formula.affinity       * affinityScore;

      const matchReason = generateMatchReason(
        { ...c, recency_score: recencyScore },
        weights,
        filters.activity_types
      );

      return {
        experience_id: c.experience_id.toString(),
        experience_name: c.experience_name,
        destination_name: c.destination_name,
        destination_id: c.destination_id?.toString(),
        activity_types: c.activity_types || [],
        cost_estimate: c.cost_estimate,
        plan_count: c.co_occurrence_count,
        completion_rate: c.avg_completion_rate,
        collaborator_count: c.collaborator_count,
        trust_score: Math.round(trustScore * 1000) / 1000,
        popularity_score: Math.round(popularityNorm * 1000) / 1000,
        affinity_score: Math.round(affinityScore * 1000) / 1000,
        affinity_drivers: affinityDrivers,
        relevance_score: Math.round(relevanceScore * 1000) / 1000,
        match_reason: matchReason,
        default_photo_url: c.default_photo_url
      };
    });

    scored.sort((a, b) => b.relevance_score - a.relevance_score);
    const results = scored.slice(0, limit);

    if (!results.length) return null;

    // Flush affinity cache misses in one batch update (fire-and-forget).
    // Replaces the previous per-candidate computeAndCacheAffinity fan-out.
    if (userId && affinityMisses.length) {
      const decayedUser = signals || applySignalDecay({});
      const entries = affinityMisses.map(m =>
        buildAffinityEntry(m.experienceId, decayedUser, m.decayedEntity)
      );
      affinityCache.setAffinityEntries(userId, entries).catch(err => {
        logger.debug('[bienbot-context] affinity batch write failed', { error: err.message });
      });
    }

    const contextBlock = formatDiscoveryContextBlock(results, filters);

    // Signal feedback (fire-and-forget). Swallowing is intentional — signal
    // ingest failing should not break discovery — but we at least log at debug
    // level so a systemic signal outage is observable in structured logs.
    try {
      const expandedTypes = expandActivityTypes(filters.activity_types);
      const maybePromise = processSignalEvent(userId, {
        type: 'search',
        metadata: {
          source: 'discovery',
          activity_type: expandedTypes[0] || null,
          all_activity_types: expandedTypes,
          result_count: results.length
        }
      });
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(e => {
          logger.debug('[bienbot-context] signal feedback failed (async)', { error: e.message });
        });
      }
    } catch (e) {
      logger.debug('[bienbot-context] signal feedback failed (sync)', { error: e.message });
    }

    logger.info('[bienbot-context] buildDiscoveryContext completed', {
      userId,
      resultCount: results.length,
      cacheHit,
      crossDestination: !!(filters.cross_destination || (!filters.destination_id && !filters.destination_name))
    });

    return {
      contextBlock,
      results,
      query_metadata: {
        filters_applied: filters,
        cache_hit: cacheHit,
        result_count: results.length,
        cross_destination: !!(filters.cross_destination || (!filters.destination_id && !filters.destination_name))
      }
    };
  } catch (err) {
    logger.error('[bienbot-context] buildDiscoveryContext failed', { error: err.message, stack: err.stack }, err);
    return null;
  }
}

/**
 * Format discovery results into a text context block for the LLM.
 */
function formatDiscoveryContextBlock(results, filters) {
  const header = filters.activity_types?.length
    ? `Discovery results for ${filters.activity_types.join(', ')} experiences`
    : 'Discovery results';

  // Qualitative popularity labels — avoid exposing raw counts to the LLM
  const popularityLabel = (planCount) => {
    if (!planCount || planCount <= 0) return 'new';
    if (planCount <= 2) return 'emerging';
    if (planCount <= 10) return 'popular';
    return 'very popular';
  };

  const completionLabel = (rate) => {
    if (rate == null || rate <= 0) return null;
    if (rate >= 0.8) return 'very high completion';
    if (rate >= 0.5) return 'solid completion';
    if (rate >= 0.2) return 'moderate completion';
    return null;
  };

  const affinityLabel = (score) => {
    if (score == null) return null;
    if (score > 0.6) return 'strong match for your travel style';
    if (score >= 0.4) return 'moderate match for your travel style';
    return 'different from your usual travel style';
  };

  const lines = results.map((r, i) => {
    const parts = [
      `${i + 1}. ${r.experience_name} (${r.destination_name})`,
      popularityLabel(r.plan_count) + ' among travelers'
    ];
    const compLabel = completionLabel(r.completion_rate);
    if (compLabel) parts.push(compLabel);
    const affLabel = affinityLabel(r.affinity_score);
    if (affLabel) parts.push(affLabel);
    if (r.affinity_drivers) parts.push(`driven by ${r.affinity_drivers}`);
    parts.push(r.match_reason);
    return parts.join(' — ');
  });

  return `[DISCOVERY RESULTS]\n${header}:\n${lines.join('\n')}\n[/DISCOVERY RESULTS]`;
}

/**
 * Build context of similar experiences in the same destination.
 * Used for post-plan onboarding to suggest related content.
 *
 * @param {string} experienceId - Current experience ID
 * @param {string} destinationId - Destination ID
 * @param {string} userId
 * @param {object} [options]
 * @returns {Promise<string|null>}
 */
async function buildSimilarExperiencesContext(experienceId, destinationId, userId, options = {}) {
  loadModels();

  try {
    if (!destinationId) return null;

    const { valid: destValid, objectId: destOid } = validateObjectId(String(destinationId), 'destinationId');
    const { valid: expValid, objectId: expOid } = validateObjectId(String(experienceId), 'experienceId');
    if (!destValid || !expValid) return null;

    // Find other public experiences in the same destination, sorted by plan count
    const pipeline = [
      { $match: {
        destination: destOid,
        _id: { $ne: expOid },
        visibility: { $ne: 'private' }
      }},
      { $lookup: {
        from: 'plans',
        localField: '_id',
        foreignField: 'experience',
        as: 'plans'
      }},
      { $addFields: { plan_count: { $size: '$plans' } } },
      { $sort: { plan_count: -1 } },
      { $limit: SIMILAR_EXPERIENCES_LIMIT },
      { $project: { name: 1, overview: 1, plan_count: 1, experience_type: 1 } }
    ];

    const results = await Experience.aggregate(pipeline);
    if (results.length === 0) return null;

    const lines = ['[SIMILAR EXPERIENCES]'];
    for (const r of results) {
      const types = r.experience_type?.join(', ') || '';
      lines.push(`- ${r.name} (${r.plan_count} plan${r.plan_count !== 1 ? 's' : ''})${types ? ` [${types}]` : ''}`);
    }
    lines.push('[/SIMILAR EXPERIENCES]');

    return trimToTokenBudget(lines.join('\n'), options.tokenBudget || 800);
  } catch (err) {
    logger.error('[bienbot-context] buildSimilarExperiencesContext failed', { error: err.message, stack: err.stack }, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared aggregation stage builders
// ---------------------------------------------------------------------------
// Both findCoOccurringExperiences and findPopularExperiences build the same
// core pipeline: lookup experience → filter visibility → compute cost +
// completion fields → group by experience → lookup destination → sort + limit.
// The builders below factor that shell out so each function only has to
// declare the parts that genuinely differ (the initial $match and a couple of
// group fields).

/**
 * Experience lookup + unwind + visibility filter.
 * Produces `$exp` on each doc and drops private experiences.
 * @returns {Array<Object>}
 */
function buildExperienceLookupStages() {
  return [
    { $lookup: {
      from: 'experiences',
      localField: 'experience',
      foreignField: '_id',
      as: 'exp'
    }},
    { $unwind: '$exp' },
    { $match: { 'exp.visibility': { $ne: 'private' } } }
  ];
}

/**
 * Destination filter stages. Resolves `filters.destination_name` to an
 * ObjectId when possible so we can use an indexed $match on `exp.destination`;
 * falls back to the old name-regex $lookup when resolution misses to preserve
 * substring-match behavior.
 *
 * @param {Object} filters - Discovery filters
 * @param {string} [regexLookupAs='dest_filter'] - $lookup output field when falling back to regex.
 *   Pass a distinct name when the caller appends another `$lookup as: 'dest'` later.
 * @returns {Promise<Array<Object>>}
 */
async function buildDestinationFilterStages(filters, regexLookupAs = 'dest_filter') {
  const shouldFilter = !filters.cross_destination &&
    (filters.destination_id || filters.destination_name);
  if (!shouldFilter) return [];

  const destId = await resolveFilterDestinationId(filters);
  if (destId) return [{ $match: { 'exp.destination': destId } }];

  if (filters.destination_name) {
    const nameRegex = new RegExp(
      filters.destination_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    );
    return [
      { $lookup: { from: 'destinations', localField: 'exp.destination', foreignField: '_id', as: regexLookupAs } },
      { $unwind: `$${regexLookupAs}` },
      { $match: { [`${regexLookupAs}.name`]: nameRegex } }
    ];
  }
  return [];
}

/**
 * Compute `_planCost`, `_completedCount`, `_totalCount`, `_completionRate` fields
 * on each plan. Optionally captures user-type permissions as `_userCollaborators`
 * so a downstream $group can count unique collaborators.
 *
 * @param {Object} [options]
 * @param {boolean} [options.withCollaborators=false]
 * @returns {Array<Object>}
 */
function buildCostAndCompletionStages(options = {}) {
  const addFields = {
    _planCost: { $reduce: {
      input: '$plan',
      initialValue: 0,
      in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
    }},
    _completedCount: { $size: { $filter: {
      input: '$plan',
      cond: { $eq: ['$$this.complete', true] }
    }}},
    _totalCount: { $size: '$plan' }
  };
  if (options.withCollaborators) {
    addFields._userCollaborators = { $filter: {
      input: '$permissions',
      cond: { $eq: ['$$this.entity', 'user'] }
    }};
  }
  return [
    { $addFields: addFields },
    { $addFields: {
      _completionRate: { $cond: {
        if: { $gt: ['$_totalCount', 0] },
        then: { $divide: ['$_completedCount', '$_totalCount'] },
        else: 0
      }}
    }}
  ];
}

/**
 * Pre-group cost-filter stages. Writes `_planCostFilter` and matches it against
 * `filters.max_cost`. Split out from buildCostAndCompletionStages so max_cost
 * can filter plans *before* expensive fields + grouping run.
 *
 * @param {number} maxCost
 * @returns {Array<Object>}
 */
function buildPlanCostFilterStages(maxCost) {
  return [
    { $addFields: {
      _planCostFilter: { $reduce: {
        input: '$plan',
        initialValue: 0,
        in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
      }}
    }},
    { $match: { _planCostFilter: { $lte: maxCost } } }
  ];
}

/**
 * $group stage that aggregates per-experience candidate metrics. Options toggle
 * the optional `collaborator_ids` and `plan_item_types` fields specific to
 * co-occurrence ranking.
 *
 * @param {Object} [options]
 * @param {boolean} [options.withCollaborators=false]
 * @param {boolean} [options.withPlanItemTypes=false]
 * @returns {Object}
 */
function buildExperienceGroupStage(options = {}) {
  const group = {
    _id: '$experience',
    co_occurrence_count: { $sum: 1 },
    avg_completion_rate: { $avg: '$_completionRate' },
    latest_planned_date: { $max: '$planned_date' },
    avg_cost: { $avg: '$_planCost' },
    experience_name: { $first: '$exp.name' },
    destination_id: { $first: '$exp.destination' },
    activity_types: { $first: '$exp.experience_type' },
    photos: { $first: '$exp.photos' }
  };
  if (options.withCollaborators) {
    group.collaborator_ids = { $addToSet: '$_userCollaborators._id' };
  }
  if (options.withPlanItemTypes) {
    group.plan_item_types = { $first: '$exp.plan_items.activity_type' };
  }
  return { $group: group };
}

/**
 * Destination lookup + sort + limit stages. Uses `preserveNullAndEmptyArrays`
 * so experiences with missing destinations still appear. Sort is by
 * co_occurrence_count descending (works for both collaborative and popularity
 * paths since popularity reuses the same field name).
 *
 * @param {number} [limit=MAX_CANDIDATES_PER_STAGE]
 * @returns {Array<Object>}
 */
function buildDestinationLookupStages(limit = MAX_CANDIDATES_PER_STAGE) {
  return [
    { $lookup: {
      from: 'destinations',
      localField: 'destination_id',
      foreignField: '_id',
      as: 'dest'
    }},
    { $unwind: { path: '$dest', preserveNullAndEmptyArrays: true } },
    { $sort: { co_occurrence_count: -1 } },
    { $limit: limit }
  ];
}

// ---------------------------------------------------------------------------
// Stage 1: Find users who planned matching activity types
// ---------------------------------------------------------------------------

async function findSimilarUsers(filters, userId) {
  const activityTypes = expandActivityTypes(filters.activity_types);
  if (!activityTypes.length) return [];

  loadModels();
  const matchStage = {
    'plan.activity_type': { $in: activityTypes },
    user: { $ne: new Types.ObjectId(userId) }
  };

  const pipeline = [
    { $match: matchStage },
    ...buildExperienceLookupStages(),
    ...(await buildDestinationFilterStages(filters, 'dest'))
  ];

  // Cost filter via $reduce on plan[].cost
  if (filters.max_cost) {
    pipeline.push({
      $addFields: {
        _totalCost: { $reduce: {
          input: '$plan',
          initialValue: 0,
          in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
        }}
      }
    });
    pipeline.push({ $match: { _totalCost: { $lte: filters.max_cost } } });
  }

  // Group by user
  pipeline.push(
    { $group: {
      _id: '$user',
      matchingPlanCount: { $sum: 1 },
      experienceIds: { $addToSet: '$experience' }
    }},
    { $sort: { matchingPlanCount: -1 } },
    { $limit: MAX_SIMILAR_USERS }
  );

  const results = await Plan.aggregate(pipeline);

  logger.debug('[bienbot-context] findSimilarUsers', {
    userId,
    activityTypes,
    resultCount: results.length
  });

  return results.map(r => ({
    userId: r._id,
    matchingPlanCount: r.matchingPlanCount,
    experienceIds: r.experienceIds
  }));
}

// ---------------------------------------------------------------------------
// Stage 2: Find other experiences planned by similar users
// ---------------------------------------------------------------------------

async function findCoOccurringExperiences(similarUsers, filters, userId) {
  if (!similarUsers.length) return [];

  loadModels();
  const userIds = similarUsers.map(u => u.userId);
  const excludeExpIds = [...new Set(similarUsers.flatMap(u => u.experienceIds))];

  const pipeline = [
    { $match: {
      user: { $in: userIds },
      experience: { $nin: excludeExpIds }
    }},
    ...buildExperienceLookupStages(),
    ...buildCostAndCompletionStages({ withCollaborators: true }),
    buildExperienceGroupStage({ withCollaborators: true, withPlanItemTypes: true }),
    ...buildDestinationLookupStages()
  ];

  const results = await Plan.aggregate(pipeline);

  // Resolve default photo URLs in a single batch query post-aggregation —
  // replaces an in-pipeline nested $lookup + $let + $arrayElemAt + $filter.
  await hydrateDefaultPhotoUrls(results);

  logger.debug('[bienbot-context] findCoOccurringExperiences', {
    similarUserCount: similarUsers.length,
    resultCount: results.length
  });

  return results.map(r => {
    const flatCollabs = (r.collaborator_ids || []).flat().flat();
    const uniqueCollabs = [...new Set(flatCollabs.map(id => id?.toString()).filter(Boolean))];

    const allTypes = [...new Set([
      ...(r.activity_types || []),
      ...(r.plan_item_types || []).filter(Boolean)
    ])];

    return {
      experience_id: r._id,
      experience_name: r.experience_name,
      destination_name: r.dest?.name || 'Unknown',
      destination_id: r.destination_id,
      activity_types: allTypes,
      cost_estimate: Math.round(r.avg_cost || 0),
      co_occurrence_count: r.co_occurrence_count,
      avg_completion_rate: r.avg_completion_rate || 0,
      collaborator_count: uniqueCollabs.length,
      latest_planned_date: r.latest_planned_date,
      default_photo_url: r.default_photo_url || null
    };
  });
}

// ---------------------------------------------------------------------------
// Popularity-based fallback: used when collaborative filtering yields no results
// (e.g. no activity_types provided, new user, or sparse plan data)
// ---------------------------------------------------------------------------

/**
 * Find popular public experiences ranked by plan count.
 * Returns the same candidate shape as findCoOccurringExperiences.
 * Supports destination and max_cost filters; cross_destination flag is ignored
 * (query is always cross-destination by default).
 * @param {Object} filters - { destination_id, destination_name, max_cost }
 * @param {string} userId - Exclude plans owned by this user
 * @returns {Promise<Array>}
 */
async function findPopularExperiences(filters, userId) {
  loadModels();

  const activityTypes = expandActivityTypes(filters.activity_types);
  const pipeline = [
    { $match: { user: { $ne: new Types.ObjectId(userId) } } },
    ...buildExperienceLookupStages(),
    ...(await buildDestinationFilterStages(filters, 'dest_filter'))
  ];

  // Activity-type filter: when falling back to popularity but intent was supplied
  // (e.g. "culinary"), keep results relevant. Matches experience top-level type
  // or any plan_item's activity_type.
  if (activityTypes.length) {
    pipeline.push({
      $match: {
        $or: [
          { 'exp.experience_type':           { $in: activityTypes } },
          { 'exp.plan_items.activity_type':  { $in: activityTypes } }
        ]
      }
    });
  }

  // Pre-group cost filter: prune expensive plans before cost/completion fields run.
  if (filters.max_cost) {
    pipeline.push(...buildPlanCostFilterStages(filters.max_cost));
  }

  pipeline.push(
    ...buildCostAndCompletionStages(),
    buildExperienceGroupStage(),
    ...buildDestinationLookupStages()
  );

  const results = await Plan.aggregate(pipeline);

  // One batch Photo query instead of an in-pipeline nested $lookup.
  await hydrateDefaultPhotoUrls(results);

  logger.debug('[bienbot-context] findPopularExperiences', {
    userId,
    filters,
    resultCount: results.length
  });

  return results.map(r => ({
    experience_id: r._id,
    experience_name: r.experience_name,
    destination_name: r.dest?.name || 'Unknown',
    destination_id: r.destination_id,
    activity_types: r.activity_types || [],
    cost_estimate: Math.round(r.avg_cost || 0),
    co_occurrence_count: r.co_occurrence_count,
    avg_completion_rate: r.avg_completion_rate || 0,
    collaborator_count: 0,
    latest_planned_date: r.latest_planned_date,
    default_photo_url: r.default_photo_url || null
  }));
}

module.exports = {
  buildDiscoveryContext,
  buildSimilarExperiencesContext,
  formatDiscoveryContextBlock,
  SEMANTIC_ACTIVITY_MAP,
  DIM_DRIVER_DESCRIPTIONS,
  describeDimDrivers,
  expandActivityTypes,
  computeAdaptiveWeights,
  computeCostAlignment,
  normalizeCostToPercentile,
  computeRecencyScore,
  normalizeCount,
  generateMatchReason,
  findSimilarUsers,
  findCoOccurringExperiences,
  findPopularExperiences
};
