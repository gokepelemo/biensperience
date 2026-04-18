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

const logger = require('./backend-logger');
const { validateObjectId } = require('./controller-helpers');
const {
  applySignalDecay,
  signalsToNaturalLanguage,
  computePopularityScore,
  computeAffinityScore,
  computeAndCacheAffinity,
  processSignalEvent
} = require('./hidden-signals');
const signalsConfig = require('./signals-config');
const affinityCache = require('./affinity-cache');

// Token budget helpers (local copies — avoids circular dep with context-builders)
const CHARS_PER_TOKEN = 4;
const DEFAULT_TOKEN_BUDGET = 1500;

function trimToTokenBudget(text, tokenBudget = DEFAULT_TOKEN_BUDGET) {
  const maxChars = tokenBudget * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + '...';
}

// Lazy-loaded models (resolved on first use)
let Experience, Plan, User;
function loadModels() {
  if (!Experience) {
    Experience = require('../models/experience');
    Plan = require('../models/plan');
    User = require('../models/user');
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
const SIGNAL_THRESHOLD = 0.7;
const MIN_CONFIDENCE = 0.2;
const RECENCY_HALF_LIFE_DAYS = 174; // e^(-ln2 * 90/174) ≈ 0.70 at 90 days, per spec

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

  // Symmetric +0.10/-0.10 swaps
  if ((signals.budget_sensitivity || 0) > SIGNAL_THRESHOLD) {
    weights.cost_alignment += 0.10;
    weights.plan_count -= 0.10;
  }
  if ((signals.social || 0) > SIGNAL_THRESHOLD) {
    weights.collaborators += 0.10;
    weights.recency -= 0.10;
  }
  if ((signals.structure || 0) > SIGNAL_THRESHOLD) {
    weights.completion_rate += 0.10;
    weights.plan_count -= 0.10;
  }
  if ((signals.novelty || 0) > SIGNAL_THRESHOLD) {
    weights.recency += 0.10;
    weights.completion_rate -= 0.10;
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
 * @param {number} cost
 * @param {number[]} allCandidateCosts
 * @returns {number}
 */
function normalizeCostToPercentile(cost, allCandidateCosts) {
  if (!allCandidateCosts || allCandidateCosts.length <= 1) return 0.5;
  const sorted = [...allCandidateCosts].sort((a, b) => a - b);
  const rank = sorted.findIndex(v => v >= cost);
  return rank === -1 ? 1.0 : rank / (sorted.length - 1);
}

/**
 * Compute cost alignment between an experience cost and user's budget sensitivity.
 * 1.0 = perfect fit, 0.0 = worst mismatch, 0.5 = neutral.
 * @param {number|null} experienceCost
 * @param {Object|null} signals
 * @param {number[]} allCandidateCosts
 * @returns {number}
 */
function computeCostAlignment(experienceCost, signals, allCandidateCosts) {
  if (!experienceCost || !signals) return 0.5;
  const userBudgetLevel = 1 - (signals.budget_sensitivity || 0.5);
  const costPercentile = normalizeCostToPercentile(experienceCost, allCandidateCosts || []);
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
  if (daysSince < 0) return 1;
  return Math.exp(-0.693 * daysSince / RECENCY_HALF_LIFE_DAYS); // ln(2) ~= 0.693
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
  const categoryPhrases = {
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

  const templates = {
    plan_count:      (c) => `Planned by ${c.co_occurrence_count} similar travelers`,
    completion_rate: (c) => `${Math.round((c.avg_completion_rate || 0) * 100)}% plan completion rate`,
    recency:         () => 'Recently trending among travelers',
    collaborators:   (c) => `Popular group activity - ${c.collaborator_count} collaborators`,
    cost_alignment:  () => 'Good budget fit for your travel style'
  };

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

  // Build phrase
  const catPhrase = (categories || [])
    .map(c => categoryPhrases[c] || c)
    .filter(Boolean)[0];

  const signalPhrase = templates[dominant](candidate);
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
  const { getCacheKey, createDiscoveryCache } = require('./discovery-cache');
  const UserModel = require('../models/user');

  const limit = options.limit || 8;
  const cacheKey = getCacheKey(filters);
  const cache = createDiscoveryCache();

  try {
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
      }

      if (!candidates.length) {
        logger.debug('[bienbot-context] No experiences found for filters', { filters, userId });
        return null;
      }

      await cache.set(cacheKey, candidates);
    }

    // Fetch user's hidden signals for personalized ranking
    let signals = null;
    try {
      const user = await UserModel.findById(userId).select('hidden_signals').lean();
      if (user?.hidden_signals) {
        signals = applySignalDecay(user.hidden_signals);
      }
    } catch (err) {
      logger.warn('[bienbot-context] Failed to fetch user signals for ranking', { userId, error: err.message });
    }

    // Compute adaptive weights (personalized by user behavioral signals)
    const weights = computeAdaptiveWeights(signals);

    const allCosts = candidates.map(c => c.cost_estimate).filter(Boolean);
    const maxCoOccurrence = candidates.reduce((m, c) => Math.max(m, c.co_occurrence_count || 0), 1);
    const maxCollaborators = candidates.reduce((m, c) => Math.max(m, c.collaborator_count || 0), 1);

    // Load pre-computed content signals from Experience documents.
    // One secondary query keyed by experience_id — avoids modifying the aggregation pipeline.
    // Experiences whose signals haven't been computed yet fall back to neutral defaults.
    let experienceSignalsMap = new Map();
    try {
      const ExperienceModel = require('../models/experience');
      const candidateIds = candidates.map(c => c.experience_id).filter(Boolean);
      const storedSignalDocs = await ExperienceModel
        .find({ _id: { $in: candidateIds } })
        .select('signals hidden_signals')
        .lean();
      for (const doc of storedSignalDocs) {
        if (doc._id) experienceSignalsMap.set(doc._id.toString(), {
          signals: doc.signals || null,
          hidden_signals: doc.hidden_signals || null
        });
      }
    } catch (err) {
      logger.warn('[bienbot-context] Failed to load stored content signals; falling back to neutral', { error: err.message });
    }

    // Compute per-candidate-set maximums for popularity normalisation.
    // This makes each candidate's popularity score relative to the destination
    // context rather than a global absolute value.
    const maxPopularity = {
      planCount:             Math.max(...[...experienceSignalsMap.values()].map(s => s?.signals?.popularity?.planCount             || 0), 1),
      planCountWithActivity: Math.max(...[...experienceSignalsMap.values()].map(s => s?.signals?.popularity?.planCountWithActivity || 0), 1),
      completedPlanCount:    Math.max(...[...experienceSignalsMap.values()].map(s => s?.signals?.popularity?.completedPlanCount    || 0), 1)
    };

    const formula = signalsConfig.formula;

    // Load affinity map once for all candidates (cache-first; empty Map on failure or missing userId)
    let affinityMap = new Map();
    if (userId) {
      try {
        affinityMap = await affinityCache.getAffinityMap(userId);
      } catch (affinityErr) {
        logger.warn('[bienbot-context] Failed to load affinity map for discovery ranking', { userId, error: affinityErr.message });
      }
    }

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
        weights.cost_alignment  * computeCostAlignment(c.cost_estimate, signals, allCosts);

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
      // On a cache miss, fire-and-forget computeAndCacheAffinity so subsequent
      // requests for the same (user, experience) pair hit the cache.
      const cachedAffinity = affinityMap.get(c.experience_id.toString());
      let affinityScore;
      let affinityDrivers = '';
      if (cachedAffinity) {
        affinityScore = cachedAffinity.score;
        if (cachedAffinity.top_dims?.length) {
          affinityDrivers = describeDimDrivers(cachedAffinity.top_dims);
        }
      } else {
        affinityScore = computeAffinityScore(signals, entityBehavior);
        // Warm the cache asynchronously — never awaited, never throws
        computeAndCacheAffinity(userId, c.experience_id).catch(() => {});
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

    const contextBlock = formatDiscoveryContextBlock(results, filters);

    // Signal feedback (fire-and-forget)
    try {
      const expandedTypes = expandActivityTypes(filters.activity_types);
      processSignalEvent(userId, {
        type: 'search',
        metadata: {
          source: 'discovery',
          activity_type: expandedTypes[0] || null,
          all_activity_types: expandedTypes,
          result_count: results.length
        }
      });
    } catch (e) {
      // Silently ignore signal event errors
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
    logger.error('[bienbot-context] buildDiscoveryContext failed', { error: err.message });
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
    if (score < 0.4) return 'different from your usual travel style';
    return null;
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
      { $limit: 5 },
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
    logger.error('[bienbot-context] buildSimilarExperiencesContext failed', { error: err.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Stage 1: Find users who planned matching activity types
// ---------------------------------------------------------------------------

async function findSimilarUsers(filters, userId) {
  const activityTypes = expandActivityTypes(filters.activity_types);
  if (!activityTypes.length) return [];

  loadModels();
  const { Types } = require('mongoose');
  const matchStage = {
    'plan.activity_type': { $in: activityTypes },
    user: { $ne: new Types.ObjectId(userId) }
  };

  const pipeline = [
    { $match: matchStage },
    // Lookup experience for destination filter + visibility
    { $lookup: {
      from: 'experiences',
      localField: 'experience',
      foreignField: '_id',
      as: 'exp'
    }},
    { $unwind: '$exp' },
    { $match: { 'exp.visibility': { $ne: 'private' } } }
  ];

  // Destination filter
  const shouldFilterDestination = !filters.cross_destination &&
    (filters.destination_id || filters.destination_name);

  if (shouldFilterDestination) {
    if (filters.destination_id) {
      pipeline.push({ $match: { 'exp.destination': new Types.ObjectId(filters.destination_id) } });
    } else if (filters.destination_name) {
      const nameRegex = new RegExp(filters.destination_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push(
        { $lookup: { from: 'destinations', localField: 'exp.destination', foreignField: '_id', as: 'dest' } },
        { $unwind: '$dest' },
        { $match: { 'dest.name': nameRegex } }
      );
    }
  }

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
    { $limit: 50 }
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
    { $lookup: {
      from: 'experiences',
      localField: 'experience',
      foreignField: '_id',
      as: 'exp'
    }},
    { $unwind: '$exp' },
    { $match: { 'exp.visibility': { $ne: 'private' } } },
    { $addFields: {
      _planCost: { $reduce: {
        input: '$plan',
        initialValue: 0,
        in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
      }},
      _completedCount: { $size: { $filter: {
        input: '$plan',
        cond: { $eq: ['$$this.complete', true] }
      }}},
      _totalCount: { $size: '$plan' },
      _userCollaborators: { $filter: {
        input: '$permissions',
        cond: { $eq: ['$$this.entity', 'user'] }
      }}
    }},
    { $addFields: {
      _completionRate: { $cond: {
        if: { $gt: ['$_totalCount', 0] },
        then: { $divide: ['$_completedCount', '$_totalCount'] },
        else: 0
      }}
    }},
    { $group: {
      _id: '$experience',
      co_occurrence_count: { $sum: 1 },
      avg_completion_rate: { $avg: '$_completionRate' },
      collaborator_ids: { $addToSet: '$_userCollaborators._id' },
      latest_planned_date: { $max: '$planned_date' },
      avg_cost: { $avg: '$_planCost' },
      experience_name: { $first: '$exp.name' },
      destination_id: { $first: '$exp.destination' },
      activity_types: { $first: '$exp.experience_type' },
      plan_item_types: { $first: '$exp.plan_items.activity_type' },
      photos: { $first: '$exp.photos' }
    }},
    { $lookup: {
      from: 'destinations',
      localField: 'destination_id',
      foreignField: '_id',
      as: 'dest'
    }},
    { $unwind: { path: '$dest', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'photos',
      let: {
        photoId: { $let: {
          vars: {
            defaultEntry: { $arrayElemAt: [{ $filter: { input: '$photos', as: 'p', cond: { $eq: ['$$p.default', true] } } }, 0] },
            firstEntry: { $arrayElemAt: ['$photos', 0] }
          },
          in: { $ifNull: ['$$defaultEntry.photo', '$$firstEntry.photo'] }
        }}
      },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$photoId'] } } },
        { $project: { url: 1 } }
      ],
      as: 'photo'
    }},
    { $unwind: { path: '$photo', preserveNullAndEmptyArrays: true } },
    { $sort: { co_occurrence_count: -1 } },
    { $limit: 20 }
  ];

  const results = await Plan.aggregate(pipeline);

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
      default_photo_url: r.photo?.url || null
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
  const { Types } = require('mongoose');

  const pipeline = [
    { $match: { user: { $ne: new Types.ObjectId(userId) } } },
    { $lookup: {
      from: 'experiences',
      localField: 'experience',
      foreignField: '_id',
      as: 'exp'
    }},
    { $unwind: '$exp' },
    { $match: { 'exp.visibility': { $ne: 'private' } } }
  ];

  // Optional destination filter
  const shouldFilterDestination = !filters.cross_destination &&
    (filters.destination_id || filters.destination_name);

  if (shouldFilterDestination) {
    if (filters.destination_id) {
      pipeline.push({ $match: { 'exp.destination': new Types.ObjectId(filters.destination_id) } });
    } else if (filters.destination_name) {
      const nameRegex = new RegExp(filters.destination_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      pipeline.push(
        { $lookup: { from: 'destinations', localField: 'exp.destination', foreignField: '_id', as: 'dest_filter' } },
        { $unwind: '$dest_filter' },
        { $match: { 'dest_filter.name': nameRegex } }
      );
    }
  }

  // Optional cost filter
  if (filters.max_cost) {
    pipeline.push(
      { $addFields: {
        _planCostFilter: { $reduce: {
          input: '$plan',
          initialValue: 0,
          in: { $add: ['$$value', { $ifNull: ['$$this.cost', 0] }] }
        }}
      }},
      { $match: { _planCostFilter: { $lte: filters.max_cost } } }
    );
  }

  pipeline.push(
    { $addFields: {
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
    }},
    { $addFields: {
      _completionRate: { $cond: {
        if: { $gt: ['$_totalCount', 0] },
        then: { $divide: ['$_completedCount', '$_totalCount'] },
        else: 0
      }}
    }},
    { $group: {
      _id: '$experience',
      co_occurrence_count: { $sum: 1 },
      avg_completion_rate: { $avg: '$_completionRate' },
      latest_planned_date: { $max: '$planned_date' },
      avg_cost: { $avg: '$_planCost' },
      experience_name: { $first: '$exp.name' },
      destination_id: { $first: '$exp.destination' },
      activity_types: { $first: '$exp.experience_type' },
      photos: { $first: '$exp.photos' }
    }},
    { $lookup: {
      from: 'destinations',
      localField: 'destination_id',
      foreignField: '_id',
      as: 'dest'
    }},
    { $unwind: { path: '$dest', preserveNullAndEmptyArrays: true } },
    { $lookup: {
      from: 'photos',
      let: { photoId: { $let: {
        vars: {
          defaultEntry: { $arrayElemAt: [{ $filter: { input: '$photos', as: 'p', cond: { $eq: ['$$p.default', true] } } }, 0] },
          firstEntry: { $arrayElemAt: ['$photos', 0] }
        },
        in: { $ifNull: ['$$defaultEntry.photo', '$$firstEntry.photo'] }
      }} },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$photoId'] } } },
        { $project: { url: 1 } }
      ],
      as: 'photo'
    }},
    { $unwind: { path: '$photo', preserveNullAndEmptyArrays: true } },
    { $sort: { co_occurrence_count: -1 } },
    { $limit: 20 }
  );

  const results = await Plan.aggregate(pipeline);

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
    default_photo_url: r.photo?.url || null
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
