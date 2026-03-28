const mongoose = require('mongoose');
const { Schema } = mongoose;

const discoveryCacheSchema = new Schema({
  _id: { type: String },                     // cache key (e.g., 'bien:discovery:culinary|all|none')
  candidates: { type: Schema.Types.Mixed },   // raw candidate array (pre-ranking)
  expiresAt: { type: Date, required: true }   // TTL index field
}, {
  timestamps: false,
  collection: 'discovery_cache'
});

// MongoDB automatically removes docs when expiresAt passes
discoveryCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('DiscoveryCache', discoveryCacheSchema);
