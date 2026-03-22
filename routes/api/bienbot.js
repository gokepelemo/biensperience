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
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bienbotCtrl = require('../../controllers/api/bienbot');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireFeatureFlag } = require('../../utilities/feature-flag-middleware');

// Ensure upload temp directory exists
const BIENBOT_UPLOAD_DIR = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(BIENBOT_UPLOAD_DIR)) {
  fs.mkdirSync(BIENBOT_UPLOAD_DIR, { recursive: true });
}

// Multer configuration for BienBot attachments (images + documents)
const bienbotUpload = multer({
  dest: BIENBOT_UPLOAD_DIR,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
      'application/pdf',
      'text/plain', 'text/csv'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for BienBot attachments
    files: 1
  }
});

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
 *          Supports optional file attachment via multipart/form-data
 * @access  Private (requires ai_features flag)
 */
router.post('/chat', bienbotUpload.single('attachment'), (err, req, res, next) => {
  // Handle multer errors gracefully
  if (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    return res.status(400).json({ error: err.message });
  }
  next();
}, bienbotCtrl.chat);

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

/**
 * @route   POST /api/bienbot/sessions/:id/context
 * @desc    Update session context mid-conversation (e.g. plan item opened)
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/context', bienbotCtrl.updateContext);

/**
 * @route   POST /api/bienbot/sessions/:id/collaborators
 * @desc    Share a session with another user (owner only)
 * @access  Private (requires ai_features flag)
 */
router.post('/sessions/:id/collaborators', bienbotCtrl.addSessionCollaborator);

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
router.post('/analyze', bienbotCtrl.analyze);

module.exports = router;
