const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const destinationSchema = new Schema(
  {
    // provide a list of countries and cities on the react frontend
    // seed the database with a list from https://restcountries.com/v3.1/all
    country: { type: String },
    city: { type: String },
    // an address or coordinates that can be used to construct a Google Maps link
    map_location: { type: String },
    users_favorite: [{ type: Schema.Types.ObjectId, ref: "User" }],
    photos: [{ type: Schema.Types.ObjectId, ref: "Photo" }],
    travel_tips: { type: Array },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Destination", destinationSchema);
