/**
 * oEmbed Service for fetching link previews
 *
 * Supports fetching oEmbed data for common providers (YouTube, Vimeo, Twitter, etc.)
 * Falls back to Open Graph metadata for other URLs
 *
 * @module oembed-service
 */

import { logger } from './logger';

// Cache for oEmbed results to avoid repeated requests
const oEmbedCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Known oEmbed providers and their endpoints
 * Format: { urlPattern: RegExp, endpoint: string, format: 'json' | 'xml' }
 */
const OEMBED_PROVIDERS = [
  {
    name: 'YouTube',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=/,
      /^https?:\/\/youtu\.be\//,
      /^https?:\/\/(?:www\.)?youtube\.com\/embed\//
    ],
    endpoint: 'https://www.youtube.com/oembed'
  },
  {
    name: 'Vimeo',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?vimeo\.com\/\d+/
    ],
    endpoint: 'https://vimeo.com/api/oembed.json'
  },
  {
    name: 'Twitter',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?twitter\.com\/\w+\/status\//,
      /^https?:\/\/(?:www\.)?x\.com\/\w+\/status\//
    ],
    endpoint: 'https://publish.twitter.com/oembed'
  },
  {
    name: 'Instagram',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?instagram\.com\/p\//,
      /^https?:\/\/(?:www\.)?instagram\.com\/reel\//
    ],
    endpoint: 'https://api.instagram.com/oembed'
  },
  {
    name: 'Spotify',
    urlPatterns: [
      /^https?:\/\/open\.spotify\.com\/(track|album|playlist|episode)\//
    ],
    endpoint: 'https://open.spotify.com/oembed'
  },
  {
    name: 'SoundCloud',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?soundcloud\.com\//
    ],
    endpoint: 'https://soundcloud.com/oembed'
  },
  {
    name: 'TikTok',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?tiktok\.com\/@[\w.]+\/video\//,
      /^https?:\/\/vm\.tiktok\.com\//
    ],
    endpoint: 'https://www.tiktok.com/oembed'
  },
  {
    name: 'Flickr',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?flickr\.com\/photos\//
    ],
    endpoint: 'https://www.flickr.com/services/oembed'
  },
  {
    name: 'Giphy',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?giphy\.com\/gifs\//,
      /^https?:\/\/gph\.is\//
    ],
    endpoint: 'https://giphy.com/services/oembed'
  },
  {
    name: 'CodePen',
    urlPatterns: [
      /^https?:\/\/codepen\.io\/[\w-]+\/pen\//
    ],
    endpoint: 'https://codepen.io/api/oembed'
  }
];

/**
 * URL regex pattern for detecting URLs in text
 */
export const URL_REGEX = /https?:\/\/[-_.!~*'()a-zA-Z0-9;/?:@&=+$,%#]+/g;

/**
 * Extract all URLs from text
 * @param {string} text - Text to search for URLs
 * @returns {string[]} Array of found URLs
 */
export function extractUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches ? [...new Set(matches)] : []; // Deduplicate
}

/**
 * Find the oEmbed provider for a given URL
 * @param {string} url - URL to check
 * @returns {Object|null} Provider object or null if not found
 */
function findProvider(url) {
  for (const provider of OEMBED_PROVIDERS) {
    for (const pattern of provider.urlPatterns) {
      if (pattern.test(url)) {
        return provider;
      }
    }
  }
  return null;
}

/**
 * Check if a URL is from a known oEmbed provider
 * @param {string} url - URL to check
 * @returns {boolean} True if URL matches a known provider
 */
export function isOEmbedUrl(url) {
  return findProvider(url) !== null;
}

/**
 * Fetch oEmbed data for a URL
 * @param {string} url - URL to fetch oEmbed data for
 * @param {Object} options - Optional parameters
 * @param {number} options.maxwidth - Maximum width for embedded content
 * @param {number} options.maxheight - Maximum height for embedded content
 * @returns {Promise<Object|null>} oEmbed data or null if not available
 */
export async function fetchOEmbed(url, options = {}) {
  if (!url) return null;

  // Check cache first
  const cacheKey = `${url}:${options.maxwidth || ''}:${options.maxheight || ''}`;
  const cached = oEmbedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const provider = findProvider(url);
  if (!provider) {
    logger.debug('[oEmbed] No provider found for URL', { url });
    return null;
  }

  try {
    const params = new URLSearchParams({
      url,
      format: 'json',
      ...(options.maxwidth && { maxwidth: options.maxwidth }),
      ...(options.maxheight && { maxheight: options.maxheight })
    });

    const response = await fetch(`${provider.endpoint}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      logger.warn('[oEmbed] Failed to fetch', { url, status: response.status });
      return null;
    }

    const data = await response.json();

    // Normalize the response
    const normalized = {
      type: data.type || 'link',
      title: data.title || '',
      description: data.description || '',
      thumbnail_url: data.thumbnail_url || '',
      thumbnail_width: data.thumbnail_width,
      thumbnail_height: data.thumbnail_height,
      html: data.html || '',
      width: data.width,
      height: data.height,
      provider_name: data.provider_name || provider.name,
      provider_url: data.provider_url || '',
      author_name: data.author_name || '',
      author_url: data.author_url || '',
      url: url
    };

    // Cache the result
    oEmbedCache.set(cacheKey, {
      data: normalized,
      timestamp: Date.now()
    });

    logger.debug('[oEmbed] Fetched successfully', { url, provider: provider.name });
    return normalized;
  } catch (error) {
    logger.error('[oEmbed] Error fetching', { url, error: error.message });
    return null;
  }
}

/**
 * Fetch link preview metadata (fallback for non-oEmbed URLs)
 * Uses the backend API to fetch Open Graph metadata
 * @param {string} url - URL to fetch preview for
 * @returns {Promise<Object|null>} Link preview data or null
 */
export async function fetchLinkPreview(url) {
  if (!url) return null;

  // Check cache first
  const cacheKey = `preview:${url}`;
  const cached = oEmbedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Call backend API to fetch Open Graph metadata
    // This avoids CORS issues when fetching arbitrary URLs
    const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      logger.warn('[LinkPreview] Failed to fetch', { url, status: response.status });
      return null;
    }

    const data = await response.json();

    // Cache the result
    oEmbedCache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });

    return data;
  } catch (error) {
    logger.error('[LinkPreview] Error fetching', { url, error: error.message });
    return null;
  }
}

/**
 * Fetch preview for any URL - uses oEmbed if available, falls back to link preview
 * @param {string} url - URL to fetch preview for
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object|null>} Preview data or null
 */
export async function fetchUrlPreview(url, options = {}) {
  // Try oEmbed first for known providers
  const oEmbedData = await fetchOEmbed(url, options);
  if (oEmbedData) {
    return {
      ...oEmbedData,
      source: 'oembed'
    };
  }

  // Fall back to link preview
  const linkPreviewData = await fetchLinkPreview(url);
  if (linkPreviewData) {
    return {
      ...linkPreviewData,
      source: 'opengraph'
    };
  }

  // Return minimal data if no preview available
  return {
    type: 'link',
    url,
    title: new URL(url).hostname,
    source: 'fallback'
  };
}

/**
 * Batch fetch previews for multiple URLs
 * @param {string[]} urls - Array of URLs to fetch previews for
 * @param {Object} options - Optional parameters
 * @returns {Promise<Map<string, Object>>} Map of URL to preview data
 */
export async function fetchMultipleUrlPreviews(urls, options = {}) {
  const results = new Map();

  // Fetch all previews in parallel
  const promises = urls.map(async (url) => {
    const preview = await fetchUrlPreview(url, options);
    results.set(url, preview);
  });

  await Promise.all(promises);
  return results;
}

/**
 * Clear the oEmbed cache
 */
export function clearOEmbedCache() {
  oEmbedCache.clear();
}

/**
 * Get the provider name for a URL
 * @param {string} url - URL to check
 * @returns {string|null} Provider name or null
 */
export function getProviderName(url) {
  const provider = findProvider(url);
  return provider ? provider.name : null;
}
