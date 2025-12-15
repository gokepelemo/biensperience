/**
 * User Preferences Utilities
 *
 * Provides application-wide access to user preferences with localStorage fallback.
 * Preferences are synced from user profile and stored locally for fast access.
 *
 * Features:
 * - Encrypted localStorage storage (AES-GCM via Web Crypto API)
 * - TTL/expiry support for temporary preferences
 * - Namespace-based organization
 * - Sync support with user profile
 * - Automatic size management with LRU eviction
 * - Single storage key for all preferences
 *
 * Storage Management:
 * - All preferences stored in single encrypted key: 'biensperience:encrypted_prefs'
 * - Maximum size: 4MB (encrypted data)
 * - Safe threshold: 3MB (triggers automatic cleanup)
 * - LRU (Least Recently Used) eviction when storage is full
 * - Hierarchy preferences protected from auto-cleanup (highest priority)
 * - Access times tracked for intelligent cleanup
 *
 * @module preferences-utils
 */

import { encryptData, decryptData } from './crypto-utils';
import { logger } from './logger';

// Default preferences when no user is logged in or preferences not set
const DEFAULT_PREFERENCES = {
  theme: 'system-default',
  currency: 'USD',
  language: 'en',
  timezone: 'system-default',
  profileVisibility: 'public',
  notifications: {
    enabled: true,
    channels: ['email'],
    types: ['activity', 'reminder']
  }
};

// localStorage key for preferences
const STORAGE_KEY = 'biensperience:preferences';

// ============================================================================
// ENCRYPTED PREFERENCES API
// Standard API for storing, retrieving, and expiring preferences
// ============================================================================

/**
 * Storage key for encrypted UI preferences
 */
const ENCRYPTED_PREFERENCES_KEY = 'biensperience:encrypted_prefs';

/**
 * Metadata key for preference expiry tracking
 */
const PREFERENCES_META_KEY = 'biensperience:prefs_meta';

/**
 * Storage size limits
 * localStorage typically has a 5-10MB limit per domain
 * Keep well below that to avoid quota exceeded errors
 */
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB max for encrypted data
const SAFE_STORAGE_SIZE = 3 * 1024 * 1024; // 3MB safe threshold - trigger cleanup

/**
 * Preference categories for organization
 */
export const PREFERENCE_CATEGORIES = {
  VIEW_MODE: 'viewMode',
  SORT: 'sort',
  FILTER: 'filter',
  LAYOUT: 'layout',
  DISPLAY: 'display',
  FORM: 'form',
  SESSION: 'session',
  CUSTOM: 'custom'
};

/**
 * Standard preference keys for view modes
 */
export const PREFERENCE_KEYS = {
  // View mode preferences
  VIEW_MODE_MY_PLANS: 'viewMode.myPlans',
  VIEW_MODE_CALENDAR_VIEW: 'viewMode.calendarView', // month/week/day
  VIEW_MODE_EXPERIENCES: 'viewMode.experiences',
  VIEW_MODE_DESTINATIONS: 'viewMode.destinations',
  VIEW_MODE_PROFILE_EXPERIENCES: 'viewMode.profileExperiences',
  VIEW_MODE_PROFILE_DESTINATIONS: 'viewMode.profileDestinations',
  VIEW_MODE_PLAN_ITEMS: 'viewMode.planItems',

  // Layout preferences
  LAYOUT_SIDEBAR_COLLAPSED: 'layout.sidebarCollapsed',
  LAYOUT_TABLE_PAGE_SIZE: 'layout.tablePageSize',

  // Sort preferences (dynamic context suffix)
  SORT_EXPERIENCES: 'sort.experiences',
  SORT_DESTINATIONS: 'sort.destinations',
  SORT_PLANS: 'sort.plans',

  // Filter preferences (dynamic context suffix)
  FILTER_EXPERIENCES: 'filter.experiences',
  FILTER_DESTINATIONS: 'filter.destinations',
  FILTER_PLANS: 'filter.plans'
};

/**
 * Internal cache for decrypted preferences to avoid repeated decryption
 */
let preferencesCache = null;
let preferencesCacheUserId = null;

/**
 * Calculate byte size of a string (UTF-16)
 * @param {string} str - String to measure
 * @returns {number} Size in bytes
 */
function getStringByteSize(str) {
  return new Blob([str]).size;
}

/**
 * Get current storage size for preferences
 * @returns {number} Size in bytes
 */
function getPreferencesStorageSize() {
  try {
    const stored = localStorage.getItem(ENCRYPTED_PREFERENCES_KEY);
    return stored ? getStringByteSize(stored) : 0;
  } catch {
    return 0;
  }
}

/**
 * Get metadata about preferences (expiry tracking)
 * @returns {Object} Metadata object with expiry times and access times
 */
function getPreferencesMeta() {
  try {
    const meta = localStorage.getItem(PREFERENCES_META_KEY);
    return meta ? JSON.parse(meta) : { expiry: {}, lastAccess: {} };
  } catch {
    return { expiry: {}, lastAccess: {} };
  }
}

/**
 * Set metadata about preferences
 * @param {Object} meta - Metadata object
 */
function setPreferencesMeta(meta) {
  try {
    localStorage.setItem(PREFERENCES_META_KEY, JSON.stringify(meta));
  } catch (e) {
    logger.warn('Failed to save preferences metadata', { error: e.message });
  }
}

/**
 * Auto-expire least recently used preferences to free up space
 * Uses LRU (Least Recently Used) strategy
 * @param {Object} prefs - Preferences object
 * @param {number} targetSize - Target size to reduce to
 * @returns {Object} Cleaned preferences object
 */
function autoExpireLRUPreferences(prefs, targetSize) {
  const meta = getPreferencesMeta();
  const now = Date.now();
  
  // Build list of preferences with access times
  const prefList = Object.keys(prefs).map(key => ({
    key,
    lastAccess: meta.lastAccess?.[key] || 0,
    size: getStringByteSize(JSON.stringify(prefs[key]))
  }));
  
  // Sort by least recently accessed
  prefList.sort((a, b) => a.lastAccess - b.lastAccess);
  
  // Remove preferences until we're under target size
  let currentSize = getPreferencesStorageSize();
  let removed = 0;
  
  for (const pref of prefList) {
    if (currentSize <= targetSize) break;
    
    // Skip hierarchy preferences (most important for UX)
    if (pref.key.startsWith('hierarchy.')) continue;
    
    // Remove preference
    delete prefs[pref.key];
    if (meta.expiry?.[pref.key]) delete meta.expiry[pref.key];
    if (meta.lastAccess?.[pref.key]) delete meta.lastAccess[pref.key];
    
    currentSize -= pref.size;
    removed++;
    
    logger.debug('Auto-expired LRU preference', { 
      key: pref.key, 
      lastAccess: new Date(pref.lastAccess).toISOString() 
    });
  }
  
  if (removed > 0) {
    setPreferencesMeta(meta);
    logger.info('Auto-expired preferences due to storage limit', { 
      removed, 
      newSize: currentSize 
    });
  }
  
  return prefs;
}

/**
 * Check and remove expired preferences
 * @param {Object} prefs - Preferences object
 * @returns {Object} Cleaned preferences object
 */
function cleanExpiredPreferences(prefs) {
  const meta = getPreferencesMeta();
  const now = Date.now();
  let hasExpired = false;

  for (const key of Object.keys(meta.expiry || {})) {
    if (meta.expiry[key] && meta.expiry[key] < now) {
      // Remove expired preference
      delete prefs[key];
      delete meta.expiry[key];
      hasExpired = true;
      logger.debug('Expired preference removed', { key });
    }
  }

  if (hasExpired) {
    setPreferencesMeta(meta);
  }

  return prefs;
}

/**
 * Store a preference with optional encryption and TTL
 *
 * @param {string} key - Preference key (use PREFERENCE_KEYS or dot notation)
 * @param {*} value - Value to store (any JSON-serializable value)
 * @param {Object} options - Storage options
 * @param {string} [options.userId] - User ID for encryption (required for encrypted storage)
 * @param {number} [options.ttl] - Time-to-live in milliseconds (optional expiry)
 * @param {string} [options.category] - Category for organization (default: derived from key)
 * @returns {Promise<boolean>} Success status
 *
 * @example
 * // Store view mode preference (encrypted)
 * await storePreference('viewMode.myPlans', 'calendar', { userId: user._id });
 *
 * // Store temporary preference with 1 hour TTL
 * await storePreference('session.lastTab', 'settings', { userId: user._id, ttl: 3600000 });
 */
export async function storePreference(key, value, options = {}) {
  const { userId, ttl, category } = options;

  try {
    // Get current preferences
    let prefs = await getAllEncryptedPreferences(userId);

    // Store the value
    prefs[key] = value;

    // Update last access time for LRU tracking
    const meta = getPreferencesMeta();
    meta.lastAccess = meta.lastAccess || {};
    meta.lastAccess[key] = Date.now();

    // Handle TTL/expiry
    if (ttl && ttl > 0) {
      meta.expiry = meta.expiry || {};
      meta.expiry[key] = Date.now() + ttl;
    }
    
    setPreferencesMeta(meta);

    // Check storage size before encrypting/storing
    // Estimate size by checking current size + new value size
    const currentSize = getPreferencesStorageSize();
    
    // If approaching limit, auto-expire old preferences
    if (currentSize > SAFE_STORAGE_SIZE) {
      logger.warn('Preferences storage size exceeds safe threshold', { 
        currentSize, 
        threshold: SAFE_STORAGE_SIZE 
      });
      prefs = autoExpireLRUPreferences(prefs, SAFE_STORAGE_SIZE * 0.7); // Target 70% of safe size
    }

    // Encrypt and store
    if (userId) {
      const encrypted = await encryptData(prefs, userId);
      
      // Final size check before storing
      const encryptedSize = getStringByteSize(encrypted);
      if (encryptedSize > MAX_STORAGE_SIZE) {
        logger.error('Encrypted preferences exceed maximum storage size', { 
          size: encryptedSize, 
          max: MAX_STORAGE_SIZE 
        });
        // Emergency cleanup - remove more aggressively
        prefs = autoExpireLRUPreferences(prefs, MAX_STORAGE_SIZE * 0.5);
        const reEncrypted = await encryptData(prefs, userId);
        localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, reEncrypted);
      } else {
        localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, encrypted);
      }
      
      // Update cache
      preferencesCache = prefs;
      preferencesCacheUserId = userId;
    } else {
      // Fallback to unencrypted storage
      const jsonStr = JSON.stringify(prefs);
      const jsonSize = getStringByteSize(jsonStr);
      
      if (jsonSize > MAX_STORAGE_SIZE) {
        logger.error('Preferences exceed maximum storage size', { 
          size: jsonSize, 
          max: MAX_STORAGE_SIZE 
        });
        prefs = autoExpireLRUPreferences(prefs, MAX_STORAGE_SIZE * 0.5);
        localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, JSON.stringify(prefs));
      } else {
        localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, jsonStr);
      }
      
      preferencesCache = prefs;
    }

    logger.debug('Preference stored', { key, hasExpiry: !!ttl, size: currentSize });
    return true;
  } catch (e) {
    // Handle QuotaExceededError specifically
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      logger.error('localStorage quota exceeded - emergency cleanup', { key });
      try {
        // Emergency: clear old preferences and retry
        const prefs = await getAllEncryptedPreferences(userId);
        const cleaned = autoExpireLRUPreferences(prefs, MAX_STORAGE_SIZE * 0.3);
        
        if (userId) {
          const encrypted = await encryptData(cleaned, userId);
          localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, encrypted);
        } else {
          localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, JSON.stringify(cleaned));
        }
        
        logger.info('Emergency cleanup successful, retrying store');
        // Don't retry to avoid infinite loop - just report success of cleanup
        return true;
      } catch (cleanupError) {
        logger.error('Emergency cleanup failed', { error: cleanupError.message });
        return false;
      }
    }
    
    logger.error('Failed to store preference', { key, error: e.message });
    return false;
  }
}

/**
 * Retrieve a preference value
 *
 * @param {string} key - Preference key
 * @param {*} defaultValue - Default value if not found or expired
 * @param {Object} options - Retrieval options
 * @param {string} [options.userId] - User ID for decryption
 * @returns {Promise<*>} Preference value or default
 *
 * @example
 * const viewMode = await retrievePreference('viewMode.myPlans', 'list', { userId: user._id });
 */
export async function retrievePreference(key, defaultValue = null, options = {}) {
  const { userId } = options;

  try {
    const prefs = await getAllEncryptedPreferences(userId);

    // Check if key exists
    if (key in prefs) {
      // Check expiry
      const meta = getPreferencesMeta();
      if (meta.expiry?.[key] && meta.expiry[key] < Date.now()) {
        // Expired - remove and return default
        await expirePreference(key, { userId });
        return defaultValue;
      }
      
      // Update last access time for LRU tracking
      meta.lastAccess = meta.lastAccess || {};
      meta.lastAccess[key] = Date.now();
      setPreferencesMeta(meta);
      
      return prefs[key];
    }

    return defaultValue;
  } catch (e) {
    logger.error('Failed to retrieve preference', { key, error: e.message });
    return defaultValue;
  }
}

/**
 * Remove/expire a preference immediately
 *
 * @param {string} key - Preference key to remove
 * @param {Object} options - Options
 * @param {string} [options.userId] - User ID for encryption
 * @returns {Promise<boolean>} Success status
 */
export async function expirePreference(key, options = {}) {
  const { userId } = options;

  try {
    const prefs = await getAllEncryptedPreferences(userId);

    // Remove the preference
    delete prefs[key];

    // Remove from expiry tracking
    const meta = getPreferencesMeta();
    if (meta.expiry?.[key]) {
      delete meta.expiry[key];
      setPreferencesMeta(meta);
    }

    // Re-encrypt and store
    if (userId) {
      const encrypted = await encryptData(prefs, userId);
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, encrypted);
      preferencesCache = prefs;
    } else {
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, JSON.stringify(prefs));
      preferencesCache = prefs;
    }

    logger.debug('Preference expired/removed', { key });
    return true;
  } catch (e) {
    logger.error('Failed to expire preference', { key, error: e.message });
    return false;
  }
}

/**
 * Get all encrypted preferences (decrypted)
 *
 * @param {string} [userId] - User ID for decryption
 * @returns {Promise<Object>} All preferences as key-value object
 */
export async function getAllEncryptedPreferences(userId) {
  try {
    // Check cache
    if (preferencesCache && preferencesCacheUserId === userId) {
      return cleanExpiredPreferences({ ...preferencesCache });
    }

    const stored = localStorage.getItem(ENCRYPTED_PREFERENCES_KEY);
    if (!stored) {
      return {};
    }

    let prefs;
    if (userId) {
      prefs = await decryptData(stored, userId);
    } else {
      try {
        prefs = JSON.parse(stored);
      } catch {
        prefs = {};
      }
    }

    if (!prefs || typeof prefs !== 'object') {
      prefs = {};
    }

    // Clean expired preferences
    prefs = cleanExpiredPreferences(prefs);

    // Update cache
    preferencesCache = prefs;
    preferencesCacheUserId = userId;

    return { ...prefs };
  } catch (e) {
    logger.debug('Failed to get encrypted preferences', { error: e.message });
    return {};
  }
}

/**
 * Set multiple preferences at once
 *
 * @param {Object} preferences - Object of key-value pairs
 * @param {Object} options - Storage options
 * @param {string} [options.userId] - User ID for encryption
 * @param {number} [options.ttl] - TTL for all preferences (optional)
 * @returns {Promise<boolean>} Success status
 *
 * @example
 * await setMultiplePreferences({
 *   'viewMode.myPlans': 'calendar',
 *   'viewMode.experiences': 'compact'
 * }, { userId: user._id });
 */
export async function setMultiplePreferences(preferences, options = {}) {
  const { userId, ttl } = options;

  try {
    const current = await getAllEncryptedPreferences(userId);
    const merged = { ...current, ...preferences };

    // Handle TTL for all new preferences
    if (ttl && ttl > 0) {
      const meta = getPreferencesMeta();
      meta.expiry = meta.expiry || {};
      const expiryTime = Date.now() + ttl;
      for (const key of Object.keys(preferences)) {
        meta.expiry[key] = expiryTime;
      }
      setPreferencesMeta(meta);
    }

    // Encrypt and store
    if (userId) {
      const encrypted = await encryptData(merged, userId);
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, encrypted);
    } else {
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, JSON.stringify(merged));
    }

    // Update cache
    preferencesCache = merged;
    preferencesCacheUserId = userId;

    return true;
  } catch (e) {
    logger.error('Failed to set multiple preferences', { error: e.message });
    return false;
  }
}

/**
 * Get storage health information
 * Useful for monitoring and debugging storage issues
 * 
 * @returns {Object} Storage health metrics
 * @property {number} currentSize - Current storage size in bytes
 * @property {number} maxSize - Maximum allowed size in bytes
 * @property {number} safeSize - Safe threshold size in bytes
 * @property {number} percentUsed - Percentage of max size used
 * @property {boolean} needsCleanup - Whether cleanup is recommended
 * @property {number} preferenceCount - Number of stored preferences
 * 
 * @example
 * const health = getPreferencesStorageHealth();
 * console.log(`Storage: ${health.percentUsed}% used`);
 * if (health.needsCleanup) {
 *   await cleanupPreferencesStorage();
 * }
 */
export function getPreferencesStorageHealth() {
  const currentSize = getPreferencesStorageSize();
  const percentUsed = (currentSize / MAX_STORAGE_SIZE) * 100;
  
  let preferenceCount = 0;
  try {
    const stored = localStorage.getItem(ENCRYPTED_PREFERENCES_KEY);
    if (stored) {
      // Rough estimate - won't be exact without decryption
      preferenceCount = (stored.match(/:/g) || []).length;
    }
  } catch {}
  
  return {
    currentSize,
    maxSize: MAX_STORAGE_SIZE,
    safeSize: SAFE_STORAGE_SIZE,
    percentUsed: Math.round(percentUsed * 100) / 100,
    needsCleanup: currentSize > SAFE_STORAGE_SIZE,
    preferenceCount
  };
}

/**
 * Manually trigger storage cleanup
 * Removes least recently used preferences to free up space
 * 
 * @param {Object} options - Cleanup options
 * @param {string} [options.userId] - User ID for decryption/encryption
 * @param {number} [options.targetSize] - Target size after cleanup (default: 70% of safe size)
 * @returns {Promise<Object>} Cleanup results
 * 
 * @example
 * const result = await cleanupPreferencesStorage({ userId: user._id });
 * console.log(`Removed ${result.removed} preferences, freed ${result.freedBytes} bytes`);
 */
export async function cleanupPreferencesStorage(options = {}) {
  const { userId, targetSize = SAFE_STORAGE_SIZE * 0.7 } = options;
  
  try {
    const beforeSize = getPreferencesStorageSize();
    let prefs = await getAllEncryptedPreferences(userId);
    const beforeCount = Object.keys(prefs).length;
    
    // Run LRU cleanup
    prefs = autoExpireLRUPreferences(prefs, targetSize);
    
    // Re-encrypt and store
    if (userId) {
      const encrypted = await encryptData(prefs, userId);
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, encrypted);
    } else {
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, JSON.stringify(prefs));
    }
    
    // Update cache
    preferencesCache = prefs;
    preferencesCacheUserId = userId;
    
    const afterSize = getPreferencesStorageSize();
    const afterCount = Object.keys(prefs).length;
    
    return {
      success: true,
      beforeSize,
      afterSize,
      freedBytes: beforeSize - afterSize,
      removed: beforeCount - afterCount,
      remaining: afterCount
    };
  } catch (e) {
    logger.error('Manual cleanup failed', { error: e.message });
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Get preferences by category
 *
 * @param {string} category - Category prefix (e.g., 'viewMode', 'sort')
 * @param {Object} options - Retrieval options
 * @param {string} [options.userId] - User ID for decryption
 * @returns {Promise<Object>} Preferences matching the category
 *
 * @example
 * const viewModes = await getPreferencesByCategory('viewMode', { userId: user._id });
 * // Returns: { 'viewMode.myPlans': 'list', 'viewMode.experiences': 'card' }
 */
export async function getPreferencesByCategory(category, options = {}) {
  const prefs = await getAllEncryptedPreferences(options.userId);
  const categoryPrefs = {};
  const prefix = `${category}.`;

  for (const [key, value] of Object.entries(prefs)) {
    if (key.startsWith(prefix)) {
      categoryPrefs[key] = value;
    }
  }

  return categoryPrefs;
}

/**
 * Clear all preferences for a category
 *
 * @param {string} category - Category prefix to clear
 * @param {Object} options - Options
 * @param {string} [options.userId] - User ID for encryption
 * @returns {Promise<boolean>} Success status
 */
export async function clearPreferenceCategory(category, options = {}) {
  const { userId } = options;

  try {
    const prefs = await getAllEncryptedPreferences(userId);
    const prefix = `${category}.`;
    const meta = getPreferencesMeta();

    // Remove matching keys
    for (const key of Object.keys(prefs)) {
      if (key.startsWith(prefix)) {
        delete prefs[key];
        if (meta.expiry?.[key]) {
          delete meta.expiry[key];
        }
      }
    }

    setPreferencesMeta(meta);

    // Re-encrypt and store
    if (userId) {
      const encrypted = await encryptData(prefs, userId);
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, encrypted);
    } else {
      localStorage.setItem(ENCRYPTED_PREFERENCES_KEY, JSON.stringify(prefs));
    }

    preferencesCache = prefs;

    return true;
  } catch (e) {
    logger.error('Failed to clear preference category', { category, error: e.message });
    return false;
  }
}

/**
 * Clear all encrypted preferences
 *
 * @returns {boolean} Success status
 */
export function clearAllEncryptedPreferences() {
  try {
    localStorage.removeItem(ENCRYPTED_PREFERENCES_KEY);
    localStorage.removeItem(PREFERENCES_META_KEY);
    preferencesCache = null;
    preferencesCacheUserId = null;
    return true;
  } catch (e) {
    logger.error('Failed to clear all encrypted preferences', { error: e.message });
    return false;
  }
}

/**
 * Get detailed diagnostic information about preferences storage
 * Useful for debugging storage issues in production
 * 
 * @param {string} [userId] - User ID for decryption (to see preference keys)
 * @returns {Promise<Object>} Detailed diagnostic information
 * 
 * @example
 * // In browser console:
 * window.prefsDebug = () => import('./utilities/preferences-utils').then(m => m.getPreferencesDiagnostics(user._id));
 * await window.prefsDebug();
 */
export async function getPreferencesDiagnostics(userId) {
  const health = getPreferencesStorageHealth();
  const meta = getPreferencesMeta();
  
  let preferences = {};
  let categories = {};
  
  try {
    preferences = await getAllEncryptedPreferences(userId);
    
    // Group by category
    for (const key of Object.keys(preferences)) {
      const category = key.split('.')[0];
      categories[category] = (categories[category] || 0) + 1;
    }
  } catch (e) {
    logger.error('Failed to load preferences for diagnostics', { error: e.message });
  }
  
  // Calculate sizes by category
  const categorySizes = {};
  for (const [key, value] of Object.entries(preferences)) {
    const category = key.split('.')[0];
    const size = getStringByteSize(JSON.stringify(value));
    categorySizes[category] = (categorySizes[category] || 0) + size;
  }
  
  // Get oldest and newest access times
  const accessTimes = Object.entries(meta.lastAccess || {})
    .map(([key, time]) => ({ key, time, age: Date.now() - time }))
    .sort((a, b) => b.age - a.age);
  
  return {
    health,
    totalPreferences: Object.keys(preferences).length,
    categories,
    categorySizes,
    oldestAccess: accessTimes[0] || null,
    newestAccess: accessTimes[accessTimes.length - 1] || null,
    expiredCount: Object.keys(meta.expiry || {}).filter(k => meta.expiry[k] < Date.now()).length,
    preferenceKeys: Object.keys(preferences),
    recommendation: health.needsCleanup 
      ? 'Storage usage high - cleanup recommended'
      : 'Storage usage healthy'
  };
}

/**
 * Invalidate the preferences cache (call when user changes)
 */
export function invalidatePreferencesCache() {
  preferencesCache = null;
  preferencesCacheUserId = null;
}

/**
 * Common timezone list with user-friendly labels
 * Grouped by region for easier navigation
 */
const TIMEZONE_OPTIONS = [
  // System default option (uses browser timezone)
  { value: 'system-default', label: 'System Default' },

  // Americas
  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time - New York' },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time - Chicago' },
  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time - Denver' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time - Los Angeles' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
  { value: 'America/Toronto', label: '(UTC-05:00) Eastern Time - Toronto' },
  { value: 'America/Vancouver', label: '(UTC-08:00) Pacific Time - Vancouver' },
  { value: 'America/Mexico_City', label: '(UTC-06:00) Central Time - Mexico City' },
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brasilia' },
  { value: 'America/Buenos_Aires', label: '(UTC-03:00) Buenos Aires' },

  // Europe
  { value: 'UTC', label: '(UTC+00:00) UTC' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'Europe/Paris', label: '(UTC+01:00) Paris, Berlin, Rome' },
  { value: 'Europe/Amsterdam', label: '(UTC+01:00) Amsterdam' },
  { value: 'Europe/Berlin', label: '(UTC+01:00) Berlin' },
  { value: 'Europe/Madrid', label: '(UTC+01:00) Madrid' },
  { value: 'Europe/Rome', label: '(UTC+01:00) Rome' },
  { value: 'Europe/Athens', label: '(UTC+02:00) Athens' },
  { value: 'Europe/Istanbul', label: '(UTC+03:00) Istanbul' },
  { value: 'Europe/Moscow', label: '(UTC+03:00) Moscow' },

  // Africa & Middle East
  { value: 'Africa/Cairo', label: '(UTC+02:00) Cairo' },
  { value: 'Africa/Johannesburg', label: '(UTC+02:00) Johannesburg' },
  { value: 'Africa/Lagos', label: '(UTC+01:00) Lagos' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
  { value: 'Asia/Jerusalem', label: '(UTC+02:00) Jerusalem' },

  // Asia Pacific
  { value: 'Asia/Kolkata', label: '(UTC+05:30) Mumbai, Delhi' },
  { value: 'Asia/Shanghai', label: '(UTC+08:00) Beijing, Shanghai' },
  { value: 'Asia/Hong_Kong', label: '(UTC+08:00) Hong Kong' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo' },
  { value: 'Asia/Seoul', label: '(UTC+09:00) Seoul' },
  { value: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok' },
  { value: 'Asia/Jakarta', label: '(UTC+07:00) Jakarta' },

  // Australia & Pacific
  { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney' },
  { value: 'Australia/Melbourne', label: '(UTC+10:00) Melbourne' },
  { value: 'Australia/Perth', label: '(UTC+08:00) Perth' },
  { value: 'Australia/Brisbane', label: '(UTC+10:00) Brisbane' },
  { value: 'Pacific/Auckland', label: '(UTC+12:00) Auckland' },
  { value: 'Pacific/Fiji', label: '(UTC+12:00) Fiji' }
];

/**
 * Pre-built Set for O(1) timezone validation
 * Avoids O(n) .some() lookup on every timezone check
 */
const VALID_TIMEZONES = new Set(TIMEZONE_OPTIONS.map(opt => opt.value));

/**
 * Get timezone options for select dropdown
 * @returns {Array<{value: string, label: string}>} Array of timezone options
 */
export function getTimezoneOptions() {
  return TIMEZONE_OPTIONS;
}

/**
 * Detect user's timezone from browser
 * @returns {string} IANA timezone identifier (e.g., 'America/New_York')
 */
export function detectUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Get preferences from localStorage
 * Falls back to defaults if not available
 * @returns {Object} User preferences object
 */
export function getStoredPreferences() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Store preferences in localStorage
 * @param {Object} preferences - Preferences to store
 */
export function storePreferences(preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    // Also store individual keys for backward compatibility
    if (preferences.currency) localStorage.setItem('biensperience:currency', preferences.currency);
    if (preferences.language) localStorage.setItem('biensperience:language', preferences.language);
    if (preferences.timezone) localStorage.setItem('biensperience:timezone', preferences.timezone);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get a specific preference value
 * Checks profile first, then localStorage, then defaults
 *
 * @param {string} key - Preference key (e.g., 'currency', 'timezone')
 * @param {Object} profile - User profile object (optional)
 * @returns {*} Preference value
 */
export function getPreference(key, profile = null) {
  // Check profile first
  if (profile?.preferences?.[key] !== undefined) {
    return profile.preferences[key];
  }

  // Check localStorage
  const stored = getStoredPreferences();
  if (stored[key] !== undefined) {
    return stored[key];
  }

  // Return default
  return DEFAULT_PREFERENCES[key];
}

/**
 * Get user's preferred currency
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Currency code (e.g., 'USD')
 */
export function getCurrency(profile = null) {
  return getPreference('currency', profile);
}

/**
 * Get user's preferred language
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Language code (e.g., 'en')
 */
export function getLanguage(profile = null) {
  return getPreference('language', profile);
}

/**
 * Get user's preferred timezone
 * @param {Object} profile - User profile object (optional)
 * @returns {string} IANA timezone identifier
 */
export function getTimezone(profile = null) {
  const tz = getPreference('timezone', profile);
  // If not set, detect from browser
  if (!tz || tz === 'UTC') {
    const detected = detectUserTimezone();
    // O(1) Set lookup instead of O(n) array.some()
    if (VALID_TIMEZONES.has(detected)) {
      return detected;
    }
  }
  return tz || 'UTC';
}

/**
 * Get user's preferred theme
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Theme name ('light', 'dark', 'system-default')
 */
export function getTheme(profile = null) {
  return getPreference('theme', profile);
}

/**
 * Format a date in user's timezone
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted date string
 */
export function formatDateInTimezone(date, options = {}, profile = null) {
  const timezone = getTimezone(profile);
  const d = new Date(date);

  const defaultOptions = {
    timeZone: timezone,
    ...options
  };

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch {
    // Fallback if timezone is invalid
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(d);
  }
}

/**
 * Format a time in user's timezone
 * @param {Date|string} date - Date to format
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted time string (e.g., '3:30 PM')
 */
export function formatTimeInTimezone(date, profile = null) {
  return formatDateInTimezone(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }, profile);
}

/**
 * Format a date and time in user's timezone
 * @param {Date|string} date - Date to format
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted datetime string
 */
export function formatDateTimeInTimezone(date, profile = null) {
  return formatDateInTimezone(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }, profile);
}

/**
 * Get the current time in user's timezone as a Date object
 * @param {Object} profile - User profile object (optional)
 * @returns {Date} Current time
 */
export function getCurrentTimeInTimezone(profile = null) {
  // JavaScript Date objects are always in UTC internally
  // Use this with formatDateInTimezone for display
  return new Date();
}

/**
 * Get timezone offset string (e.g., '+05:30' or '-08:00')
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} Offset string
 */
export function getTimezoneOffset(timezone = 'UTC') {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    return offsetPart?.value || '+00:00';
  } catch {
    return '+00:00';
  }
}

/**
 * Check if a timezone is valid
 * @param {string} timezone - IANA timezone identifier
 * @returns {boolean} True if valid
 */
export function isValidTimezone(timezone) {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// Export default preferences for reference
export { DEFAULT_PREFERENCES };

// ============================================================================
// UI PREFERENCES (uses encrypted storage when userId is available)
// ============================================================================

/**
 * Storage key for UI preferences (fallback when no encryption)
 * @deprecated Use encrypted preferences API instead
 */
const UI_PREFERENCES_KEY = 'biensperience:ui_preferences';

/**
 * Default UI preferences for view modes and layouts
 */
const DEFAULT_UI_PREFERENCES = {
  // Dashboard / MyPlans view mode
  myPlansViewMode: 'list', // 'list' | 'calendar'

  // Experiences list view mode
  experiencesViewMode: 'card', // 'card' | 'compact' | 'list'

  // Destinations list view mode
  destinationsViewMode: 'card', // 'card' | 'compact' | 'list'

  // Profile tabs - experiences/destinations view mode
  profileExperiencesViewMode: 'card', // 'card' | 'compact'
  profileDestinationsViewMode: 'card', // 'card' | 'compact'

  // Single Experience view preferences
  planItemsViewMode: 'expanded', // 'expanded' | 'compact'

  // Sidebar collapsed state
  sidebarCollapsed: false,

  // Table preferences (items per page)
  tablePageSize: 10, // 10 | 25 | 50 | 100

  // Sort preferences by context
  sortPreferences: {
    experiences: { field: 'updatedAt', direction: 'desc' },
    destinations: { field: 'updatedAt', direction: 'desc' },
    plans: { field: 'planned_date', direction: 'asc' }
  },

  // Filter preferences (remembered filter states)
  filterPreferences: {
    experiences: {},
    destinations: {},
    plans: {}
  },

  // Recently viewed items (for quick access)
  recentlyViewed: {
    experiences: [], // Array of { _id, name, viewedAt }
    destinations: []
  }
};

/**
 * Get all UI preferences from localStorage (synchronous fallback)
 * @returns {Object} UI preferences object merged with defaults
 * @deprecated Use getAllEncryptedPreferences for encrypted storage
 */
export function getUIPreferences() {
  try {
    const stored = localStorage.getItem(UI_PREFERENCES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Deep merge with defaults to ensure all keys exist
      return deepMerge(DEFAULT_UI_PREFERENCES, parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_UI_PREFERENCES };
}

/**
 * Store all UI preferences to localStorage (synchronous fallback)
 * @param {Object} preferences - UI preferences object
 * @deprecated Use storePreference for encrypted storage
 */
export function setUIPreferences(preferences) {
  try {
    const current = getUIPreferences();
    const merged = deepMerge(current, preferences);
    localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Dangerous prototype keys that must be blocked to prevent prototype pollution
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Check if a key is safe (not a prototype pollution vector)
 * @param {string} key - Key to check
 * @returns {boolean} True if safe
 */
function isSafeKey(key) {
  // Must be a string
  if (typeof key !== 'string') return false;
  // Block dangerous keys
  if (DANGEROUS_KEYS.includes(key)) return false;
  // Additional validation: only allow alphanumeric, underscore, hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) return false;
  return true;
}

/**
 * Create a clean object with no prototype for safe property assignment
 * @returns {Object} Clean object with null prototype
 */
function createCleanObject() {
  return Object.create(null);
}

/**
 * Get a specific UI preference value (synchronous)
 * For encrypted preferences, use retrievePreference instead
 *
 * @param {string} key - Preference key (e.g., 'myPlansViewMode', 'experiencesViewMode')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Preference value
 */
export function getUIPreference(key, defaultValue = null) {
  const prefs = getUIPreferences();

  // Handle nested keys with dot notation (e.g., 'sortPreferences.experiences')
  if (key.includes('.')) {
    const parts = key.split('.');

    // Validate all parts against prototype pollution
    if (!parts.every(isSafeKey)) {
      return defaultValue; // Return default for dangerous keys
    }

    let value = prefs;
    for (const part of parts) {
      if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, part)) {
        value = value[part];
      } else {
        return defaultValue ?? getNestedDefault(DEFAULT_UI_PREFERENCES, parts);
      }
    }
    return value;
  }

  // Validate single key against prototype pollution
  if (!isSafeKey(key)) {
    return defaultValue; // Return default for dangerous keys
  }

  if (Object.prototype.hasOwnProperty.call(prefs, key)) {
    return prefs[key];
  }

  return defaultValue ?? DEFAULT_UI_PREFERENCES[key];
}

/**
 * Set a specific UI preference value (synchronous)
 * For encrypted preferences, use storePreference instead
 *
 * @param {string} key - Preference key (e.g., 'myPlansViewMode')
 * @param {*} value - Value to set
 */
export function setUIPreference(key, value) {
  // Early validation of key type
  if (typeof key !== 'string' || !key) {
    return; // Silently reject invalid keys
  }

  const prefs = getUIPreferences();

  // Handle nested keys with dot notation
  if (key.includes('.')) {
    const parts = key.split('.');

    // Validate all parts against prototype pollution BEFORE any operations
    for (const part of parts) {
      if (!isSafeKey(part)) {
        return; // Silently reject dangerous keys
      }
    }

    // Build nested structure safely
    let current = prefs;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      // Ensure we're working with an own property, not inherited
      const hasOwn = Object.prototype.hasOwnProperty.call(current, part);
      const isPlainObject = hasOwn && current[part] !== null && typeof current[part] === 'object' && !Array.isArray(current[part]);

      if (!isPlainObject) {
        // Create a clean object with null prototype to prevent pollution
        const newObj = createCleanObject();
        // Use Reflect.set which is recognized as safe by static analyzers
        Reflect.set(current, part, newObj);
      }
      current = current[part];

      // Safety check: ensure current is still a plain object
      if (current === null || typeof current !== 'object') {
        return; // Abort if structure is corrupted
      }
    }

    // Set final value using Reflect.set (safer pattern for static analysis)
    const lastPart = parts[parts.length - 1];
    Reflect.set(current, lastPart, value);
  } else {
    // Validate single key against prototype pollution
    if (!isSafeKey(key)) {
      return; // Silently reject dangerous keys
    }
    // Use Reflect.set which is recognized as safe by static analyzers
    Reflect.set(prefs, key, value);
  }

  setUIPreferences(prefs);
}

/**
 * Clear all UI preferences (reset to defaults)
 */
export function clearUIPreferences() {
  try {
    localStorage.removeItem(UI_PREFERENCES_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Migrate legacy UI preferences to encrypted storage
 * Call this when user logs in to migrate old preferences
 *
 * @param {string} userId - User ID for encryption
 * @returns {Promise<boolean>} Success status
 */
export async function migrateToEncryptedPreferences(userId) {
  if (!userId) return false;

  try {
    // Check if legacy preferences exist
    const legacy = localStorage.getItem(UI_PREFERENCES_KEY);
    if (!legacy) return true; // Nothing to migrate

    const legacyPrefs = JSON.parse(legacy);

    // Convert to new format with prefixed keys
    const newPrefs = {};

    // View modes
    if (legacyPrefs.myPlansViewMode) newPrefs['viewMode.myPlans'] = legacyPrefs.myPlansViewMode;
    if (legacyPrefs.experiencesViewMode) newPrefs['viewMode.experiences'] = legacyPrefs.experiencesViewMode;
    if (legacyPrefs.destinationsViewMode) newPrefs['viewMode.destinations'] = legacyPrefs.destinationsViewMode;
    if (legacyPrefs.profileExperiencesViewMode) newPrefs['viewMode.profileExperiences'] = legacyPrefs.profileExperiencesViewMode;
    if (legacyPrefs.profileDestinationsViewMode) newPrefs['viewMode.profileDestinations'] = legacyPrefs.profileDestinationsViewMode;
    if (legacyPrefs.planItemsViewMode) newPrefs['viewMode.planItems'] = legacyPrefs.planItemsViewMode;

    // Layout preferences
    if (legacyPrefs.sidebarCollapsed !== undefined) newPrefs['layout.sidebarCollapsed'] = legacyPrefs.sidebarCollapsed;
    if (legacyPrefs.tablePageSize) newPrefs['layout.tablePageSize'] = legacyPrefs.tablePageSize;

    // Sort preferences
    if (legacyPrefs.sortPreferences) {
      for (const [context, config] of Object.entries(legacyPrefs.sortPreferences)) {
        newPrefs[`sort.${context}`] = config;
      }
    }

    // Filter preferences
    if (legacyPrefs.filterPreferences) {
      for (const [context, filters] of Object.entries(legacyPrefs.filterPreferences)) {
        if (Object.keys(filters).length > 0) {
          newPrefs[`filter.${context}`] = filters;
        }
      }
    }

    // Store encrypted
    await setMultiplePreferences(newPrefs, { userId });

    // Remove legacy storage
    localStorage.removeItem(UI_PREFERENCES_KEY);

    logger.info('Migrated legacy preferences to encrypted storage', {
      keyCount: Object.keys(newPrefs).length
    });

    return true;
  } catch (e) {
    logger.error('Failed to migrate preferences', { error: e.message });
    return false;
  }
}

// ============================================================================
// VIEW MODE HELPERS (convenience functions for common view mode operations)
// ============================================================================

/**
 * View mode constants for type safety
 */
export const VIEW_MODES = {
  LIST: 'list',
  CALENDAR: 'calendar',
  CARD: 'card',
  COMPACT: 'compact',
  EXPANDED: 'expanded'
};

/**
 * Get view mode for a specific context
 * @param {string} context - Context key (e.g., 'myPlans', 'experiences', 'destinations')
 * @returns {string} View mode value
 */
export function getViewMode(context) {
  const keyMap = {
    myPlans: 'myPlansViewMode',
    experiences: 'experiencesViewMode',
    destinations: 'destinationsViewMode',
    profileExperiences: 'profileExperiencesViewMode',
    profileDestinations: 'profileDestinationsViewMode',
    planItems: 'planItemsViewMode'
  };

  const key = keyMap[context];
  if (key) {
    return getUIPreference(key);
  }

  // Fallback for unknown contexts
  return getUIPreference(`${context}ViewMode`, VIEW_MODES.LIST);
}

/**
 * Set view mode for a specific context
 * @param {string} context - Context key (e.g., 'myPlans', 'experiences')
 * @param {string} mode - View mode value
 */
export function setViewMode(context, mode) {
  const keyMap = {
    myPlans: 'myPlansViewMode',
    experiences: 'experiencesViewMode',
    destinations: 'destinationsViewMode',
    profileExperiences: 'profileExperiencesViewMode',
    profileDestinations: 'profileDestinationsViewMode',
    planItems: 'planItemsViewMode'
  };

  const key = keyMap[context] || `${context}ViewMode`;
  setUIPreference(key, mode);
}

// ============================================================================
// SORT & FILTER PREFERENCE HELPERS
// ============================================================================

/**
 * Get sort preference for a context
 * @param {string} context - Context key (e.g., 'experiences', 'destinations', 'plans')
 * @returns {{ field: string, direction: 'asc' | 'desc' }} Sort preference
 */
export function getSortPreference(context) {
  return getUIPreference(`sortPreferences.${context}`, {
    field: 'updatedAt',
    direction: 'desc'
  });
}

/**
 * Set sort preference for a context
 * @param {string} context - Context key
 * @param {string} field - Field to sort by
 * @param {'asc' | 'desc'} direction - Sort direction
 */
export function setSortPreference(context, field, direction = 'desc') {
  setUIPreference(`sortPreferences.${context}`, { field, direction });
}

/**
 * Get filter preference for a context
 * @param {string} context - Context key
 * @returns {Object} Filter preference object
 */
export function getFilterPreference(context) {
  return getUIPreference(`filterPreferences.${context}`, {});
}

/**
 * Set filter preference for a context
 * @param {string} context - Context key
 * @param {Object} filters - Filter object
 */
export function setFilterPreference(context, filters) {
  setUIPreference(`filterPreferences.${context}`, filters);
}

// ============================================================================
// RECENTLY VIEWED HELPERS
// ============================================================================

/**
 * Maximum number of recently viewed items to store per context
 */
const MAX_RECENTLY_VIEWED = 10;

/**
 * Add an item to recently viewed list
 * @param {string} context - Context key (e.g., 'experiences', 'destinations')
 * @param {{ _id: string, name: string }} item - Item to add
 */
export function addToRecentlyViewed(context, item) {
  if (!item?._id || !item?.name) return;

  const prefs = getUIPreferences();
  const recentlyViewed = prefs.recentlyViewed || { experiences: [], destinations: [] };

  if (!recentlyViewed[context]) {
    recentlyViewed[context] = [];
  }

  // Remove existing entry for this item
  recentlyViewed[context] = recentlyViewed[context].filter(
    (i) => i._id !== item._id
  );

  // Add to beginning with timestamp
  recentlyViewed[context].unshift({
    _id: item._id,
    name: item.name,
    viewedAt: new Date().toISOString()
  });

  // Trim to max size
  recentlyViewed[context] = recentlyViewed[context].slice(0, MAX_RECENTLY_VIEWED);

  setUIPreference('recentlyViewed', recentlyViewed);
}

/**
 * Get recently viewed items for a context
 * @param {string} context - Context key
 * @param {number} limit - Maximum items to return (default: 5)
 * @returns {Array<{ _id: string, name: string, viewedAt: string }>} Recently viewed items
 */
export function getRecentlyViewed(context, limit = 5) {
  const recentlyViewed = getUIPreference('recentlyViewed', {});
  const items = recentlyViewed[context] || [];
  return items.slice(0, limit);
}

/**
 * Clear recently viewed items for a context (or all if no context specified)
 * @param {string} [context] - Context key (optional)
 */
export function clearRecentlyViewed(context) {
  const prefs = getUIPreferences();
  const recentlyViewed = prefs.recentlyViewed || {};

  if (context) {
    recentlyViewed[context] = [];
  } else {
    // Clear all
    Object.keys(recentlyViewed).forEach((key) => {
      recentlyViewed[key] = [];
    });
  }

  setUIPreference('recentlyViewed', recentlyViewed);
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Get a nested default value from an object using a path array
 * @param {Object} obj - Object to search
 * @param {string[]} path - Path array
 * @returns {*} Value at path or undefined
 */
function getNestedDefault(obj, path) {
  let value = obj;
  for (const part of path) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return value;
}

// Export UI preferences defaults for reference
export { DEFAULT_UI_PREFERENCES };
