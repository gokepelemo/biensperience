/**
 * Form persistence utility for saving and restoring form data
 * Uses localStorage to persist form state across page reloads and failures
 * Supports encryption for secure storage and user-specific form data
 *
 * @module form-persistence
 */

import store from 'store2';
import { logger } from './logger';
import { encryptData, decryptData } from './crypto-utils';

// Legacy namespaces (deprecated)
// Historically, form drafts have been persisted under a few similar prefixes.
// We migrate all variants into the consolidated encrypted `bien:formDrafts:*` bucket.
const LEGACY_FORM_STORAGE_PREFIXES = [
  '__form_data__',
  '__form__data__',
  '__form__data'
];

// Canonical consolidated form drafts store
// NOTE: The pending hash is the only localStorage key allowed to remain unencrypted.
// All form drafts are stored encrypted-at-rest under `bien:`.
const FORM_DRAFTS_PREFIX = 'bien:formDrafts:';

// Anonymous drafts still must be encrypted; this deterministic key material enables
// decrypting across sessions without leaking plaintext to localStorage.
const ANON_KEY_MATERIAL = 'bien:anon';

const FORM_DRAFTS_SCHEMA_VERSION = 1;

// Default TTL: 24 hours
const DEFAULT_TTL = 24 * 60 * 60 * 1000;

/**
 * Generate storage key for a form
 * @param {string} formId - Unique identifier for the form
 * @param {string} userId - User ID for user-specific storage (optional)
 * @returns {string} Storage key
 */
function getBucketId(userId = null) {
  return userId || 'anon';
}

function getBucketKey(userId = null) {
  return `${FORM_DRAFTS_PREFIX}${getBucketId(userId)}`;
}

function getKeyMaterial(userId = null) {
  return userId || ANON_KEY_MATERIAL;
}

async function readBucket(userId = null) {
  const bucketKey = getBucketKey(userId);
  const raw = localStorage.getItem(bucketKey);

  if (!raw) {
    return { version: FORM_DRAFTS_SCHEMA_VERSION, forms: {} };
  }

  const decrypted = await decryptData(raw, getKeyMaterial(userId));
  if (!decrypted || typeof decrypted !== 'object') {
    return { version: FORM_DRAFTS_SCHEMA_VERSION, forms: {} };
  }

  return {
    version: FORM_DRAFTS_SCHEMA_VERSION,
    forms: decrypted.forms && typeof decrypted.forms === 'object' ? decrypted.forms : {}
  };
}

async function writeBucket(userId, bucket) {
  const bucketKey = getBucketKey(userId);
  const payload = {
    version: FORM_DRAFTS_SCHEMA_VERSION,
    forms: bucket?.forms && typeof bucket.forms === 'object' ? bucket.forms : {}
  };

  const encrypted = await encryptData(payload, getKeyMaterial(userId));
  localStorage.setItem(bucketKey, encrypted);
}

function getLegacyPrefixMatch(key) {
  if (!key) return null;
  return LEGACY_FORM_STORAGE_PREFIXES.find(prefix => key.startsWith(prefix)) || null;
}

function parseLegacyKey(key) {
  const prefix = getLegacyPrefixMatch(key);
  if (!prefix) return null;

  // Legacy patterns:
  // - __form_data__<userId>__<formId>
  // - __form_data__<formId>
  // (also supports __form__data variants)
  const rest = key.slice(prefix.length);
  const parts = rest.split('__');

  if (parts.length >= 2) {
    const userId = parts[0] || null;
    const formId = parts.slice(1).join('__');
    return { userId, formId };
  }

  return { userId: null, formId: rest };
}

let legacyMigrationRan = false;

async function migrateLegacyFormData() {
  if (legacyMigrationRan) return;
  legacyMigrationRan = true;

  try {
    // Migrate legacy __form_data__* style keys.
    const allKeys = store.keys();
    const legacyKeys = allKeys.filter(k => k && getLegacyPrefixMatch(k));
    if (legacyKeys.length === 0) {
      return;
    }

    const buckets = new Map(); // bucketId -> { userId, bucket }
    let migratedCount = 0;

    for (const legacyKey of legacyKeys) {
      const parsed = parseLegacyKey(legacyKey);
      if (!parsed?.formId) continue;

      const legacyPayload = store.get(legacyKey);
      if (!legacyPayload) {
        store.remove(legacyKey);
        continue;
      }

      const legacyUserId = parsed.userId;
      const bucketId = getBucketId(legacyUserId);
      const bucketUserId = legacyUserId || null;

      if (!buckets.has(bucketId)) {
        const existingBucket = await readBucket(bucketUserId);
        buckets.set(bucketId, { userId: bucketUserId, bucket: existingBucket });
      }

      const entry = buckets.get(bucketId);
      const timestamp = legacyPayload.timestamp || Date.now();
      const expiresAt = legacyPayload.expiresAt || (timestamp + DEFAULT_TTL);

      let data = legacyPayload.data;
      if (legacyPayload.encrypted) {
        data = await decryptData(legacyPayload.data, getKeyMaterial(bucketUserId));
      }

      entry.bucket.forms[parsed.formId] = {
        data,
        timestamp,
        expiresAt
      };

      store.remove(legacyKey);
      migratedCount++;
    }

    for (const { userId, bucket } of buckets.values()) {
      await writeBucket(userId, bucket);
    }

    logger.info('[FormPersistence] Migrated legacy form drafts', {
      migratedCount,
      buckets: buckets.size
    });
  } catch (err) {
    logger.warn('[FormPersistence] Legacy migration failed', { error: err.message });
  }
}

/**
 * Proactively migrate legacy form draft keys into the consolidated encrypted
 * `bien:formDrafts:*` bucket.
 *
 * Safe to call multiple times.
 */
export async function migrateFormDraftsFromLegacyStorage() {
  await migrateLegacyFormData();
}

/**
 * Save form data to localStorage
 * @param {string} formId - Unique identifier for the form
 * @param {Object} data - Form data to save
 * @param {number} ttl - Time to live in milliseconds (default: 24 hours)
 * @param {string} userId - User ID for encryption and user-specific storage (optional)
 * @returns {Promise<boolean>} True if saved successfully
 */
export async function saveFormData(formId, data, ttl = DEFAULT_TTL, userId = null) {
  if (!formId) {
    logger.warn('saveFormData: formId is required');
    return false;
  }

  try {
    await migrateLegacyFormData();

    const bucket = await readBucket(userId);
    bucket.forms[formId] = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };

    await writeBucket(userId, bucket);

    logger.debug('Form data saved', {
      formId,
      userId: userId ? 'provided' : 'none',
      encrypted: true,
      dataKeys: Object.keys(data || {})
    });
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
 * @param {string} userId - User ID for decryption and user-specific storage (optional)
 * @returns {Promise<Object|null>} Form data or null if not found/expired
 */
export async function loadFormData(formId, autoCleanup = true, userId = null) {
  if (!formId) {
    logger.warn('loadFormData: formId is required');
    return null;
  }

  try {
    await migrateLegacyFormData();

    const bucket = await readBucket(userId);
    const entry = bucket.forms?.[formId];
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      logger.debug('Form data expired', { formId });
      if (autoCleanup) {
        await clearFormData(formId, userId);
      }
      return null;
    }

    logger.debug('Form data loaded', {
      formId,
      userId: userId ? 'provided' : 'none',
      encrypted: true,
      dataKeys: Object.keys(entry.data || {})
    });

    return entry.data || null;
  } catch (err) {
    logger.error('Failed to load form data', { formId, error: err.message }, err);
    return null;
  }
}

/**
 * Clear form data from localStorage
 * @param {string} formId - Unique identifier for the form
 * @param {string} userId - User ID for user-specific storage (optional)
 * @returns {boolean} True if cleared successfully
 */
export async function clearFormData(formId, userId = null) {
  if (!formId) {
    logger.warn('clearFormData: formId is required');
    return false;
  }

  try {
    await migrateLegacyFormData();
    const bucket = await readBucket(userId);
    if (bucket.forms && bucket.forms[formId]) {
      delete bucket.forms[formId];
    }

    const remaining = Object.keys(bucket.forms || {}).length;
    if (remaining === 0) {
      localStorage.removeItem(getBucketKey(userId));
    } else {
      await writeBucket(userId, bucket);
    }

    logger.debug('Form data cleared', { formId, userId: userId ? 'provided' : 'none' });
    return true;
  } catch (err) {
    logger.error('Failed to clear form data', { formId, error: err.message }, err);
    return false;
  }
}

/**
 * Check if form data exists and is not expired
 * @param {string} formId - Unique identifier for the form
 * @param {string} userId - User ID for user-specific storage (optional)
 * @returns {boolean} True if valid data exists
 */
export async function hasFormData(formId, userId = null) {
  if (!formId) {
    return false;
  }

  try {
    await migrateLegacyFormData();

    const bucket = await readBucket(userId);
    const entry = bucket.forms?.[formId];
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) return false;
    return true;
  } catch (err) {
    logger.error('Failed to check form data', { formId, error: err.message }, err);
    return false;
  }
}

/**
 * Get age of stored form data in milliseconds
 * @param {string} formId - Unique identifier for the form
 * @param {string} userId - User ID for user-specific storage (optional)
 * @returns {number|null} Age in milliseconds or null if not found
 */
export async function getFormDataAge(formId, userId = null) {
  if (!formId) {
    return null;
  }

  try {
    await migrateLegacyFormData();

    const bucket = await readBucket(userId);
    const entry = bucket.forms?.[formId];
    if (!entry?.timestamp) return null;
    return Date.now() - entry.timestamp;
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

    // Legacy cleanup (still safe to do synchronously)
    const allKeys = store.keys();
    allKeys.forEach(key => {
      if (getLegacyPrefixMatch(key)) {
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
      if (getLegacyPrefixMatch(key)) {
        store.remove(key);
        clearedCount++;
      }
    });

    // Remove all consolidated buckets
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(FORM_DRAFTS_PREFIX)) {
        localStorage.removeItem(key);
        clearedCount++;
      }
    }

    logger.info('Cleared all form data', { count: clearedCount });
    return clearedCount;
  } catch (err) {
    logger.error('Failed to clear all form data', { error: err.message }, err);
    return 0;
  }
}
