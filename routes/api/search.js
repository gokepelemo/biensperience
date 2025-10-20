const express = require('express');
const router = express.Router();
const searchController = require('../../controllers/api/search');
const ensureLoggedIn = require('../../config/ensureLoggedIn');

/**
 * Global search endpoint
 * GET /api/search?q=query&types=destination,experience&limit=10
 * Searches across all collections: destinations, experiences, plans, users
 */
router.get('/', ensureLoggedIn, searchController.searchAll);

/**
 * Search destinations
 * GET /api/search/destinations?q=query&limit=10
 */
router.get('/destinations', ensureLoggedIn, searchController.searchDestinations);

/**
 * Search experiences
 * GET /api/search/experiences?q=query&limit=10
 */
router.get('/experiences', ensureLoggedIn, searchController.searchExperiences);

/**
 * Search plans
 * GET /api/search/plans?q=query&limit=10
 */
router.get('/plans', ensureLoggedIn, searchController.searchPlans);

/**
 * Search users
 * GET /api/search/users?q=query&limit=10
 */
router.get('/users', ensureLoggedIn, searchController.searchUsers);

module.exports = router;
