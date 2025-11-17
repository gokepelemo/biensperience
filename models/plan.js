const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Permission sub-schema for collaborative plan management
 * Supports role-based access (owner, collaborator, contributor)
 */
const permissionSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    required: true
  },
  entity: {
    type: String,
    required: true,
    enum: ['user', 'destination', 'experience']
  },
  type: {
    type: String,
    enum: ['owner', 'collaborator', 'contributor']
  },
  granted_at: {
    type: Date,
    default: Date.now
  },
  granted_by: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

/**
 * Plan item snapshot schema
 * Point-in-time snapshot of plan items for this specific user's plan
 */
const planItemSnapshotSchema = new Schema({
  plan_item_id: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Experience.plan_items'
  },
  complete: {
    type: Boolean,
    default: false
  },
  cost: {
    type: Number,
    default: 0
  },
  planning_days: {
    type: Number,
    default: 0
  },
  // Store snapshot of original item data in case experience changes
  text: String,
  url: String,
  photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  parent: { type: Schema.Types.ObjectId },
  // Optional location object: plain text `address` and a GeoJSON `Point`
  // stored at `location.geo` as { type: 'Point', coordinates: [lng, lat] }
  location: {
    address: { type: String },
    geo: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        validate: {
          validator: function(v) {
              // allow empty (no location), an empty array, or an array of two numbers [lng, lat]
              // Some clients may send an empty array `[]` while location is not yet available;
              // treat that as "no location" to avoid failing validation during interim API requests.
              if (v == null) return true; // null or undefined
              if (Array.isArray(v) && v.length === 0) return true; // allow empty array
              return Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number');
          },
          message: 'GeoJSON coordinates must be an array of two numbers [lng, lat]'
        }
      }
    }
  }
}, { _id: true });

/**
 * Plan schema
 * Represents a user's personalized plan for an experience
 * Creates point-in-time snapshot of plan items
 */
const planSchema = new Schema(
  {
    experience: {
      type: Schema.Types.ObjectId,
      ref: "Experience",
      required: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    planned_date: {
      type: Date
    },
    plan: {
      type: [planItemSnapshotSchema],
      default: []
    },
    // Costs associated with the plan. Each cost can be linked to a plan_item,
    // a collaborator, or the plan itself.
    costs: {
      type: [new Schema({
        title: { type: String, required: true },
        description: { type: String },
        cost: { type: Number, required: true, default: 0 },
        currency: { type: String, default: 'USD' },
        plan_item: { type: Schema.Types.ObjectId }, // optional link to a plan item snapshot
        plan: { type: Schema.Types.ObjectId, ref: 'Plan' }, // optional link back to this plan
        collaborator: { type: Schema.Types.ObjectId, ref: 'User' }, // optional contributor who paid or is responsible
        created_at: { type: Date, default: Date.now }
      }, { _id: true }) ],
      default: []
    },
    permissions: {
      type: [permissionSchema],
      default: [],
      validate: {
        validator: function(permissions) {
          // Ensure at least one owner exists
          const hasOwner = permissions.some(p => 
            p.entity === 'user' && p.type === 'owner'
          );
          
          // If permissions array has user entries, must have at least one owner
          const hasUserPermissions = permissions.some(p => p.entity === 'user');
          if (hasUserPermissions && !hasOwner) {
            return false;
          }
          
          // Check for duplicate permissions
          const seen = new Set();
          for (const p of permissions) {
            const key = `${p.entity}:${p._id}`;
            if (seen.has(key)) {
              return false;
            }
            seen.add(key);
          }
          
          return true;
        },
        message: 'Plans must have at least one owner and no duplicate permissions'
      }
    },
    notes: {
      type: String
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for efficient queries
planSchema.index({ experience: 1, user: 1 }, { unique: true }); // One plan per user per experience
planSchema.index({ user: 1 });
planSchema.index({ experience: 1 });

// OPTIMIZATION: Compound index for permission-based queries (Phase 2.3)
// Supports queries that filter by experience and permission entities
planSchema.index({ experience: 1, 'permissions._id': 1, 'permissions.type': 1 });  // For getExperiencePlans queries

// Spatial index for plan item locations (GeoJSON Points stored on each plan item)
planSchema.index({ 'plan.location.geo': '2dsphere' });

/**
 * Virtual property for total cost
 */
planSchema.virtual("total_cost").get(function () {
  if (!this.plan || !Array.isArray(this.plan)) return 0;
  const itemsTotal = this.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
  const costsTotal = (this.costs && Array.isArray(this.costs))
    ? this.costs.reduce((s, c) => s + (c.cost || 0), 0)
    : 0;
  return itemsTotal + costsTotal;
});

/**
 * Virtual property for maximum planning days
 */
planSchema.virtual("max_days").get(function () {
  if (!this.plan || !Array.isArray(this.plan)) return 0;
  return this.plan.reduce((max, item) => Math.max(max, item.planning_days || 0), 0);
});

/**
 * Virtual property for completion percentage
 */
planSchema.virtual("completion_percentage").get(function () {
  if (!this.plan || !Array.isArray(this.plan) || this.plan.length === 0) return 0;
  const completed = this.plan.filter(item => item.complete).length;
  return Math.round((completed / this.plan.length) * 100);
});

module.exports = mongoose.model("Plan", planSchema);
