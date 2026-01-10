/**
 * Storage Migration Utility
 *
 * Handles migration of localStorage data from old keys to the new
 * consolidated encrypted format. Run once on app initialization.
 *
 * Migration v1 (Nov 2025):
 * - Removes deprecated `bien:event` key (replaced by `bien:events`)
 * - Removes deprecated `bien:plan_event` key (consolidated into `bien:events`)
 * - Cleans up any orphaned event data
 *
 * @module storage-migration
 */

import { logger } from './logger';
import { getObfuscatedJson, setObfuscatedJson, removeStorageKey } from './secure-storage-lite';
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from './storage-keys';
import { setStoredToken } from './token-storage';

/**
 * Current storage version
 * Increment this when adding new migrations
 */
const CURRENT_VERSION = 3;

/**
 * Key used to track migration version
 */
// Encrypted migration marker. This allows us to version migrations without
// adding additional plaintext keys to localStorage.
const MIGRATION_MARKER_KEY = STORAGE_KEYS.storageMigration;

// Legacy plaintext version keys (pre-v2)
const LEGACY_VERSION_KEYS = new Set(LEGACY_STORAGE_KEYS.storageVersion);

// Canonical keys that should never be removed during cleanup.
const CANONICAL_KEYS = new Set([
  STORAGE_KEYS.pendingHash,
  STORAGE_KEYS.token,
  STORAGE_KEYS.themeState,
  STORAGE_KEYS.currency,
  STORAGE_KEYS.language,
  STORAGE_KEYS.timezone,
  STORAGE_KEYS.encryptedPrefs,
  STORAGE_KEYS.prefsMeta,
  STORAGE_KEYS.uiPreferences,
  STORAGE_KEYS.planCache,
  STORAGE_KEYS.events,
  STORAGE_KEYS.sessionData,
  STORAGE_KEYS.cookieConsent,
  STORAGE_KEYS.storageMigration,
]);

// NOTE: pending hash is the only localStorage key allowed to remain unencrypted.
// Keep both canonical and legacy variants here so cleanup does not delete them
// before the rest of the app has a chance to migrate.
const PENDING_HASH_KEYS = new Set([
  STORAGE_KEYS.pendingHash,
  ...LEGACY_STORAGE_KEYS.pendingHash
]);

function getMigrationMarker() {
  try {
    const marker = getObfuscatedJson(localStorage, MIGRATION_MARKER_KEY, null);
    return marker && typeof marker === 'object' ? marker : null;
  } catch {
    return null;
  }
}

function setMigrationMarker(version) {
  try {
    const payload = {
      version: Number(version) || 0,
      migratedAt: Date.now(),
    };
    setObfuscatedJson(localStorage, MIGRATION_MARKER_KEY, payload);
  } catch (error) {
    logger.warn('[StorageMigration] Failed to set migration marker', { error: error.message });
  }
}

/**
 * Deprecated keys to remove
 */
const DEPRECATED_KEYS = [
  'bien:event',      // Old single event key
  'bien:plan_event', // Old plan-specific event key
];

/**
 * Get current storage version
 * @returns {number} Current version or 0 if not set
 */
function getStorageVersion() {
  try {
    const marker = getMigrationMarker();
    const markerVersion = marker?.version;
    if (typeof markerVersion === 'number' && Number.isFinite(markerVersion)) {
      return markerVersion;
    }

    // Fallback: legacy underscore key
    for (const legacyKey of LEGACY_VERSION_KEYS) {
      const legacyVersion = localStorage.getItem(legacyKey);
      if (!legacyVersion) continue;

      const parsed = parseInt(legacyVersion, 10) || 0;

      // Opportunistically create the v2 marker so we don't keep depending
      // on legacy plaintext version keys.
      try {
        setMigrationMarker(parsed);
        localStorage.removeItem(legacyKey);
      } catch {
        // ignore
      }

      return parsed;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Set storage version
 * @param {number} version - Version to set
 */
function setStorageVersion(version) {
  try {
    // Backward compatible no-op setter (legacy callers).
    // v2 uses an encrypted migration marker instead of a plaintext version key.
    LEGACY_VERSION_KEYS.forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    });
  } catch (error) {
    logger.warn('[StorageMigration] Failed to set version', { error: error.message });
  }
}

function migrateKeyIfPresent(fromKeys, toKey) {
  for (const fromKey of fromKeys) {
    try {
      const value = localStorage.getItem(fromKey);
      if (value === null) continue;
      if (!localStorage.getItem(toKey)) {
        localStorage.setItem(toKey, value);
      }
      localStorage.removeItem(fromKey);
      return 1;
    } catch {
      // ignore
    }
  }
  return 0;
}

/**
 * Migration v2: CamelCase key normalization + encrypted migration marker
 * - Moves bien:pending_hash -> bien:pendingHash (plaintext exception)
 * - Moves bien:encrypted_prefs -> bien:encryptedPrefs (encrypted bucket)
 * - Moves bien:prefs_meta -> bien:prefsMeta (encrypted meta)
 */
function migrateV2() {
  logger.info('[StorageMigration] Running migration v2: CamelCase key normalization');

  let movedCount = 0;
  movedCount += migrateKeyIfPresent(['bien:pending_hash'], STORAGE_KEYS.pendingHash);
  movedCount += migrateKeyIfPresent(['bien:encrypted_prefs'], STORAGE_KEYS.encryptedPrefs);
  movedCount += migrateKeyIfPresent(['bien:prefs_meta'], STORAGE_KEYS.prefsMeta);

  logger.info('[StorageMigration] Migration v2 complete', { movedCount });
  return movedCount;
}

/**
 * Migration v3: Remove remaining legacy biensperience:* keys
 * - Migrates legacy encrypted prefs/meta/session keys to canonical bien:* keys
 * - Migrates legacy UI preferences (plaintext JSON) to obfuscated bien:uiPreferences
 */
function migrateV3() {
  logger.info('[StorageMigration] Running migration v3: Legacy key cleanup');

  let movedCount = 0;

  // Opportunistically normalize additional legacy variants.
  movedCount += migrateKeyIfPresent(LEGACY_STORAGE_KEYS.encryptedPrefs, STORAGE_KEYS.encryptedPrefs);
  movedCount += migrateKeyIfPresent(LEGACY_STORAGE_KEYS.prefsMeta, STORAGE_KEYS.prefsMeta);
  movedCount += migrateKeyIfPresent(LEGACY_STORAGE_KEYS.sessionData, STORAGE_KEYS.sessionData);
  movedCount += migrateKeyIfPresent(LEGACY_STORAGE_KEYS.pendingHash, STORAGE_KEYS.pendingHash);
  movedCount += migrateKeyIfPresent(LEGACY_STORAGE_KEYS.chunkReloadAttempted, STORAGE_KEYS.chunkReloadAttempted);

  // Base prefs migration: legacy builds stored plaintext values under biensperience:* keys.
  // We migrate them into obfuscated bien:* base-pref keys so localStorage has no plaintext.
  try {
    const encodeUtf8 = (str) => {
      const safe = String(str ?? '');
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(safe);
      if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(safe, 'utf8'));
      const out = new Uint8Array(safe.length);
      for (let i = 0; i < safe.length; i++) out[i] = safe.charCodeAt(i) & 0xff;
      return out;
    };

    const base64Encode = (bytes) => {
      if (typeof btoa === 'function') {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
      }
      if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
      throw new Error('Base64 encode not available');
    };

    const xorTransform = (inputBytes) => {
      const keyBytes = encodeUtf8('bien:base_prefs:v1');
      const out = new Uint8Array(inputBytes.length);
      for (let i = 0; i < inputBytes.length; i++) {
        out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      return out;
    };

    const obfuscate = (plainText) => base64Encode(xorTransform(encodeUtf8(plainText)));

    // Start with values from legacy preferences blob (if present)
    let legacyPrefs = null;
    for (const k of LEGACY_STORAGE_KEYS.preferencesBlob || []) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        legacyPrefs = JSON.parse(raw) || null;
        break;
      } catch {
        // ignore
      }
    }

    const legacyTheme = typeof legacyPrefs?.theme === 'string' ? legacyPrefs.theme : null;

    const legacyCurrency = (() => {
      for (const k of LEGACY_STORAGE_KEYS.currency || []) {
        try {
          const v = localStorage.getItem(k);
          if (v) return v;
        } catch {
          // ignore
        }
      }
      return typeof legacyPrefs?.currency === 'string' ? legacyPrefs.currency : null;
    })();

    const legacyLanguage = (() => {
      for (const k of LEGACY_STORAGE_KEYS.language || []) {
        try {
          const v = localStorage.getItem(k);
          if (v) return v;
        } catch {
          // ignore
        }
      }
      return typeof legacyPrefs?.language === 'string' ? legacyPrefs.language : null;
    })();

    const legacyTimezone = (() => {
      for (const k of LEGACY_STORAGE_KEYS.timezone || []) {
        try {
          const v = localStorage.getItem(k);
          if (v) return v;
        } catch {
          // ignore
        }
      }
      return typeof legacyPrefs?.timezone === 'string' ? legacyPrefs.timezone : null;
    })();

    // Theme state uses a small JSON payload for lastApplied.
    if (legacyTheme && !localStorage.getItem(STORAGE_KEYS.themeState)) {
      try {
        const payload = JSON.stringify({ theme: legacyTheme, lastApplied: Date.now() });
        localStorage.setItem(STORAGE_KEYS.themeState, obfuscate(payload));
        movedCount++;
      } catch {
        // ignore
      }
    }

    if (legacyCurrency && !localStorage.getItem(STORAGE_KEYS.currency)) {
      try {
        localStorage.setItem(STORAGE_KEYS.currency, obfuscate(String(legacyCurrency)));
        movedCount++;
      } catch {
        // ignore
      }
    }

    if (legacyLanguage && !localStorage.getItem(STORAGE_KEYS.language)) {
      try {
        localStorage.setItem(STORAGE_KEYS.language, obfuscate(String(legacyLanguage)));
        movedCount++;
      } catch {
        // ignore
      }
    }

    if (legacyTimezone && legacyTimezone !== 'system-default' && !localStorage.getItem(STORAGE_KEYS.timezone)) {
      try {
        localStorage.setItem(STORAGE_KEYS.timezone, obfuscate(String(legacyTimezone)));
        movedCount++;
      } catch {
        // ignore
      }
    }

    // Remove legacy keys after best-effort migration
    for (const k of LEGACY_STORAGE_KEYS.preferencesBlob || []) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
    for (const k of LEGACY_STORAGE_KEYS.currency || []) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
    for (const k of LEGACY_STORAGE_KEYS.language || []) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
    for (const k of LEGACY_STORAGE_KEYS.timezone || []) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
  } catch {
    // ignore
  }

  // Token legacy migration: `token` (plaintext) -> `bien:token` (obfuscated)
  try {
    const existing = localStorage.getItem(STORAGE_KEYS.token);
    if (!existing) {
      for (const legacyKey of LEGACY_STORAGE_KEYS.token) {
        const legacyToken = localStorage.getItem(legacyKey);
        if (!legacyToken) continue;
        try {
          setStoredToken(legacyToken);
          movedCount++;
        } catch {
          // ignore
        }
        try {
          localStorage.removeItem(legacyKey);
        } catch {
          // ignore
        }
      }
    } else {
      for (const legacyKey of LEGACY_STORAGE_KEYS.token) {
        try { localStorage.removeItem(legacyKey); } catch { /* ignore */ }
      }
    }
  } catch {
    // ignore
  }

  // UI preferences were historically stored as plaintext JSON under biensperience:ui_preferences.
  // Migrate to an obfuscated bien:* key to avoid plaintext localStorage.
  try {
    const existing = getObfuscatedJson(localStorage, STORAGE_KEYS.uiPreferences, null);
    if (!existing) {
      for (const legacyKey of LEGACY_STORAGE_KEYS.uiPreferences) {
        const raw = localStorage.getItem(legacyKey);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            setObfuscatedJson(localStorage, STORAGE_KEYS.uiPreferences, parsed);
            movedCount++;
          }
        } catch {
          // If legacy is corrupted/unparseable, drop it.
        }

        try {
          localStorage.removeItem(legacyKey);
        } catch {
          // ignore
        }
      }
    } else {
      // Even if canonical exists, remove legacy keys.
      for (const legacyKey of LEGACY_STORAGE_KEYS.uiPreferences) {
        try { localStorage.removeItem(legacyKey); } catch { /* ignore */ }
      }
    }
  } catch {
    // ignore
  }

  // Remove known legacy non-namespaced keys that should not persist.
  // These are best-effort cleanups to satisfy the "only bien:*" acceptance criteria.
  try {
    const legacyPrefixes = [
      'seen_activities_',
      'resend_verification_cooldown_',
    ];

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (legacyPrefixes.some((p) => key.startsWith(p))) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key);
        movedCount++;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  logger.info('[StorageMigration] Migration v3 complete', { movedCount });
  return movedCount;
}

/**
 * Migration v1: Remove deprecated event keys
 *
 * Old system used separate keys for events:
 * - `bien:event` - General events
 * - `bien:plan_event` - Plan-specific events
 *
 * New system uses:
 * - `bien:events` - Consolidated, encrypted event store
 */
function migrateV1() {
  logger.info('[StorageMigration] Running migration v1: Removing deprecated event keys');

  let removedCount = 0;

  DEPRECATED_KEYS.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (value !== null) {
        localStorage.removeItem(key);
        removedCount++;
        logger.debug('[StorageMigration] Removed deprecated key', { key });
      }
    } catch (error) {
      logger.warn('[StorageMigration] Failed to remove key', { key, error: error.message });
    }
  });

  logger.info('[StorageMigration] Migration v1 complete', { removedCount });
  return removedCount;
}

/**
 * Clean up any orphaned or corrupted event data
 */
function cleanupOrphanedData() {
  logger.info('[StorageMigration] Cleaning up orphaned data');

  const keysToRemove = [];

  try {
    // Find any keys that look like old event data patterns
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      // Check for old event-like keys that aren't the new consolidated key
          if (key.startsWith('bien:') &&
            !CANONICAL_KEYS.has(key) &&
            !LEGACY_VERSION_KEYS.has(key) &&
            !PENDING_HASH_KEYS.has(key)) {

        // Check if it looks like event data
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            // If it has event-like properties and isn't a known data type
            if (parsed && (parsed.type || parsed.event || parsed.sessionId)) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Not JSON, skip
        }
      }
    }

    // Remove identified orphaned keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
        logger.debug('[StorageMigration] Removed orphaned key', { key });
      } catch (error) {
        logger.warn('[StorageMigration] Failed to remove orphaned key', { key, error: error.message });
      }
    });

    logger.info('[StorageMigration] Cleanup complete', { removedCount: keysToRemove.length });
    return keysToRemove.length;
  } catch (error) {
    logger.error('[StorageMigration] Cleanup failed', { error: error.message }, error);
    return 0;
  }
}

/**
 * Run all pending migrations
 *
 * Call this on app initialization to ensure storage is up to date.
 * Migrations are idempotent and version-tracked to prevent re-running.
 *
 * @returns {object} Migration result with version and changes
 */
export function runStorageMigrations() {
  if (typeof window === 'undefined' || !window.localStorage) {
    logger.debug('[StorageMigration] localStorage not available, skipping migrations');
    return { version: 0, migrated: false, changes: 0 };
  }

  const currentVersion = getStorageVersion();
  let totalChanges = 0;

  logger.info('[StorageMigration] Checking migrations', {
    currentVersion,
    targetVersion: CURRENT_VERSION
  });

  // Already at current version
  if (currentVersion >= CURRENT_VERSION) {
    logger.debug('[StorageMigration] Storage already at current version');
    return { version: currentVersion, migrated: false, changes: 0 };
  }

  // Run pending migrations
  try {
    // V1: Remove deprecated keys
    if (currentVersion < 1) {
      totalChanges += migrateV1();
    }

    // V2: Normalize camelCase keys
    if (currentVersion < 2) {
      totalChanges += migrateV2();
    }

    // V3: Legacy key cleanup (biensperience:* removal)
    if (currentVersion < 3) {
      totalChanges += migrateV3();
    }

    // Always run cleanup
    totalChanges += cleanupOrphanedData();

    // Update marker
    setMigrationMarker(CURRENT_VERSION);

    logger.info('[StorageMigration] All migrations complete', {
      fromVersion: currentVersion,
      toVersion: CURRENT_VERSION,
      totalChanges
    });

    return { version: CURRENT_VERSION, migrated: true, changes: totalChanges };
  } catch (error) {
    logger.error('[StorageMigration] Migration failed', { error: error.message }, error);
    return { version: currentVersion, migrated: false, changes: totalChanges, error: error.message };
  }
}

/**
 * Force re-run all migrations (for debugging/recovery)
 * Resets version to 0 and runs all migrations
 *
 * @returns {object} Migration result
 */
export function forceRunMigrations() {
  logger.warn('[StorageMigration] Force running all migrations');
  try {
    removeStorageKey(localStorage, MIGRATION_MARKER_KEY);
  } catch {
    // ignore
  }
  setStorageVersion(0);
  return runStorageMigrations();
}

/**
 * Get storage stats for debugging
 *
 * @returns {object} Storage statistics
 */
export function getStorageStats() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { available: false };
  }

  const stats = {
    available: true,
    version: getStorageVersion(),
    totalKeys: localStorage.length,
    bienKeys: [],
    deprecatedKeys: [],
    estimatedSize: 0
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      const value = localStorage.getItem(key);
      const size = value ? new Blob([value]).size : 0;
      stats.estimatedSize += size;

      if (key.startsWith('bien:') || key.startsWith('biensperience:')) {
        stats.bienKeys.push({ key, size });
      }

      if (DEPRECATED_KEYS.includes(key)) {
        stats.deprecatedKeys.push(key);
      }
    }
  } catch (error) {
    stats.error = error.message;
  }

  return stats;
}

export default {
  runStorageMigrations,
  forceRunMigrations,
  getStorageStats,
  CURRENT_VERSION
};
