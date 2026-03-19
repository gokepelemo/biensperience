/**
 * BienBot Session Model - Persists conversation history, active context,
 * and pending actions for the BienBot AI assistant.
 *
 * Sessions track multi-turn conversations across entity pages,
 * supporting both standalone chat and in-context invocation.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Invoke context sub-schema — records which entity page the user
 * opened BienBot from. Only set at session creation time.
 */
const invokeContextSchema = new Schema({
  entity: {
    type: String,
    enum: [null, 'destination', 'experience', 'plan', 'plan_item', 'user'],
    default: null
  },
  entity_id: {
    type: Schema.Types.ObjectId,
    default: null
  },
  entity_label: {
    type: String,
    default: null
  }
}, { _id: false });

/**
 * Entity context sub-schema — accumulates resolved entity IDs
 * as the conversation progresses across entities.
 */
const contextSchema = new Schema({
  destination_id: {
    type: Schema.Types.ObjectId,
    ref: 'Destination',
    default: null
  },
  experience_id: {
    type: Schema.Types.ObjectId,
    ref: 'Experience',
    default: null
  },
  plan_id: {
    type: Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  plan_item_id: {
    type: Schema.Types.ObjectId,
    default: null
  }
}, { _id: false });

/**
 * Message sub-schema — individual conversation turns.
 */
const messageSchema = new Schema({
  role: {
    type: String,
    required: true,
    enum: ['user', 'assistant']
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  intent: {
    type: String,
    default: null
  },
  actions_taken: [{
    type: String
  }]
}, { _id: false });

/**
 * Summary sub-schema — cached resume summary, regenerated when stale.
 */
const summarySchema = new Schema({
  text: {
    type: String,
    default: null
  },
  suggested_next_steps: [{
    type: String
  }],
  generated_at: {
    type: Date,
    default: null
  }
}, { _id: false });

/**
 * Pending action sub-schema — proposed actions awaiting user confirmation.
 */
const pendingActionSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'create_destination',
      'create_experience',
      'create_plan',
      'add_plan_items',
      'update_plan_item',
      'invite_collaborator',
      'sync_plan'
    ]
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  executed: {
    type: Boolean,
    default: false
  },
  result: {
    type: Schema.Types.Mixed,
    default: null
  }
}, { _id: false });

/**
 * Main BienBot Session schema
 */
const bienBotSessionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: null
  },
  invoke_context: {
    type: invokeContextSchema,
    default: () => ({})
  },
  messages: [messageSchema],
  context: {
    type: contextSchema,
    default: () => ({})
  },
  summary: {
    type: summarySchema,
    default: () => ({})
  },
  pending_actions: [pendingActionSchema],
  status: {
    type: String,
    required: true,
    enum: ['active', 'archived'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true,
  collection: 'bienbot_sessions'
});

// Compound indexes for efficient querying
bienBotSessionSchema.index({ user: 1, status: 1 });
bienBotSessionSchema.index({ updatedAt: 1 });

// ----- Static methods -----

/**
 * Create a new session for a user, optionally with invoke context.
 */
bienBotSessionSchema.statics.createSession = async function (userId, invokeContext = {}) {
  const session = new this({
    user: userId,
    invoke_context: invokeContext,
    messages: [],
    pending_actions: [],
    status: 'active'
  });
  await session.save();
  return session;
};

/**
 * Find the most recent active session for a user.
 */
bienBotSessionSchema.statics.findActiveSession = async function (userId) {
  return this.findOne({ user: userId, status: 'active' })
    .sort({ updatedAt: -1 })
    .lean();
};

/**
 * List sessions for a user, most recent first.
 */
bienBotSessionSchema.statics.listSessions = async function (userId, options = {}) {
  const query = { user: userId };
  if (options.status) {
    query.status = options.status;
  }
  return this.find(query)
    .sort({ updatedAt: -1 })
    .limit(options.limit || 50)
    .lean();
};

// ----- Instance methods -----

/**
 * Append a message to the conversation history.
 */
bienBotSessionSchema.methods.addMessage = async function (role, content, { intent = null, actions_taken = [] } = {}) {
  this.messages.push({
    role,
    content,
    timestamp: new Date(),
    intent,
    actions_taken
  });
  return this.save();
};

/**
 * Update the entity context with new resolved IDs.
 * Merges over existing values (does not clear unset keys).
 */
bienBotSessionSchema.methods.updateContext = async function (contextUpdate) {
  const validKeys = ['destination_id', 'experience_id', 'plan_id', 'plan_item_id'];
  for (const key of validKeys) {
    if (contextUpdate[key] !== undefined) {
      this.context[key] = contextUpdate[key];
    }
  }
  this.markModified('context');
  return this.save();
};

/**
 * Set pending actions (replaces any existing pending actions).
 */
bienBotSessionSchema.methods.setPendingActions = async function (actions) {
  this.pending_actions = actions;
  return this.save();
};

/**
 * Mark a specific pending action as executed with its result.
 */
bienBotSessionSchema.methods.markActionExecuted = async function (actionId, result) {
  const action = this.pending_actions.find(a => a.id === actionId);
  if (!action) {
    return null;
  }
  action.executed = true;
  action.result = result;
  this.markModified('pending_actions');
  return this.save();
};

/**
 * Cache a resume summary.
 */
bienBotSessionSchema.methods.cacheSummary = async function (text, suggestedNextSteps = []) {
  this.summary = {
    text,
    suggested_next_steps: suggestedNextSteps,
    generated_at: new Date()
  };
  this.markModified('summary');
  return this.save();
};

/**
 * Check whether the cached summary is stale (older than the given TTL).
 * Default TTL: 6 hours.
 */
bienBotSessionSchema.methods.isSummaryStale = function (ttlMs = 6 * 60 * 60 * 1000) {
  if (!this.summary || !this.summary.generated_at) {
    return true;
  }
  return (Date.now() - this.summary.generated_at.getTime()) > ttlMs;
};

/**
 * Archive the session.
 */
bienBotSessionSchema.methods.archive = async function () {
  this.status = 'archived';
  return this.save();
};

/**
 * Auto-generate a title from the first user message if not already set.
 */
bienBotSessionSchema.methods.generateTitle = async function () {
  if (this.title) {
    return this;
  }
  const firstUserMsg = this.messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    // Truncate to 80 chars for a reasonable title
    this.title = firstUserMsg.content.length > 80
      ? firstUserMsg.content.substring(0, 77) + '...'
      : firstUserMsg.content;
    return this.save();
  }
  return this;
};

module.exports = mongoose.model('BienBotSession', bienBotSessionSchema);
