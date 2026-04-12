/**
 * Hidden Signal Sub-Schemas
 *
 * Reusable Mongoose sub-schemas (not full Models) for:
 *   - hiddenSignalVectorSchema  — 8-dim behavioral preference vector (User / Experience / Destination)
 *   - hiddenSignalEventSchema   — individual behavioral event record (User)
 *   - contentSignalsSchema      — pre-computed content-quality signals (Experience)
 *       trustScore   : curator + public + content completeness → stored, updated on plan events
 *       popularity   : raw plan-count metrics              → stored, normalised at ranking time
 *       reviews      : placeholder for future review data  → schema present, never written yet
 *       computed_at  : UTC timestamp of last computation
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

/**
 * Popularity sub-document — raw plan-count metrics for an experience.
 * Three dimensions are stored so that the blending weights can be adjusted
 * via SIGNALS_CONFIG without a schema migration.
 */
const popularitySignalSchema = new Schema({
  /** Total number of distinct plans that include this experience. */
  planCount: { type: Number, min: 0, default: 0 },
  /** Plans that include at least one plan item with an activity_type set. */
  planCountWithActivity: { type: Number, min: 0, default: 0 },
  /** Plans where at least one item is marked complete. */
  completedPlanCount: { type: Number, min: 0, default: 0 }
}, { _id: false });

/**
 * Reviews sub-document — placeholder for the future reviews dimension.
 * The schema is present so that SIGNALS_CONFIG can reference "reviews"
 * weights without a schema migration when the feature ships.
 * All values default to null to signal "not yet computed".
 */
const reviewsSignalSchema = new Schema({
  avgRating: { type: Number, min: 0, max: 5, default: null },
  reviewCount: { type: Number, min: 0, default: 0 }
}, { _id: false });

/**
 * Content-quality signals for an experience.
 * Stored on the Experience document and refreshed at plan create/delete events.
 * Ranking reads these scores and normalises popularity within the candidate set
 * rather than storing a normalised value (which would require a full-collection sweep
 * on every update).
 */
const contentSignalsSchema = new Schema({
  /**
   * Composite trust score [0, 1].
   * null = not yet computed (experience is new / signals backfill pending).
   * Weighted blend of: curator flag on creator, public visibility, and content
   * quality signals derived from plan data.
   */
  trustScore: { type: Number, min: 0, max: 1, default: null },
  /** Raw plan-count dimensions. Normalised at ranking time. */
  popularity: { type: popularitySignalSchema, default: () => ({}) },
  /** Future reviews dimension — not yet populated. */
  reviews: { type: reviewsSignalSchema, default: () => ({}) },
  /** UTC timestamp of the last signal computation. */
  computed_at: { type: Date, default: null }
}, { _id: false });

/**
 * A single cached affinity computation for one (user, experience) pair.
 * Stored as a bounded array on the User document (max 50, oldest evicted).
 */
const affinityCacheEntrySchema = new Schema({
  /** The experience this affinity was computed against. */
  experience_id: { type: Schema.Types.ObjectId, required: true },
  /** Affinity score [0, 1]. 0.5 is neutral. */
  score: { type: Number, min: 0, max: 1, required: true },
  /**
   * Top 2–3 dimensions driving the match (lowest delta = strongest alignment).
   * Empty when both vectors are below the confidence threshold.
   */
  top_dims: [{
    dim:        { type: String },   // e.g. 'food_focus'
    user_val:   { type: Number },   // user's signal value
    entity_val: { type: Number },   // experience's signal value
    delta:      { type: Number }    // abs(user_val - entity_val)
  }],
  computed_at: { type: Date, default: Date.now }
}, { _id: false });

module.exports = {
  hiddenSignalVectorSchema,
  hiddenSignalEventSchema,
  contentSignalsSchema,
  affinityCacheEntrySchema
};
