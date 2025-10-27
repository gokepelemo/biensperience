/**
 * API Tokens Service
 *
 * Functions for managing API tokens on the frontend.
 */

import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/tokens';

/**
 * Get all API tokens for the current user
 * @returns {Promise<Array>} - Array of token objects
 */
export async function getApiTokens() {
  try {
    const tokens = await sendRequest(BASE_URL, 'GET');
    logger.debug('Retrieved API tokens', { count: tokens.length });
    return tokens;
  } catch (error) {
    logger.error('Error getting API tokens', {}, error);
    throw error;
  }
}

/**
 * Create a new API token
 * @param {Object} tokenData - Token configuration
 * @param {string} tokenData.name - Token name/description
 * @param {Date} tokenData.expiresAt - Optional expiration date
 * @returns {Promise<Object>} - { token, tokenData }
 */
export async function createApiToken(tokenData) {
  try {
    const result = await sendRequest(BASE_URL, 'POST', tokenData);
    logger.info('Created API token', { tokenName: tokenData.name });
    return result;
  } catch (error) {
    logger.error('Error creating API token', { tokenData }, error);
    throw error;
  }
}

/**
 * Delete (revoke) an API token
 * @param {string} tokenId - Token ID to delete
 * @param {boolean} permanent - Whether to permanently delete (default: false)
 * @returns {Promise<Object>} - Success response
 */
export async function deleteApiToken(tokenId, permanent = false) {
  try {
    const url = permanent ? `${BASE_URL}/${tokenId}?permanent=true` : `${BASE_URL}/${tokenId}`;
    const result = await sendRequest(url, 'DELETE');
    logger.info('Deleted API token', { tokenId, permanent });
    return result;
  } catch (error) {
    logger.error('Error deleting API token', { tokenId }, error);
    throw error;
  }
}

/**
 * Toggle API access for the current user
 * @param {boolean} enabled - Whether to enable API access
 * @returns {Promise<Object>} - { success, apiEnabled, message }
 */
export async function toggleApiAccess(enabled) {
  try {
    const result = await sendRequest(`${BASE_URL}/toggle-api-access`, 'PUT', { enabled });
    logger.info('Toggled API access', { enabled });
    return result;
  } catch (error) {
    logger.error('Error toggling API access', { enabled }, error);
    throw error;
  }
}
