/**
 * Cookie utility for managing browser cookies
 * Provides functions for getting, setting, and managing cookies with expiration
 */

import debug from "./debug";

/**
 * Gets all data from a JSON-encoded cookie
 * @param {string} cookieName - The name of the cookie
 * @returns {Object} Parsed JSON data or empty object if not found/invalid
 */
export function getCookieData(cookieName) {
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
 * Sets a JSON-encoded cookie with expiration
 * @param {string} cookieName - The name of the cookie
 * @param {Object} data - The data to store (will be JSON stringified)
 * @param {number} expirationMs - Expiration time in milliseconds from now
 */
export function setCookieData(cookieName, data, expirationMs) {
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
 * Deletes an entire cookie
 * @param {string} cookieName - The name of the cookie to delete
 */
export function deleteCookie(cookieName) {
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
