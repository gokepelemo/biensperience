/**
 * Geocode API Routes
 * Routes for geocoding addresses to coordinates
 */

const express = require('express');
const router = express.Router();
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const geocodeController = require('../../controllers/api/geocode');

/**
 * POST /api/geocode
 * Geocode an address to coordinates
 * Requires authentication to prevent abuse
 */
router.post('/', ensureLoggedIn, geocodeController.geocode);

module.exports = router;
