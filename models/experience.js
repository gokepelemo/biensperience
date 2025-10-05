const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
    photo: { type: Schema.Types.ObjectId, ref: "Photo" },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    users: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        plan: [String],
        planned_date: { type: Date },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

experienceSchema.index({ user: 1 });
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
  if (this.plan_items.length === 0) return 0;
  return Math.max(...this.plan_items.filter(item => !item.parent).map(item => calculateMaxDays(item._id)));
});

module.exports = mongoose.model("Experience", experienceSchema);
