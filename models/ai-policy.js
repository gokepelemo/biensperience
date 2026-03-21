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

const allowedModelSchema = new Schema({
  provider: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  models: {
    type: [String],
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
    default: null
  },
  provider: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
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
}, {
  _id: false,
  validate: {
    validator: function () {
      return this.task || this.intent;
    },
    message: 'A routing rule must specify at least a task or an intent'
  }
});

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
  allowed_providers: {
    type: [String],
    default: []
  },
  blocked_providers: {
    type: [String],
    default: []
  },

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
    block_patterns: { type: [String], default: [] },
    redact_patterns: { type: [String], default: [] }
  },

  // Hard cap on tokens per request
  max_tokens_per_request: {
    type: Number,
    default: 4000,
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

// Only one global policy and one policy per user
aiPolicySchema.index({ scope: 1, target: 1 }, { unique: true });

// Quick lookup of active policies
aiPolicySchema.index({ active: 1, scope: 1 });

module.exports = mongoose.model('AIPolicy', aiPolicySchema);
