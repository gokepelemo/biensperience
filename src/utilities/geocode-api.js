/**
 * Geocode API Utility
 * Frontend utility for calling the backend geocoding endpoint
 * Uses backend proxy to avoid exposing API keys in frontend
 */

import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/geocode';

// In-memory cache for geocoding results
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
 * Geocode an address using the backend API
 *
 * @param {string} address - Address to geocode
 * @param {Object} options - Options
 * @param {boolean} [options.useCache=true] - Whether to use caching
 * @returns {Promise<Object|null>} Geocoding result or null if not found
 *
 * @example
 * const result = await geocodeAddressViaAPI('Los Angeles, California');
 * // Returns:
 * // {
 * //   formattedAddress: 'Los Angeles, CA, USA',
 * //   location: { lat: 34.0522, lng: -118.2437 },
 * //   city: 'Los Angeles',
 * //   country: 'United States',
 * //   ...
 * // }
 */
export async function geocodeAddressViaAPI(address, options = {}) {
  const { useCache = true } = options;

  if (!address || typeof address !== 'string' || !address.trim()) {
    logger.warn('[geocode-api] geocodeAddressViaAPI called with empty address');
    return null;
  }

  const normalizedKey = normalizeAddressKey(address);

  // Check cache
  if (useCache) {
    const cached = geocodeCache.get(normalizedKey);
    if (isCacheValid(cached)) {
      logger.debug('[geocode-api] Cache hit', { address: normalizedKey });
      return cached.result;
    }
  }

  try {
    const result = await sendRequest(BASE_URL, 'POST', { address: address.trim() });

    // Backend returns latitude/longitude directly, not in a location object
    if (!result || (typeof result.latitude !== 'number' && !result.coordinates)) {
      logger.debug('[geocode-api] No geocoding results', { address });
      return null;
    }

    // Normalize the response to include a location object for consistency
    const normalizedResult = {
      ...result,
      // Add location object with lat/lng for frontend consumption
      location: {
        lat: result.latitude,
        lng: result.longitude
      }
    };

    // Cache result
    if (useCache) {
      geocodeCache.set(normalizedKey, { result: normalizedResult, timestamp: Date.now() });
    }

    logger.debug('[geocode-api] Geocoded address via API', {
      input: address,
      output: result.displayName
    });

    return normalizedResult;
  } catch (error) {
    logger.error('[geocode-api] Geocoding error', { address, error: error.message });
    return null;
  }
}

/**
 * Batch geocode multiple addresses
 *
 * @param {Array<string>} addresses - Array of addresses to geocode
 * @param {Object} options - Options
 * @param {number} [options.batchSize=5] - Number of concurrent requests
 * @param {number} [options.delayMs=100] - Delay between batches
 * @returns {Promise<Map<string, Object>>} Map of address to geocode result
 */
export async function batchGeocodeAddresses(addresses, options = {}) {
  const { batchSize = 5, delayMs = 100 } = options;

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return new Map();
  }

  const results = new Map();
  const uniqueAddresses = [...new Set(addresses.filter(a => a && typeof a === 'string'))];

  for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
    const batch = uniqueAddresses.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (address) => {
        const result = await geocodeAddressViaAPI(address);
        return { address, result };
      })
    );

    batchResults.forEach(({ address, result }) => {
      if (result) {
        results.set(address, result);
      }
    });

    // Delay between batches to avoid rate limiting
    if (i + batchSize < uniqueAddresses.length && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Clear geocoding cache
 */
export function clearGeocodeAPICache() {
  geocodeCache.clear();
  logger.debug('[geocode-api] Cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getGeocodeAPICacheStats() {
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
