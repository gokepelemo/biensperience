/**
 * Signals Configuration Loader
 *
 * Reads SIGNALS_CONFIG from the environment (a JSON string), deep-merges it
 * against the hardcoded defaults, validates numeric ranges, and re-normalises
 * sub-group weights so they always sum to 1.  The resulting frozen object is
 * the single source of truth for all content-signal weights and formula
 * coefficients throughout the application.
 *
 * Adding a new dimension (e.g. "reviews") requires no code change here —
 * add the key to DEFAULTS and it is automatically picked up and normalised.
 *
 * @module utilities/signals-config
 */

const logger = require('./backend-logger');

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Hardcoded defaults used when SIGNALS_CONFIG is absent or incomplete.
 * Sub-group weights do NOT need to sum to 1 here; normalisation is applied
 * after merging so partial overrides are safe.
 */
const DEFAULTS = {
  trustScore: {
    /** Boost when the experience creator has the 'curator' feature flag. */
    curator: 0.30,
    /** Boost when the experience is publicly listed. */
    public: 0.20,
    /** Boost derived from the ratio of plans that have at least one completed item. */
    completionRate: 0.20,
    /** Floor score awarded to any experience that has >= minPlanItems plans. */
    base: 0.10,
    /** Minimum plan count required to award the base score. */
    minPlanItems: 1,
  },
  popularity: {
    /** Weight of total distinct plan count. */
    planCount: 0.50,
    /** Weight of plans with at least one activity_type item. */
    planWithActivity: 0.30,
    /** Weight of plans with at least one completed item. */
    completedPlans: 0.20,
  },
  /**
   * Reviews dimension — weights accepted and normalised today so the schema
   * can be referenced in SIGNALS_CONFIG without a code change when the
   * reviews feature ships.
   */
  reviews: {
    /** Weight of the normalised average rating. */
    avgRating: 1.0,
  },
  /**
   * Affinity dimension — per-dimension importance weights for the user ↔ entity
   * hidden_signals similarity score (1 - weighted mean absolute difference).
   * Dimension weights are normalised to sum to 1 at startup.
   * Non-weight keys (confidenceThreshold, neutralAffinityScore) are passed through unchanged.
   */
  affinity: {
    energy:             0.15,
    novelty:            0.15,
    budget_sensitivity: 0.10,
    social:             0.10,
    structure:          0.10,
    food_focus:         0.15,
    cultural_depth:     0.15,
    comfort_zone:       0.10,
    /** Minimum confidence required on both vectors before affinity is computed.
     *  Below this, neutralAffinityScore is returned instead. */
    confidenceThreshold: 0.20,
    /** Score to return when confidence is too low to compute affinity meaningfully. */
    neutralAffinityScore: 0.50,
  },
  formula: {
    /** Share going to the adaptive/collaborative ranking score. */
    adaptiveFactor: 0.60,
    /** Share going to the stored trustScore. */
    trustScore: 0.10,
    /** Share going to the normalised popularity score. */
    popularity: 0.10,
    /** Share going to the freshly-computed recency decay score. */
    recencyBoost: 0.10,
    /** Share going to the user ↔ experience hidden_signals affinity score. */
    affinity: 0.10,
  },
  /**
   * Top-level scalar config keys (not weight groups — never normalised).
   * Stored directly on the config object, not nested inside a weight group.
   */
  SIGNALS_STALENESS_MS:   15 * 60 * 1000,  // 15 minutes
  AFFINITY_CACHE_TTL_MS:   6 * 60 * 60 * 1000, // 6 hours
};

// Keys whose numeric values are weights and should be normalised to sum to 1.
// Non-weight keys are excluded from normalisation but still validated:
//   - NON_WEIGHT_INTEGER_KEYS: must be non-negative integers (e.g. minPlanItems)
//   - NON_WEIGHT_FLOAT_KEYS:   must be finite non-negative numbers in [0, 1]
// NON_WEIGHT_KEYS is the union — the full exclusion set for normalisation.
const WEIGHT_GROUPS = ['trustScore', 'popularity', 'reviews', 'affinity', 'formula'];
const NON_WEIGHT_INTEGER_KEYS = new Set(['minPlanItems']);
const NON_WEIGHT_FLOAT_KEYS   = new Set(['confidenceThreshold', 'neutralAffinityScore']);
const NON_WEIGHT_KEYS         = new Set([...NON_WEIGHT_INTEGER_KEYS, ...NON_WEIGHT_FLOAT_KEYS]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deep-merge `override` into `base`, one level deep per signal group.
 * Returns a new object; does not mutate either argument.
 *
 * @param {Object} base
 * @param {Object} override
 * @returns {Object}
 */
function deepMerge(base, override) {
  const result = {};
  const allKeys = new Set([...Object.keys(base), ...Object.keys(override)]);
  for (const key of allKeys) {
    if (
      typeof base[key] === 'object' && base[key] !== null &&
      typeof override[key] === 'object' && override[key] !== null
    ) {
      result[key] = { ...base[key], ...override[key] };
    } else if (key in override) {
      result[key] = override[key];
    } else {
      result[key] = base[key];
    }
  }
  return result;
}

/**
 * Validate that all values in a weight group are finite numbers >= 0.
 * Logs a warning and uses the default for any invalid entry.
 *
 * @param {Object} group - Merged weight group (e.g. config.trustScore)
 * @param {Object} defaultGroup - Default values for the same group
 * @param {string} groupName - Name used in log messages
 * @returns {Object} Sanitised group
 */
function validateGroup(group, defaultGroup, groupName) {
  const sanitised = { ...group };
  for (const [key, val] of Object.entries(sanitised)) {
    if (NON_WEIGHT_INTEGER_KEYS.has(key)) {
      // Integer threshold (e.g. minPlanItems): must be a non-negative integer
      if (!Number.isInteger(val) || val < 0) {
        logger.warn(`[signals-config] ${groupName}.${key} must be a non-negative integer; using default`, {
          received: val,
          default: defaultGroup[key],
        });
        sanitised[key] = defaultGroup[key] ?? 1;
      }
      continue;
    }
    if (NON_WEIGHT_FLOAT_KEYS.has(key)) {
      // Float scalar (e.g. confidenceThreshold, neutralAffinityScore): must be finite [0, 1]
      if (typeof val !== 'number' || !isFinite(val) || val < 0 || val > 1) {
        logger.warn(`[signals-config] ${groupName}.${key} must be a number in [0, 1]; using default`, {
          received: val,
          default: defaultGroup[key],
        });
        sanitised[key] = defaultGroup[key] ?? 0;
      }
      continue;
    }
    if (typeof val !== 'number' || !isFinite(val) || val < 0) {
      logger.warn(`[signals-config] ${groupName}.${key} is invalid; using default`, {
        received: val,
        default: defaultGroup[key],
      });
      sanitised[key] = defaultGroup[key] ?? 0;
    }
  }
  return sanitised;
}

/**
 * Re-normalise the numeric weights within a group so they sum to 1.
 * Non-weight keys (minPlanItems) are passed through unchanged.
 *
 * @param {Object} group
 * @returns {Object}
 */
function normaliseWeights(group) {
  const weightKeys = Object.keys(group).filter(k => !NON_WEIGHT_KEYS.has(k));
  const sum = weightKeys.reduce((acc, k) => acc + (group[k] || 0), 0);

  if (sum === 0) {
    // Degenerate case: all weights are 0 — distribute equally
    const equal = 1 / (weightKeys.length || 1);
    const normalised = { ...group };
    for (const k of weightKeys) normalised[k] = equal;
    return normalised;
  }

  const normalised = { ...group };
  for (const k of weightKeys) normalised[k] = (group[k] || 0) / sum;
  return normalised;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Parse SIGNALS_CONFIG, merge with defaults, validate, normalise, and freeze.
 *
 * @returns {Object} Frozen, validated signals configuration.
 */
function loadSignalsConfig() {
  let override = {};

  const raw = process.env.SIGNALS_CONFIG;
  if (raw) {
    try {
      override = JSON.parse(raw);
      if (typeof override !== 'object' || override === null || Array.isArray(override)) {
        logger.warn('[signals-config] SIGNALS_CONFIG is not a plain object; ignoring');
        override = {};
      }
    } catch (err) {
      logger.warn('[signals-config] Failed to parse SIGNALS_CONFIG; using defaults', {
        error: err.message,
      });
      override = {};
    }
  }

  let merged = deepMerge(DEFAULTS, override);

  // Validate and normalise each weight group
  for (const groupName of WEIGHT_GROUPS) {
    if (!merged[groupName] || typeof merged[groupName] !== 'object') {
      merged[groupName] = { ...DEFAULTS[groupName] };
    }
    merged[groupName] = validateGroup(
      merged[groupName],
      DEFAULTS[groupName] || {},
      groupName
    );
    merged[groupName] = normaliseWeights(merged[groupName]);
  }

  // Pass through top-level scalar keys (not weight groups)
  const SCALAR_KEYS = ['SIGNALS_STALENESS_MS', 'AFFINITY_CACHE_TTL_MS'];
  for (const key of SCALAR_KEYS) {
    const overrideVal = override[key];
    if (overrideVal !== undefined) {
      if (typeof overrideVal === 'number' && isFinite(overrideVal) && overrideVal > 0) {
        merged[key] = overrideVal;
      } else {
        logger.warn(`[signals-config] ${key} must be a finite positive number; using default`, {
          received: overrideVal,
          default: DEFAULTS[key],
        });
        merged[key] = DEFAULTS[key];
      }
    } else {
      merged[key] = DEFAULTS[key];
    }
  }

  const config = Object.freeze(merged);

  logger.debug('[signals-config] Loaded signals configuration', {
    trustScore: config.trustScore,
    popularity: config.popularity,
    formula: config.formula,
  });

  return config;
}

// ---------------------------------------------------------------------------
// Singleton — parse once at module load time
// ---------------------------------------------------------------------------

const signalsConfig = loadSignalsConfig();

module.exports = signalsConfig;
