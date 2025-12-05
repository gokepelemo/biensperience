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

// Preferences.language validation is handled at controller level using
// the canonical `src/lang.constants.js` module as the single source of truth.
// Defining a simple default here; controller will enforce available codes.
const DEFAULT_LANG = 'en';

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
     * Array of photo objects for user profile
     * @type {Array}
     */
    photos: {
      type: [Schema.Types.ObjectId],
      ref: "Photo",
      default: []
    },
    default_photo_id: { 
      type: Schema.Types.ObjectId, 
      ref: "Photo" 
    },

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
     * User preferences for platform settings
     * Includes theme, currency, language, profile visibility and notification preferences
     */
    preferences: {
      type: new Schema({
        theme: { type: String, enum: ['light', 'dark', 'system-default'], default: 'system-default' },
        currency: { type: String, default: 'USD' },
        language: { type: String, default: DEFAULT_LANG },
        timezone: { type: String, default: 'UTC' },
        profileVisibility: { type: String, enum: ['private','public'], default: 'public' },
        notifications: {
          enabled: { type: Boolean, default: true },
          // channels: email, push, sms
          channels: { type: [String], enum: ['email','push','sms'], default: ['email'] },
          // types: activity, reminders, marketing, updates
          types: { type: [String], enum: ['activity','reminder','marketing','updates'], default: ['activity','reminder'] }
        }
      }, { _id: false }),
      default: {}
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
    },

    /**
     * Feature flags for the user
     * Controls access to experimental or premium features
     * @type {Array<Object>}
     */
    feature_flags: {
      type: [new Schema({
        /**
         * Unique feature flag identifier (e.g., 'ai_features', 'beta_ui')
         * @type {string}
         */
        flag: {
          type: String,
          required: true,
          trim: true,
          lowercase: true
        },
        /**
         * Whether the flag is enabled
         * @type {boolean}
         */
        enabled: {
          type: Boolean,
          default: true
        },
        /**
         * Optional configuration for the flag (JSON-compatible)
         * @type {Object}
         */
        config: {
          type: Schema.Types.Mixed,
          default: {}
        },
        /**
         * When the flag was granted
         * @type {Date}
         */
        granted_at: {
          type: Date,
          default: Date.now
        },
        /**
         * Who granted the flag (admin user ID)
         * @type {ObjectId}
         */
        granted_by: {
          type: Schema.Types.ObjectId,
          ref: 'User'
        },
        /**
         * Optional expiration date for time-limited flags
         * @type {Date}
         */
        expires_at: {
          type: Date,
          default: null
        },
        /**
         * Reason for granting the flag
         * @type {string}
         */
        reason: {
          type: String,
          trim: true
        }
      }, { _id: true })],
      default: []
    },

    /**
     * User's bio/about text (curator profile)
     * Only displayed if user has curator feature flag
     * @type {string}
     */
    bio: {
      type: String,
      trim: true,
      maxLength: 500
    },

    /**
     * User's external links (website, social, etc.)
     * Only displayed if user has curator feature flag
     * @type {Array<Object>}
     */
    links: {
      type: [new Schema({
        /**
         * Display title for the link
         * @type {string}
         */
        title: {
          type: String,
          required: true,
          trim: true,
          maxLength: 100
        },
        /**
         * URL of the link
         * @type {string}
         */
        url: {
          type: String,
          required: true,
          trim: true,
          validate: {
            validator: function(v) {
              // Basic URL validation
              try {
                new URL(v);
                return true;
              } catch (e) {
                return false;
              }
            },
            message: 'Invalid URL format'
          }
        },
        /**
         * Optional metadata for the link
         * @type {Object}
         */
        meta: {
          type: Schema.Types.Mixed,
          default: {}
        }
      }, { _id: true })],
      default: []
    },

    /**
     * User's location with GeoJSON-compatible coordinates
     * Supports city names, zip codes, and full addresses via geocoding
     * @type {Object}
     */
    location: {
      type: new Schema({
        /**
         * Full formatted address from geocoding
         * @type {string}
         */
        displayName: { type: String },

        /**
         * City/Town/Village name
         * @type {string}
         */
        city: { type: String },

        /**
         * State/Province/Region name
         * @type {string}
         */
        state: { type: String },

        /**
         * Country name
         * @type {string}
         */
        country: { type: String },

        /**
         * ISO 3166-1 alpha-2 country code (e.g., 'US', 'FR')
         * @type {string}
         */
        countryCode: { type: String, uppercase: true, maxLength: 2 },

        /**
         * Postal/Zip code
         * @type {string}
         */
        postalCode: { type: String },

        /**
         * GeoJSON Point for MongoDB 2dsphere index
         * Format: { type: 'Point', coordinates: [longitude, latitude] }
         * @type {Object}
         */
        coordinates: {
          type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
          },
          coordinates: {
            type: [Number], // [longitude, latitude]
            validate: {
              validator: function(coords) {
                if (!coords || coords.length !== 2) return true; // Allow empty
                const [lng, lat] = coords;
                return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
              },
              message: 'Invalid coordinates: longitude must be -180 to 180, latitude must be -90 to 90'
            }
          }
        },

        /**
         * Original query string entered by user
         * @type {string}
         */
        originalQuery: { type: String },

        /**
         * Timestamp when location was geocoded
         * @type {Date}
         */
        geocodedAt: { type: Date }
      }, { _id: false })
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
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ provider: 1 });
userSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 });
userSchema.index({ emailConfirmationToken: 1, emailConfirmationExpires: 1 });
userSchema.index({ currentSessionId: 1 });
userSchema.index({ sessionExpiresAt: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ photos: 1 });
userSchema.index({ default_photo_id: 1 });
userSchema.index({ 'location.coordinates': '2dsphere' });
userSchema.index({ 'location.city': 1 });
userSchema.index({ 'location.country': 1 });
userSchema.index({ 'feature_flags.flag': 1 });
userSchema.index({ 'feature_flags.enabled': 1, 'feature_flags.flag': 1 });

module.exports = mongoose.model("User", userSchema);
