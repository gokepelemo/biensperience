/**
 * Orphaned temp file cleanup utility.
 *
 * When the server crashes between an S3 download and the normal
 * `finally` block cleanup in document processing, temp files in
 * `uploads/temp/` persist indefinitely.  This module provides a
 * startup sweep that removes files older than a configurable
 * threshold (default: 1 hour).
 *
 * @module utilities/temp-cleanup
 */

const fs = require('fs');
const path = require('path');
const backendLogger = require('./backend-logger');

const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const TEMP_DIR = path.resolve(__dirname, '../uploads/temp');

/**
 * Remove files in `uploads/temp/` that are older than `maxAgeMs`.
 *
 * @param {Object}  [options]
 * @param {string}  [options.tempDir]    - Directory to sweep (default: uploads/temp)
 * @param {number}  [options.maxAgeMs]   - Maximum file age in ms (default: 1 hour)
 * @returns {Promise<{ removed: number, errors: number }>}
 */
async function cleanOrphanedTempFiles(options = {}) {
  const {
    tempDir = TEMP_DIR,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  } = options;

  const result = { removed: 0, errors: 0 };

  if (!fs.existsSync(tempDir)) {
    return result;
  }

  let entries;
  try {
    entries = await fs.promises.readdir(tempDir);
  } catch (err) {
    backendLogger.warn('[temp-cleanup] Failed to read temp directory', {
      error: err.message,
      tempDir,
    });
    return result;
  }

  const now = Date.now();

  for (const entry of entries) {
    // Skip hidden files / dotfiles (e.g. .gitkeep)
    if (entry.startsWith('.')) continue;

    const filePath = path.join(tempDir, entry);

    try {
      const stat = await fs.promises.stat(filePath);

      // Only remove regular files, not subdirectories
      if (!stat.isFile()) continue;

      const ageMs = now - stat.mtimeMs;
      if (ageMs > maxAgeMs) {
        await fs.promises.unlink(filePath);
        result.removed++;
        backendLogger.debug('[temp-cleanup] Removed orphaned temp file', {
          file: entry,
          ageMinutes: Math.round(ageMs / 60000),
        });
      }
    } catch (err) {
      result.errors++;
      backendLogger.warn('[temp-cleanup] Failed to process temp file', {
        file: entry,
        error: err.message,
      });
    }
  }

  return result;
}

module.exports = { cleanOrphanedTempFiles, DEFAULT_MAX_AGE_MS, TEMP_DIR };
