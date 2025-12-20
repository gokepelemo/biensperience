/**
 * Countries API Utilities
 *
 * Frontend API utilities for fetching country-specific destinations and experiences
 * with pagination support. Used by the Countries view for displaying all destinations
 * and experiences within a specific country.
 *
 * NOTE: This is a read-only API - no mutation events are emitted since all functions
 * only perform GET requests. For destination/experience mutations, use the respective
 * destinations-api.js and experiences-api.js which emit events via eventBus.
 *
 * @module countries-api
 */

import { sendRequest } from './send-request';

const BASE_URL = '/api/countries';

/**
 * Get destinations and experiences for a specific country with pagination
 *
 * @example
 * // Fetch first page of destinations and experiences for France
 * const data = await getCountryData('france');
 * console.log(data.destinations, data.experiences);
 *
 * @example
 * // Fetch with custom pagination
 * const data = await getCountryData('japan', {
 *   destinationsPage: 2,
 *   destinationsLimit: 6,
 *   experiencesLimit: 24
 * });
 * @param {string} countryName - Name of the country (slug or display name)
 * @param {Object} options - Pagination options
 * @param {number} options.destinationsPage - Page number for destinations (default: 1)
 * @param {number} options.destinationsLimit - Items per page for destinations (default: 12)
 * @param {number} options.experiencesPage - Page number for experiences (default: 1)
 * @param {number} options.experiencesLimit - Items per page for experiences (default: 12)
 * @returns {Promise<{
 *   country: string,
 *   slug: string,
 *   destinations: Array,
 *   destinationsMeta: { page: number, limit: number, total: number, totalPages: number, hasMore: boolean },
 *   experiences: Array,
 *   experiencesMeta: { page: number, limit: number, total: number, totalPages: number, hasMore: boolean }
 * }>}
 */
export async function getCountryData(countryName, options = {}) {
  const {
    destinationsPage = 1,
    destinationsLimit = 12,
    experiencesPage = 1,
    experiencesLimit = 12
  } = options;

  // Build query string
  const params = new URLSearchParams();
  if (destinationsPage > 1) params.set('destinationsPage', String(destinationsPage));
  if (destinationsLimit !== 12) params.set('destinationsLimit', String(destinationsLimit));
  if (experiencesPage > 1) params.set('experiencesPage', String(experiencesPage));
  if (experiencesLimit !== 12) params.set('experiencesLimit', String(experiencesLimit));

  const queryString = params.toString();
  const url = `${BASE_URL}/${encodeURIComponent(countryName)}${queryString ? `?${queryString}` : ''}`;

  const response = await sendRequest(url, 'GET');
  // API returns { success: true, data: { country, slug, destinations, destinationsMeta, experiences, experiencesMeta } }
  return response?.data || response;
}

/**
 * Load more destinations for a country
 *
 * Optimized for pagination - only fetches destinations, skips experiences query.
 *
 * @example
 * // Load page 2 of destinations
 * const { destinations, destinationsMeta } = await loadMoreDestinations('italy', 2);
 * if (destinationsMeta.hasMore) {
 *   // Can load more
 * }
 *
 * @param {string} countryName - Name of the country (slug or display name)
 * @param {number} page - Page to load
 * @param {number} [limit=12] - Items per page
 * @returns {Promise<{ destinations: Array, destinationsMeta: Object }>}
 */
export async function loadMoreDestinations(countryName, page, limit = 12) {
  const result = await getCountryData(countryName, {
    destinationsPage: page,
    destinationsLimit: limit,
    experiencesPage: 1,
    experiencesLimit: 0 // Don't fetch experiences
  });
  return {
    destinations: result.destinations || [],
    destinationsMeta: result.destinationsMeta
  };
}

/**
 * Load more experiences for a country
 *
 * Optimized for pagination - only fetches experiences, skips destinations query.
 *
 * @example
 * // Load page 3 of experiences with custom limit
 * const { experiences, experiencesMeta } = await loadMoreExperiences('spain', 3, 24);
 *
 * @param {string} countryName - Name of the country (slug or display name)
 * @param {number} page - Page to load
 * @param {number} [limit=12] - Items per page
 * @returns {Promise<{ experiences: Array, experiencesMeta: Object }>}
 */
export async function loadMoreExperiences(countryName, page, limit = 12) {
  const result = await getCountryData(countryName, {
    destinationsPage: 1,
    destinationsLimit: 0, // Don't fetch destinations
    experiencesPage: page,
    experiencesLimit: limit
  });
  return {
    experiences: result.experiences || [],
    experiencesMeta: result.experiencesMeta
  };
}
