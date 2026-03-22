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
 * @route   PUT /api/ai-admin/providers/reorder
 * @desc    Reorder providers by drag priority (must come before /:id to avoid param clash)
 * @access  Private (requires ai_admin flag)
 */
router.put('/providers/reorder', modificationLimiter, aiAdminCtrl.reorderProviders);

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

// ---------------------------------------------------------------------------
// Intent Corpus
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/ai-admin/corpus
 * @desc    List all intents with utterance counts
 * @access  Private (requires ai_admin flag)
 */
router.get('/corpus', aiAdminCtrl.listCorpus);

/**
 * @route   POST /api/ai-admin/corpus/retrain
 * @desc    Trigger NLP model retraining (must come before /:intent)
 * @access  Private (requires ai_admin flag)
 */
router.post('/corpus/retrain', modificationLimiter, aiAdminCtrl.retrainClassifier);

/**
 * @route   GET /api/ai-admin/corpus/:intent
 * @desc    Get a single intent with utterances
 * @access  Private (requires ai_admin flag)
 */
router.get('/corpus/:intent', aiAdminCtrl.getCorpusIntent);

/**
 * @route   POST /api/ai-admin/corpus
 * @desc    Create a new intent
 * @access  Private (requires ai_admin flag)
 */
router.post('/corpus', modificationLimiter, aiAdminCtrl.createCorpusIntent);

/**
 * @route   PUT /api/ai-admin/corpus/:intent
 * @desc    Update an intent (utterances, description, enabled)
 * @access  Private (requires ai_admin flag)
 */
router.put('/corpus/:intent', modificationLimiter, aiAdminCtrl.updateCorpusIntent);

/**
 * @route   DELETE /api/ai-admin/corpus/:intent
 * @desc    Delete a custom intent
 * @access  Private (requires ai_admin flag)
 */
router.delete('/corpus/:intent', modificationLimiter, aiAdminCtrl.deleteCorpusIntent);

// ---------------------------------------------------------------------------
// Classification Logs
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/ai-admin/classifications/summary
 * @desc    Classification stats summary (must come before /:id)
 * @access  Private (requires ai_admin flag)
 */
router.get('/classifications/summary', aiAdminCtrl.getClassificationSummary);

/**
 * @route   GET /api/ai-admin/classifications
 * @desc    List classification logs with filters
 * @access  Private (requires ai_admin flag)
 */
router.get('/classifications', aiAdminCtrl.listClassifications);

/**
 * @route   PUT /api/ai-admin/classifications/:id/review
 * @desc    Mark a classification as reviewed
 * @access  Private (requires ai_admin flag)
 */
router.put('/classifications/:id/review', modificationLimiter, aiAdminCtrl.reviewClassification);

/**
 * @route   POST /api/ai-admin/classifications/batch-add
 * @desc    Add reviewed corrections as utterances to corpus
 * @access  Private (requires ai_admin flag)
 */
router.post('/classifications/batch-add', modificationLimiter, aiAdminCtrl.batchAddToCorpus);

// ---------------------------------------------------------------------------
// Classifier Config
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/ai-admin/classifier-config
 * @desc    Get classifier configuration
 * @access  Private (requires ai_admin flag)
 */
router.get('/classifier-config', aiAdminCtrl.getClassifierConfig);

/**
 * @route   PUT /api/ai-admin/classifier-config
 * @desc    Update classifier configuration
 * @access  Private (requires ai_admin flag)
 */
router.put('/classifier-config', modificationLimiter, aiAdminCtrl.updateClassifierConfig);

module.exports = router;
