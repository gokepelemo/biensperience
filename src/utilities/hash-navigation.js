/**
 * Hash Navigation Utilities
 *
 * Utilities for preserving URL fragments across React Router navigation.
 * Solves React Router limitation where hash fragments are stripped during navigation.
 *
 * @module hash-navigation
 */

import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from './storage-keys';

// Common localStorage key for hash navigation (reusable across all navigation)
// NOTE: This is the only localStorage key allowed to remain unencrypted.
const HASH_STORAGE_KEY = STORAGE_KEYS.pendingHash;

// Legacy keys (migrated automatically)
const LEGACY_HASH_STORAGE_KEYS = LEGACY_STORAGE_KEYS.pendingHash;

function readRawPendingHash() {
  try {
    const primary = localStorage.getItem(HASH_STORAGE_KEY);
    if (primary) return { key: HASH_STORAGE_KEY, raw: primary };

    for (const legacyKey of LEGACY_HASH_STORAGE_KEYS) {
      const v = localStorage.getItem(legacyKey);
      if (v) return { key: legacyKey, raw: v };
    }
  } catch (e) {
    // ignore
  }
  return { key: null, raw: null };
}

function normalizePendingHashPayload(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Legacy: raw hash string
    return { hash: raw, originPath: null, storedAt: null, meta: null };
  }
}

function migrateLegacyPendingHashIfNeeded() {
  try {
    const { key, raw } = readRawPendingHash();
    if (!raw) return;
    if (key === HASH_STORAGE_KEY) return;

    // Write into canonical key and delete legacy.
    localStorage.setItem(HASH_STORAGE_KEY, raw);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Store hash fragment before navigation
 * Uses localStorage for cross-tab compatibility and persistence
 *
 * @param {string} hash - Hash fragment (e.g., "#plan-123-item-456")
 * @param {string} [originPath] - Original path where hash was created
 * @param {Object} [meta] - Optional metadata to store alongside the hash
 */
export function storeHash(hash, originPath = null, meta = null) {
  if (!hash || typeof window === 'undefined') return;

  try {
    migrateLegacyPendingHashIfNeeded();
    const payload = JSON.stringify({ hash, originPath, storedAt: Date.now(), meta: meta || null });
    localStorage.setItem(HASH_STORAGE_KEY, payload);
  } catch (e) {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Retrieve stored hash WITHOUT clearing it
 * Allows destination component to read hash for navigation
 *
 * @returns {Object|null} - Stored object { hash, originPath, storedAt, meta } or null
 */
export function getStoredHash() {
  if (typeof window === 'undefined') return null;

  try {
    // Prefer canonical key but tolerate legacy keys.
    const { key, raw } = readRawPendingHash();
    if (!raw) return null;

    // Migrate legacy key on read
    if (key && key !== HASH_STORAGE_KEY) {
      migrateLegacyPendingHashIfNeeded();
    }

    return normalizePendingHashPayload(raw);
  } catch (e) {
    // Ignore storage errors
    return null;
  }
}

/**
 * Clear stored hash after successful navigation
 * Should be called by destination component after handling hash
 */
export function clearStoredHash() {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(HASH_STORAGE_KEY);
    // Also clear legacy keys
    LEGACY_HASH_STORAGE_KEYS.forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
  } catch (e) {
    // Ignore storage errors
  }
}

/**
 * Parse plan ID and item ID from hash
 * Supports patterns:
 * - #plan-{planId}-item-{itemId}
 * - #plan-{planId}
 *
 * @param {string} hash - Hash fragment
 * @returns {{planId: string|null, itemId: string|null}}
 */
export function parseHash(hash) {
  if (!hash || typeof hash !== 'string') {
    return { planId: null, itemId: null };
  }

  // Remove leading # if present
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;

  // Pattern: plan-{planId}-item-{itemId}
  const fullMatch = cleanHash.match(/^plan-([a-f0-9]+)-item-([a-f0-9]+)$/i);
  if (fullMatch) {
    return {
      planId: fullMatch[1],
      itemId: fullMatch[2]
    };
  }

  // Pattern: plan-{planId}
  const planMatch = cleanHash.match(/^plan-([a-f0-9]+)$/i);
  if (planMatch) {
    return {
      planId: planMatch[1],
      itemId: null
    };
  }

  return { planId: null, itemId: null };
}

/**
 * Scroll to element and trigger shake animation
 *
 * @param {string} elementId - DOM element ID to scroll to
 * @param {boolean} [shake=false] - Whether to trigger shake animation
 * @param {Object} [options] - Scroll configuration
 * @param {number} [options.renderDelay=0] - Delay for React render (default: 0ms - immediate)
 * @param {number} [options.anticipationDelay=0] - Delay before scroll starts (default: 0ms - immediate)
 */
export function scrollToElement(elementId, shake = false, options = {}) {
  if (!elementId || typeof window === 'undefined') return;

  const { renderDelay = 0, anticipationDelay = 0 } = options;

  const doScroll = () => {
    const element = document.getElementById(elementId);
    if (!element) return;

    // Scroll to element with offset for fixed headers
    const headerOffset = 80;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });

    // Trigger shake animation if requested
    if (shake) {
      element.classList.add('shake-animation');
      setTimeout(() => {
        element.classList.remove('shake-animation');
      }, 2000); // Match animation duration
    }
  };

  // Execute immediately or with minimal delay
  const totalDelay = renderDelay + anticipationDelay;
  if (totalDelay > 0) {
    setTimeout(doScroll, totalDelay);
  } else {
    // Use requestAnimationFrame for next paint if no delay
    requestAnimationFrame(doScroll);
  }
}

/**
 * Retrieve and parse stored hash from cross-navigation
 * Returns parsed plan/item IDs without modifying URL or scrolling
 * (Destination component handles URL update and scrolling)
 *
 * @returns {{planId: string|null, itemId: string|null, hash: string|null, originPath: string|null, meta: Object|null}}
 */
export function handleStoredHash() {
  const stored = getStoredHash();
  if (!stored) return { planId: null, itemId: null, hash: null, originPath: null, meta: null };

  const { hash, originPath, meta } = stored;
  if (!hash) return { planId: null, itemId: null, hash: null, originPath: originPath || null, meta: meta || null };

  const { planId, itemId } = parseHash(hash);

  return { planId, itemId, hash, originPath: originPath || null, meta: meta || null };
}

/**
 * Restore hash to URL using history API.
 * By default this will push a new history entry, but callers can request
 * replacement to avoid introducing an extra intermediate entry.
 *
 * @param {string} hash - Hash fragment to restore (e.g., "#plan-123-item-456")
 * @param {Object} [options] - Options for URL restoration
 * @param {boolean} [options.replace=false] - Whether to replace current history entry instead of pushing
 */
export function restoreHashToUrl(hash, options = {}) {
  if (!hash || typeof window === 'undefined') return;

  try {
    const { replace = false } = options;
    const cleanHash = hash.startsWith('#') ? hash : `#${hash}`;
    const newUrl = `${window.location.pathname}${cleanHash}`;

    // Compare pathname+hash to avoid origin mismatch
    const current = `${window.location.pathname}${window.location.hash || ''}`;
    if (current === newUrl) return;

    if (replace) {
      window.history.replaceState(null, '', newUrl);
    } else {
      window.history.pushState(null, '', newUrl);
    }
  } catch (e) {
    // Ignore history API errors
  }
}

export default {
  storeHash,
  getStoredHash,
  clearStoredHash,
  parseHash,
  scrollToElement,
  handleStoredHash,
  restoreHashToUrl
};
