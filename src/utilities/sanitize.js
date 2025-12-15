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
 * Allowed URL protocols for safe navigation
 * Only these protocols are permitted to prevent open redirect attacks
 */
const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

/**
 * Sanitize URL to prevent XSS and open redirect vulnerabilities
 * Uses an allowlist approach - only permits safe protocols
 * @param {string} url - Potentially unsafe URL
 * @returns {string} - Sanitized URL or empty string if unsafe
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmedUrl = url.trim();
  
  // Reject empty URLs
  if (!trimmedUrl) {
    return '';
  }

  // Reject protocol-relative URLs (//example.com) which could be exploited
  if (trimmedUrl.startsWith('//')) {
    return '';
  }

  try {
    // For URLs without a protocol, prepend https:// for validation
    // This handles cases like "example.com" or "www.example.com"
    const urlToValidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    
    const parsedUrl = new URL(urlToValidate);
    
    // Allowlist check: only permit safe protocols
    if (!SAFE_URL_PROTOCOLS.includes(parsedUrl.protocol)) {
      return '';
    }

    // Return the original URL (preserving user's format) if it had a valid protocol,
    // otherwise return the normalized version with https://
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedUrl)
      ? trimmedUrl
      : urlToValidate;
  } catch {
    // URL parsing failed - reject the URL
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
