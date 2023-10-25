const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const photoSchema = new Schema(
  {
    key: { type: String },
    photo_credit: { type: String },
    photo_credit_url: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Photo", photoSchema);
