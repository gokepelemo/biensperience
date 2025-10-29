/**
 * API Token model for Biensperience application.
 * Allows users to generate API keys with the same permissions as their user account.
 * API tokens bypass CSRF protection and can be used for programmatic access.
 *
 * @module ApiToken
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const crypto = require("crypto");
const logger = require("../utilities/backend-logger");

/**
 * Mongoose schema for API Token model
 * @type {mongoose.Schema}
 */
const apiTokenSchema = new Schema(
  {
    /**
     * Reference to the user who owns this token
     * @type {mongoose.Schema.Types.ObjectId}
     * @ref User
     * @required
     */
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    /**
     * Hashed token value (only the hash is stored)
     * @type {string}
     * @required
     */
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    /**
     * First 8 characters of the token for display purposes
     * Helps users identify which token they're looking at
     * @type {string}
     */
    tokenPrefix: {
      type: String,
      required: true
    },

    /**
     * User-provided name/description for this token
     * @type {string}
     */
    name: {
      type: String,
      trim: true,
      default: 'API Token'
    },

    /**
     * Last time this token was used
     * @type {Date}
     */
    lastUsed: {
      type: Date
    },

    /**
     * Token expiration date (optional)
     * If null, token never expires
     * @type {Date}
     */
    expiresAt: {
      type: Date
    },

    /**
     * Whether this token is active
     * Allows revoking tokens without deleting them
     * @type {boolean}
     */
    isActive: {
      type: Boolean,
      default: true
    },

    /**
     * IP address where the token was created
     * @type {string}
     */
    createdFrom: {
      type: String
    },

    /**
     * User agent where the token was created
     * @type {string}
     */
    createdUserAgent: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

/**
 * Generate a secure random API token
 * @returns {string} - 64-character hex string
 */
apiTokenSchema.statics.generateToken = function() {
  // Generate 32 bytes (256 bits) of random data
  // This becomes 64 hex characters
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a token for storage
 * @param {string} token - Plain text token
 * @returns {string} - SHA-256 hash of the token
 */
apiTokenSchema.statics.hashToken = function(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Get token prefix for display
 * @param {string} token - Plain text token
 * @returns {string} - First 8 characters
 */
apiTokenSchema.statics.getTokenPrefix = function(token) {
  return token.substring(0, 8);
};

/**
 * Create a new token for a user
 * @param {string} userId - User ID
 * @param {Object} options - Token options
 * @param {string} options.name - Token name/description
 * @param {Date} options.expiresAt - Expiration date
 * @param {string} options.createdFrom - IP address
 * @param {string} options.createdUserAgent - User agent
 * @returns {Promise<{token: string, apiToken: Object}>} - Plain token and saved document
 */
apiTokenSchema.statics.createToken = async function(userId, options = {}) {
  const token = this.generateToken();
  const tokenHash = this.hashToken(token);
  const tokenPrefix = this.getTokenPrefix(token);

  const apiToken = await this.create({
    user: userId,
    tokenHash,
    tokenPrefix,
    name: options.name || 'API Token',
    expiresAt: options.expiresAt,
    createdFrom: options.createdFrom,
    createdUserAgent: options.createdUserAgent
  });

  // Return both the plain token (only time it's visible) and the saved document
  return { token, apiToken };
};

/**
 * Find a user by their API token
 * @param {string} token - Plain text token
 * @returns {Promise<Object|null>} - User object or null
 */
apiTokenSchema.statics.findUserByToken = async function(token) {
  const tokenHash = this.hashToken(token);

  const apiToken = await this.findOne({
    tokenHash,
    isActive: true
  }).populate('user');

  if (!apiToken) {
    return null;
  }

  // Check expiration
  if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
    return null;
  }

  // Update last used timestamp (async, don't wait)
  apiToken.lastUsed = new Date();
  apiToken.save().catch(err => {
    // Log error but don't fail the request
    logger.error('Failed to update lastUsed timestamp', { tokenId: apiToken._id, error: err.message });
  });

  return apiToken.user;
};

/**
 * Revoke a token
 * @param {string} tokenId - Token document ID
 * @returns {Promise<boolean>} - True if revoked
 */
apiTokenSchema.statics.revokeToken = async function(tokenId) {
  const result = await this.updateOne(
    { _id: tokenId },
    { isActive: false }
  );

  return result.modifiedCount > 0;
};

/**
 * Delete a token permanently
 * @param {string} tokenId - Token document ID
 * @returns {Promise<boolean>} - True if deleted
 */
apiTokenSchema.statics.deleteToken = async function(tokenId) {
  const result = await this.deleteOne({ _id: tokenId });
  return result.deletedCount > 0;
};

/**
 * Get all tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of token documents (without hashes)
 */
apiTokenSchema.statics.getUserTokens = async function(userId) {
  return this.find({ user: userId })
    .select('-tokenHash') // Don't return the hash
    .sort('-createdAt');
};

/**
 * Clean up expired tokens
 * @returns {Promise<number>} - Number of tokens deleted
 */
apiTokenSchema.statics.cleanupExpiredTokens = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });

  return result.deletedCount;
};

/**
 * Database indexes for query performance
 */
apiTokenSchema.index({ user: 1, isActive: 1 });
apiTokenSchema.index({ expiresAt: 1 }, { sparse: true });
apiTokenSchema.index({ createdAt: -1 });

module.exports = mongoose.model("ApiToken", apiTokenSchema);
