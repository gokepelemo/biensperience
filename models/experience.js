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

/**
 * Per-document memoization for cost_estimate / max_planning_days virtuals.
 *
 * Both virtuals previously did O(N) recursive descents per root item, calling
 * `plan_items.id(...)` (which is O(N)) and a nested `forEach` on the full
 * plan_items array — overall O(N^2) per serialization. With deeply nested
 * plan_items this dominated list-view serialize cost.
 *
 * Strategy:
 *  - Build a parent -> children index ONCE per plan_items array reference.
 *  - Traverse iteratively (post-order via stack) to fold up totals/max-days.
 *  - Cache the result in a WeakMap keyed on the plan_items array reference,
 *    so repeated `toJSON` / `toObject` calls within a single request reuse
 *    the computation. The cache is freed automatically when the document
 *    (and therefore its plan_items array) is GC'd.
 *
 * Invalidation: Mongoose mutations to plan_items keep the SAME array object
 * (it's a MongooseArray). We invalidate by snapshotting the array length and
 * a cheap fingerprint of its contents; a mismatch on subsequent reads
 * triggers recomputation.
 */
const COST_CACHE = new WeakMap();
const PLANNING_DAYS_CACHE = new WeakMap();

function fingerprintPlanItems(planItems) {
  // Cheap O(N) fingerprint that changes if a relevant field mutates.
  // We intentionally skip _id stringification on every read by using the
  // raw _id value (ObjectId) as part of the fingerprint indirectly via
  // length + summed numeric fields + last item _id reference identity.
  let costSum = 0;
  let daysSum = 0;
  for (let i = 0; i < planItems.length; i++) {
    const it = planItems[i];
    costSum += Number(it.cost_estimate) || 0;
    daysSum += Number(it.planning_days) || 0;
  }
  return `${planItems.length}:${costSum}:${daysSum}`;
}

function buildChildIndex(planItems) {
  // Map<parentIdString, indices[]> — root items are bucketed under '__root__'.
  const childrenByParent = new Map();
  for (let i = 0; i < planItems.length; i++) {
    const it = planItems[i];
    const parentKey = it.parent ? String(it.parent) : '__root__';
    let bucket = childrenByParent.get(parentKey);
    if (!bucket) {
      bucket = [];
      childrenByParent.set(parentKey, bucket);
    }
    bucket.push(i);
  }
  return childrenByParent;
}

function computeCostEstimate(planItems) {
  if (!planItems || planItems.length === 0) return 0;
  const childrenByParent = buildChildIndex(planItems);
  // Iterative post-order traversal of all subtrees rooted at items without a parent.
  // Because cost is purely additive, we can sum every reachable item exactly once
  // by walking from each root via the children index.
  let total = 0;
  const stack = [];
  const roots = childrenByParent.get('__root__') || [];
  for (const rootIdx of roots) stack.push(rootIdx);
  while (stack.length > 0) {
    const idx = stack.pop();
    const item = planItems[idx];
    total += Number(item.cost_estimate) || 0;
    const childIndices = childrenByParent.get(String(item._id));
    if (childIndices) {
      for (const ci of childIndices) stack.push(ci);
    }
  }
  return total;
}

function computeMaxPlanningDays(planItems) {
  if (!planItems || planItems.length === 0) return 0;
  const childrenByParent = buildChildIndex(planItems);
  // For each root, compute max planning_days down its subtree, then take overall max.
  const roots = childrenByParent.get('__root__') || [];
  if (roots.length === 0) return 0;
  let overallMax = 0;
  // Iterative DFS per root, tracking max along the path.
  for (const rootIdx of roots) {
    const stack = [rootIdx];
    let subtreeMax = 0;
    while (stack.length > 0) {
      const idx = stack.pop();
      const item = planItems[idx];
      const days = Number(item.planning_days) || 0;
      if (days > subtreeMax) subtreeMax = days;
      const childIndices = childrenByParent.get(String(item._id));
      if (childIndices) {
        for (const ci of childIndices) stack.push(ci);
      }
    }
    if (subtreeMax > overallMax) overallMax = subtreeMax;
  }
  return overallMax;
}

experienceSchema.virtual("cost_estimate").get(function () {
  const planItems = this.plan_items;
  if (!planItems || planItems.length === 0) return 0;
  const cached = COST_CACHE.get(planItems);
  const fp = fingerprintPlanItems(planItems);
  if (cached && cached.fp === fp) return cached.value;
  const value = computeCostEstimate(planItems);
  COST_CACHE.set(planItems, { fp, value });
  return value;
});

experienceSchema.virtual("max_planning_days").get(function () {
  const planItems = this.plan_items;
  if (!planItems || planItems.length === 0) return 0;
  const cached = PLANNING_DAYS_CACHE.get(planItems);
  const fp = fingerprintPlanItems(planItems);
  if (cached && cached.fp === fp) return cached.value;
  const value = computeMaxPlanningDays(planItems);
  PLANNING_DAYS_CACHE.set(planItems, { fp, value });
  return value;
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
// NOTE: A solo index on { 'permissions._id': 1 } was removed (bd #8f36.9) because
// it is fully subsumed by the compound indexes above and below — both lead with
// 'permissions._id', so any planner that would have selected the solo index will
// select the compound one via B-tree prefix-match.
// Production must drop the legacy index by running:
//   node utilities/migrations/2026-04-26-drop-experience-permissions-id-solo-index.js
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
 *
 * PERF: previously did up to N*5 sequential DB queries (one `findOne` per tag
 * per retry). Now batches all candidates into ONE `$in` query per attempt
 * round, so a save with N tags issues 1 query in the common (no-collision)
 * case and at most 5 queries total in the worst case (down from 5*N).
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
    const selfIdStr = this._id ? String(this._id) : null;

    // Collect base slugs (deduped, valid only)
    const tagBases = [];
    const seenBase = new Set();
    for (const rawTag of this.experience_type) {
      if (!rawTag || typeof rawTag !== 'string') continue;
      const base = slugify(rawTag);
      if (!base || seenBase.has(base)) continue;
      seenBase.add(base);
      tagBases.push(base);
    }

    if (tagBases.length === 0) {
      this.experience_type_slugs = [];
      return next();
    }

    // Working state: tag -> candidate slug (starts as base, may gain suffix)
    const tagToCandidate = new Map(tagBases.map(b => [b, b]));
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidates = Array.from(tagToCandidate.values());

      // ONE batched query per round: find any experiences (excluding self)
      // whose experience_type_slugs intersect our candidate set.
      const filter = { experience_type_slugs: { $in: candidates } };
      if (selfIdStr) filter._id = { $ne: this._id };
      const conflicts = await Experience.find(filter, { experience_type_slugs: 1 })
        .lean()
        .exec();

      // Build a set of taken slugs (only those in our candidate list)
      const candidateSet = new Set(candidates);
      const taken = new Set();
      for (const conflict of conflicts) {
        const slugs = conflict.experience_type_slugs || [];
        for (const s of slugs) {
          if (candidateSet.has(s)) taken.add(s);
        }
      }

      if (taken.size === 0) break; // all good

      // Re-suffix only the colliding candidates; non-colliding ones are kept.
      for (const [base, candidate] of tagToCandidate.entries()) {
        if (taken.has(candidate)) {
          const suffix = crypto.randomBytes(3).toString('hex');
          tagToCandidate.set(base, `${base}-${suffix}`);
        }
      }
      // Loop again to verify the new suffixed candidates don't themselves collide.
    }

    // Deduplicate (defensive — bases were already deduped) and set
    this.experience_type_slugs = Array.from(new Set(tagToCandidate.values()));
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model("Experience", experienceSchema);
