/**
 * BienBot Routes
 *
 * API endpoints for the BienBot AI assistant.
 * All endpoints require authentication and the 'ai_features' feature flag.
 *
 * @module routes/api/bienbot
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bienbotCtrl = require('../../controllers/api/bienbot');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireFeatureFlag } = require('../../utilities/feature-flag-middleware');
const { createUploadMiddleware } = require('../../utilities/upload-middleware');
const { skipIfSuperAdmin } = require('../../config/rateLimiters');
const { createRateLimitStore } = require('../../utilities/rate-limit-store');
const { validate } = require('../../utilities/validate');
const {
  chatSchema,
  executeSchema,
  resumeSchema,
  updateContextSchema,
  updatePendingActionSchema,
  addSessionCollaboratorSchema,
  analyzeSchema,
  applyTipsSchema,
} = require('../../controllers/api/bienbot.schemas');

const { upload: bienbotUpload, handleError: bienbotHandleError } = createUploadMiddleware({
  dest: 'uploads/temp',
  maxSize: 10 * 1024 * 1024, // 10MB max for BienBot attachments
  allowedTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
    'application/pdf',
    'text/plain', 'text/csv'
  ]
});

// BienBot-specific rate limiter: default 30 requests per 15 minutes
// Configurable via env: BIENBOT_RATE_WINDOW_MS, BIENBOT_RATE_MAX
const bienbotRateLimiter = rateLimit({
  windowMs: parseInt(process.env.BIENBOT_RATE_WINDOW_MS || '', 10) || (15 * 60 * 1000),
  max: parseInt(process.env.BIENBOT_RATE_MAX || '', 10) || 30,
  message: {
    success: false,
    error: 'Too many BienBot requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfSuperAdmin,
  store: createRateLimitStore({ prefix: 'rl:bienbot:' })
});

// All routes require auth + ai_features flag
router.use(ensureLoggedIn);
router.use(requireFeatureFlag('ai_features'));
router.use(bienbotRateLimiter);

/**
 * @route   POST /api/bienbot/chat
 * @desc    Main chat endpoint — runs full BienBot pipeline with SSE streaming
 *          Supports optional file attachment via multipart/form-data
 * @access  Private (requires ai_features flag)
 */
router.post('/chat', bienbotUpload.single('attachment'), bienbotHandleError, validate(chatSchema), bienbotCtrl.chat);

/**
 * @route   GET /api/bienbot/sessions
 * @desc    List sessions for the authenticated user
 * @access  Private (requires ai_features flag)
 */
router.get('/sessions', bienbotCtrl.listSessions);

/**
 * @route   GET /api/bienbot/sessions/:id
 * @desc    Get a single session by ID
 * @access  Private (requires ai_features flag)
 */
router.get('/sessions/:id', bienbotCtrl.getSession);

/**
 * @route   DELETE /api/bienbot/sessions/:id
 * @desc    Delete (archive) a session
 * @access  Private (requires ai_features flag)
 */
router.delete('/sessions/:id', bienbotCtrl.deleteSession);

/**
 * @route   POST /api/bienbot/sessions/:id/execute
 * @desc    Execute pending actions from a session
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/execute', validate(executeSchema), bienbotCtrl.execute);

/**
 * @route   POST /api/bienbot/sessions/:id/resume
 * @desc    Resume a past session with summary and greeting
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/resume', validate(resumeSchema), bienbotCtrl.resume);

/**
 * @route   DELETE /api/bienbot/sessions/:id/pending/:actionId
 * @desc    Remove a specific pending action from a session
 * @access  Private (requires ai_features flag)
 */
router.delete('/sessions/:id/pending/:actionId', bienbotCtrl.deletePendingAction);

/**
 * @route   PATCH /api/bienbot/sessions/:id/pending/:actionId
 * @desc    Update a pending action's status (approve, skip) or edit its payload
 * @access  Private (requires ai_features flag)
 */
router.patch('/sessions/:id/pending/:actionId', validate(updatePendingActionSchema), bienbotCtrl.updatePendingAction);

/**
 * @route   GET /api/bienbot/sessions/:id/workflow/:workflowId
 * @desc    Get the full state of a workflow (all actions sharing a workflow_id)
 * @access  Private (requires ai_features flag)
 */
router.get('/sessions/:id/workflow/:workflowId', bienbotCtrl.getWorkflowState);

/**
 * @route   POST /api/bienbot/sessions/:id/context
 * @desc    Update session context mid-conversation (e.g. plan item opened)
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/context', validate(updateContextSchema), bienbotCtrl.updateContext);

/**
 * @route   GET /api/bienbot/mutual-followers
 * @desc    Return users who mutually follow the authenticated user (for share popover search)
 * @access  Private (requires ai_features flag)
 */
router.get('/mutual-followers', bienbotCtrl.getMutualFollowers);

/**
 * @route   POST /api/bienbot/sessions/:id/collaborators
 * @desc    Share a session with another user (owner only)
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/collaborators', validate(addSessionCollaboratorSchema), bienbotCtrl.addSessionCollaborator);

/**
 * @route   DELETE /api/bienbot/sessions/:id/collaborators/:userId
 * @desc    Remove a collaborator from a session (owner or self)
 * @access  Private (requires ai_features flag)
 */
router.delete('/sessions/:id/collaborators/:userId', bienbotCtrl.removeSessionCollaborator);

/**
 * @route   GET /api/bienbot/memory
 * @desc    Get cross-session memory entries for the authenticated user
 * @access  Private (requires ai_features flag)
 */
router.get('/memory', bienbotCtrl.getMemory);

/**
 * @route   DELETE /api/bienbot/memory
 * @desc    Clear all cross-session memory for the authenticated user
 * @access  Private (requires ai_features flag)
 */
router.delete('/memory', bienbotCtrl.clearMemory);

/**
 * @route   POST /api/bienbot/analyze
 * @desc    Proactively analyze an entity and return suggestions without starting a conversation
 * @access  Private (requires ai_features flag)
 */
router.post('/analyze', validate(analyzeSchema), bienbotCtrl.analyze);

/**
 * @route   POST /api/bienbot/sessions/:id/tips
 * @desc    Directly append selected travel tips to a destination (bypasses LLM)
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/tips', validate(applyTipsSchema), bienbotCtrl.applyTips);

/**
 * @route   GET /api/bienbot/sessions/:id/attachments/:messageIndex/:attachmentIndex
 * @desc    Get a signed URL for a session attachment stored in S3
 * @access  Private (requires ai_features flag)
 */
router.get('/sessions/:id/attachments/:messageIndex/:attachmentIndex', bienbotCtrl.getAttachmentUrl);

module.exports = router;
