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

// Helper: skip rate limiting for super admins
function skipIfSuperAdmin(req) {
  try {
    const user = req.user;
    return !!(user && (user.isSuperAdmin || user.role === 'super_admin'));
  } catch (_) {
    return false;
  }
}

// BienBot-specific rate limiter: 30 requests per 15 minutes
const bienbotRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: {
    success: false,
    error: 'Too many BienBot requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfSuperAdmin
});

// All routes require auth + ai_features flag
router.use(ensureLoggedIn);
router.use(requireFeatureFlag('ai_features'));
router.use(bienbotRateLimiter);

/**
 * @route   POST /api/bienbot/chat
 * @desc    Main chat endpoint — runs full BienBot pipeline with SSE streaming
 * @access  Private (requires ai_features flag)
 */
router.post('/chat', bienbotCtrl.chat);

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
router.post('/sessions/:id/execute', bienbotCtrl.execute);

/**
 * @route   POST /api/bienbot/sessions/:id/resume
 * @desc    Resume a past session with summary and greeting
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/resume', bienbotCtrl.resume);

/**
 * @route   DELETE /api/bienbot/sessions/:id/pending/:actionId
 * @desc    Remove a specific pending action from a session
 * @access  Private (requires ai_features flag)
 */
router.delete('/sessions/:id/pending/:actionId', bienbotCtrl.deletePendingAction);

module.exports = router;
