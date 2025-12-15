/**
 * Unified Encrypted Storage Utility
 *
 * Provides a consistent API for storing data in localStorage with encryption.
 * All data except tokens should use this utility.
 *
 * Key features:
 * - AES-GCM encryption using Web Crypto API
 * - Falls back to session-based key for anonymous users
 * - Automatic migration from unencrypted legacy data
 * - Type-safe key management with namespace prefixes
 *
 * Storage keys that should NOT use this (remain unencrypted):
 * - 'token' - JWT tokens are self-contained and don't benefit from encryption
 *
 * @module utilities/encrypted-storage
 */

import { encryptData, decryptData } from './crypto-utils';
import { logger } from './logger';

/**
 * Storage namespace prefix for all encrypted data
 */
const STORAGE_PREFIX = 'biensperience:';

/**
 * Session-based encryption key for anonymous users
 * Generated once per browser session, stored in sessionStorage
 */
const SESSION_KEY_STORAGE = 'biensperience:session_encryption_key';

/**
 * Get or create a session-based encryption key for anonymous users
 * This provides encryption even when no user is logged in
 * @returns {string} Session encryption key
 */
function getSessionEncryptionKey() {
  try {
    let sessionKey = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!sessionKey) {
      // Generate a random key for this session
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      sessionKey = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem(SESSION_KEY_STORAGE, sessionKey);
    }
    return sessionKey;
  } catch (e) {
    // Fallback for environments without sessionStorage
    logger.warn('sessionStorage not available, using fallback key');
    return 'anonymous-fallback-key-' + Date.now();
  }
}

/**
 * Get the encryption key to use
 * Uses userId if available, otherwise uses session key
 * @param {string} [userId] - User ID for encryption
 * @returns {string} Encryption key
 */
function getEncryptionKey(userId) {
  return userId || getSessionEncryptionKey();
}

/**
 * Store data in encrypted localStorage
 *
 * @param {string} key - Storage key (will be prefixed with namespace)
 * @param {*} data - Data to store (any JSON-serializable value)
 * @param {Object} [options] - Storage options
 * @param {string} [options.userId] - User ID for encryption (uses session key if not provided)
 * @param {boolean} [options.skipPrefix] - If true, don't add namespace prefix to key
 * @returns {Promise<boolean>} Success status
 *
 * @example
 * // Store with user encryption
 * await setEncrypted('user_data', userData, { userId: user._id });
 *
 * // Store for anonymous user (uses session key)
 * await setEncrypted('theme', 'dark');
 */
export async function setEncrypted(key, data, options = {}) {
  const { userId, skipPrefix = false } = options;
  const storageKey = skipPrefix ? key : `${STORAGE_PREFIX}${key}`;
  const encryptionKey = getEncryptionKey(userId);

  try {
    const encrypted = await encryptData(data, encryptionKey);
    localStorage.setItem(storageKey, encrypted);
    return true;
  } catch (e) {
    logger.error('Failed to store encrypted data', { key: storageKey, error: e.message });
    return false;
  }
}

/**
 * Retrieve and decrypt data from localStorage
 *
 * @param {string} key - Storage key (will be prefixed with namespace)
 * @param {*} [defaultValue=null] - Default value if not found or decryption fails
 * @param {Object} [options] - Retrieval options
 * @param {string} [options.userId] - User ID for decryption (uses session key if not provided)
 * @param {boolean} [options.skipPrefix] - If true, don't add namespace prefix to key
 * @returns {Promise<*>} Decrypted data or default value
 *
 * @example
 * const userData = await getEncrypted('user_data', null, { userId: user._id });
 */
export async function getEncrypted(key, defaultValue = null, options = {}) {
  const { userId, skipPrefix = false } = options;
  const storageKey = skipPrefix ? key : `${STORAGE_PREFIX}${key}`;
  const encryptionKey = getEncryptionKey(userId);

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return defaultValue;
    }

    const decrypted = await decryptData(stored, encryptionKey);
    return decrypted ?? defaultValue;
  } catch (e) {
    logger.debug('Failed to retrieve encrypted data', { key: storageKey, error: e.message });
    return defaultValue;
  }
}

/**
 * Remove data from localStorage
 *
 * @param {string} key - Storage key (will be prefixed with namespace)
 * @param {Object} [options] - Options
 * @param {boolean} [options.skipPrefix] - If true, don't add namespace prefix to key
 * @returns {boolean} Success status
 */
export function removeEncrypted(key, options = {}) {
  const { skipPrefix = false } = options;
  const storageKey = skipPrefix ? key : `${STORAGE_PREFIX}${key}`;

  try {
    localStorage.removeItem(storageKey);
    return true;
  } catch (e) {
    logger.error('Failed to remove data', { key: storageKey, error: e.message });
    return false;
  }
}

/**
 * Check if a key exists in localStorage
 *
 * @param {string} key - Storage key (will be prefixed with namespace)
 * @param {Object} [options] - Options
 * @param {boolean} [options.skipPrefix] - If true, don't add namespace prefix to key
 * @returns {boolean} True if key exists
 */
export function hasEncrypted(key, options = {}) {
  const { skipPrefix = false } = options;
  const storageKey = skipPrefix ? key : `${STORAGE_PREFIX}${key}`;

  try {
    return localStorage.getItem(storageKey) !== null;
  } catch (e) {
    return false;
  }
}

/**
 * Migrate unencrypted data to encrypted storage
 * Call this on app startup or user login to migrate legacy data
 *
 * @param {string} legacyKey - Legacy storage key to migrate from
 * @param {string} newKey - New key to migrate to
 * @param {Object} [options] - Migration options
 * @param {string} [options.userId] - User ID for encryption
 * @param {boolean} [options.removeLegacy] - If true, remove legacy key after migration
 * @returns {Promise<boolean>} True if migration occurred
 */
export async function migrateToEncrypted(legacyKey, newKey, options = {}) {
  const { userId, removeLegacy = true } = options;

  try {
    const legacyData = localStorage.getItem(legacyKey);
    if (!legacyData) {
      return false; // Nothing to migrate
    }

    // Try to parse as JSON (legacy unencrypted data)
    let data;
    try {
      data = JSON.parse(legacyData);
    } catch {
      // Not JSON, store as-is
      data = legacyData;
    }

    // Store in encrypted format
    await setEncrypted(newKey, data, { userId });

    // Remove legacy key if requested
    if (removeLegacy) {
      localStorage.removeItem(legacyKey);
      logger.info('Migrated and removed legacy storage key', { legacyKey, newKey });
    }

    return true;
  } catch (e) {
    logger.error('Migration failed', { legacyKey, newKey, error: e.message });
    return false;
  }
}

/**
 * Clear all encrypted storage for the current user/session
 * Useful for logout
 *
 * @param {Object} [options] - Options
 * @param {boolean} [options.clearSessionKey] - If true, also clear the session encryption key
 */
export function clearEncryptedStorage(options = {}) {
  const { clearSessionKey = false } = options;

  try {
    // Remove all keys with our prefix
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && key !== 'token') {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));

    if (clearSessionKey) {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
    }

    logger.info('Cleared encrypted storage', { keysRemoved: keysToRemove.length });
  } catch (e) {
    logger.error('Failed to clear encrypted storage', { error: e.message });
  }
}

/**
 * Storage keys enum for type safety
 * Use these constants instead of raw strings
 */
export const STORAGE_KEYS = {
  // User data
  USER: 'user',
  USER_PREFERENCES: 'preferences',
  ENCRYPTED_PREFS: 'encrypted_prefs',
  PREFS_META: 'prefs_meta',

  // UI state
  THEME: 'theme',
  UI_PREFERENCES: 'ui_preferences',
  HASH_NAVIGATION: 'hash_navigation',

  // Session/temp data
  EVENT_QUEUE: 'event_queue',
  STORAGE_VERSION: 'storage_version',
  SEEN_TOASTS: 'seen_toasts',

  // Currency/locale (legacy, prefer encrypted_prefs)
  CURRENCY: 'currency',
  LANGUAGE: 'language',
  TIMEZONE: 'timezone'
};

/**
 * Keys that should NOT be encrypted (tokens, version markers)
 */
export const UNENCRYPTED_KEYS = new Set([
  'token',
  'biensperience:storage_version'
]);
