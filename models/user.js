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
 * @type {number}
 */
const SALT_ROUNDS = parseInt(6);

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
     * Reference to user's profile photo (kept for backward compatibility)
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

module.exports = mongoose.model("User", userSchema);
