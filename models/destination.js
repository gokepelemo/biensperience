const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
    photo: { type: Schema.Types.ObjectId, ref: "Photo" },
    travel_tips: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Destination", destinationSchema);
