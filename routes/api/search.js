const express = require('express');
const router = express.Router();
const searchController = require('../../controllers/api/search');
const requireAuth = require('../../utilities/require-auth');

/**
 * Global search endpoint
 * GET /api/search?q=query&types=destination,experience&limit=10
 * Searches across all collections: destinations, experiences, plans, users
 */
router.get('/', requireAuth, searchController.searchAll);

/**
 * Search destinations
 * GET /api/search/destinations?q=query&limit=10
 */
router.get('/destinations', requireAuth, searchController.searchDestinations);

/**
 * Search experiences
 * GET /api/search/experiences?q=query&limit=10
 */
router.get('/experiences', requireAuth, searchController.searchExperiences);

/**
 * Search plans
 * GET /api/search/plans?q=query&limit=10
 */
router.get('/plans', requireAuth, searchController.searchPlans);

/**
 * Search users (admin only)
 * GET /api/search/users?q=query&limit=10
 */
router.get('/users', requireAuth, searchController.searchUsers);

module.exports = router;
