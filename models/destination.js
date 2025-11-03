const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
    state: {
      type: String,
    },
    map_location: { type: String },
    users_favorite: [{ type: Schema.Types.ObjectId, ref: "User" }],
    photos: {
      type: [Schema.Types.ObjectId],
      ref: "Photo",
      default: []
    },
    default_photo_id: { 
      type: Schema.Types.ObjectId, 
      ref: "Photo" 
    },
    travel_tips: {
      type: [Schema.Types.Mixed],
      default: [],
      validate: {
        validator: function(tips) {
          return tips.every(tip => {
            // Must be string or object with type and value fields
            if (typeof tip === 'string') return true;
            if (typeof tip === 'object' && tip !== null) {
              return tip.type && typeof tip.value === 'string';
            }
            return false;
          });
        },
        message: 'Travel tips must be strings or structured tip objects with type and value'
      }
    },
    visibility: {
      type: String,
      enum: ['private', 'contributors', 'public'],
      default: 'public'
    },
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

/**
 * Database indexes for query performance optimization
 */
destinationSchema.index({ name: 1, country: 1 });
destinationSchema.index({ country: 1 });
destinationSchema.index({ 'permissions._id': 1 });
destinationSchema.index({ users_favorite: 1 });
destinationSchema.index({ createdAt: -1 });
destinationSchema.index({ photos: 1 });
destinationSchema.index({ default_photo_id: 1 });

module.exports = mongoose.model("Destination", destinationSchema);
