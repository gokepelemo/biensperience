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

const planItemSchema = new Schema({
  text: { type: String },
  photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  url: { type: String },
  cost_estimate: { type: Number },
  planning_days: { type: Number, default: 0 },
  parent: { type: mongoose.Schema.Types.ObjectId }, // reference to parent plan item
});

const experienceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    destination: {
      type: Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
    },
    map_location: {
      type: String,
    },
    experience_type: [String],
    plan_items: [planItemSchema],
    photos: {
      type: [Schema.Types.ObjectId],
      ref: "Photo",
      default: []
    },
    default_photo_id: { 
      type: Schema.Types.ObjectId, 
      ref: "Photo" 
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
experienceSchema.index({ destination: 1, createdAt: -1 });
experienceSchema.index({ createdAt: -1 });
experienceSchema.index({ 'permissions._id': 1, 'permissions.type': 1, name: 1 });
experienceSchema.index({ photos: 1 });
experienceSchema.index({ default_photo_id: 1 });

module.exports = mongoose.model("Experience", experienceSchema);
