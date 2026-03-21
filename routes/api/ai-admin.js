/**
 * AI Admin Routes
 *
 * API endpoints for managing AI provider configs, policies, usage analytics,
 * and task routing. All endpoints require authentication and the 'ai_admin'
 * feature flag (super admin only).
 *
 * @module routes/api/ai-admin
 */

const express = require('express');
const router = express.Router();
const aiAdminCtrl = require('../../controllers/api/ai-admin');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireFeatureFlag } = require('../../utilities/feature-flag-middleware');
const { modificationLimiter } = require('../../config/rateLimiters');

/**
 * Middleware: require super_admin role (defense-in-depth alongside feature flag).
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'super_admin' && !req.user.isSuperAdmin)) {
    return res.status(403).json({ success: false, error: 'Super admin access required' });
  }
  next();
}

// All ai-admin routes require auth + super_admin role + ai_admin feature flag
router.use(ensureLoggedIn);
router.use(requireSuperAdmin);
router.use(requireFeatureFlag('ai_admin'));

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/ai-admin/providers
 * @desc    List all AI provider configurations
 * @access  Private (requires ai_admin flag)
 */
router.get('/providers', aiAdminCtrl.listProviders);

/**
 * @route   GET /api/ai-admin/providers/:id
 * @desc    Get a single provider configuration
 * @access  Private (requires ai_admin flag)
 */
router.get('/providers/:id', aiAdminCtrl.getProvider);

/**
 * @route   POST /api/ai-admin/providers
 * @desc    Create a new provider configuration
 * @access  Private (requires ai_admin flag)
 */
router.post('/providers', modificationLimiter, aiAdminCtrl.createProvider);

/**
 * @route   PUT /api/ai-admin/providers/:id
 * @desc    Update a provider configuration
 * @access  Private (requires ai_admin flag)
 */
router.put('/providers/:id', modificationLimiter, aiAdminCtrl.updateProvider);

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/ai-admin/policies
 * @desc    List all AI policies (global + user-scoped)
 * @access  Private (requires ai_admin flag)
 */
router.get('/policies', aiAdminCtrl.listPolicies);

/**
 * @route   GET /api/ai-admin/policies/:id
 * @desc    Get a single policy
 * @access  Private (requires ai_admin flag)
 */
router.get('/policies/:id', aiAdminCtrl.getPolicy);

/**
 * @route   POST /api/ai-admin/policies
 * @desc    Create a new policy
 * @access  Private (requires ai_admin flag)
 */
router.post('/policies', modificationLimiter, aiAdminCtrl.createPolicy);

/**
 * @route   PUT /api/ai-admin/policies/:id
 * @desc    Update a policy
 * @access  Private (requires ai_admin flag)
 */
router.put('/policies/:id', modificationLimiter, aiAdminCtrl.updatePolicy);

/**
 * @route   DELETE /api/ai-admin/policies/:id
 * @desc    Deactivate a policy (soft delete)
 * @access  Private (requires ai_admin flag)
 */
router.delete('/policies/:id', modificationLimiter, aiAdminCtrl.deletePolicy);

// ---------------------------------------------------------------------------
// Usage Analytics
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/ai-admin/usage/summary
 * @desc    Dashboard usage summary
 * @access  Private (requires ai_admin flag)
 */
router.get('/usage/summary', aiAdminCtrl.getUsageSummary);

/**
 * @route   GET /api/ai-admin/usage
 * @desc    Aggregated usage data (filterable)
 * @access  Private (requires ai_admin flag)
 */
router.get('/usage', aiAdminCtrl.getUsage);

/**
 * @route   GET /api/ai-admin/usage/users/:userId
 * @desc    Usage for a specific user
 * @access  Private (requires ai_admin flag)
 */
router.get('/usage/users/:userId', aiAdminCtrl.getUserUsage);

// ---------------------------------------------------------------------------
// Routing Configuration
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/ai-admin/routing
 * @desc    Get current task routing configuration
 * @access  Private (requires ai_admin flag)
 */
router.get('/routing', aiAdminCtrl.getRouting);

/**
 * @route   PUT /api/ai-admin/routing
 * @desc    Update global task routing
 * @access  Private (requires ai_admin flag)
 */
router.put('/routing', modificationLimiter, aiAdminCtrl.updateRouting);

module.exports = router;
