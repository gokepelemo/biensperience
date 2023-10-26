const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const planItemSchema = new Schema({
  text: { type: String },
  photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  cost_estimate: { type: Number },
});

const experienceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    destination: { 
      type: Schema.Types.ObjectId, ref: "Destination",
      // required: true,
    },
    map_location: { 
      type: String,
      // required: true,
    },
    experience_type: [String],
    plan_items: [planItemSchema],
    photo: { type: Schema.Types.ObjectId, ref: "Photo" },
  },
  {
    timestamps: true,
  }
);

experienceSchema.virtual("cost_estimate").get(function () {
  return this.plan_items.reduce(function (sum, item) {
    sum + item.cost_estimate;
  });
});

module.exports = mongoose.model("Experience", experienceSchema);
