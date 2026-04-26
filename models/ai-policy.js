/**
 * AI Policy Model
 *
 * Defines guardrail policies for AI usage. There is one global policy
 * (scope: 'global', target: null) and optional per-user policies.
 * The gateway resolves the effective policy by merging the chain:
 * entity ai_config → user policy → global policy → env defaults.
 *
 * @module models/ai-policy
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { SUPPORTED_PROVIDERS } = require('../utilities/ai-providers');

// Heuristic ReDoS detector. Flags nested unbounded quantifiers like
// /(a+)+/, /(a*)*/, /(.+)+/ — the most common catastrophic-backtracking class.
// Not exhaustive; pair with review for untrusted input.
const NESTED_QUANTIFIER_RE = /\([^)]*[+*][^)]*\)[+*]/;

function validateRegexPattern(pattern) {
  if (typeof pattern !== 'string' || pattern.length === 0) return false;
  try {
    new RegExp(pattern);
  } catch (_e) {
    return false;
  }
  return !NESTED_QUANTIFIER_RE.test(pattern);
}

const regexPatternField = {
  type: String,
  validate: {
    validator: validateRegexPattern,
    message: 'Invalid or catastrophic regex pattern: {VALUE}'
  }
};

const allowedModelSchema = new Schema({
  provider: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    enum: SUPPORTED_PROVIDERS
  },
  models: {
    type: [{ type: String, trim: true, lowercase: true }],
    default: []
  }
}, { _id: false });

const taskRoutingSchema = new Schema({
  task: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  intent: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  provider: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    enum: SUPPORTED_PROVIDERS
  },
  model: {
    type: String,
    trim: true,
    default: null
  },
  max_tokens: {
    type: Number,
    default: null,
    min: 1
  },
  temperature: {
    type: Number,
    default: null,
    min: 0,
    max: 2
  }
}, { _id: false });

// Mongoose ignores `validate` in schema options; enforce via pre-hook instead.
taskRoutingSchema.pre('validate', function (next) {
  if (!this.task && !this.intent) {
    return next(new Error('A routing rule must specify at least a task or an intent'));
  }
  next();
});

const providerListField = {
  type: [{ type: String, lowercase: true, trim: true, enum: SUPPORTED_PROVIDERS }],
  default: []
};

const aiPolicySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  scope: {
    type: String,
    required: true,
    enum: ['global', 'user'],
    default: 'global'
  },
  target: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Provider restrictions
  allowed_providers: providerListField,
  blocked_providers: providerListField,

  // Ordered list of fallback providers to try when the primary provider fails
  // with a transient error (5xx, timeout) after all retries are exhausted.
  fallback_providers: providerListField,

  // Model restrictions
  allowed_models: {
    type: [allowedModelSchema],
    default: []
  },

  // Rate limits
  rate_limits: {
    requests_per_minute: { type: Number, default: null, min: 1 },
    requests_per_hour: { type: Number, default: null, min: 1 },
    requests_per_day: { type: Number, default: null, min: 1 }
  },

  // Token budgets
  token_budget: {
    daily_input_tokens: { type: Number, default: null, min: 0 },
    daily_output_tokens: { type: Number, default: null, min: 0 },
    monthly_input_tokens: { type: Number, default: null, min: 0 },
    monthly_output_tokens: { type: Number, default: null, min: 0 }
  },

  // Task routing overrides
  task_routing: {
    type: [taskRoutingSchema],
    default: []
  },

  // Content filtering
  content_filtering: {
    enabled: { type: Boolean, default: false },
    block_patterns: { type: [regexPatternField], default: [] },
    redact_patterns: { type: [regexPatternField], default: [] }
  },

  // Hard cap on tokens per request
  max_tokens_per_request: {
    type: Number,
    default: 4000,
    min: 1
  },

  // Hard cap on total LLM call attempts across the entire failover chain.
  // Without this, worst-case is (maxRetries + 1) × len(providerChain) calls,
  // which is a runaway cost path. Counted as: every callProvider() invocation
  // (success or failure) increments the counter; once counter >= cap, the
  // gateway short-circuits and throws a clear cap-reached error.
  max_total_attempts: {
    type: Number,
    default: 5,
    min: 1
  },

  active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updated_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Cross-field invariants: scope↔target consistency and provider overlap.
aiPolicySchema.pre('validate', function (next) {
  if (this.scope === 'user' && !this.target) {
    return next(new Error('user-scoped policy requires a target user'));
  }
  if (this.scope === 'global' && this.target) {
    return next(new Error('global-scoped policy must have null target'));
  }

  const allowed = new Set((this.allowed_providers || []).map((p) => String(p).toLowerCase()));
  for (const p of (this.blocked_providers || [])) {
    if (allowed.has(String(p).toLowerCase())) {
      return next(new Error(`Provider "${p}" cannot appear in both allowed_providers and blocked_providers`));
    }
  }

  next();
});

// Only one global policy and one policy per user.
aiPolicySchema.index({ scope: 1, target: 1 }, { unique: true });
// The {active, scope} index was removed: the hot path fetches by (scope, target)
// via the unique index above and checks `active` in memory.

// Auto-invalidate the gateway's in-process policy cache on writes so callers
// don't have to remember. Lazy-required to avoid circular deps.
function invalidateGatewayCache() {
  try {
    require('../utilities/ai-gateway').invalidatePolicyCache();
  } catch (_e) {
    // Gateway may not be loaded (e.g. in unit tests). Safe to ignore.
  }
}
aiPolicySchema.post('save', invalidateGatewayCache);
aiPolicySchema.post('findOneAndUpdate', invalidateGatewayCache);
aiPolicySchema.post('findOneAndDelete', invalidateGatewayCache);
aiPolicySchema.post('deleteOne', invalidateGatewayCache);

/**
 * Resolve the effective policy for a user by falling back user → global.
 * Convenience for non-gateway callers; the gateway has its own bulk cache
 * in utilities/ai-gateway.js.
 *
 * @param {string|mongoose.Types.ObjectId|null} userId
 * @returns {Promise<Object|null>} Lean policy document or null.
 */
aiPolicySchema.statics.findEffective = async function findEffective(userId) {
  if (userId) {
    const userPolicy = await this.findOne({
      scope: 'user',
      target: userId,
      active: true
    }).lean();
    if (userPolicy) return userPolicy;
  }
  return this.findOne({ scope: 'global', active: true }).lean();
};

const AIPolicy = mongoose.model('AIPolicy', aiPolicySchema);
AIPolicy.SUPPORTED_PROVIDERS = SUPPORTED_PROVIDERS;

module.exports = AIPolicy;
