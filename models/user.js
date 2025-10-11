/**
 * User model for Biensperience application.
 * Defines the schema for user accounts with authentication and profile data.
 *
 * @module User
 */

const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcrypt");

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
     * @required
     */
    password: {
      type: String,
      trim: true,
      minLength: 3,
      required: true,
    },

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
    default_photo_index: { type: Number, default: 0 }
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
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  return next();
});

module.exports = mongoose.model("User", userSchema);
