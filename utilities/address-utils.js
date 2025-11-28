/**
 * Address Utilities - Backend Geocoding Service
 *
 * Provides server-side address validation, geocoding, and coordinate conversion
 * using Google's Geocoding API.
 *
 * Features:
 * - Address validation and correction
 * - Geocoding (address to coordinates)
 * - Reverse geocoding (coordinates to address)
 * - GeoJSON Point creation
 * - Address component extraction
 *
 * @module utilities/address-utils
 */

const backendLogger = require('./backend-logger');

// Google Maps API key from environment
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

/**
 * In-memory cache for geocoding results
 * Key: normalized address string
 * Value: { result, timestamp }
 */
const geocodeCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Normalize address string for cache key
 * @param {string} address - Address to normalize
 * @returns {string} Normalized address
 */
function normalizeAddressKey(address) {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[,]+/g, ',');
}

/**
 * Check if cached result is still valid
 * @param {Object} cached - Cached result with timestamp
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(cached) {
  if (!cached || !cached.timestamp) return false;
  return Date.now() - cached.timestamp < CACHE_TTL_MS;
}

/**
 * Geocode an address to get coordinates and formatted address
 *
 * @param {string} address - Address to geocode
 * @param {Object} options - Options
 * @param {boolean} [options.useCache=true] - Whether to use caching
 * @returns {Promise<Object|null>} Geocoding result or null if not found
 *
 * @example
 * const result = await geocodeAddress('1600 Amphitheatre Parkway, Mountain View, CA');
 * // Returns:
 * // {
 * //   formattedAddress: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
 * //   location: { lat: 37.4224764, lng: -122.0842499 },
 * //   components: { street: '...', city: '...', state: '...', country: '...', postalCode: '...' },
 * //   placeId: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA'
 * // }
 */
async function geocodeAddress(address, options = {}) {
  const { useCache = true } = options;

  if (!address || typeof address !== 'string' || !address.trim()) {
    backendLogger.warn('[address-utils] geocodeAddress called with empty address');
    return null;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    backendLogger.warn('[address-utils] GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  const normalizedKey = normalizeAddressKey(address);

  // Check cache
  if (useCache) {
    const cached = geocodeCache.get(normalizedKey);
    if (isCacheValid(cached)) {
      backendLogger.debug('[address-utils] Cache hit for geocodeAddress', { address: normalizedKey });
      return cached.result;
    }
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      backendLogger.debug('[address-utils] No geocoding results', { address, status: data.status });
      return null;
    }

    const result = data.results[0];
    const parsed = {
      formattedAddress: result.formatted_address,
      location: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng
      },
      components: extractAddressComponents(result.address_components),
      placeId: result.place_id,
      locationType: result.geometry.location_type
    };

    // Cache result
    if (useCache) {
      geocodeCache.set(normalizedKey, { result: parsed, timestamp: Date.now() });
    }

    backendLogger.debug('[address-utils] Geocoded address', { input: address, output: parsed.formattedAddress });
    return parsed;
  } catch (error) {
    backendLogger.error('[address-utils] Geocoding error', { address, error: error.message });
    return null;
  }
}

/**
 * Reverse geocode coordinates to get address
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object|null>} Address result or null if not found
 */
async function reverseGeocode(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    backendLogger.warn('[address-utils] reverseGeocode called with invalid coordinates', { lat, lng });
    return null;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    backendLogger.warn('[address-utils] GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      backendLogger.debug('[address-utils] No reverse geocoding results', { lat, lng, status: data.status });
      return null;
    }

    const result = data.results[0];
    return {
      formattedAddress: result.formatted_address,
      location: { lat, lng },
      components: extractAddressComponents(result.address_components),
      placeId: result.place_id,
      locationType: result.geometry?.location_type
    };
  } catch (error) {
    backendLogger.error('[address-utils] Reverse geocoding error', { lat, lng, error: error.message });
    return null;
  }
}

/**
 * Extract address components from Google API response
 *
 * @param {Array} components - Address components from Google API
 * @returns {Object} Parsed address components
 */
function extractAddressComponents(components) {
  if (!Array.isArray(components)) return {};

  const result = {
    streetNumber: '',
    route: '',
    city: '',
    state: '',
    stateShort: '',
    country: '',
    countryShort: '',
    postalCode: '',
    neighborhood: '',
    sublocality: ''
  };

  components.forEach(component => {
    const types = component.types || [];

    if (types.includes('street_number')) {
      result.streetNumber = component.long_name;
    } else if (types.includes('route')) {
      result.route = component.long_name;
    } else if (types.includes('locality')) {
      result.city = component.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      result.state = component.long_name;
      result.stateShort = component.short_name;
    } else if (types.includes('country')) {
      result.country = component.long_name;
      result.countryShort = component.short_name;
    } else if (types.includes('postal_code')) {
      result.postalCode = component.long_name;
    } else if (types.includes('neighborhood')) {
      result.neighborhood = component.long_name;
    } else if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
      result.sublocality = component.long_name;
    }
  });

  // Construct full street address
  result.street = [result.streetNumber, result.route].filter(Boolean).join(' ');

  return result;
}

/**
 * Create a GeoJSON Point from latitude and longitude
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object|null} GeoJSON Point object or null if invalid
 */
function createGeoJSONPoint(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return {
    type: 'Point',
    coordinates: [lng, lat] // GeoJSON uses [longitude, latitude] order
  };
}

/**
 * Create a location object suitable for plan items
 * Geocodes the address and creates the full location structure
 *
 * @param {string|Object} addressOrLocation - Address string or { address, lat, lng } object
 * @returns {Promise<Object|null>} Location object for plan item or null if geocoding fails
 *
 * @example
 * // From address string
 * const location = await createPlanItemLocation('123 Main St, City, State');
 *
 * // From coordinates
 * const location = await createPlanItemLocation({ lat: 37.4224764, lng: -122.0842499 });
 *
 * // From full object
 * const location = await createPlanItemLocation({
 *   address: '123 Main St',
 *   lat: 37.4224764,
 *   lng: -122.0842499
 * });
 */
async function createPlanItemLocation(addressOrLocation) {
  if (!addressOrLocation) {
    return null;
  }

  let geocoded = null;
  let address = null;
  let lat = null;
  let lng = null;

  // Parse input
  if (typeof addressOrLocation === 'string') {
    address = addressOrLocation;
    geocoded = await geocodeAddress(address);
    if (geocoded) {
      lat = geocoded.location.lat;
      lng = geocoded.location.lng;
    }
  } else if (typeof addressOrLocation === 'object') {
    address = addressOrLocation.address;
    lat = addressOrLocation.lat;
    lng = addressOrLocation.lng;

    // If we have coordinates but no address, reverse geocode
    if (!address && typeof lat === 'number' && typeof lng === 'number') {
      geocoded = await reverseGeocode(lat, lng);
      if (geocoded) {
        address = geocoded.formattedAddress;
      }
    }
    // If we have address but no coordinates, geocode
    else if (address && (typeof lat !== 'number' || typeof lng !== 'number')) {
      geocoded = await geocodeAddress(address);
      if (geocoded) {
        lat = geocoded.location.lat;
        lng = geocoded.location.lng;
      }
    }
    // If we have both, still geocode to get formatted address and components
    else if (address && typeof lat === 'number' && typeof lng === 'number') {
      geocoded = await geocodeAddress(address);
    }
  }

  // Build location object
  const location = {
    address: geocoded?.formattedAddress || address || null,
    geo: createGeoJSONPoint(lat, lng),
    city: geocoded?.components?.city || null,
    state: geocoded?.components?.state || null,
    country: geocoded?.components?.country || null,
    postalCode: geocoded?.components?.postalCode || null,
    placeId: geocoded?.placeId || null
  };

  // Return null if we don't have at least an address or coordinates
  if (!location.address && !location.geo) {
    return null;
  }

  return location;
}

/**
 * Validate and correct an address
 * Returns the corrected/formatted address if valid
 *
 * @param {string} address - Address to validate
 * @returns {Promise<Object>} Validation result
 */
async function validateAddress(address) {
  const result = {
    isValid: false,
    original: address,
    corrected: null,
    confidence: 'low',
    geocoded: null
  };

  if (!address || typeof address !== 'string' || !address.trim()) {
    return result;
  }

  const geocoded = await geocodeAddress(address);

  if (!geocoded) {
    return result;
  }

  result.isValid = true;
  result.corrected = geocoded.formattedAddress;
  result.geocoded = geocoded;

  // Determine confidence based on location type
  switch (geocoded.locationType) {
    case 'ROOFTOP':
      result.confidence = 'high';
      break;
    case 'RANGE_INTERPOLATED':
    case 'GEOMETRIC_CENTER':
      result.confidence = 'medium';
      break;
    default:
      result.confidence = 'low';
  }

  return result;
}

/**
 * Get address suggestions for autocomplete (server-side)
 * Uses Google Places Autocomplete API
 *
 * @param {string} input - User input text
 * @param {Object} options - Options
 * @param {string} [options.types='address'] - Place types filter
 * @param {string} [options.country] - Country restriction (ISO 3166-1 Alpha-2 code)
 * @param {number} [options.limit=5] - Maximum number of suggestions
 * @returns {Promise<Array>} Array of suggestions
 */
async function getAddressSuggestions(input, options = {}) {
  const {
    types = 'address',
    country = null,
    limit = 5
  } = options;

  if (!input || typeof input !== 'string' || input.trim().length < 2) {
    return [];
  }

  if (!GOOGLE_MAPS_API_KEY) {
    backendLogger.warn('[address-utils] GOOGLE_MAPS_API_KEY not configured');
    return [];
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.set('types', types);

    if (country) {
      url.searchParams.set('components', `country:${country}`);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.predictions) {
      backendLogger.debug('[address-utils] No autocomplete predictions', { input, status: data.status });
      return [];
    }

    return data.predictions.slice(0, limit).map(prediction => ({
      description: prediction.description,
      placeId: prediction.place_id,
      mainText: prediction.structured_formatting?.main_text,
      secondaryText: prediction.structured_formatting?.secondary_text,
      types: prediction.types
    }));
  } catch (error) {
    backendLogger.error('[address-utils] Autocomplete error', { input, error: error.message });
    return [];
  }
}

/**
 * Clear geocoding cache
 */
function clearGeocodeCache() {
  geocodeCache.clear();
  backendLogger.debug('[address-utils] Geocode cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
function getCacheStats() {
  let validEntries = 0;
  let expiredEntries = 0;

  geocodeCache.forEach((value) => {
    if (isCacheValid(value)) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  });

  return {
    totalEntries: geocodeCache.size,
    validEntries,
    expiredEntries,
    cacheTTLMs: CACHE_TTL_MS
  };
}

module.exports = {
  geocodeAddress,
  reverseGeocode,
  createGeoJSONPoint,
  createPlanItemLocation,
  validateAddress,
  getAddressSuggestions,
  extractAddressComponents,
  clearGeocodeCache,
  getCacheStats
};
