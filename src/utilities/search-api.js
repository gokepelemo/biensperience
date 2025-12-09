import { sendQueuedRequest, PRIORITY } from './send-request';

const BASE_URL = '/api/search';

/**
 * Search across all collections (destinations, experiences, plans, users)
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {Array<string>} options.types - Filter by types: ['destination', 'experience', 'plan', 'user']
 * @param {number} options.limit - Maximum results per type (default: 10)
 * @returns {Promise<Array>} Array of search results with type property
 */
export async function searchAll(query, options = {}) {
  const { types = [], limit = 10 } = options;

  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  });

  if (types.length > 0) {
    params.append('types', types.join(','));
  }

  // High priority for search - user is actively typing and waiting
  const response = await sendQueuedRequest(`${BASE_URL}?${params.toString()}`, "GET", null, {
    priority: PRIORITY.HIGH,
    label: 'search',
    coalesce: true, // Coalesce rapid search requests
  });
  // Backend returns { results: [...] }, extract the results array
  return response.results || [];
}

/**
 * Search destinations only
 * @param {string} query - Search query
 * @param {number} limit - Maximum results (default: 10)
 * @returns {Promise<Array>} Array of destination results
 */
export async function searchDestinations(query, limit = 10) {
  return searchAll(query, { types: ['destination'], limit });
}

/**
 * Search experiences only
 * @param {string} query - Search query
 * @param {number} limit - Maximum results (default: 10)
 * @returns {Promise<Array>} Array of experience results
 */
export async function searchExperiences(query, limit = 10) {
  return searchAll(query, { types: ['experience'], limit });
}

/**
 * Search plans only
 * @param {string} query - Search query
 * @param {number} limit - Maximum results (default: 10)
 * @returns {Promise<Array>} Array of plan results
 */
export async function searchPlans(query, limit = 10) {
  return searchAll(query, { types: ['plan'], limit });
}

/**
 * Search users only (admin feature)
 * @param {string} query - Search query
 * @param {number} limit - Maximum results (default: 10)
 * @returns {Promise<Array>} Array of user results
 */
export async function searchUsers(query, limit = 10) {
  return searchAll(query, { types: ['user'], limit });
}

/**
 * Future: Search using external service (Algolia, Elasticsearch, etc.)
 * This is a placeholder for future integration
 */
export async function searchWithExternalService(query, options = {}) {
  return searchAll(query, options);
}
