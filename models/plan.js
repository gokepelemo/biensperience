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
  parent: { type: Schema.Types.ObjectId }
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

/**
 * Virtual for total estimated cost of plan
 */
planSchema.virtual("total_cost").get(function () {
  return this.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
});

/**
 * Virtual for maximum planning days in plan
 */
planSchema.virtual("max_days").get(function () {
  if (this.plan.length === 0) return 0;
  return Math.max(...this.plan.map(item => item.planning_days || 0));
});

/**
 * Virtual for completion percentage
 */
planSchema.virtual("completion_percentage").get(function () {
  if (this.plan.length === 0) return 0;
  const completed = this.plan.filter(item => item.complete).length;
  return Math.round((completed / this.plan.length) * 100);
});

module.exports = mongoose.model("Plan", planSchema);
