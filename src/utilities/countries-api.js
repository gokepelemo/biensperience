import { sendRequest } from './send-request';

const BASE_URL = '/api/countries';

/**
 * Get destinations and experiences for a specific country with pagination
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
 * @param {string} countryName - Name of the country (slug or display name)
 * @param {number} page - Page to load
 * @param {number} limit - Items per page
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
 * @param {string} countryName - Name of the country (slug or display name)
 * @param {number} page - Page to load
 * @param {number} limit - Items per page
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
