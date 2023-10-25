const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const planItemSchema = new Schema({
  text: { type: String },
  photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  cost_estimate: { type: Number },
});

const experienceSchema = new Schema(
  {
    map_location: { type: String },
    experience_type: { type: String },
    planItems: [planItemSchema],
    photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  },
  {
    timestamps: true,
  }
);

experienceSchema.virtual("cost_estimate").get(function () {
  return this.planItems.reduce(function (sum, item) {
    sum + item.cost_estimate;
  });
});

module.exports = mongoose.model("Experience", experienceSchema);
