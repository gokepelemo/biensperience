/**
 * Address Utilities - Google Geocoding API Integration
 *
 * Provides address correction, suggestions, and lat/long coordinate retrieval
 * using Google's Geocoding API.
 *
 * Features:
 * - Address validation and correction
 * - Address autocomplete suggestions
 * - Geocoding (address to coordinates)
 * - Reverse geocoding (coordinates to address)
 * - Address component extraction (city, state, country, postal code)
 *
 * @module address-utils
 */

import { logger } from './logger';

// Google Maps API key - uses the same key as GoogleMap component
const DEFAULT_API_KEY = 'AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0';

/**
 * Cache for geocoding results to avoid redundant API calls
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
 * @param {string} [options.apiKey] - Google Maps API key
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
export async function geocodeAddress(address, options = {}) {
  const { apiKey = DEFAULT_API_KEY, useCache = true } = options;

  if (!address || typeof address !== 'string' || !address.trim()) {
    logger.warn('[address-utils] geocodeAddress called with empty address');
    return null;
  }

  const normalizedKey = normalizeAddressKey(address);

  // Check cache
  if (useCache) {
    const cached = geocodeCache.get(normalizedKey);
    if (isCacheValid(cached)) {
      logger.debug('[address-utils] Cache hit for geocodeAddress', { address: normalizedKey });
      return cached.result;
    }
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      logger.debug('[address-utils] No geocoding results', { address, status: data.status });
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

    logger.debug('[address-utils] Geocoded address', { input: address, output: parsed.formattedAddress });
    return parsed;
  } catch (error) {
    logger.error('[address-utils] Geocoding error', { address, error: error.message });
    return null;
  }
}

/**
 * Reverse geocode coordinates to get address
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Options
 * @param {string} [options.apiKey] - Google Maps API key
 * @returns {Promise<Object|null>} Address result or null if not found
 *
 * @example
 * const result = await reverseGeocode(37.4224764, -122.0842499);
 * // Returns same structure as geocodeAddress
 */
export async function reverseGeocode(lat, lng, options = {}) {
  const { apiKey = DEFAULT_API_KEY } = options;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    logger.warn('[address-utils] reverseGeocode called with invalid coordinates', { lat, lng });
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      logger.debug('[address-utils] No reverse geocoding results', { lat, lng, status: data.status });
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
    logger.error('[address-utils] Reverse geocoding error', { lat, lng, error: error.message });
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
 * Validate and correct an address
 * Returns the corrected/formatted address if valid
 *
 * @param {string} address - Address to validate
 * @param {Object} options - Options
 * @returns {Promise<Object>} Validation result
 *
 * @example
 * const result = await validateAddress('1600 Amphitheatre Parkway');
 * // Returns:
 * // {
 * //   isValid: true,
 * //   original: '1600 Amphitheatre Parkway',
 * //   corrected: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
 * //   confidence: 'high', // 'high' | 'medium' | 'low'
 * //   geocoded: { ... }
 * // }
 */
export async function validateAddress(address, options = {}) {
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

  const geocoded = await geocodeAddress(address, options);

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
 * Get address suggestions for autocomplete
 * Uses Google Places Autocomplete API
 *
 * @param {string} input - User input text
 * @param {Object} options - Options
 * @param {string} [options.apiKey] - Google Maps API key
 * @param {string} [options.types] - Place types filter (e.g., 'address', 'geocode', 'establishment')
 * @param {string} [options.country] - Country restriction (ISO 3166-1 Alpha-2 code)
 * @param {number} [options.limit=5] - Maximum number of suggestions
 * @returns {Promise<Array>} Array of suggestions
 *
 * @example
 * const suggestions = await getAddressSuggestions('1600 Amphitheatre');
 * // Returns:
 * // [
 * //   { description: '1600 Amphitheatre Pkwy, Mountain View, CA, USA', placeId: '...' },
 * //   ...
 * // ]
 */
export async function getAddressSuggestions(input, options = {}) {
  const {
    apiKey = DEFAULT_API_KEY,
    types = 'address',
    country = null,
    limit = 5
  } = options;

  if (!input || typeof input !== 'string' || input.trim().length < 2) {
    return [];
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('types', types);

    if (country) {
      url.searchParams.set('components', `country:${country}`);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.predictions) {
      logger.debug('[address-utils] No autocomplete predictions', { input, status: data.status });
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
    logger.error('[address-utils] Autocomplete error', { input, error: error.message });
    return [];
  }
}

/**
 * Get place details from place ID
 *
 * @param {string} placeId - Google Place ID
 * @param {Object} options - Options
 * @param {string} [options.apiKey] - Google Maps API key
 * @returns {Promise<Object|null>} Place details or null if not found
 */
export async function getPlaceDetails(placeId, options = {}) {
  const { apiKey = DEFAULT_API_KEY } = options;

  if (!placeId) {
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('fields', 'formatted_address,geometry,address_components,name,place_id');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      logger.debug('[address-utils] Place not found', { placeId, status: data.status });
      return null;
    }

    const result = data.result;
    return {
      name: result.name,
      formattedAddress: result.formatted_address,
      location: {
        lat: result.geometry?.location?.lat,
        lng: result.geometry?.location?.lng
      },
      components: extractAddressComponents(result.address_components),
      placeId: result.place_id
    };
  } catch (error) {
    logger.error('[address-utils] Place details error', { placeId, error: error.message });
    return null;
  }
}

/**
 * Format address components into a standardized string
 *
 * @param {Object} components - Address components from extractAddressComponents
 * @param {Object} options - Formatting options
 * @param {boolean} [options.includeStreet=true] - Include street in output
 * @param {boolean} [options.includeCity=true] - Include city in output
 * @param {boolean} [options.includeState=true] - Include state in output
 * @param {boolean} [options.includeCountry=true] - Include country in output
 * @param {boolean} [options.includePostalCode=false] - Include postal code in output
 * @param {boolean} [options.useShortState=false] - Use abbreviated state name
 * @param {boolean} [options.useShortCountry=false] - Use abbreviated country name
 * @returns {string} Formatted address string
 */
export function formatAddressComponents(components, options = {}) {
  const {
    includeStreet = true,
    includeCity = true,
    includeState = true,
    includeCountry = true,
    includePostalCode = false,
    useShortState = false,
    useShortCountry = false
  } = options;

  if (!components) return '';

  const parts = [];

  if (includeStreet && components.street) {
    parts.push(components.street);
  }

  if (includeCity && components.city) {
    parts.push(components.city);
  }

  if (includeState) {
    const state = useShortState ? components.stateShort : components.state;
    if (state) parts.push(state);
  }

  if (includePostalCode && components.postalCode) {
    parts.push(components.postalCode);
  }

  if (includeCountry) {
    const country = useShortCountry ? components.countryShort : components.country;
    if (country) parts.push(country);
  }

  return parts.join(', ');
}

/**
 * Create a map location string suitable for GoogleMap component
 *
 * @param {Object} destination - Destination object
 * @returns {string} Location string for map
 */
export function createMapLocationString(destination) {
  if (!destination) return '';

  // Use explicit map_location if available
  if (destination.map_location) {
    return destination.map_location;
  }

  // Build from components
  const parts = [destination.name];
  if (destination.state && destination.state !== destination.name) {
    parts.push(destination.state);
  }
  if (destination.country) {
    parts.push(destination.country);
  }

  return parts.join(', ');
}

/**
 * Calculate distance between two coordinates using Haversine formula
 *
 * @param {Object} coord1 - First coordinate { lat, lng }
 * @param {Object} coord2 - Second coordinate { lat, lng }
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(coord1, coord2) {
  if (!coord1 || !coord2 ||
      typeof coord1.lat !== 'number' || typeof coord1.lng !== 'number' ||
      typeof coord2.lat !== 'number' || typeof coord2.lng !== 'number') {
    return 0;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Degrees
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Format a location value for display
 * Handles both string locations and geocoded location objects
 *
 * @param {string|Object} location - Location string or geocoded location object
 * @param {Object} options - Formatting options
 * @param {string} [options.format='short'] - 'short' (city, country) or 'full' (displayName)
 * @returns {string} Formatted location string
 *
 * @example
 * formatLocation('New York, NY, USA') // 'New York, NY, USA'
 * formatLocation({ displayName: 'New York, NY', city: 'New York', country: 'USA' }) // 'New York, USA'
 * formatLocation({ city: 'Paris', country: 'France' }) // 'Paris, France'
 */
export function formatLocation(location, options = {}) {
  const { format = 'short' } = options;

  // Handle null/undefined
  if (!location) {
    return '';
  }

  // Handle string location (legacy format)
  if (typeof location === 'string') {
    return location;
  }

  // Handle object location (geocoded format)
  if (typeof location === 'object') {
    // If displayName exists and format is 'full', use it
    if (format === 'full' && location.displayName) {
      return location.displayName;
    }

    // Build from components for short format
    const parts = [];

    // Prefer city, fall back to displayName parsing
    if (location.city) {
      parts.push(location.city);
    }

    // Add state if different from city (for US locations)
    if (location.state && location.state !== location.city) {
      // Use short state code if available
      parts.push(location.state);
    }

    // Add country
    if (location.country) {
      // Use country code for brevity if available
      parts.push(location.countryCode || location.country);
    }

    // If we have parts, join them
    if (parts.length > 0) {
      return parts.join(', ');
    }

    // Fallback to displayName or originalQuery
    return location.displayName || location.originalQuery || '';
  }

  return '';
}

/**
 * Clear geocoding cache
 */
export function clearGeocodeCache() {
  geocodeCache.clear();
  logger.debug('[address-utils] Geocode cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
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
