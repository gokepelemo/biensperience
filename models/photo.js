const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const photoSchema = new Schema(
  {
    url: { type: String },
    s3_key: { type: String },
    photo_credit: { type: String },
    photo_credit_url: { type: String },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Photo", photoSchema);
