/**
 * Form persistence utility for saving and restoring form data
 * Uses localStorage to persist form state across page reloads and failures
 *
 * @module form-persistence
 */

import store from 'store2';
import { logger } from './logger';

// Namespace for all form data
const FORM_STORAGE_PREFIX = '__form_data__';

// Default TTL: 24 hours
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

/**
 * Generate storage key for a form
 * @param {string} formId - Unique identifier for the form
 * @returns {string} Storage key
 */
function getStorageKey(formId) {
  return `${FORM_STORAGE_PREFIX}${formId}`;
}

/**
 * Save form data to localStorage
 * @param {string} formId - Unique identifier for the form
 * @param {Object} data - Form data to save
 * @param {number} ttl - Time to live in milliseconds (default: 24 hours)
 * @returns {boolean} True if saved successfully
 */
export function saveFormData(formId, data, ttl = DEFAULT_TTL) {
  if (!formId) {
    logger.warn('saveFormData: formId is required');
    return false;
  }

  try {
    const key = getStorageKey(formId);
    const payload = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };

    store.set(key, payload);
    logger.debug('Form data saved', { formId, dataKeys: Object.keys(data) });
    return true;
  } catch (err) {
    logger.error('Failed to save form data', { formId, error: err.message }, err);
    return false;
  }
}

/**
 * Load form data from localStorage
 * @param {string} formId - Unique identifier for the form
 * @param {boolean} autoCleanup - Automatically remove expired data (default: true)
 * @returns {Object|null} Form data or null if not found/expired
 */
export function loadFormData(formId, autoCleanup = true) {
  if (!formId) {
    logger.warn('loadFormData: formId is required');
    return null;
  }

  try {
    const key = getStorageKey(formId);
    const payload = store.get(key);

    if (!payload) {
      return null;
    }

    // Check if expired
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      logger.debug('Form data expired', { formId });
      if (autoCleanup) {
        clearFormData(formId);
      }
      return null;
    }

    logger.debug('Form data loaded', { formId, dataKeys: Object.keys(payload.data || {}) });
    return payload.data || null;
  } catch (err) {
    logger.error('Failed to load form data', { formId, error: err.message }, err);
    return null;
  }
}

/**
 * Clear form data from localStorage
 * @param {string} formId - Unique identifier for the form
 * @returns {boolean} True if cleared successfully
 */
export function clearFormData(formId) {
  if (!formId) {
    logger.warn('clearFormData: formId is required');
    return false;
  }

  try {
    const key = getStorageKey(formId);
    store.remove(key);
    logger.debug('Form data cleared', { formId });
    return true;
  } catch (err) {
    logger.error('Failed to clear form data', { formId, error: err.message }, err);
    return false;
  }
}

/**
 * Check if form data exists and is not expired
 * @param {string} formId - Unique identifier for the form
 * @returns {boolean} True if valid data exists
 */
export function hasFormData(formId) {
  if (!formId) {
    return false;
  }

  try {
    const key = getStorageKey(formId);
    const payload = store.get(key);

    if (!payload) {
      return false;
    }

    // Check if expired
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return false;
    }

    return true;
  } catch (err) {
    logger.error('Failed to check form data', { formId, error: err.message }, err);
    return false;
  }
}

/**
 * Get age of stored form data in milliseconds
 * @param {string} formId - Unique identifier for the form
 * @returns {number|null} Age in milliseconds or null if not found
 */
export function getFormDataAge(formId) {
  if (!formId) {
    return null;
  }

  try {
    const key = getStorageKey(formId);
    const payload = store.get(key);

    if (!payload || !payload.timestamp) {
      return null;
    }

    return Date.now() - payload.timestamp;
  } catch (err) {
    logger.error('Failed to get form data age', { formId, error: err.message }, err);
    return null;
  }
}

/**
 * Clean up all expired form data
 * @returns {number} Number of forms cleaned up
 */
export function cleanupExpiredForms() {
  try {
    let cleanedCount = 0;
    const allKeys = store.keys();

    allKeys.forEach(key => {
      if (key.startsWith(FORM_STORAGE_PREFIX)) {
        const payload = store.get(key);
        if (payload && payload.expiresAt && Date.now() > payload.expiresAt) {
          store.remove(key);
          cleanedCount++;
        }
      }
    });

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired form data', { count: cleanedCount });
    }

    return cleanedCount;
  } catch (err) {
    logger.error('Failed to cleanup expired forms', { error: err.message }, err);
    return 0;
  }
}

/**
 * Clear all form data (for testing/debugging)
 * @returns {number} Number of forms cleared
 */
export function clearAllFormData() {
  try {
    let clearedCount = 0;
    const allKeys = store.keys();

    allKeys.forEach(key => {
      if (key.startsWith(FORM_STORAGE_PREFIX)) {
        store.remove(key);
        clearedCount++;
      }
    });

    logger.info('Cleared all form data', { count: clearedCount });
    return clearedCount;
  } catch (err) {
    logger.error('Failed to clear all form data', { error: err.message }, err);
    return 0;
  }
}
