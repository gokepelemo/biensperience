/**
 * Hidden Signal Sub-Schemas
 *
 * Reusable Mongoose sub-schemas (not full Models) for behavioral signal vectors
 * and signal events. Embedded in User, Experience, and Destination models.
 *
 * @module models/hidden-signals
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * 8-dimension behavioral signal vector.
 * All dimensions are 0–1 with a neutral default of 0.5.
 * Confidence starts at 0 and grows as events are processed.
 */
const hiddenSignalVectorSchema = new Schema({
  energy: { type: Number, min: 0, max: 1, default: 0.5 },
  novelty: { type: Number, min: 0, max: 1, default: 0.5 },
  budget_sensitivity: { type: Number, min: 0, max: 1, default: 0.5 },
  social: { type: Number, min: 0, max: 1, default: 0.5 },
  structure: { type: Number, min: 0, max: 1, default: 0.5 },
  food_focus: { type: Number, min: 0, max: 1, default: 0.5 },
  cultural_depth: { type: Number, min: 0, max: 1, default: 0.5 },
  comfort_zone: { type: Number, min: 0, max: 1, default: 0.5 },
  confidence: { type: Number, min: 0, max: 1, default: 0 },
  last_updated: { type: Date, default: null },
  weights: { type: Map, of: Number, default: () => new Map() }
}, { _id: false });

/**
 * Individual signal event record.
 * Capped at 200 per user via atomic $push + $slice in update ops.
 */
const hiddenSignalEventSchema = new Schema({
  type: {
    type: String,
    enum: ['click', 'save', 'dismiss', 'book', 'view_duration', 'search', 'vote', 'edit_plan', 'remove_plan_item'],
    required: true
  },
  entity_type: {
    type: String,
    enum: ['experience', 'destination', 'plan_item'],
    required: true
  },
  entity_id: { type: Schema.Types.ObjectId, required: true },
  value: { type: Number, default: 0 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
}, { _id: false });

module.exports = {
  hiddenSignalVectorSchema,
  hiddenSignalEventSchema
};
