/**
 * CollaboratorInvite Model
 * Stores pending collaborator invitations for users who don't have accounts yet
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const collaboratorInviteSchema = new Schema({
  // Email of the person being invited
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },

  // Person who sent the invite
  inviter: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Experience they're being invited to collaborate on
  experience: {
    type: Schema.Types.ObjectId,
    ref: 'Experience',
    required: true
  },

  // Unique token for accepting the invite
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Status of the invite
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'cancelled'],
    default: 'pending'
  },

  // When the invite was sent
  sentAt: {
    type: Date,
    default: Date.now
  },

  // When the invite expires (default: 30 days)
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  },

  // When/if the invite was accepted
  acceptedAt: {
    type: Date
  },

  // User ID if they accepted and created an account
  acceptedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for finding pending invites by email
collaboratorInviteSchema.index({ email: 1, status: 1 });

// Index for finding invites by experience
collaboratorInviteSchema.index({ experience: 1, status: 1 });

// Index for automatic cleanup of expired invites
collaboratorInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Check if invite is expired
 */
collaboratorInviteSchema.methods.isExpired = function() {
  return this.status === 'expired' || this.expiresAt < new Date();
};

/**
 * Mark invite as accepted
 */
collaboratorInviteSchema.methods.markAccepted = function(userId) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

/**
 * Mark invite as expired
 */
collaboratorInviteSchema.methods.markExpired = function() {
  this.status = 'expired';
  return this.save();
};

/**
 * Mark invite as cancelled
 */
collaboratorInviteSchema.methods.markCancelled = function() {
  this.status = 'cancelled';
  return this.save();
};

/**
 * Static method to find pending invite by token
 */
collaboratorInviteSchema.statics.findByToken = function(token) {
  return this.findOne({ token, status: 'pending' })
    .populate('inviter', 'name email')
    .populate('experience', 'name destination')
    .populate({
      path: 'experience',
      populate: {
        path: 'destination',
        select: 'name country state'
      }
    });
};

/**
 * Static method to find pending invites for an email
 */
collaboratorInviteSchema.statics.findPendingByEmail = function(email) {
  return this.find({
    email: email.toLowerCase(),
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
  .populate('inviter', 'name email')
  .populate('experience', 'name destination')
  .populate({
    path: 'experience',
    populate: {
      path: 'destination',
      select: 'name country state'
    }
  })
  .sort({ sentAt: -1 });
};

/**
 * Static method to find all invites for an experience
 */
collaboratorInviteSchema.statics.findByExperience = function(experienceId, includeExpired = false) {
  const query = { experience: experienceId };
  if (!includeExpired) {
    query.status = 'pending';
    query.expiresAt = { $gt: new Date() };
  }

  return this.find(query)
    .populate('inviter', 'name email')
    .populate('acceptedBy', 'name email')
    .sort({ sentAt: -1 });
};

module.exports = mongoose.model('CollaboratorInvite', collaboratorInviteSchema);
