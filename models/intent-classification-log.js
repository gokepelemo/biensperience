/**
 * Intent Classification Log Model
 *
 * Stores BienBot intent classification results for admin review.
 * Low-confidence classifications are flagged for review so admins
 * can correct intents and add utterances to the training corpus.
 *
 * @module models/intent-classification-log
 */

const mongoose = require('mongoose');

const intentClassificationLogSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true
    },
    intent: {
      type: String,
      required: true,
      trim: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BienBotSession'
    },
    is_low_confidence: {
      type: Boolean,
      default: false
    },
    llm_reclassified: {
      type: Boolean,
      default: false
    },
    llm_intent: {
      type: String,
      trim: true,
      default: null
    },
    reviewed: {
      type: Boolean,
      default: false
    },
    admin_corrected_intent: {
      type: String,
      trim: true,
      default: null
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewed_at: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

intentClassificationLogSchema.index({ is_low_confidence: 1, reviewed: 1, createdAt: -1 });
intentClassificationLogSchema.index({ intent: 1, createdAt: -1 });
intentClassificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('IntentClassificationLog', intentClassificationLogSchema);
