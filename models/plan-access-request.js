const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * PlanAccessRequest
 * Represents a user's request to gain access to another user's Plan.
 */
const planAccessRequestSchema = new Schema(
  {
    plan: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
      index: true
    },
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined'],
      default: 'pending',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Only allow one open request per (plan, requester)
planAccessRequestSchema.index({ plan: 1, requester: 1 }, { unique: true });

module.exports = mongoose.model('PlanAccessRequest', planAccessRequestSchema);
