const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const photoObjectSchema = new Schema({
  url: { type: String, required: true },
  photo_credit: { type: String, default: 'Unknown' },
  photo_credit_url: { type: String }
}, { _id: false });

const permissionSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  entity: { 
    type: String, 
    required: true,
    enum: ['user', 'destination', 'experience']
  },
  type: { 
    type: String,
    enum: ['owner', 'collaborator', 'contributor'],
    // Only required for user entities
    validate: {
      validator: function(v) {
        // If entity is 'user', type must be present
        return this.entity !== 'user' || (v && v.length > 0);
      },
      message: 'Permission type is required for user entities'
    }
  }
}, { _id: false });

const destinationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    state: {
      type: String,
    },
    map_location: { type: String },
    users_favorite: [{ type: Schema.Types.ObjectId, ref: "User" }],
    photo: { type: Schema.Types.ObjectId, ref: "Photo" }, // Keep for backward compatibility during migration
    photos: {
      type: [photoObjectSchema],
      default: []
    },
    default_photo_index: { type: Number, default: 0 },
    travel_tips: [String],
    permissions: {
      type: [permissionSchema],
      default: [],
      validate: {
        validator: function(permissions) {
          // Check for duplicate permissions
          const seen = new Set();
          for (const perm of permissions) {
            const key = `${perm.entity}:${perm._id}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
          }
          return true;
        },
        message: 'Duplicate permissions are not allowed'
      }
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Destination", destinationSchema);
