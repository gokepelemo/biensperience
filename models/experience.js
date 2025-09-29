const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const planItemSchema = new Schema({
  text: { type: String },
  photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  url: { type: String },
  cost_estimate: { type: Number },
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
  return this.plan_items.reduce(function (sum, item) {
    return sum + item.cost_estimate;
  }, 0);
});

module.exports = mongoose.model("Experience", experienceSchema);
