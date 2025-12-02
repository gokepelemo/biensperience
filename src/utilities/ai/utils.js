/**
 * AI Utility Functions
 *
 * SECURITY: AI availability is now determined by the backend.
 * The frontend no longer has access to API keys.
 *
 * @module ai/utils
 */

import { logger } from '../logger';
import { sendRequest } from '../send-request';
import { AI_PROVIDERS } from './constants';

const AI_API_BASE = '/api/ai';

// Cache for AI status to avoid repeated API calls
let cachedStatus = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get AI status from backend (cached)
 * @returns {Promise<Object|null>} AI status or null
 */
async function getAIStatus() {
  const now = Date.now();

  // Return cached status if still valid
  if (cachedStatus && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedStatus;
  }

  try {
    const result = await sendRequest(`${AI_API_BASE}/status`, 'GET');
    if (result.success) {
      cachedStatus = result.data;
      cacheTimestamp = now;
      return cachedStatus;
    }
  } catch (error) {
    logger.debug('Failed to get AI status', { error: error.message });
  }

  return null;
}

/**
 * Clear the cached AI status
 */
export function clearAIStatusCache() {
  cachedStatus = null;
  cacheTimestamp = 0;
}

/**
 * Check if a provider is configured (async - checks backend)
 * @param {string} provider - Provider name
 * @returns {Promise<boolean>} True if provider is configured
 */
export async function isProviderConfigured(provider) {
  const status = await getAIStatus();
  return status?.providers?.[provider] === true;
}

/**
 * Get list of configured providers (async)
 * @returns {Promise<string[]>} Array of configured provider names
 */
export async function getConfiguredProviders() {
  const status = await getAIStatus();
  if (!status?.providers) return [];

  return Object.entries(status.providers)
    .filter(([, configured]) => configured)
    .map(([provider]) => provider);
}

/**
 * Check if AI features are available
 * This is a synchronous check based on cached status.
 * For accurate async check, use isAIAvailableAsync()
 *
 * @returns {boolean} True if AI is available (based on cache)
 */
export function isAIAvailable() {
  // If we have cached status, use it
  if (cachedStatus) {
    return cachedStatus.available === true;
  }
  // Default to false if no cache - triggers async check
  return false;
}

/**
 * Check if AI features are available (async - accurate)
 * @returns {Promise<boolean>} True if AI is available
 */
export async function isAIAvailableAsync() {
  try {
    const status = await getAIStatus();
    return status?.available === true;
  } catch (error) {
    logger.debug('AI availability check failed', { error: error.message });
    return false;
  }
}

/**
 * Get the default provider (async)
 * @returns {Promise<string|null>} Default provider name or null
 */
export async function getDefaultProvider() {
  const status = await getAIStatus();
  return status?.defaultProvider || null;
}

/**
 * Synchronous version - returns cached value
 * @returns {string|null} Cached default provider
 */
export function getDefaultProviderSync() {
  return cachedStatus?.defaultProvider || null;
}

/**
 * Pre-fetch AI status for caching
 * Call this on app init to warm the cache
 */
export async function prefetchAIStatus() {
  try {
    await getAIStatus();
    logger.debug('AI status prefetched', { available: cachedStatus?.available });
  } catch (error) {
    logger.debug('AI status prefetch failed', { error: error.message });
  }
}
