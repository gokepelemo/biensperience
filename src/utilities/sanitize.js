/**
 * XSS Sanitization Utilities
 * Use DOMPurify to sanitize user-generated content before rendering
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} dirty - Potentially unsafe HTML string
 * @param {Object} options - DOMPurify configuration options
 * @returns {string} - Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(dirty, options = {}) {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ...options
  });
}

/**
 * Sanitize text content (strips all HTML)
 * @param {string} dirty - Potentially unsafe text string
 * @returns {string} - Plain text with no HTML
 */
export function sanitizeText(dirty) {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 * @param {string} url - Potentially unsafe URL
 * @returns {string} - Sanitized URL or empty string if unsafe
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const sanitized = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    sanitized.startsWith('javascript:') ||
    sanitized.startsWith('data:') ||
    sanitized.startsWith('vbscript:')
  ) {
    return '';
  }

  // Ensure URL is properly encoded
  try {
    return encodeURI(decodeURI(url));
  } catch (e) {
    return '';
  }
}

/**
 * Create a sanitized dangerouslySetInnerHTML prop for React
 * @param {string} html - HTML string to sanitize
 * @returns {Object} - Object with __html property for React
 */
export function createSafeMarkup(html) {
  return {
    __html: sanitizeHtml(html)
  };
}

/**
 * Sanitize object fields that may contain user input
 * @param {Object} obj - Object to sanitize
 * @param {Array} fields - Array of field names to sanitize
 * @returns {Object} - New object with sanitized fields
 */
export function sanitizeObject(obj, fields = []) {
  if (!obj || typeof obj !== 'object') {
    return {};
  }

  const sanitized = { ...obj };

  fields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeText(sanitized[field]);
    }
  });

  return sanitized;
}
