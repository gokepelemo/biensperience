/**
 * AI Usage Model
 *
 * Tracks AI usage per user per day for analytics and budget enforcement.
 * Uses a daily aggregation pattern — one document per user per day.
 * Individual requests are logged in a capped sub-array for debugging.
 *
 * @module models/ai-usage
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const providerBreakdownSchema = new Schema({
  provider: { type: String, required: true },
  requests: { type: Number, default: 0 },
  input_tokens: { type: Number, default: 0 },
  output_tokens: { type: Number, default: 0 }
}, { _id: false });

const taskBreakdownSchema = new Schema({
  task: { type: String, required: true },
  requests: { type: Number, default: 0 },
  input_tokens: { type: Number, default: 0 },
  output_tokens: { type: Number, default: 0 }
}, { _id: false });

const requestLogEntrySchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  task: { type: String },
  provider: { type: String },
  model: { type: String },
  input_tokens: { type: Number, default: 0 },
  output_tokens: { type: Number, default: 0 },
  latency_ms: { type: Number, default: 0 },
  status: {
    type: String,
    // 'cap_reached'  — failover loop exhausted total-attempts cap (bd #8f36.12 + #863b)
    // 'rate_limited' — per-user rate or token-budget rejected the request pre-LLM-call
    // 'disabled'     — entity ai_config.disabled rejected the request
    enum: ['success', 'error', 'filtered', 'cap_reached', 'rate_limited', 'disabled'],
    default: 'success'
  },
  error_message: { type: String, default: null },
  entity_type: { type: String, default: null },
  entity_id: { type: Schema.Types.ObjectId, default: null },
  // HTTP correlation id propagated from the originating request via the AI
  // gateway. Optional — null for non-HTTP callers (background jobs, seeds).
  // Indexed so the AI usage admin view can pivot from a request id to all
  // LLM calls it triggered. See utilities/log-context.js.
  request_id: { type: String, default: null, index: true }
}, { _id: false });

const aiUsageSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },

  // Daily aggregated totals
  total_requests: { type: Number, default: 0 },
  total_input_tokens: { type: Number, default: 0 },
  total_output_tokens: { type: Number, default: 0 },
  total_cost_estimate: { type: Number, default: 0 },

  // Per-provider breakdown
  providers: {
    type: [providerBreakdownSchema],
    default: []
  },

  // Per-task breakdown
  tasks: {
    type: [taskBreakdownSchema],
    default: []
  },

  // Individual request log (capped at 100 per day via trackUsage logic)
  request_log: {
    type: [requestLogEntrySchema],
    default: []
  }
}, {
  timestamps: true
});

// One document per user per day
aiUsageSchema.index({ user: 1, date: -1 }, { unique: true });

// TTL index: auto-delete documents older than 90 days
aiUsageSchema.index({ date: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

/**
 * Get the date key (midnight UTC) for a given date.
 * @param {Date} [d] - Date to truncate (defaults to now)
 * @returns {Date}
 */
aiUsageSchema.statics.getDateKey = function (d) {
  const date = d ? new Date(d) : new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

/**
 * Get start of current month (midnight UTC on the 1st).
 * @param {Date} [d] - Reference date (defaults to now)
 * @returns {Date}
 */
aiUsageSchema.statics.getMonthStart = function (d) {
  const date = d ? new Date(d) : new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

/**
 * Track a single AI request by atomically incrementing counters.
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.task - AI task type
 * @param {string} params.provider - Provider name
 * @param {string} params.model - Model used
 * @param {number} params.inputTokens - Input token count
 * @param {number} params.outputTokens - Output token count
 * @param {number} params.latencyMs - Request latency in ms
 * @param {string} params.status - 'success' | 'error' | 'filtered'
 * @param {string} [params.errorMessage] - Error message if status is 'error'
 * @param {string} [params.entityType] - Entity type if in entity context
 * @param {string} [params.entityId] - Entity ID if in entity context
 * @param {number} [params.costEstimate] - Estimated cost in USD cents
 * @param {string} [params.requestId] - HTTP correlation id from req.id (null for non-HTTP callers)
 * @returns {Promise<Object>} Updated usage document
 */
aiUsageSchema.statics.trackRequest = async function (params) {
  const {
    userId, task, provider, model,
    inputTokens = 0, outputTokens = 0, latencyMs = 0,
    status = 'success', errorMessage = null,
    entityType = null, entityId = null,
    costEstimate = 0,
    requestId = null
  } = params;

  const dateKey = this.getDateKey();

  const logEntry = {
    timestamp: new Date(),
    task,
    provider,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: latencyMs,
    status,
    error_message: errorMessage,
    entity_type: entityType,
    entity_id: entityId,
    request_id: requestId
  };

  return this.findOneAndUpdate(
    { user: userId, date: dateKey },
    {
      $inc: {
        total_requests: 1,
        total_input_tokens: inputTokens,
        total_output_tokens: outputTokens,
        total_cost_estimate: costEstimate
      },
      $push: {
        request_log: { $each: [logEntry], $slice: -100 }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).then(doc => {
    // Update provider and task breakdowns atomically
    return this.findOneAndUpdate(
      { user: userId, date: dateKey, 'providers.provider': provider },
      {
        $inc: {
          'providers.$.requests': 1,
          'providers.$.input_tokens': inputTokens,
          'providers.$.output_tokens': outputTokens
        }
      },
      { new: true }
    ).then(updated => {
      if (!updated) {
        // Provider entry doesn't exist yet, push it
        return this.findOneAndUpdate(
          { user: userId, date: dateKey },
          {
            $push: {
              providers: { provider, requests: 1, input_tokens: inputTokens, output_tokens: outputTokens }
            }
          },
          { new: true }
        );
      }
      return updated;
    });
  }).then(doc => {
    // Update task breakdown
    return this.findOneAndUpdate(
      { user: userId, date: dateKey, 'tasks.task': task },
      {
        $inc: {
          'tasks.$.requests': 1,
          'tasks.$.input_tokens': inputTokens,
          'tasks.$.output_tokens': outputTokens
        }
      },
      { new: true }
    ).then(updated => {
      if (!updated) {
        return this.findOneAndUpdate(
          { user: userId, date: dateKey },
          {
            $push: {
              tasks: { task, requests: 1, input_tokens: inputTokens, output_tokens: outputTokens }
            }
          },
          { new: true }
        );
      }
      return updated;
    });
  });
};

/**
 * Get daily usage for a user.
 * @param {string} userId
 * @param {Date} [date] - Specific date (defaults to today)
 * @returns {Promise<Object|null>}
 */
aiUsageSchema.statics.getDailyUsage = function (userId, date) {
  const dateKey = this.getDateKey(date);
  return this.findOne({ user: userId, date: dateKey }).lean();
};

/**
 * Get monthly aggregated usage for a user.
 * @param {string} userId
 * @param {Date} [refDate] - Reference date (defaults to now)
 * @returns {Promise<Object>}
 */
aiUsageSchema.statics.getMonthlyUsage = async function (userId, refDate) {
  const monthStart = this.getMonthStart(refDate);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const result = await this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: monthStart, $lt: nextMonth }
      }
    },
    {
      $group: {
        _id: null,
        total_requests: { $sum: '$total_requests' },
        total_input_tokens: { $sum: '$total_input_tokens' },
        total_output_tokens: { $sum: '$total_output_tokens' },
        total_cost_estimate: { $sum: '$total_cost_estimate' }
      }
    }
  ]);

  return result[0] || {
    total_requests: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost_estimate: 0
  };
};

module.exports = mongoose.model('AIUsage', aiUsageSchema);
