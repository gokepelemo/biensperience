/**
 * URL processing utility functions
 * @module url-utils
 */

/**
 * Convert a string to a URL-friendly slug
 * - Converts to lowercase
 * - Replaces spaces and symbols with hyphens
 * - Collapses apostrophes (removes them)
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 * @param {string} str - The string to convert to a slug
 * @returns {string} - The URL slug
 */
export function createUrlSlug(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  return str
    .toLowerCase()
    // Remove apostrophes
    .replace(/'/g, '')
    // Replace spaces and symbols with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Trim hyphens from start and end
    .replace(/^-+|-+$/g, '');
}