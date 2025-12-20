/**
 * Invite Code model for Biensperience application.
 * Allows users to be invited to the platform with pre-configured experiences and destinations.
 *
 * @module InviteCode
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const crypto = require("crypto");

/**
 * Mongoose schema for Invite Code model
 * @type {mongoose.Schema}
 */
const inviteCodeSchema = new Schema(
  {
    /**
     * The invite code itself (human-readable, unique)
     * @type {string}
     * @required
     */
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },

    /**
     * Reference to the user who created this invite
     * @type {mongoose.Schema.Types.ObjectId}
     * @ref User
     * @required
     */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    /**
     * Email address this invite is intended for (optional)
     * If set, only this email can use the code
     * @type {string}
     */
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true
    },

    /**
     * Name of the person being invited (optional)
     * Used for personalization in invite emails
     * @type {string}
     */
    inviteeName: {
      type: String,
      trim: true
    },

    /**
     * Experiences to be added to the user's plan upon signup
     * @type {Array<mongoose.Schema.Types.ObjectId>}
     * @ref Experience
     */
    experiences: [{
      type: Schema.Types.ObjectId,
      ref: "Experience"
    }],

    /**
     * Destinations to be added to the user's favorites upon signup
     * @type {Array<mongoose.Schema.Types.ObjectId>}
     * @ref Destination
     */
    destinations: [{
      type: Schema.Types.ObjectId,
      ref: "Destination"
    }],

    /**
     * Maximum number of times this code can be used
     * null = unlimited uses
     * @type {number}
     */
    maxUses: {
      type: Number,
      default: 1
    },

    /**
     * Number of times this code has been used
     * @type {number}
     */
    usedCount: {
      type: Number,
      default: 0
    },

    /**
     * Users who have redeemed this invite code
     * @type {Array<mongoose.Schema.Types.ObjectId>}
     * @ref User
     */
    redeemedBy: [{
      type: Schema.Types.ObjectId,
      ref: "User"
    }],

    /**
     * Invite code expiration date (optional)
     * If null, code never expires
     * @type {Date}
     */
    expiresAt: {
      type: Date
    },

    /**
     * Whether this invite code is active
     * @type {boolean}
     */
    isActive: {
      type: Boolean,
      default: true
    },

    /**
     * Custom message to include in the invite email
     * @type {string}
     */
    customMessage: {
      type: String,
      trim: true
    },

    /**
     * Permission type to grant when redeeming the invite
     * @type {string}
     */
    permissionType: {
      type: String,
      enum: ['owner', 'collaborator', 'contributor'],
      default: 'owner'
    },

    /**
     * Metadata about where this invite was sent
     * @type {Object}
     */
    inviteMetadata: {
      sentAt: Date,
      sentFrom: String, // IP address
      emailSent: { type: Boolean, default: false }
    },

    /**
     * Whether to create mutual follow relationship when invite is redeemed
     * When true, the inviter and invitee will automatically follow each other
     * @type {boolean}
     */
    mutualFollow: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

/**
 * Generate a random invite code
 * Format: XXX-XXX-XXX (e.g., ABC-DEF-GHI)
 * @returns {string} - 11-character code with dashes
 */
inviteCodeSchema.statics.generateCode = function() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars: 0, O, 1, I
  const segments = 3;
  const segmentLength = 3;
  const code = [];

  for (let i = 0; i < segments; i++) {
    let segment = '';
    for (let j = 0; j < segmentLength; j++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      segment += chars[randomIndex];
    }
    code.push(segment);
  }

  return code.join('-');
};

/**
 * Create a new invite code
 * @param {Object} options - Invite code options
 * @param {string} options.createdBy - User ID who created the invite
 * @param {string} options.email - Email address (optional)
 * @param {string} options.inviteeName - Invitee name (optional)
 * @param {Array<string>} options.experiences - Experience IDs (optional)
 * @param {Array<string>} options.destinations - Destination IDs (optional)
 * @param {number} options.maxUses - Maximum uses (default: 1)
 * @param {Date} options.expiresAt - Expiration date (optional)
 * @param {string} options.customMessage - Custom message (optional)
 * @returns {Promise<Object>} - Created invite code document
 */
inviteCodeSchema.statics.createInvite = async function(options) {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  // Generate unique code (retry if collision)
  while (attempts < maxAttempts) {
    code = this.generateCode();
    const existing = await this.findOne({ code });
    if (!existing) break;
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique invite code after maximum attempts');
  }

  const invite = await this.create({
    code,
    createdBy: options.createdBy,
    email: options.email,
    inviteeName: options.inviteeName,
    experiences: options.experiences || [],
    destinations: options.destinations || [],
    permissionType: options.permissionType || 'owner',
    maxUses: options.maxUses !== undefined ? options.maxUses : 1,
    expiresAt: options.expiresAt,
    customMessage: options.customMessage,
    mutualFollow: options.mutualFollow || false
  });

  return invite;
};

/**
 * Validate an invite code
 * @param {string} code - Invite code to validate
 * @param {string} email - Email address attempting to use the code (optional)
 * @returns {Promise<{valid: boolean, error: string|null, invite: Object|null}>}
 */
inviteCodeSchema.statics.validateCode = async function(code, email = null) {
  const invite = await this.findOne({
    code: code.toUpperCase(),
    isActive: true
  });

  if (!invite) {
    return { valid: false, error: 'Invalid or inactive invite code', invite: null };
  }

  // Check expiration
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { valid: false, error: 'Invite code has expired', invite: null };
  }

  // Check usage limit
  if (invite.maxUses && invite.usedCount >= invite.maxUses) {
    return { valid: false, error: 'Invite code has reached maximum uses', invite: null };
  }

  // Check email restriction
  if (invite.email && email && invite.email !== email.toLowerCase()) {
    return { valid: false, error: 'This invite code is for a different email address', invite: null };
  }

  return { valid: true, error: null, invite };
};

/**
 * Redeem an invite code for a user
 * @param {string} code - Invite code
 * @param {string} userId - User ID redeeming the code
 * @returns {Promise<{success: boolean, error: string|null, invite: Object|null}>}
 */
inviteCodeSchema.statics.redeemCode = async function(code, userId) {
  const invite = await this.findOne({
    code: code.toUpperCase(),
    isActive: true
  }).populate('experiences destinations');

  if (!invite) {
    return { success: false, error: 'Invalid or inactive invite code', invite: null };
  }

  // Check if already redeemed by this user
  if (invite.redeemedBy.some(id => id.toString() === userId.toString())) {
    return { success: false, error: 'You have already used this invite code', invite: null };
  }

  // Validate the code
  const validation = await this.validateCode(code);
  if (!validation.valid) {
    return { success: false, error: validation.error, invite: null };
  }

  // Increment usage count and add user to redeemed list
  invite.usedCount += 1;
  invite.redeemedBy.push(userId);
  await invite.save();

  return { success: true, error: null, invite };
};

/**
 * Get all invites created by a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of invite code documents
 */
inviteCodeSchema.statics.getUserInvites = async function(userId) {
  return this.find({ createdBy: userId })
    .populate('redeemedBy', 'name email')
    .sort('-createdAt');
};

/**
 * Deactivate an invite code
 * @param {string} inviteId - Invite code document ID
 * @returns {Promise<boolean>} - True if deactivated
 */
inviteCodeSchema.statics.deactivateInvite = async function(inviteId) {
  const result = await this.updateOne(
    { _id: inviteId },
    { isActive: false }
  );

  return result.modifiedCount > 0;
};

/**
 * Create multiple invites from a CSV upload
 * @param {Array<Object>} inviteData - Array of invite data objects
 * @param {string} createdBy - User ID who created the invites
 * @returns {Promise<{created: Array, errors: Array}>}
 */
inviteCodeSchema.statics.bulkCreateInvites = async function(inviteData, createdBy) {
  const created = [];
  const errors = [];

  for (let i = 0; i < inviteData.length; i++) {
    const data = inviteData[i];
    try {
      const invite = await this.createInvite({
        createdBy,
        email: data.email,
        inviteeName: data.name,
        experiences: data.experiences || [],
        destinations: data.destinations || [],
        maxUses: data.maxUses || 1,
        expiresAt: data.expiresAt,
        customMessage: data.customMessage
      });

      created.push(invite);
    } catch (error) {
      errors.push({
        row: i + 1,
        email: data.email,
        name: data.name,
        error: error.message
      });
    }
  }

  return { created, errors };
};

/**
 * Clean up expired invite codes
 * @returns {Promise<number>} - Number of invites deactivated
 */
inviteCodeSchema.statics.cleanupExpiredInvites = async function() {
  const result = await this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      isActive: true
    },
    {
      isActive: false
    }
  );

  return result.modifiedCount;
};

/**
 * Database indexes for query performance
 */
inviteCodeSchema.index({ createdBy: 1, createdAt: -1 });
inviteCodeSchema.index({ expiresAt: 1 }, { sparse: true });
inviteCodeSchema.index({ isActive: 1, usedCount: 1 });

module.exports = mongoose.model("InviteCode", inviteCodeSchema);
