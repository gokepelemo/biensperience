/**
 * Intent Classifier Config Model
 *
 * Singleton configuration for the BienBot intent classifier.
 * Controls confidence thresholds, LLM fallback behaviour,
 * and classification logging settings.
 *
 * @module models/intent-classifier-config
 */

const mongoose = require('mongoose');

const intentClassifierConfigSchema = new mongoose.Schema(
  {
    low_confidence_threshold: {
      type: Number,
      default: 0.65,
      min: 0,
      max: 1
    },
    llm_fallback_enabled: {
      type: Boolean,
      default: false
    },
    llm_fallback_threshold: {
      type: Number,
      default: 0.4,
      min: 0,
      max: 1
    },
    log_all_classifications: {
      type: Boolean,
      default: false
    },
    log_retention_days: {
      type: Number,
      default: 90,
      min: 1,
      max: 365
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

/**
 * Get or create the singleton config document.
 */
intentClassifierConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

module.exports = mongoose.model('IntentClassifierConfig', intentClassifierConfigSchema);
