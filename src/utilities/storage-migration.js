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

/**
 * Current storage version
 * Increment this when adding new migrations
 */
const CURRENT_VERSION = 1;

/**
 * Key used to track migration version
 */
const VERSION_KEY = 'bien:storage_version';

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
    const version = localStorage.getItem(VERSION_KEY);
    return version ? parseInt(version, 10) : 0;
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
    localStorage.setItem(VERSION_KEY, version.toString());
  } catch (error) {
    logger.warn('[StorageMigration] Failed to set version', { error: error.message });
  }
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
          key !== 'bien:events' &&
          key !== VERSION_KEY &&
          key !== 'bien:pending_hash') {

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

    // Always run cleanup
    totalChanges += cleanupOrphanedData();

    // Update version
    setStorageVersion(CURRENT_VERSION);

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
