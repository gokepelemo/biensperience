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

/**
 * Normalize a URL by adding a scheme if it doesn't have one
 * - Returns empty string if URL is empty or invalid
 * - Adds https:// if no scheme is present
 * - Preserves existing scheme (http://, https://, ftp://, mailto:, tel:, etc.)
 * @param {string} url - The URL to normalize
 * @returns {string} - The normalized URL with scheme
 * 
 * @example
 * normalizeUrl('example.com') // => 'https://example.com'
 * normalizeUrl('http://example.com') // => 'http://example.com'
 * normalizeUrl('www.example.com') // => 'https://www.example.com'
 * normalizeUrl('mailto:user@example.com') // => 'mailto:user@example.com'
 * normalizeUrl('') // => ''
 */
export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Trim whitespace
  const trimmed = url.trim();
  
  if (!trimmed) {
    return '';
  }

  // Check if URL already has a scheme (protocol)
  // Matches schemes at the start followed by : or ://
  // Must be at the very beginning and consist of letters, digits, +, -, or .
  // The colon must be followed by at least one character (not end of string)
  // This avoids matching "user:pass" or "domain:port" patterns
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:(?:\/\/|[^/])/i.test(trimmed);
  
  if (hasScheme) {
    return trimmed;
  }

  // Add https:// as default scheme
  return `https://${trimmed}`;
}