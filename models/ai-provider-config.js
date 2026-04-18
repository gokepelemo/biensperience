/**
 * AI Provider Config Model
 *
 * Stores AI provider configurations in the database instead of hardcoded constants.
 * Each document represents one provider (OpenAI, Anthropic, etc.) with its endpoint,
 * valid models, and active/inactive state.
 *
 * API keys remain in environment variables for security — the env_key_name field
 * tells the gateway which env var to read.
 *
 * @module models/ai-provider-config
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { SUPPORTED_PROVIDERS } = require('../utilities/ai-providers');

const aiProviderConfigSchema = new Schema({
  provider: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    enum: SUPPORTED_PROVIDERS
  },
  display_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  endpoint: {
    type: String,
    required: true,
    trim: true
  },
  api_version: {
    type: String,
    trim: true,
    default: null
  },
  default_model: {
    type: String,
    required: true,
    trim: true
  },
  valid_models: {
    type: [String],
    default: []
  },
  enabled: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0
  },
  env_key_name: {
    type: String,
    required: true,
    trim: true
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

// Index for quick lookups by provider name
aiProviderConfigSchema.index({ provider: 1 }, { unique: true });

// Index for listing enabled providers by priority
aiProviderConfigSchema.index({ enabled: 1, priority: 1 });

module.exports = mongoose.model('AIProviderConfig', aiProviderConfigSchema);
