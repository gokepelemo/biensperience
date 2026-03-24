/**
 * BienBot Session Model - Persists conversation history, active context,
 * and pending actions for the BienBot AI assistant.
 *
 * Sessions track multi-turn conversations across entity pages,
 * supporting both standalone chat and in-context invocation.
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { ALLOWED_ACTION_TYPES } = require('../utilities/bienbot-action-executor');

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
 * Attachment sub-schema — files uploaded with a user message.
 * Stored in S3 (protected bucket) and processed for text extraction.
 */
const attachmentSchema = new Schema({
  filename: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    default: null
  },
  s3Key: {
    type: String,
    default: null
  },
  s3Bucket: {
    type: String,
    default: null
  },
  isProtected: {
    type: Boolean,
    default: false
  },
  extractedText: {
    type: String,
    default: null
  },
  extractionMethod: {
    type: String,
    default: null
  },
  s3Status: {
    type: String,
    enum: ['pending', 'uploaded', 'failed'],
    default: 'pending'
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
  }],
  attachments: [attachmentSchema],
  /**
   * Structured content blocks for rich rendering (photo galleries, suggestion
   * lists, etc.). Each block has a `type` discriminator and type-specific
   * fields stored in `data`. The frontend reads `type` to choose which
   * component to render.
   *
   * Supported types:
   *   - photo_gallery: { photos: [...], entity_type, entity_id, entity_name, total_count }
   *   - suggestion_list: { suggestions: [...], destination_name, source_count }
   */
  structured_content: [{
    type: {
      type: String,
      required: true,
      enum: ['photo_gallery', 'suggestion_list']
    },
    data: {
      type: Schema.Types.Mixed,
      default: {}
    }
  }],
  /**
   * The user who sent this message. Only set for 'user' role messages in
   * shared sessions so memory extraction can filter per-participant
   * contributions. Null for assistant messages and legacy messages.
   */
  sent_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
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
 *
 * Workflow fields (workflow_id, workflow_step, workflow_total, depends_on, status,
 * error_message) support the sequential workflow confirmation UX where each
 * workflow step is exploded into an individual pending action that users can
 * approve, skip, or edit one at a time.
 */
const pendingActionSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ALLOWED_ACTION_TYPES
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
  },
  // --- Workflow step fields ---
  workflow_id: {
    type: String,
    default: null
  },
  workflow_step: {
    type: Number,
    default: null
  },
  workflow_total: {
    type: Number,
    default: null
  },
  depends_on: {
    type: [String],
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'executing', 'completed', 'skipped', 'failed'],
    default: 'pending'
  },
  error_message: {
    type: String,
    default: null
  }
}, { _id: false });

/**
 * Collaborator sub-schema — tracks users who have been granted access
 * to a session by the owner.
 */
const collaboratorSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['viewer', 'editor'],
    default: 'viewer'
  },
  granted_at: {
    type: Date,
    default: Date.now
  },
  granted_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
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
  shared_with: {
    type: [collaboratorSchema],
    default: []
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
bienBotSessionSchema.index({ 'shared_with.user_id': 1, status: 1 });

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
 * List sessions for a user (owned + shared), most recent first.
 */
bienBotSessionSchema.statics.listSessions = async function (userId, options = {}) {
  const baseFilter = { $or: [{ user: userId }, { 'shared_with.user_id': userId }] };
  if (options.status) {
    baseFilter.status = options.status;
  }
  return this.find(baseFilter)
    .sort({ updatedAt: -1 })
    .limit(options.limit || 50)
    .lean();
};

// ----- Instance methods -----

/**
 * Append a message to the conversation history.
 *
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 * @param {object} [opts]
 * @param {string|null} [opts.intent] - Classified intent
 * @param {string[]} [opts.actions_taken] - Action types executed
 * @param {object[]} [opts.attachments] - File attachments
 * @param {string|object|null} [opts.sentBy] - User ID of the sender (for
 *   'user' role messages in shared sessions). Enables per-participant memory
 *   extraction when the session is archived.
 */
bienBotSessionSchema.methods.addMessage = async function (role, content, { intent = null, actions_taken = [], attachments = [], sentBy = null, structured_content = [] } = {}) {
  const msg = {
    role,
    content,
    timestamp: new Date(),
    intent,
    actions_taken
  };
  if (attachments.length > 0) {
    msg.attachments = attachments;
  }
  if (structured_content.length > 0) {
    msg.structured_content = structured_content;
  }
  if (sentBy && role === 'user') {
    msg.sent_by = sentBy;
  }
  this.messages.push(msg);
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
 * Check whether a user has access to this session (owner or shared collaborator).
 * @param {string} userId - The user ID to check.
 * @returns {{ hasAccess: boolean, role: 'owner'|'editor'|'viewer'|null }}
 */
bienBotSessionSchema.methods.checkAccess = function (userId) {
  const uid = userId.toString();
  if (this.user.toString() === uid) {
    return { hasAccess: true, role: 'owner' };
  }
  const collab = (this.shared_with || []).find(c => c.user_id.toString() === uid);
  if (collab) {
    return { hasAccess: true, role: collab.role };
  }
  return { hasAccess: false, role: null };
};

/**
 * Add a collaborator to the session. Idempotent — updates role if already present.
 * @param {string} userId - User ID to add.
 * @param {string} role - 'viewer' or 'editor'.
 * @param {string} grantedBy - User ID of the granter.
 */
bienBotSessionSchema.methods.addCollaborator = async function (userId, role = 'viewer', grantedBy = null) {
  const uid = userId.toString();
  const existing = (this.shared_with || []).find(c => c.user_id.toString() === uid);
  if (existing) {
    existing.role = role;
    this.markModified('shared_with');
  } else {
    this.shared_with.push({
      user_id: userId,
      role,
      granted_at: new Date(),
      granted_by: grantedBy
    });
  }
  return this.save();
};

/**
 * Remove a collaborator from the session.
 * @param {string} userId - User ID to remove.
 */
bienBotSessionSchema.methods.removeCollaborator = async function (userId) {
  const uid = userId.toString();
  this.shared_with = (this.shared_with || []).filter(c => c.user_id.toString() !== uid);
  this.markModified('shared_with');
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
