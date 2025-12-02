/**
 * AI Routes
 *
 * Secure API endpoints for AI features.
 * All endpoints require authentication and the 'ai_features' feature flag.
 *
 * @module routes/api/ai
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const aiCtrl = require('../../controllers/api/ai');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireFeatureFlag } = require('../../utilities/feature-flag-middleware');

// Helper: skip limiting for super admins
function skipIfSuperAdmin(req) {
  try {
    const user = req.user;
    return !!(user && (user.isSuperAdmin || user.role === 'super_admin'));
  } catch (_) {
    return false;
  }
}

// AI-specific rate limiter - more restrictive than general API
// 100 requests per 15 minutes to prevent abuse of AI features
const aiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_WINDOW_MS || '', 10) || (15 * 60 * 1000), // 15 minutes
  max: parseInt(process.env.AI_RATE_MAX || '', 10) || 100,
  message: {
    success: false,
    error: 'Too many AI requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfSuperAdmin
});

/**
 * @route   GET /api/ai/status
 * @desc    Check AI service availability
 * @access  Private (authenticated)
 */
router.get(
  '/status',
  ensureLoggedIn,
  aiCtrl.status
);

/**
 * @route   POST /api/ai/complete
 * @desc    General AI completion
 * @access  Private (requires ai_features flag)
 * @body    {
 *            messages: [{ role: 'system'|'user'|'assistant', content: string }],
 *            task?: string,
 *            options?: { provider?: string, model?: string, temperature?: number, maxTokens?: number }
 *          }
 */
router.post(
  '/complete',
  ensureLoggedIn,
  requireFeatureFlag('ai_features'),
  aiRateLimiter,
  aiCtrl.complete
);

/**
 * @route   POST /api/ai/autocomplete
 * @desc    Text autocomplete
 * @access  Private (requires ai_features flag)
 * @body    {
 *            text: string,
 *            context?: string,
 *            options?: object
 *          }
 */
router.post(
  '/autocomplete',
  ensureLoggedIn,
  requireFeatureFlag('ai_features'),
  aiRateLimiter,
  aiCtrl.autocomplete
);

/**
 * @route   POST /api/ai/improve
 * @desc    Improve text description
 * @access  Private (requires ai_features flag)
 * @body    {
 *            text: string,
 *            type?: 'experience'|'destination'|'plan'|'general',
 *            options?: object
 *          }
 */
router.post(
  '/improve',
  ensureLoggedIn,
  requireFeatureFlag('ai_features'),
  aiRateLimiter,
  aiCtrl.improve
);

/**
 * @route   POST /api/ai/translate
 * @desc    Translate text
 * @access  Private (requires ai_features flag)
 * @body    {
 *            text: string,
 *            targetLanguage: string,
 *            sourceLanguage?: string,
 *            options?: object
 *          }
 */
router.post(
  '/translate',
  ensureLoggedIn,
  requireFeatureFlag('ai_features'),
  aiRateLimiter,
  aiCtrl.translate
);

/**
 * @route   POST /api/ai/summarize
 * @desc    Summarize text
 * @access  Private (requires ai_features flag)
 * @body    {
 *            text: string,
 *            maxLength?: number,
 *            options?: object
 *          }
 */
router.post(
  '/summarize',
  ensureLoggedIn,
  requireFeatureFlag('ai_features'),
  aiRateLimiter,
  aiCtrl.summarize
);

/**
 * @route   POST /api/ai/generate-tips
 * @desc    Generate travel tips
 * @access  Private (requires ai_features flag)
 * @body    {
 *            destination: string,
 *            category?: 'general'|'food'|'safety'|'transport'|'culture',
 *            count?: number,
 *            options?: object
 *          }
 */
router.post(
  '/generate-tips',
  ensureLoggedIn,
  requireFeatureFlag('ai_features'),
  aiRateLimiter,
  aiCtrl.generateTips
);

module.exports = router;
