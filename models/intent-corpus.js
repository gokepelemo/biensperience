/**
 * Intent Corpus Model
 *
 * Stores BienBot intent training corpus in MongoDB so admins can
 * manage utterances without code deploys. The static JSON file
 * (`utilities/bienbot-intent-corpus.json`) serves as seed data.
 *
 * @module models/intent-corpus
 */

const mongoose = require('mongoose');

const intentCorpusSchema = new mongoose.Schema(
  {
    intent: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 100
    },
    utterances: {
      type: [String],
      default: [],
      validate: {
        validator: arr => arr.every(u => typeof u === 'string' && u.trim().length > 0),
        message: 'All utterances must be non-empty strings'
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    is_custom: {
      type: Boolean,
      default: false
    },
    enabled: {
      type: Boolean,
      default: true
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

intentCorpusSchema.index({ enabled: 1 });

module.exports = mongoose.model('IntentCorpus', intentCorpusSchema);
