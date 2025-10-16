/**
 * Cookie and Storage utility for managing browser cookies with localStorage fallback
 * Provides functions for getting, setting, and managing cookies/storage with expiration
 * Automatically detects if cookies are available and falls back to localStorage
 * Includes cookie consent management
 */

import debug from "./debug";

// Test if cookies are available
let cookiesAvailable = null;

// Cookie consent storage key
const COOKIE_CONSENT_KEY = '__cookie_consent__';

/**
 * Gets the stored cookie consent value
 * @returns {boolean|null} True if consent given, false if declined, null if not set
 */
function getStoredConsent() {
  try {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent === null) return null;
    return consent === 'true';
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
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    debug.log('Cookie consent granted');
    // Reset cookie availability test to re-check with consent
    cookiesAvailable = null;
  } catch (err) {
    debug.error('Failed to set cookie consent:', err);
  }
}

/**
 * Set cookie consent to declined
 */
export function setConsentDeclined() {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'false');
    debug.log('Cookie consent declined');
    // Force localStorage usage
    cookiesAvailable = false;
  } catch (err) {
    debug.error('Failed to set cookie consent:', err);
  }
}

/**
 * Revoke cookie consent (reset to undecided)
 */
export function revokeConsent() {
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    debug.log('Cookie consent revoked');
    // Reset cookie availability test
    cookiesAvailable = null;
  } catch (err) {
    debug.error('Failed to revoke cookie consent:', err);
  }
}

/**
 * Tests if the browser accepts cookies AND user has given consent
 * @returns {boolean} True if cookies are available and consent given, false otherwise
 */
function testCookiesAvailable() {
  // Check consent first
  if (!hasConsentGiven()) {
    debug.log('Cookies disabled: No user consent');
    return false;
  }

  if (cookiesAvailable !== null) {
    return cookiesAvailable;
  }

  try {
    // Try to set a test cookie
    const testKey = '__cookie_test__';
    const testValue = 'test';
    document.cookie = `${testKey}=${testValue}; path=/; SameSite=Lax`;
    
    // Try to read it back
    const cookieExists = document.cookie.includes(`${testKey}=${testValue}`);
    
    // Clean up test cookie
    if (cookieExists) {
      document.cookie = `${testKey}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
    }
    
    cookiesAvailable = cookieExists;
    debug.log(`Cookies available: ${cookiesAvailable}`);
    return cookiesAvailable;
  } catch (err) {
    debug.warn('Cookie test failed, falling back to localStorage:', err);
    cookiesAvailable = false;
    return false;
  }
}

/**
 * Gets data from localStorage with the storage key
 * Checks expiration metadata and returns null if expired
 * @param {string} storageKey - The localStorage key
 * @returns {Object} Parsed JSON data or empty object if not found/invalid/expired
 */
function getLocalStorageData(storageKey) {
  try {
    const rawData = localStorage.getItem(storageKey);
    if (!rawData) return {};
    
    const storageData = JSON.parse(rawData);
    
    // Check if data has expiration metadata
    if (storageData.__expires) {
      if (Date.now() > storageData.__expires) {
        // Expired, clean up and return empty
        localStorage.removeItem(storageKey);
        debug.log(`Cleaned up expired localStorage entry: ${storageKey}`);
        return {};
      }
      // Return the actual data, not the wrapper
      return storageData.__data || {};
    }
    
    // Old format without expiration metadata
    return storageData;
  } catch (err) {
    debug.error(`Error reading localStorage "${storageKey}":`, err);
    return {};
  }
}

/**
 * Sets data to localStorage
 * @param {string} storageKey - The localStorage key
 * @param {Object} data - The data to store
 */
function setLocalStorageData(storageKey, data) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (err) {
    debug.error(`Error writing to localStorage "${storageKey}":`, err);
  }
}

/**
 * Deletes data from localStorage
 * @param {string} storageKey - The localStorage key
 */
function deleteLocalStorage(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch (err) {
    debug.error(`Error deleting from localStorage "${storageKey}":`, err);
  }
}

/**
 * Gets all data from a JSON-encoded cookie or localStorage
 * @param {string} cookieName - The name of the cookie/storage key
 * @returns {Object} Parsed JSON data or empty object if not found/invalid
 */
export function getCookieData(cookieName) {
  // Use localStorage if cookies are not available
  if (!testCookiesAvailable()) {
    return getLocalStorageData(cookieName);
  }

  const cookies = document.cookie.split(";");
  const searchName = `${cookieName}=`;
  
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(searchName)) {
      try {
        const jsonData = decodeURIComponent(cookie.substring(searchName.length));
        return JSON.parse(jsonData);
      } catch (err) {
        debug.error(`Error parsing cookie "${cookieName}":`, err);
        return {};
      }
    }
  }
  return {};
}

/**
 * Sets a JSON-encoded cookie or localStorage with expiration metadata
 * @param {string} cookieName - The name of the cookie/storage key
 * @param {Object} data - The data to store (will be JSON stringified)
 * @param {number} expirationMs - Expiration time in milliseconds from now
 */
export function setCookieData(cookieName, data, expirationMs) {
  // Use localStorage if cookies are not available
  if (!testCookiesAvailable()) {
    // For localStorage, store expiration metadata with the data
    const storageData = {
      __data: data,
      __expires: Date.now() + expirationMs
    };
    setLocalStorageData(cookieName, storageData);
    return;
  }

  const expires = new Date(Date.now() + expirationMs).toUTCString();
  const jsonData = JSON.stringify(data);
  document.cookie = `${cookieName}=${encodeURIComponent(jsonData)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * Gets a specific value from a JSON-encoded cookie
 * @param {string} cookieName - The name of the cookie
 * @param {string} key - The key to retrieve from the JSON data
 * @param {number} [maxAge] - Optional: maximum age in milliseconds for the value to be considered valid
 * @returns {*} The value if found and valid, null otherwise
 */
export function getCookieValue(cookieName, key, maxAge = null) {
  const data = getCookieData(cookieName);
  const value = data[key];
  
  if (value === undefined) {
    return null;
  }
  
  // If maxAge is provided, treat value as timestamp and check if expired
  if (maxAge !== null && typeof value === 'number') {
    if (Date.now() - value >= maxAge) {
      return null;
    }
  }
  
  return value;
}

/**
 * Sets or updates a specific value in a JSON-encoded cookie (upsert)
 * Automatically cleans up expired entries based on maxAge
 * @param {string} cookieName - The name of the cookie
 * @param {string} key - The key to set/update in the JSON data
 * @param {*} value - The value to store
 * @param {number} expirationMs - Expiration time for the entire cookie in milliseconds from now
 * @param {number} [maxAge] - Optional: maximum age in milliseconds for cleaning up old entries
 */
export function setCookieValue(cookieName, key, value, expirationMs, maxAge = null) {
  const data = getCookieData(cookieName);
  
  // Clean up expired entries if maxAge is provided
  if (maxAge !== null) {
    const now = Date.now();
    Object.keys(data).forEach(k => {
      if (typeof data[k] === 'number' && now - data[k] >= maxAge) {
        delete data[k];
        debug.log(`Cleaned up expired cookie entry: ${k}`);
      }
    });
  }
  
  // Upsert: add or update the value
  data[key] = value;
  
  // Save back to cookie
  setCookieData(cookieName, data, expirationMs);
}

/**
 * Deletes a specific key from a JSON-encoded cookie
 * @param {string} cookieName - The name of the cookie
 * @param {string} key - The key to delete from the JSON data
 * @param {number} expirationMs - Expiration time for the entire cookie in milliseconds from now
 */
export function deleteCookieValue(cookieName, key, expirationMs) {
  const data = getCookieData(cookieName);
  delete data[key];
  setCookieData(cookieName, data, expirationMs);
}

/**
 * Deletes an entire cookie or localStorage entry
 * @param {string} cookieName - The name of the cookie/storage key to delete
 */
export function deleteCookie(cookieName) {
  if (!testCookiesAvailable()) {
    deleteLocalStorage(cookieName);
    return;
  }
  
  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax`;
}

/**
 * Cleans up expired entries from a JSON-encoded cookie
 * @param {string} cookieName - The name of the cookie
 * @param {number} maxAge - Maximum age in milliseconds for entries to be kept
 * @param {number} expirationMs - Expiration time for the entire cookie in milliseconds from now
 * @returns {number} Number of entries cleaned up
 */
export function cleanupExpiredEntries(cookieName, maxAge, expirationMs) {
  const data = getCookieData(cookieName);
  let cleanedCount = 0;
  const now = Date.now();
  
  Object.keys(data).forEach(key => {
    if (typeof data[key] === 'number' && now - data[key] >= maxAge) {
      delete data[key];
      cleanedCount++;
      debug.log(`Cleaned up expired cookie entry: ${key}`);
    }
  });
  
  if (cleanedCount > 0) {
    setCookieData(cookieName, data, expirationMs);
    debug.log(`Total expired entries cleaned: ${cleanedCount}`);
  }
  
  return cleanedCount;
}

/**
 * Generic helper for managing expirable dismissal states
 * Creates getter and setter functions for a specific dismissal cookie/storage
 * 
 * @param {string} storageName - The name of the cookie/storage key
 * @param {number} duration - Duration in milliseconds before expiration
 * @returns {Object} Object with get and set functions
 * 
 * @example
 * const syncAlert = createExpirableStorage('planSyncAlertDismissed', 7 * 24 * 60 * 60 * 1000);
 * syncAlert.set('plan123'); // Mark as dismissed
 * const isDismissed = syncAlert.get('plan123'); // Check if dismissed (returns timestamp or null)
 */
export function createExpirableStorage(storageName, duration) {
  return {
    /**
     * Checks if item was dismissed and if it's still valid
     * @param {string} itemId - The item ID to check
     * @returns {number|null} Timestamp if dismissed and still valid, null otherwise
     */
    get: (itemId) => {
      return getCookieValue(storageName, itemId, duration);
    },
    
    /**
     * Updates the storage with dismissal data for a specific item (upsert)
     * Automatically cleans up expired entries
     * @param {string} itemId - The item ID to mark as dismissed
     */
    set: (itemId) => {
      setCookieValue(storageName, itemId, Date.now(), duration, duration);
    },
    
    /**
     * Removes a specific item from storage
     * @param {string} itemId - The item ID to remove
     */
    remove: (itemId) => {
      deleteCookieValue(storageName, itemId, duration);
    },
    
    /**
     * Clears all items from storage
     */
    clear: () => {
      deleteCookie(storageName);
    }
  };
}

/**
 * Tests if cookies are available in the browser
 * Useful for feature detection and showing appropriate UI messages
 * @returns {boolean} True if cookies are available, false if using localStorage fallback
 */
export function areCookiesAvailable() {
  return testCookiesAvailable();
}
