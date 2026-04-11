const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { hiddenSignalVectorSchema, contentSignalsSchema } = require('./hidden-signals');

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
 * Location schema for plan items
 * Stores human-readable address and GeoJSON Point for geocoding
 */
const planItemLocationSchema = new Schema({
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

const planItemSchema = new Schema({
  text: { type: String },
  photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  url: { type: String },
  cost_estimate: { type: Number },
  planning_days: { type: Number, default: 0 },
  parent: { type: mongoose.Schema.Types.ObjectId }, // reference to parent plan item
  // Activity type for grouping plan items
  // Expanded for travel and local exploration theme
  activity_type: {
    type: String,
    enum: [
      // Essentials
      'accommodation', 'transport', 'food', 'drinks', 'coffee',
      // Experiences
      'sightseeing', 'museum', 'nature', 'adventure', 'sports', 'entertainment',
      'wellness', 'tour', 'class', 'nightlife', 'religious', 'local',
      // Services
      'shopping', 'market', 'health', 'banking', 'communication', 'admin', 'laundry', 'rental',
      // Other
      'photography', 'meeting', 'work', 'rest', 'packing', 'checkpoint', 'custom',
      null
    ],
    default: null
  },
  // Location for the plan item (address and GeoJSON coordinates)
  location: {
    type: planItemLocationSchema,
    default: null
  },
  // Scheduled date and time for timeline organization
  scheduled_date: { type: Date, default: null },
  scheduled_time: { type: String, default: null } // HH:MM format
});

const experienceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    overview: {
      type: String,
      default: ''
    },
    destination: {
      type: Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
    },
    /**
     * Original owner's ID when experience is archived/transferred
     * Set when ownership is transferred to Archive User
     * Used to track who originally created the experience
     */
    archived_owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    map_location: {
      type: String,
    },
    // Location for the experience (address and GeoJSON coordinates)
    location: {
      type: planItemLocationSchema,
      default: null
    },
    experience_type: [String],
    // Array of slugified experience type values for fast, indexed lookup
    experience_type_slugs: {
      type: [String],
      index: true,
      default: []
    },
    plan_items: [planItemSchema],
    photos: {
      type: [photoEntrySchema],
      default: []
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
    // Difficulty rating (1-10 scale)
    difficulty: {
      type: Number,
      min: 1,
      max: 10,
      default: null
    },
    // General star rating (1-5 scale, supports half stars via 0.5 increments)
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: null
    },
    // AI configuration overrides for this entity
    ai_config: {
      type: new Schema({
        preferred_provider: { type: String, trim: true, lowercase: true, default: null },
        preferred_model: { type: String, trim: true, default: null },
        system_prompt_override: { type: String, maxlength: 2000, default: null },
        temperature: { type: Number, min: 0, max: 2, default: null },
        max_tokens: { type: Number, min: 1, default: null },
        language: { type: String, trim: true, default: null },
        disabled: { type: Boolean, default: false }
      }, { _id: false }),
      default: null
    },
    /**
     * Intrinsic behavioral signal profile for this experience.
     * Aggregated from plan_items activity types.
     */
    hidden_signals: {
      type: hiddenSignalVectorSchema,
      default: () => ({})
    },
    /**
     * Content-quality signals pre-computed at plan create/delete events.
     * trustScore   — curator / public / content quality blend
     * popularity   — raw plan-count metrics (normalised at ranking time)
     * reviews      — placeholder; written when the reviews feature ships
     * computed_at  — UTC timestamp of last computation (null = not yet run)
     *
     * Weights for each dimension are configured via SIGNALS_CONFIG env var.
     * Do NOT use this for user preference matching — that is hidden_signals.
     */
    signals: {
      type: contentSignalsSchema,
      default: () => ({})
    },
    /**
     * Auto-computed semantic tags derived from plan_items activity types.
     * Updated via pre-save middleware when plan_items is modified.
     */
    signal_tags: {
      type: [String],
      default: []
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

experienceSchema.index({ destination: 1 });

experienceSchema.virtual("cost_estimate").get(function () {
  const calculateTotalCost = (itemId) => {
    const item = this.plan_items.id(itemId);
    if (!item) return 0;
    let total = item.cost_estimate || 0;
    this.plan_items.forEach(subItem => {
      if (subItem.parent && subItem.parent.toString() === itemId.toString()) {
        total += calculateTotalCost(subItem._id);
      }
    });
    return total;
  };
  if (!this.plan_items || this.plan_items.length === 0) return 0;
  return this.plan_items.reduce((sum, item) => {
    if (!item.parent) { // only root items
      return sum + calculateTotalCost(item._id);
    }
    return sum;
  }, 0);
});

experienceSchema.virtual("max_planning_days").get(function () {
  const calculateMaxDays = (itemId) => {
    const item = this.plan_items.id(itemId);
    if (!item) return 0;
    let maxDays = item.planning_days || 0;
    this.plan_items.forEach(subItem => {
      if (subItem.parent && subItem.parent.toString() === itemId.toString()) {
        maxDays = Math.max(maxDays, calculateMaxDays(subItem._id));
      }
    });
    return maxDays;
  };
  if (!this.plan_items || this.plan_items.length === 0) return 0;
  return Math.max(...this.plan_items.filter(item => !item.parent).map(item => calculateMaxDays(item._id)));
});

experienceSchema.virtual("completion_percentage").get(function () {
  // Completion tracking is now handled per-plan, not at the experience level
  // Each user's plan has its own completion tracking via Plan model
  // Return 0 for backward compatibility
  return 0;
});

/**
 * Additional database indexes for query performance optimization
 */
experienceSchema.index({ name: 1 });
experienceSchema.index({ 'permissions._id': 1, 'permissions.type': 1 });
experienceSchema.index({ 'permissions._id': 1 });
experienceSchema.index({ experience_type: 1 });
// Index the slug array for fast tag lookups
experienceSchema.index({ experience_type_slugs: 1 });
experienceSchema.index({ destination: 1, createdAt: -1 });
experienceSchema.index({ createdAt: -1 });
experienceSchema.index({ 'permissions._id': 1, 'permissions.type': 1, name: 1 });
experienceSchema.index({ 'photos.photo': 1 });
// Spatial index for experience location (GeoJSON Point)
experienceSchema.index({ 'location.geo': '2dsphere' });

/**
 * Pre-save hook: enforce the photos invariant (exactly one default: true entry).
 */
experienceSchema.pre('save', function (next) {
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

/**
 * Pre-save hook: compute signal_tags from plan_items when plan_items is modified.
 */
experienceSchema.pre('save', function (next) {
  try {
    if (this.isModified('plan_items')) {
      const { computeExperienceSignalTags } = require('../utilities/hidden-signals');
      this.signal_tags = computeExperienceSignalTags(this.plan_items);
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

/**
 * Pre-save hook: ensure `experience_type_slugs` is populated from `experience_type`.
 * - Slugifies each tag value
 * - Ensures global uniqueness of the slug by appending a short random suffix when a collision exists
 */
experienceSchema.pre('save', async function (next) {
  try {
    if (!this.experience_type || !Array.isArray(this.experience_type)) {
      this.experience_type_slugs = [];
      return next();
    }

    const slugify = (s) => String(s || '')
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    const crypto = require('crypto');
    const Experience = mongoose.model('Experience');

    const slugs = [];
    for (const rawTag of this.experience_type) {
      if (!rawTag || typeof rawTag !== 'string') continue;
      let base = slugify(rawTag);
      if (!base) continue;

      // Ensure this slug is unique across experiences; if collision, append short hash
      let candidate = base;
      let attempts = 0;
      while (attempts < 5) {
        const conflict = await Experience.findOne({ experience_type_slugs: candidate }, { _id: 1 }).lean().exec();
        // Allow conflict if it is the same document (update case)
        if (!conflict || (this._id && String(conflict._id) === String(this._id))) break;
        // Collision with another document: append short random suffix
        const suffix = crypto.randomBytes(3).toString('hex');
        candidate = `${base}-${suffix}`;
        attempts += 1;
      }

      slugs.push(candidate);
    }

    // Deduplicate and set
    this.experience_type_slugs = Array.from(new Set(slugs));
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model("Experience", experienceSchema);
