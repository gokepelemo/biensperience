/**
 * Geocoding Utilities
 *
 * Provides geocoding functionality using OpenStreetMap Nominatim API.
 * Converts addresses, city names, or zip codes to structured location data
 * with GeoJSON-compatible coordinates.
 *
 * @module geocoding-utils
 */

const backendLogger = require('./backend-logger');

// Nominatim API base URL (free, no API key required)
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// User-Agent is required by Nominatim
const USER_AGENT = 'Biensperience/1.0 (https://biensperience.com)';

// Rate limiting: Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1100; // 1.1 seconds to be safe

/**
 * Wait for rate limit compliance
 */
async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Geocode an address string to structured location data
 *
 * @param {string} query - Address, city name, zip code, or full address
 * @returns {Promise<Object|null>} Location object or null if not found
 *
 * @example
 * // City name
 * const result = await geocodeAddress('Paris');
 * // { displayName: 'Paris, Île-de-France, France', city: 'Paris', ... }
 *
 * // Zip code
 * const result = await geocodeAddress('90210');
 * // { displayName: 'Beverly Hills, CA 90210, USA', ... }
 *
 * // Full address
 * const result = await geocodeAddress('123 Main St, New York, NY');
 */
async function geocodeAddress(query) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    backendLogger.warn('Geocoding: Invalid query provided', { query });
    return null;
  }

  const sanitizedQuery = query.trim();

  try {
    await waitForRateLimit();

    const url = new URL('/search', NOMINATIM_BASE_URL);
    url.searchParams.set('q', sanitizedQuery);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '1');
    url.searchParams.set('accept-language', 'en');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      backendLogger.error('Geocoding API error', {
        status: response.status,
        statusText: response.statusText,
        query: sanitizedQuery
      });
      return null;
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      backendLogger.debug('Geocoding: No results found', { query: sanitizedQuery });
      return null;
    }

    const result = results[0];
    const address = result.address || {};

    // Extract location components
    const locationData = {
      // Display name (formatted address)
      displayName: result.display_name,

      // City (try multiple fields as Nominatim varies by location type)
      city: address.city || address.town || address.village || address.municipality || address.county || null,

      // State/Province/Region
      state: address.state || address.province || address.region || null,

      // Country
      country: address.country || null,

      // Country code (ISO 3166-1 alpha-2)
      countryCode: address.country_code ? address.country_code.toUpperCase() : null,

      // Postal code
      postalCode: address.postcode || null,

      // GeoJSON Point format (MongoDB 2dsphere compatible)
      coordinates: {
        type: 'Point',
        coordinates: [
          parseFloat(result.lon), // longitude first (GeoJSON standard)
          parseFloat(result.lat)  // latitude second
        ]
      },

      // Raw latitude/longitude for convenience
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),

      // Bounding box (if available)
      boundingBox: result.boundingbox ? {
        south: parseFloat(result.boundingbox[0]),
        north: parseFloat(result.boundingbox[1]),
        west: parseFloat(result.boundingbox[2]),
        east: parseFloat(result.boundingbox[3])
      } : null,

      // Location type (city, administrative, etc.)
      locationType: result.type || null,

      // Importance score from Nominatim
      importance: result.importance || null,

      // Original query
      originalQuery: sanitizedQuery,

      // Timestamp
      geocodedAt: new Date()
    };

    backendLogger.debug('Geocoding successful', {
      query: sanitizedQuery,
      city: locationData.city,
      country: locationData.country
    });

    return locationData;
  } catch (error) {
    backendLogger.error('Geocoding error', {
      error: error.message,
      query: sanitizedQuery
    });
    return null;
  }
}

/**
 * Reverse geocode coordinates to location data
 *
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<Object|null>} Location object or null if not found
 */
async function reverseGeocode(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    backendLogger.warn('Reverse geocoding: Invalid coordinates', { latitude, longitude });
    return null;
  }

  // Validate coordinate ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    backendLogger.warn('Reverse geocoding: Coordinates out of range', { latitude, longitude });
    return null;
  }

  try {
    await waitForRateLimit();

    const url = new URL('/reverse', NOMINATIM_BASE_URL);
    url.searchParams.set('lat', latitude.toString());
    url.searchParams.set('lon', longitude.toString());
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'en');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      backendLogger.error('Reverse geocoding API error', {
        status: response.status,
        latitude,
        longitude
      });
      return null;
    }

    const result = await response.json();

    if (!result || result.error) {
      backendLogger.debug('Reverse geocoding: No results found', { latitude, longitude });
      return null;
    }

    const address = result.address || {};

    return {
      displayName: result.display_name,
      city: address.city || address.town || address.village || address.municipality || null,
      state: address.state || address.province || address.region || null,
      country: address.country || null,
      countryCode: address.country_code ? address.country_code.toUpperCase() : null,
      postalCode: address.postcode || null,
      coordinates: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      latitude,
      longitude,
      locationType: result.type || null,
      geocodedAt: new Date()
    };
  } catch (error) {
    backendLogger.error('Reverse geocoding error', {
      error: error.message,
      latitude,
      longitude
    });
    return null;
  }
}

/**
 * Format location for display
 *
 * @param {Object} location - Location object from geocoding
 * @returns {string} Formatted location string (e.g., "Paris, France")
 */
function formatLocationDisplay(location) {
  if (!location) return '';

  const parts = [];

  if (location.city) {
    parts.push(location.city);
  }

  if (location.state && location.state !== location.city) {
    parts.push(location.state);
  }

  if (location.country) {
    parts.push(location.country);
  }

  return parts.join(', ') || location.displayName || '';
}

/**
 * Validate that a location object has the required GeoJSON structure
 *
 * @param {Object} location - Location object to validate
 * @returns {boolean} True if valid GeoJSON Point
 */
function isValidGeoJSONPoint(location) {
  if (!location || !location.coordinates) return false;
  if (location.coordinates.type !== 'Point') return false;
  if (!Array.isArray(location.coordinates.coordinates)) return false;
  if (location.coordinates.coordinates.length !== 2) return false;

  const [lon, lat] = location.coordinates.coordinates;
  if (typeof lon !== 'number' || typeof lat !== 'number') return false;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return false;

  return true;
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  formatLocationDisplay,
  isValidGeoJSONPoint
};
