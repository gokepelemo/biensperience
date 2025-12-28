/**
 * Activity Routes
 * Routes for activity tracking, history, and state restoration
 */

const express = require('express');
const router = express.Router();
const {
  getResourceHistory,
  getActorHistory,
  restoreResourceState,
  getAllActivities,
  getActivityStats,
  getCuratorPlanners
} = require('../../controllers/api/activities');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { apiLimiter } = require('../../config/rateLimiters');

// Apply rate limiting to all routes
router.use(apiLimiter);

// All routes require authentication
router.use(ensureLoggedIn);

// Get all activities (super admin only)
router.get('/', getAllActivities);

// Get activity statistics (super admin only)
router.get('/stats', getActivityStats);

// Get activity history for a specific resource
router.get('/resource/:resourceId', getResourceHistory);

// Get activity history for a specific actor/user
router.get('/actor/:actorId', getActorHistory);

// Restore resource state using rollback token (super admin only)
router.post('/restore/:rollbackToken', restoreResourceState);

// Get users who have planned the curator's experiences (curator feature flag required)
router.get('/curator/planners', getCuratorPlanners);

module.exports = router;
