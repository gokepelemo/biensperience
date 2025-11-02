/**
 * User model for Biensperience application.
 * Defines the schema for user accounts with authentication and profile data.
 *
 * @module User
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcrypt");
const { USER_ROLES } = require("../utilities/user-roles");

/**
 * Number of salt rounds for password hashing
 * Recommended minimum is 12 for production security
 * @type {number}
 */
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || 12);

const photoObjectSchema = new Schema({
  url: { type: String, required: true },
  photo_credit: { type: String, default: 'Unknown' },
  photo_credit_url: { type: String }
}, { _id: false });

/**
 * Mongoose schema for User model
 * @type {mongoose.Schema}
 */
const userSchema = new Schema(
  {
    /**
     * User's full name
     * @type {string}
     * @required
     */
    name: { type: String, required: true },

    /**
     * User's email address (unique, trimmed, lowercase)
     * @type {string}
     * @required
     */
    email: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      required: true,
    },

    /**
     * User's hashed password
     * @type {string}
     * @required - Only for local auth, optional for OAuth
     */
    password: {
      type: String,
      trim: true,
      minLength: 3,
      required: function() {
        // Password required only if not using OAuth
        return !this.facebookId && !this.googleId && !this.twitterId;
      },
    },

    /**
     * Authentication provider
     * @type {string}
     * @enum ['local', 'facebook', 'google', 'twitter']
     */
    provider: {
      type: String,
      enum: ['local', 'facebook', 'google', 'twitter'],
      default: 'local'
    },

    /**
     * Facebook OAuth ID
     * @type {string}
     */
    facebookId: {
      type: String,
      unique: true,
      sparse: true,
    },

    /**
     * Google OAuth ID
     * @type {string}
     */
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    /**
     * Twitter OAuth ID
     * @type {string}
     */
    twitterId: {
      type: String,
      unique: true,
      sparse: true,
    },

    /**
     * OAuth profile photo URL
     * @type {string}
     */
    oauthProfilePhoto: {
      type: String,
    },

    /**
     * Linked social accounts
     * @type {Array}
     */
    linkedAccounts: [{
      provider: {
        type: String,
        enum: ['facebook', 'google', 'twitter'],
        required: true
      },
      providerId: {
        type: String,
        required: true
      },
      linkedAt: {
        type: Date,
        default: Date.now
      }
    }],

    /**
     * Reference to user's profile photo
     * @type {mongoose.Schema.Types.ObjectId}
     * @ref Photo
     */
    photo: {
      type: Schema.Types.ObjectId,
      ref: "Photo",
    },

    /**
     * Array of photo objects for user profile
     * @type {Array}
     */
    photos: {
      type: [photoObjectSchema],
      default: []
    },

    /**
     * Index of the default photo in photos array
     * @type {number}
     */
    default_photo_index: { type: Number, default: 0 },

    /**
     * Super admin flag - grants full permissions across the entire site
     * @type {boolean}
     */
    isSuperAdmin: { type: Boolean, default: false },

    /**
     * User role - enumeration of user types
     * @type {string}
     * @enum ['super_admin', 'regular_user']
     */
    role: {
      type: String,
      enum: Object.values(require("../utilities/user-roles").USER_ROLES),
      default: require("../utilities/user-roles").USER_ROLES.REGULAR_USER
    },

    /**
     * Password reset token
     * @type {string}
     */
    resetPasswordToken: {
      type: String,
      sparse: true
    },

    /**
     * Password reset token expiration
     * @type {Date}
     */
    resetPasswordExpires: {
      type: Date
    },

    /**
     * Email confirmation status
     * @type {boolean}
     */
    emailConfirmed: {
      type: Boolean,
      default: false
    },

    /**
     * Email confirmation token
     * @type {string}
     */
    emailConfirmationToken: {
      type: String,
      sparse: true
    },

    /**
     * Email confirmation token expiration
     * @type {Date}
     */
    emailConfirmationExpires: {
      type: Date
    },

    /**
     * Current session ID (bien-session-id)
     * Bound to user's login session, expires after 24h by default
     * @type {string}
     */
    currentSessionId: {
      type: String,
      sparse: true
    },

    /**
     * Session creation timestamp (epoch milliseconds)
     * Used to calculate session expiry
     * @type {number}
     */
    sessionCreatedAt: {
      type: Number
    },

    /**
     * Session expiration timestamp (epoch milliseconds)
     * Session is invalid after this time
     * @type {number}
     */
    sessionExpiresAt: {
      type: Number
    },

    /**
     * User profile visibility setting
     * @type {string}
     * @enum ['private', 'public']
     * @default 'public'
     */
    visibility: {
      type: String,
      enum: ['private', 'public'],
      default: 'public'
    },

    /**
     * Invite code used to sign up (optional)
     * @type {string}
     */
    inviteCode: {
      type: String,
      uppercase: true,
      trim: true
    },

    /**
     * Whether API access is enabled for this user
     * @type {boolean}
     * @default false
     */
    apiEnabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function (next) {
  // Set role based on isSuperAdmin flag
  if (this.isModified("isSuperAdmin")) {
    this.role = this.isSuperAdmin ? USER_ROLES.SUPER_ADMIN : USER_ROLES.REGULAR_USER;
  }

  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  return next();
});

/**
 * Instance method: Check if a session is valid
 * Validates session ID matches and hasn't expired
 * 
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} True if session is valid
 */
userSchema.methods.isSessionValid = function(sessionId) {
  if (!sessionId || !this.currentSessionId) {
    return false;
  }

  // Check session ID matches
  if (this.currentSessionId !== sessionId) {
    return false;
  }

  // Check session hasn't expired
  const now = Date.now();
  if (!this.sessionExpiresAt || now >= this.sessionExpiresAt) {
    return false;
  }

  return true;
};

/**
 * Generate JWT token for the user
 * @returns {string} JWT token for authentication
 */
userSchema.methods.generateToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { user: this },
    process.env.SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Database indexes for query performance optimization
 */
userSchema.index({ email: 1 });  // For login and search queries
userSchema.index({ role: 1 });  // For admin queries
userSchema.index({ provider: 1 });  // For OAuth queries
userSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 });  // For password reset lookups
userSchema.index({ emailConfirmationToken: 1, emailConfirmationExpires: 1 });  // For email confirmation
userSchema.index({ currentSessionId: 1 });  // For session validation lookups
userSchema.index({ sessionExpiresAt: 1 });  // For session expiry queries
userSchema.index({ createdAt: -1 });  // For sorting in getAllUsers

module.exports = mongoose.model("User", userSchema);
