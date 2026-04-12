/**
 * Hidden Signals — Signal Processing Pipeline
 *
 * Pure functions for computing, decaying, and converting behavioral signal
 * vectors, plus a single fire-and-forget side-effectful entry-point
 * (`processSignalEvent`) that updates MongoDB atomically.
 *
 * @module utilities/hidden-signals
 */

const backendLogger = require('./backend-logger');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maps activity_type values (from plan items) to dimension influence vectors.
 * Each key is an activity_type and each value is the set of dimensions it
 * nudges and by how much (0–1 scale).
 */
const ACTIVITY_TYPE_SIGNAL_MAP = {
  adventure:      { energy: 0.9, comfort_zone: 0.8, novelty: 0.7 },
  sports:         { energy: 0.8, comfort_zone: 0.6, social: 0.4 },
  nature:         { energy: 0.6, comfort_zone: 0.5, novelty: 0.5 },
  wellness:       { comfort_zone: 0.3, energy: 0.3, structure: 0.4 },
  museum:         { cultural_depth: 0.9, structure: 0.6 },
  sightseeing:    { cultural_depth: 0.6, novelty: 0.4 },
  religious:      { cultural_depth: 0.8, structure: 0.5 },
  tour:           { cultural_depth: 0.5, structure: 0.7, social: 0.4 },
  'class':        { cultural_depth: 0.6, structure: 0.7, novelty: 0.5 },
  food:           { food_focus: 0.9, social: 0.4 },
  drinks:         { food_focus: 0.7, social: 0.6 },
  coffee:         { food_focus: 0.6, social: 0.3 },
  market:         { food_focus: 0.7, novelty: 0.4, budget_sensitivity: 0.5 },
  nightlife:      { social: 0.9, energy: 0.5, comfort_zone: 0.4 },
  entertainment:  { social: 0.6, energy: 0.4 },
  meeting:        { social: 0.8, structure: 0.6 },
  shopping:       { budget_sensitivity: 0.6, social: 0.3 },
  accommodation:  { budget_sensitivity: 0.7, comfort_zone: 0.5 },
  transport:      { budget_sensitivity: 0.5, structure: 0.4 },
  local:          { novelty: 0.7, cultural_depth: 0.5, comfort_zone: 0.6 },
  photography:    { novelty: 0.5, cultural_depth: 0.4 },
  rest:           { energy: 0.1, comfort_zone: 0.2 },
  work:           { structure: 0.8 },
  packing:        { structure: 0.7 },
  checkpoint:     { structure: 0.6 },
  health:         { structure: 0.5 },
  banking:        { structure: 0.5, budget_sensitivity: 0.4 },
  communication:  { structure: 0.4 },
  admin:          { structure: 0.6 },
  laundry:        { structure: 0.4 },
  rental:         { budget_sensitivity: 0.5, comfort_zone: 0.4 }
};

/**
 * Weight multiplier for each event type.
 * Positive weights reinforce dimensions; negative weights decay them.
 */
const EVENT_WEIGHT_MAP = {
  save: 0.7,
  book: 1.0,
  edit_plan: 0.3,
  remove_plan_item: -0.4,
  vote: 0.5,
  dismiss: -0.6,
  click: 0.1,
  view_duration: 0.2,
  search: 0.2
};

/** Exponential Moving Average smoothing factor */
const EMA_ALPHA = 0.2;

/** Half-life in days for signal decay toward neutral */
const DECAY_HALF_LIFE_DAYS = 30;

/** Neutral value that dimensions decay toward */
const NEUTRAL = 0.5;

/** Signal dimensions (excludes metadata fields) */
const DIMENSIONS = [
  'energy', 'novelty', 'budget_sensitivity', 'social',
  'structure', 'food_focus', 'cultural_depth', 'comfort_zone'
];

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Clamp a number to the [0, 1] range.
 */
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Update a hidden signal vector given a new event.
 *
 * @param {Object} currentSignals - Current signal vector (or defaults).
 * @param {Object} event - Signal event with type, value, metadata.activity_type.
 * @returns {Object} New signal vector (shallow copy, pure).
 */
function updateHiddenSignals(currentSignals, event) {
  const cur = { ...currentSignals };

  // Ensure defaults for all dimensions
  for (const dim of DIMENSIONS) {
    if (typeof cur[dim] !== 'number') cur[dim] = NEUTRAL;
  }
  if (typeof cur.confidence !== 'number') cur.confidence = 0;

  const activityType = event.metadata?.activity_type;
  const influence = activityType ? ACTIVITY_TYPE_SIGNAL_MAP[activityType] : null;
  const eventWeight = EVENT_WEIGHT_MAP[event.type] ?? 0;
  const eventValue = typeof event.value === 'number' ? event.value : 0;
  // Use explicit non-zero check so value:0 (valid falsy number) is not replaced with 1.
  const combinedWeight = eventWeight * (eventValue !== 0 ? eventValue : 1);

  if (influence) {
    for (const [dim, strength] of Object.entries(influence)) {
      if (!DIMENSIONS.includes(dim)) continue;
      const target = clamp01(cur[dim] + strength * combinedWeight);
      cur[dim] = clamp01((1 - EMA_ALPHA) * cur[dim] + EMA_ALPHA * target);
    }
  }

  cur.confidence = clamp01(cur.confidence + 0.05);
  cur.last_updated = new Date();

  return cur;
}

/**
 * Aggregate signals from multiple user documents into a group profile.
 *
 * @param {Array<Object>} userDocuments - User docs with hidden_signals field.
 * @returns {Object} Group signal object.
 */
function aggregateGroupSignals(userDocuments) {
  if (!userDocuments || userDocuments.length === 0) {
    return { confidence: 0 };
  }

  const weightedSums = {};
  const sqWeightedSums = {};
  let totalWeight = 0;

  for (const dim of DIMENSIONS) {
    weightedSums[dim] = 0;
    sqWeightedSums[dim] = 0;
  }

  for (const doc of userDocuments) {
    const sig = doc.hidden_signals || {};
    // Use each user's confidence as their weight — high-confidence profiles
    // (many signal events) influence the group average more than sparse ones.
    const w = typeof sig.confidence === 'number' && sig.confidence > 0 ? sig.confidence : 0.01;
    totalWeight += w;
    for (const dim of DIMENSIONS) {
      const val = typeof sig[dim] === 'number' ? sig[dim] : NEUTRAL;
      weightedSums[dim] += val * w;
      sqWeightedSums[dim] += val * val * w;
    }
  }

  const result = {};
  let varianceSum = 0;

  for (const dim of DIMENSIONS) {
    result[dim] = weightedSums[dim] / totalWeight;
    // Bessel-corrected weighted variance approximation
    const rawVariance = (sqWeightedSums[dim] / totalWeight) - (result[dim] * result[dim]);
    varianceSum += Math.max(0, rawVariance);
  }

  const avgVariance = varianceSum / DIMENSIONS.length;
  // Group confidence: average of individual confidences, penalised by intra-group variance
  const avgConfidence = totalWeight / userDocuments.length;
  result.confidence = clamp01(avgConfidence * (1 - avgVariance));
  result.last_updated = new Date();

  return result;
}

/**
 * Convert signals to a natural language description for LLM context.
 *
 * @param {Object} signals - Signal vector.
 * @param {Object} options
 * @param {string} options.role - 'traveler' | 'group'
 * @param {number} [options.count] - Group size (for role='group').
 * @returns {string} Natural language string, or empty string if confidence < 0.2.
 */
function signalsToNaturalLanguage(signals, { role = 'traveler', count } = {}) {
  if (!signals || typeof signals.confidence !== 'number' || signals.confidence < 0.2) {
    return '';
  }

  const descriptors = [];
  const labelMap = {
    energy: 'energy level',
    novelty: 'novelty seeking',
    budget_sensitivity: 'cost-consciousness',
    social: 'social orientation',
    structure: 'need for structure',
    food_focus: 'food focus',
    cultural_depth: 'cultural depth',
    comfort_zone: 'comfort zone pushing'
  };

  for (const dim of DIMENSIONS) {
    const val = typeof signals[dim] === 'number' ? signals[dim] : NEUTRAL;
    const label = labelMap[dim] || dim;
    if (val > 0.7) {
      descriptors.push(`strong ${label}`);
    } else if (val >= 0.5) {
      descriptors.push(`moderate ${label}`);
    } else if (val < 0.3) {
      descriptors.push(`low ${label}`);
    }
    // 0.3–0.5 is near-neutral, omitted for brevity
  }

  if (descriptors.length === 0) return '';

  const prefix = role === 'group'
    ? `Group of ${count || '?'}: `
    : 'Traveler profile: ';

  return prefix + descriptors.join(', ') + '.';
}

/**
 * Decay signal dimensions toward the neutral value (0.5) based on elapsed time.
 *
 * @param {Object} signals - Signal vector.
 * @returns {Object} Decayed copy.
 */
function applySignalDecay(signals) {
  if (!signals || !signals.last_updated) return signals;

  const elapsed = Date.now() - new Date(signals.last_updated).getTime();
  const days = elapsed / (1000 * 60 * 60 * 24);
  if (days < 1) return { ...signals };

  const decayFactor = Math.exp(-days / DECAY_HALF_LIFE_DAYS);
  const result = { ...signals };

  for (const dim of DIMENSIONS) {
    const val = typeof result[dim] === 'number' ? result[dim] : NEUTRAL;
    result[dim] = clamp01(NEUTRAL + (val - NEUTRAL) * decayFactor);
  }

  result.confidence = clamp01((result.confidence || 0) * decayFactor);
  return result;
}

/**
 * Inject a high-novelty "surprise" recommendation when the user's novelty
 * score is low.
 *
 * @internal Not exported — candidate for wiring into discovery ranking once
 *   the scored output carries per-candidate hidden_signals.
 *
 * @param {Array<Object>} recommendations - Array of experience/destination objects.
 * @param {Object} userSignals - User's signal vector.
 * @returns {Array<Object>} Reordered array (not mutated).
 */
function injectSurprise(recommendations, userSignals) {
  if (!Array.isArray(recommendations) || recommendations.length < 2) return recommendations;
  if (!userSignals || typeof userSignals.novelty !== 'number') return recommendations;
  if (userSignals.novelty >= 0.5) return recommendations;

  const idx = recommendations.findIndex(r =>
    r.hidden_signals && typeof r.hidden_signals.novelty === 'number' && r.hidden_signals.novelty > 0.7
  );

  if (idx <= 1) return recommendations; // already at top or not found

  const copy = [...recommendations];
  const [surprise] = copy.splice(idx, 1);
  copy.splice(1, 0, surprise); // insert at index 1 (keep most relevant at 0)
  return copy;
}

/**
 * Compute semantic signal tags from plan items' activity types.
 *
 * @param {Array<Object>} planItems - Experience plan items with activity_type.
 * @returns {Array<string>} Deduplicated tag array.
 */
function computeExperienceSignalTags(planItems) {
  if (!Array.isArray(planItems) || planItems.length === 0) return [];

  const TAG_MAP = {
    adventure: 'adventure',
    sports: 'adventure',
    nature: 'nature',
    wellness: 'wellness',
    museum: 'cultural',
    sightseeing: 'cultural',
    religious: 'cultural',
    tour: 'cultural',
    'class': 'cultural',
    food: 'culinary',
    drinks: 'culinary',
    coffee: 'culinary',
    market: 'culinary',
    nightlife: 'nightlife',
    entertainment: 'entertainment',
    meeting: 'social',
    shopping: 'shopping',
    accommodation: 'accommodation',
    transport: 'transport',
    local: 'local',
    photography: 'photography',
    rest: 'relaxation',
    work: 'work',
    packing: 'logistics',
    checkpoint: 'logistics',
    health: 'health',
    banking: 'logistics',
    communication: 'logistics',
    admin: 'logistics',
    laundry: 'logistics',
    rental: 'transport'
  };

  const tags = new Set();
  for (const item of planItems) {
    const at = item.activity_type;
    if (at && TAG_MAP[at]) {
      tags.add(TAG_MAP[at]);
    }
  }
  return Array.from(tags);
}

// ---------------------------------------------------------------------------
// Side-effectful: fire-and-forget event processor
// ---------------------------------------------------------------------------

/**
 * Process a signal event for a user. Fire-and-forget — never throws, never
 * awaited by callers. Updates the user's hidden_signals atomically and
 * appends to hidden_signal_events (capped at 200).
 *
 * @param {string} userId - User ObjectId string.
 * @param {Object} eventData - { type, entity_type, entity_id, value, metadata }
 */
async function processSignalEvent(userId, eventData) {
  try {
    const User = require('../models/user');
    const user = await User.findById(userId).select('hidden_signals hidden_signal_events');
    if (!user) {
      backendLogger.warn('[hidden-signals] processSignalEvent: user not found', { userId });
      return;
    }

    // If entity is an experience, load its signal_tags to populate activity_type
    let mergedEvent = { ...eventData, createdAt: new Date() };
    if (mergedEvent.entity_type === 'experience' && mergedEvent.entity_id && !mergedEvent.metadata?.activity_type) {
      try {
        const Experience = require('../models/experience');
        const exp = await Experience.findById(mergedEvent.entity_id).select('signal_tags plan_items').lean();
        if (exp && exp.signal_tags && exp.signal_tags.length > 0) {
          mergedEvent.metadata = { ...mergedEvent.metadata, activity_type: exp.signal_tags[0] };
        } else if (exp && exp.plan_items && exp.plan_items.length > 0) {
          // Fallback: use the first activity_type from plan items
          const firstType = exp.plan_items.find(i => i.activity_type)?.activity_type;
          if (firstType) {
            mergedEvent.metadata = { ...mergedEvent.metadata, activity_type: firstType };
          }
        }
      } catch (e) {
        backendLogger.debug('[hidden-signals] Could not enrich experience signal', { error: e.message });
      }
    }

    const updatedSignals = updateHiddenSignals(user.hidden_signals || {}, mergedEvent);

    await User.findByIdAndUpdate(userId, {
      $set: { hidden_signals: updatedSignals },
      $push: {
        hidden_signal_events: {
          $each: [mergedEvent],
          $slice: -200
        }
      }
    });

    backendLogger.debug('[hidden-signals] Signal event processed', {
      userId,
      eventType: mergedEvent.type,
      entityType: mergedEvent.entity_type,
      confidence: updatedSignals.confidence
    });
  } catch (err) {
    backendLogger.error('[hidden-signals] processSignalEvent failed', {
      userId,
      error: err.message
    });
    // Never throw — fire-and-forget
  }
}

// ---------------------------------------------------------------------------
// Content-signal compute functions (pure)
// ---------------------------------------------------------------------------

/**
 * Compute a trustScore [0, 1] for an experience from its content attributes.
 *
 * Weights are read from signals-config so the blend can be adjusted via
 * the SIGNALS_CONFIG environment variable without a code change.
 *
 * @param {Object} opts
 * @param {boolean} opts.isCurator       - Whether the experience creator has the curator flag.
 * @param {boolean} opts.isPublic        - Whether the experience is publicly listed.
 * @param {number}  opts.completionRate  - Fraction of plans with >= 1 completed item (0–1).
 * @param {number}  opts.planCount       - Total number of distinct plans.
 * @param {Object}  [config]             - Parsed signals config (default: module singleton).
 * @returns {number} Clamped trust score [0, 1].
 */
function computeTrustScore(
  { isCurator = false, isPublic = false, completionRate = 0, planCount = 0 },
  config
) {
  // Lazy-load to avoid a circular-require at module evaluation time
  const cfg = config || require('./signals-config');
  const w = cfg.trustScore;

  let score = 0;
  if (isCurator) score += w.curator;
  if (isPublic)  score += w.public;
  score += clamp01(completionRate) * w.completionRate;
  if (planCount >= (w.minPlanItems || 1)) score += w.base;

  return clamp01(score);
}

/**
 * Compute a normalised popularity score [0, 1] from raw plan-count dimensions.
 *
 * Normalisation is done relative to the largest values seen in the current
 * candidate set (passed as `maxRaw`).  This keeps every experience's popularity
 * meaningful within its destination context rather than against a global maximum.
 *
 * @param {Object} raw    - { planCount, planCountWithActivity, completedPlanCount }
 * @param {Object} maxRaw - Per-dimension maximums across the candidate set.
 * @param {Object} [config]
 * @returns {number} Normalised popularity score [0, 1].
 */
function computePopularityScore(raw, maxRaw, config) {
  const cfg = config || require('./signals-config');
  const w = cfg.popularity;

  const norm = (val, max) => (max > 0 ? clamp01(val / max) : 0);

  return clamp01(
    w.planCount        * norm(raw.planCount        || 0, maxRaw.planCount        || 1) +
    w.planWithActivity * norm(raw.planCountWithActivity || 0, maxRaw.planCountWithActivity || 1) +
    w.completedPlans   * norm(raw.completedPlanCount   || 0, maxRaw.completedPlanCount   || 1)
  );
}

/**
 * Compute the affinity score between a user's behavioral signal vector and an
 * entity's behavioral signal vector.
 *
 * Formula: `1 - weighted_mean_absolute_difference` across all DIMENSIONS,
 * where per-dimension weights come from `config.affinity` (already normalised
 * to sum to 1 at startup).
 *
 * Confidence gating: if either vector's confidence is below
 * `config.affinity.confidenceThreshold`, the neutral score
 * (`config.affinity.neutralAffinityScore`) is returned instead, because the
 * vectors are too uncertain for meaningful comparison.
 *
 * @param {Object|null} userSignals   - Decayed user hidden_signals vector.
 * @param {Object|null} entitySignals - Experience/entity hidden_signals vector.
 * @param {Object}      [config]      - Parsed signals config (default: module singleton).
 * @returns {number} Affinity score [0, 1].
 */
function computeAffinityScore(userSignals, entitySignals, config) {
  const cfg = config || require('./signals-config');
  const { confidenceThreshold, neutralAffinityScore } = cfg.affinity;

  // Return neutral score when either vector is absent or confidence is too low
  const userConf   = typeof userSignals?.confidence   === 'number' ? userSignals.confidence   : 0;
  const entityConf = typeof entitySignals?.confidence === 'number' ? entitySignals.confidence : 0;

  if (userConf < confidenceThreshold || entityConf < confidenceThreshold) {
    return neutralAffinityScore;
  }

  // Weighted mean absolute difference across dimensions
  let weightedDiff = 0;
  for (const dim of DIMENSIONS) {
    const uVal = typeof userSignals[dim]   === 'number' ? userSignals[dim]   : NEUTRAL;
    const eVal = typeof entitySignals[dim] === 'number' ? entitySignals[dim] : NEUTRAL;
    const w    = cfg.affinity[dim] ?? 0;
    weightedDiff += w * Math.abs(uVal - eVal);
  }

  return clamp01(1 - weightedDiff);
}

// ---------------------------------------------------------------------------
// Content-signal update: fire-and-forget
// ---------------------------------------------------------------------------

/**
 * Recompute and persist content signals for an experience.
 *
 * Called as a fire-and-forget side-effect from plan create/delete events.
 * Never throws — errors are logged and silently absorbed.
 *
 * Pipeline:
 *  1. Load experience + creator user (for curator flag).
 *  2. Run a single Plan aggregation to obtain the three popularity dimensions.
 *  3. Compute trustScore and store raw popularity counts.
 *  4. Write back to experience.signals atomically.
 *
 * @param {string|import('mongoose').Types.ObjectId} experienceId
 */
async function updateExperienceSignals(experienceId) {
  try {
    const Experience = require('../models/experience');
    const User       = require('../models/user');
    const Plan       = require('../models/plan');
    const { hasFeatureFlag } = require('./feature-flags');
    const config     = require('./signals-config');

    // 1. Load experience and its creator
    const experience = await Experience
      .findById(experienceId)
      .select('user public plan_items')
      .lean();

    if (!experience) {
      backendLogger.warn('[hidden-signals] updateExperienceSignals: experience not found', { experienceId });
      return;
    }

    const creator = experience.user
      ? await User.findById(experience.user).select('feature_flags').lean()
      : null;

    const isCurator = creator ? hasFeatureFlag(creator, 'curator') : false;
    const isPublic  = !!experience.public;

    // 2. Aggregate plan metrics for this experience in one query
    const [metrics = {}] = await Plan.aggregate([
      { $match: { experience: experience._id } },
      {
        $project: {
          hasActivity: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$plan', []] },
                    as: 'item',
                    cond: {
                      $and: [
                        { $ne: ['$$item.activity_type', null] },
                        { $ne: ['$$item.activity_type', ''] }
                      ]
                    }
                  }
                }
              },
              0
            ]
          },
          hasCompleted: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ['$plan', []] },
                    as: 'item',
                    cond: { $eq: ['$$item.complete', true] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          planCount:             { $sum: 1 },
          planCountWithActivity: { $sum: { $cond: ['$hasActivity', 1, 0] } },
          completedPlanCount:    { $sum: { $cond: ['$hasCompleted', 1, 0] } }
        }
      }
    ]);

    const planCount             = metrics.planCount             || 0;
    const planCountWithActivity = metrics.planCountWithActivity || 0;
    const completedPlanCount    = metrics.completedPlanCount    || 0;
    const completionRate        = planCount > 0 ? completedPlanCount / planCount : 0;

    // 3. Compute trust score
    const trustScore = computeTrustScore(
      { isCurator, isPublic, completionRate, planCount },
      config
    );

    // 4. Persist (atomic, no read-modify-write race)
    await Experience.findByIdAndUpdate(experienceId, {
      $set: {
        'signals.trustScore': trustScore,
        'signals.popularity.planCount':             planCount,
        'signals.popularity.planCountWithActivity': planCountWithActivity,
        'signals.popularity.completedPlanCount':    completedPlanCount,
        'signals.computed_at': new Date()
      }
    });

    backendLogger.debug('[hidden-signals] updateExperienceSignals: signals updated', {
      experienceId: experienceId.toString(),
      trustScore,
      planCount,
      planCountWithActivity,
      completedPlanCount
    });
  } catch (err) {
    backendLogger.error('[hidden-signals] updateExperienceSignals failed', {
      experienceId: experienceId?.toString(),
      error: err.message
    });
    // Never throw — fire-and-forget
  }
}

// ---------------------------------------------------------------------------
// Affinity cache: compute + store
// ---------------------------------------------------------------------------

/**
 * Load hidden_signals for a user and an experience, compute the affinity score
 * and top aligned dimensions, then persist the result to the affinity cache.
 *
 * Returns early (without writing to the cache) when:
 *  - Either ID is not a valid ObjectId.
 *  - The user or experience document is not found in the database.
 *
 * Never throws — errors are logged and silently absorbed by the caller.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {string|import('mongoose').Types.ObjectId} experienceId
 * @returns {Promise<void>}
 */
async function computeAndCacheAffinity(userId, experienceId) {
  const mongoose = require('mongoose');
  const affinityCache = require('./affinity-cache');

  // Validate IDs before hitting the database
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(experienceId)) {
    backendLogger.warn('[hidden-signals] computeAndCacheAffinity: invalid ObjectId', {
      userId: userId?.toString(),
      experienceId: experienceId?.toString()
    });
    return;
  }

  // Load documents (lean, selecting only the field we need)
  const User       = require('../models/user');
  const Experience = require('../models/experience');

  const [user, experience] = await Promise.all([
    User.findById(userId).select('hidden_signals').lean(),
    Experience.findById(experienceId).select('hidden_signals').lean()
  ]);

  if (!user) {
    backendLogger.warn('[hidden-signals] computeAndCacheAffinity: user not found', {
      userId: userId.toString()
    });
    return;
  }

  if (!experience) {
    backendLogger.warn('[hidden-signals] computeAndCacheAffinity: experience not found', {
      experienceId: experienceId.toString()
    });
    return;
  }

  // Apply temporal decay to both vectors
  const decayedUser   = applySignalDecay(user.hidden_signals   || {});
  const decayedEntity = applySignalDecay(experience.hidden_signals || {});

  // Compute overall affinity score
  const score = computeAffinityScore(decayedUser, decayedEntity);

  // Identify top aligned dimensions (delta < 0.3), sorted ascending by delta,
  // capped at 3.
  const dimEntries = DIMENSIONS.map((dim) => {
    const userVal   = typeof decayedUser[dim]   === 'number' ? decayedUser[dim]   : NEUTRAL;
    const entityVal = typeof decayedEntity[dim] === 'number' ? decayedEntity[dim] : NEUTRAL;
    const delta     = Math.abs(userVal - entityVal);
    return { dim, user_val: userVal, entity_val: entityVal, delta };
  });

  const top_dims = dimEntries
    .filter((d) => d.delta < 0.3)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3);

  const entry = {
    experience_id: experienceId,
    score,
    top_dims,
    computed_at: new Date()
  };

  await affinityCache.setAffinityEntry(userId, experienceId, entry);

  backendLogger.debug('[hidden-signals] computeAndCacheAffinity: affinity cached', {
    userId: userId.toString(),
    experienceId: experienceId.toString(),
    score,
    topDimsCount: top_dims.length
  });
}

/**
 * Fire-and-forget: check whether experience content signals are stale; if so,
 * recompute them, then compute and cache the user ↔ experience affinity score.
 *
 * Never throws — errors are logged and silently absorbed.
 *
 * @param {string|import('mongoose').Types.ObjectId} experienceId
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {Date|string|null} computedAt - Timestamp of last signal computation.
 * @returns {Promise<void>}
 */
async function refreshSignalsAndAffinity(experienceId, userId, computedAt) {
  try {
    const config = require('./signals-config');
    const isStale = !computedAt || (Date.now() - new Date(computedAt).getTime() > config.SIGNALS_STALENESS_MS);
    if (isStale) {
      await updateExperienceSignals(experienceId); // awaited so affinity reads fresh signals
    }
    await computeAndCacheAffinity(userId, experienceId);
  } catch (err) {
    backendLogger.error('[hidden-signals] refreshSignalsAndAffinity failed', {
      experienceId: experienceId?.toString(),
      userId,
      error: err.message
    });
    // Never throw — fire-and-forget
  }
}

module.exports = {
  // Constants (exported for testing)
  ACTIVITY_TYPE_SIGNAL_MAP,
  EVENT_WEIGHT_MAP,
  EMA_ALPHA,
  DECAY_HALF_LIFE_DAYS,
  NEUTRAL,
  DIMENSIONS,
  // Pure functions
  updateHiddenSignals,
  aggregateGroupSignals,
  signalsToNaturalLanguage,
  applySignalDecay,
  computeExperienceSignalTags,
  computeTrustScore,
  computePopularityScore,
  computeAffinityScore,
  // Side-effectful
  processSignalEvent,
  updateExperienceSignals,
  computeAndCacheAffinity,
  refreshSignalsAndAffinity
};
