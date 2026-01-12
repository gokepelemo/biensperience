/**
 * Cookie and Storage utility - Refactored version using js-cookie and store2
 * Manages browser cookies with localStorage fallback
 * Includes cookie consent management and expirable storage helpers
 */

import Cookies from 'js-cookie';
import debug from "./debug";
import { getObfuscatedJson, removeStorageKey, setObfuscatedJson } from './secure-storage-lite';

// Cookie consent storage key (canonical)
const COOKIE_CONSENT_KEY = 'bien:cookieConsent';
const LEGACY_COOKIE_CONSENT_KEYS = ['__cookie_consent__', 'bien:cookie_consent'];

function getCookieDataStorageKey(name) {
  return `bien:cookieData:${name}`;
}

/**
 * Gets the stored cookie consent value
 * @returns {boolean|null} True if consent given, false if declined, null if not set
 */
function getStoredConsent() {
  try {
    const canonical = getObfuscatedJson(localStorage, COOKIE_CONSENT_KEY, null);
    if (canonical === true) return true;
    if (canonical === false) return false;

    // Migrate legacy plaintext values
    for (const legacyKey of LEGACY_COOKIE_CONSENT_KEYS) {
      try {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw === null || legacyRaw === undefined) continue;

        let parsed;
        try {
          parsed = JSON.parse(legacyRaw);
        } catch {
          parsed = legacyRaw;
        }

        const normalized = parsed === true || parsed === 'true'
          ? true
          : parsed === false || parsed === 'false'
          ? false
          : null;

        if (normalized !== null) {
          setObfuscatedJson(localStorage, COOKIE_CONSENT_KEY, normalized);
          try { localStorage.removeItem(legacyKey); } catch (e) {}
          return normalized;
        }
      } catch {
        // ignore per-key failures
      }
    }

    return null;
  } catch (err) {
    debug.warn('Failed to read cookie consent from localStorage:', err);
    return null;
  }
}

/**
 * Check if user has given cookie consent
 * @returns {boolean} True if user has given consent
 */
export function hasConsentGiven() {
  const consent = getStoredConsent();
  return consent === true;
}

/**
 * Check if user has declined cookie consent
 * @returns {boolean} True if user has declined
 */
export function hasConsentDeclined() {
  const consent = getStoredConsent();
  return consent === false;
}

/**
 * Check if consent has been decided (either given or declined)
 * @returns {boolean} True if user has made a choice
 */
export function hasConsentDecided() {
  return getStoredConsent() !== null;
}

/**
 * Set cookie consent to given
 */
export function setConsentGiven() {
  try {
    setObfuscatedJson(localStorage, COOKIE_CONSENT_KEY, true);
    LEGACY_COOKIE_CONSENT_KEYS.forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    debug.log('Cookie consent granted');
  } catch (err) {
    debug.error('Failed to set cookie consent:', err);
  }
}

/**
 * Set cookie consent to declined
 */
export function setConsentDeclined() {
  try {
    setObfuscatedJson(localStorage, COOKIE_CONSENT_KEY, false);
    LEGACY_COOKIE_CONSENT_KEYS.forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    debug.log('Cookie consent declined');
  } catch (err) {
    debug.error('Failed to set cookie consent:', err);
  }
}

/**
 * Revoke cookie consent (reset to undecided)
 */
export function revokeConsent() {
  try {
    removeStorageKey(localStorage, COOKIE_CONSENT_KEY);
    LEGACY_COOKIE_CONSENT_KEYS.forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    debug.log('Cookie consent revoked');
  } catch (err) {
    debug.error('Failed to revoke cookie consent:', err);
  }
}

/**
 * Tests if cookies are available AND user has given consent
 * @returns {boolean} True if cookies are available and consent given
 */
function canUseCookies() {
  if (!hasConsentGiven()) {
    debug.log('Cookies disabled: No user consent');
    return false;
  }

  try {
    const testKey = '__cookie_test__';
    Cookies.set(testKey, 'test', { sameSite: 'Lax' });
    const works = Cookies.get(testKey) === 'test';
    Cookies.remove(testKey);
    return works;
  } catch (err) {
    debug.warn('Cookie test failed, will use localStorage:', err);
    return false;
  }
}

/**
 * Gets data from storage (cookie or localStorage based on availability)
 * @param {string} name - Storage key name
 * @returns {Object} Parsed data or empty object if not found/invalid/expired
 */
export function getCookieData(name) {
  if (canUseCookies()) {
    try {
      const value = Cookies.get(name);
      if (!value) return {};
      return JSON.parse(value);
    } catch (err) {
      debug.error(`Error parsing cookie "${name}":`, err);
      return {};
    }
  }

  // Fallback to localStorage
  try {
    const storageKey = getCookieDataStorageKey(name);
    let data = getObfuscatedJson(localStorage, storageKey, null);

    // Migrate legacy plaintext store2 payload if present
    if (!data) {
      try {
        const legacyRaw = localStorage.getItem(name);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (parsed && typeof parsed === 'object') {
            data = parsed;
            setObfuscatedJson(localStorage, storageKey, parsed);
          }
          try { localStorage.removeItem(name); } catch (e) {}
        }
      } catch {
        // ignore
      }
    }

    if (!data) return {};
    
    // Check expiration metadata
    if (data.__expires && Date.now() > data.__expires) {
      removeStorageKey(localStorage, storageKey);
      debug.log(`Cleaned up expired localStorage entry: ${name}`);
      return {};
    }
    
    return data.__data || data;
  } catch (err) {
    debug.error(`Error reading localStorage "${name}":`, err);
    return {};
  }
}

/**
 * Sets data to storage with expiration
 * @param {string} name - Storage key name
 * @param {Object} data - Data to store (will be JSON stringified)
 * @param {number} expirationMs - Expiration time in milliseconds from now
 */
export function setCookieData(name, data, expirationMs) {
  if (canUseCookies()) {
    try {
      const expires = expirationMs / (1000 * 60 * 60 * 24); // Convert to days
      Cookies.set(name, JSON.stringify(data), { expires, sameSite: 'Lax', path: '/' });
      return;
    } catch (err) {
      debug.error(`Error setting cookie "${name}":`, err);
    }
  }

  // Fallback to localStorage with expiration metadata
  try {
    const storageData = { __data: data, __expires: Date.now() + expirationMs };
    const storageKey = getCookieDataStorageKey(name);
    setObfuscatedJson(localStorage, storageKey, storageData);
    // Cleanup legacy key (store2 plaintext) if present
    try { localStorage.removeItem(name); } catch (e) {}
  } catch (err) {
    debug.error(`Error writing to localStorage "${name}":`, err);
  }
}

/**
 * Gets a specific value from storage
 * @param {string} name - Storage key name
 * @param {string} key - Key to retrieve from the data
 * @param {number} [maxAge] - Optional: maximum age in milliseconds for validity
 * @returns {*} The value if found and valid, null otherwise
 */
export function getCookieValue(name, key, maxAge = null) {
  const data = getCookieData(name);
  const value = data[key];
  
  if (value === undefined) return null;
  
  // If maxAge provided, treat value as timestamp and check if expired
  if (maxAge !== null && typeof value === 'number') {
    if (Date.now() - value >= maxAge) return null;
  }
  
  return value;
}

/**
 * Sets or updates a specific value in storage (upsert)
 * @param {string} name - Storage key name
 * @param {string} key - Key to set/update in the data
 * @param {*} value - Value to store
 * @param {number} expirationMs - Expiration time in milliseconds from now
 * @param {number} [maxAge] - Optional: maximum age for cleanup
 */
export function setCookieValue(name, key, value, expirationMs, maxAge = null) {
  const data = getCookieData(name);
  
  // Clean up expired entries if maxAge provided
  if (maxAge !== null) {
    const now = Date.now();
    Object.keys(data).forEach(k => {
      if (typeof data[k] === 'number' && now - data[k] >= maxAge) {
        delete data[k];
        debug.log(`Cleaned up expired entry: ${k}`);
      }
    });
  }
  
  data[key] = value;
  setCookieData(name, data, expirationMs);
}

/**
 * Deletes a specific key from storage
 * @param {string} name - Storage key name
 * @param {string} key - Key to delete from the data
 * @param {number} expirationMs - Expiration time in milliseconds from now
 */
export function deleteCookieValue(name, key, expirationMs) {
  const data = getCookieData(name);
  delete data[key];
  setCookieData(name, data, expirationMs);
}

/**
 * Deletes entire storage entry
 * @param {string} name - Storage key name to delete
 */
export function deleteCookie(name) {
  if (canUseCookies()) {
    Cookies.remove(name, { path: '/' });
  } else {
    store.remove(name);
  }
}

/**
 * Cleans up expired entries from storage
 * @param {string} name - Storage key name
 * @param {number} maxAge - Maximum age in milliseconds for entries to be kept
 * @param {number} expirationMs - Expiration time in milliseconds from now
 * @returns {number} Number of entries cleaned up
 */
export function cleanupExpiredEntries(name, maxAge, expirationMs) {
  const data = getCookieData(name);
  let cleanedCount = 0;
  const now = Date.now();
  
  Object.keys(data).forEach(key => {
    if (typeof data[key] === 'number' && now - data[key] >= maxAge) {
      delete data[key];
      cleanedCount++;
      debug.log(`Cleaned up expired entry: ${key}`);
    }
  });
  
  if (cleanedCount > 0) {
    setCookieData(name, data, expirationMs);
    debug.log(`Total expired entries cleaned: ${cleanedCount}`);
  }
  
  return cleanedCount;
}

/**
 * Generic helper for managing expirable dismissal states
 * @param {string} storageName - Storage key name
 * @param {number} duration - Duration in milliseconds before expiration
 * @returns {Object} Object with get, set, remove, and clear functions
 * 
 * @example
 * const syncAlert = createExpirableStorage('planSyncAlertDismissed', 7 * 24 * 60 * 60 * 1000);
 * syncAlert.set('plan123');
 * const isDismissed = syncAlert.get('plan123');
 */
export function createExpirableStorage(storageName, duration) {
  return {
    get: (itemId) => getCookieValue(storageName, itemId, duration),
    set: (itemId) => setCookieValue(storageName, itemId, Date.now(), duration, duration),
    remove: (itemId) => deleteCookieValue(storageName, itemId, duration),
    clear: () => deleteCookie(storageName)
  };
}

/**
 * Tests if cookies are available in the browser
 * @returns {boolean} True if cookies are available
 */
export function areCookiesAvailable() {
  return canUseCookies();
}
