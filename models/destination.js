const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { hiddenSignalVectorSchema } = require('./hidden-signals');

const photoEntrySchema = new Schema({
  photo: { type: Schema.Types.ObjectId, ref: 'Photo', required: true },
  default: { type: Boolean, default: false }
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

/**
 * GeoJSON Point schema for location coordinates
 */
const geoPointSchema = new Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point'
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    validate: {
      validator: function(coords) {
        if (!coords || coords.length !== 2) return true; // Allow empty/null
        const [lng, lat] = coords;
        return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
      },
      message: 'Coordinates must be [longitude, latitude] with valid ranges'
    }
  }
}, { _id: false });

/**
 * Location schema for destinations
 * Stores human-readable address and GeoJSON Point for geocoding
 */
const locationSchema = new Schema({
  address: {
    type: String,
    trim: true
  },
  geo: {
    type: geoPointSchema,
    default: null
  },
  // Optional additional address components from geocoding
  city: String,
  state: String,
  country: String,
  postalCode: String,
  placeId: String // Google Place ID for reference
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
    overview: {
      type: String,
    },
    // Legacy field - kept for backward compatibility during migration
    map_location: { type: String },
    // New structured location field with geocoded coordinates
    location: {
      type: locationSchema,
      default: null
    },
    users_favorite: [{ type: Schema.Types.ObjectId, ref: "User" }],
    photos: {
      type: [photoEntrySchema],
      default: []
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
    travel_tips_updated_at: {
      type: Date,
      default: null
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
    /**
     * Aggregated behavioral signal profile for this destination.
     * Re-computed from child experience signals.
     */
    hidden_signals: {
      type: hiddenSignalVectorSchema,
      default: () => ({})
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
destinationSchema.index({ 'photos.photo': 1 });
// Spatial index for destination location (GeoJSON Point)
destinationSchema.index({ 'location.geo': '2dsphere' });

/**
 * Pre-save hook: enforce the photos invariant (exactly one default: true entry).
 */
destinationSchema.pre('save', function (next) {
  if (this.isModified('photos') && this.photos.length > 0) {
    const defaultCount = this.photos.filter(p => p.default).length;
    if (defaultCount === 0) {
      this.photos[0].default = true;
    } else if (defaultCount > 1) {
      let found = false;
      for (let i = this.photos.length - 1; i >= 0; i--) {
        if (this.photos[i].default && !found) {
          found = true;
        } else {
          this.photos[i].default = false;
        }
      }
    }
  }
  next();
});

module.exports = mongoose.model("Destination", destinationSchema);
