const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const photoObjectSchema = new Schema({
  url: { type: String, required: true },
  photo_credit: { type: String, default: 'Unknown' },
  photo_credit_url: { type: String }
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
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    state: {
      type: String,
    },
    map_location: { type: String },
    users_favorite: [{ type: Schema.Types.ObjectId, ref: "User" }],
    photo: { type: Schema.Types.ObjectId, ref: "Photo" }, // Keep for backward compatibility during migration
    photos: {
      type: [photoObjectSchema],
      default: []
    },
    default_photo_index: { type: Number, default: 0 },
    travel_tips: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Destination", destinationSchema);
