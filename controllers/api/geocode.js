/**
 * Geocode API Controller
 * Provides geocoding endpoints for converting addresses to coordinates
 */

const { geocodeAddress } = require('../../utilities/geocoding-utils');
const backendLogger = require('../../utilities/backend-logger');

/**
 * POST /api/geocode
 * Geocode an address string to coordinates
 */
async function geocode(req, res, next) {
  try {
    const { address } = req.body;

    if (!address || typeof address !== 'string' || address.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Address is required and must be at least 2 characters'
      });
    }

    const result = await geocodeAddress(address.trim());

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Could not find location for this address'
      });
    }

    backendLogger.debug('Geocode request successful', {
      address: address.trim(),
      city: result.city,
      country: result.country
    });

    return res.json(result);
  } catch (error) {
    backendLogger.error('Geocode request failed', {
      error: error.message,
      address: req.body?.address
    });
    next(error);
  }
}

module.exports = {
  geocode
};
