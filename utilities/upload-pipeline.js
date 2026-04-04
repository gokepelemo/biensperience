/**
 * Shared upload pipeline utility — consolidates the local→S3→cleanup pattern
 * used by photos, documents, and BienBot controllers.
 *
 * Provides three operations:
 *   uploadWithPipeline — upload to S3 (sync or background) with local cleanup
 *   retrieveFile       — local-first retrieval with S3 signed URL fallback
 *   transferBucket     — move files between protected/public S3 buckets
 */

const fs = require('fs');
const path = require('path');
const logger = require('./backend-logger');
const {
  s3Upload,
  s3Delete,
  s3GetSignedUrl,
  s3DownloadBuffer,
  resolveAndValidateLocalUploadPath
} = require('../uploads/aws-s3');

const TAG = '[upload-pipeline]';

/** Status values for tracking background S3 uploads. */
const S3_STATUS = Object.freeze({
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  FAILED: 'failed'
});

/**
 * Upload a local file to S3, optionally in the background.
 *
 * @param {string} localPath  Absolute path to the local file (from multer).
 * @param {string} originalName  Original filename (used for MIME detection).
 * @param {string} s3KeyPrefix  S3 key prefix (e.g. 'photos/123-img', 'documents/uid/ts-name').
 * @param {Object} [options]
 * @param {boolean} [options.protected=false]     Upload to protected bucket.
 * @param {boolean} [options.background=false]    Fire-and-forget upload.
 * @param {boolean} [options.deleteLocal=true]    Delete local file after upload.
 * @param {Function} [options.onS3Complete]       Called with S3 result on success.
 * @param {Function} [options.onS3Error]          Called with error on failure.
 * @returns {Promise<{s3Status: string, s3Result?: Object, localPath?: string, uploadPromise?: Promise}>}
 */
async function uploadWithPipeline(localPath, originalName, s3KeyPrefix, options = {}) {
  const {
    protected: isProtected = false,
    background = false,
    deleteLocal = true,
    onS3Complete,
    onS3Error
  } = options;

  // Validate path security before any I/O; use the resolved canonical path
  // for all subsequent operations to break the taint chain from the caller.
  const safePath = resolveAndValidateLocalUploadPath(localPath);

  if (background) {
    const uploadPromise = _doUpload(safePath, originalName, s3KeyPrefix, isProtected, deleteLocal)
      .then((s3Result) => {
        logger.info(`${TAG} Background upload complete`, {
          key: s3Result.key,
          bucket: s3Result.bucket
        });
        if (onS3Complete) {
          try { onS3Complete(s3Result); } catch (cbErr) {
            logger.error(`${TAG} onS3Complete callback error`, { error: cbErr.message });
          }
        }
        return s3Result;
      })
      .catch((error) => {
        logger.error(`${TAG} Background upload failed`, {
          localPath: safePath,
          s3KeyPrefix,
          error: error.message
        });
        if (onS3Error) {
          try { onS3Error(error); } catch (cbErr) {
            logger.error(`${TAG} onS3Error callback error`, { error: cbErr.message });
          }
        }
      });

    return {
      s3Status: S3_STATUS.PENDING,
      localPath: safePath,
      uploadPromise
    };
  }

  // Synchronous (foreground) mode
  const s3Result = await _doUpload(safePath, originalName, s3KeyPrefix, isProtected, deleteLocal);
  logger.info(`${TAG} Upload complete`, { key: s3Result.key, bucket: s3Result.bucket });
  return { s3Status: S3_STATUS.UPLOADED, s3Result };
}

/**
 * Internal: perform the S3 upload and clean up the local file.
 *
 * @param {string} validatedLocalPath  Canonical absolute path already validated
 *   by resolveAndValidateLocalUploadPath in uploadWithPipeline. Never pass a
 *   raw caller-supplied path directly — validation must happen before this call.
 */
async function _doUpload(validatedLocalPath, originalName, s3KeyPrefix, isProtected, deleteLocal) {
  // Re-validate here so any misuse of _doUpload (bypassing uploadWithPipeline)
  // is rejected, and CodeQL sees a clear sanitization step before every I/O op.
  // resolveAndValidateLocalUploadPath returns a canonical absolute path via
  // realpathSync with directory allowlist enforcement, so its return value is
  // used directly for all subsequent filesystem operations.
  const safeValidatedPath = resolveAndValidateLocalUploadPath(validatedLocalPath);

  let s3Result;
  try {
    s3Result = await s3Upload(safeValidatedPath, originalName, s3KeyPrefix, { protected: isProtected });
  } finally {
    if (deleteLocal) {
      try {
        await fs.promises.unlink(safeValidatedPath);
        logger.debug(`${TAG} Local file deleted`, { localPath: safeValidatedPath });
      } catch (unlinkErr) {
        // File may have already been deleted or never existed — non-fatal.
        if (unlinkErr.code !== 'ENOENT') {
          logger.warn(`${TAG} Failed to delete local file`, {
            localPath: safeValidatedPath,
            error: unlinkErr.message
          });
        }
      }
    }
  }
  return s3Result;
}

/**
 * Retrieve a file: check local directory first, fall back to S3 signed URL.
 *
 * @param {string} s3Key  S3 object key.
 * @param {Object} [options]
 * @param {string}  [options.localDir]          Local directory to check first.
 * @param {boolean} [options.protected=true]    Use protected bucket for signed URL.
 * @param {number}  [options.expiresIn=3600]    Signed URL expiration in seconds.
 * @param {string}  [options.bucket]            Explicit S3 bucket name.
 * @returns {Promise<{source: 'local'|'s3', path?: string, signedUrl?: string} | null>}
 */
async function retrieveFile(s3Key, options = {}) {
  const {
    localDir,
    protected: isProtected = true,
    expiresIn = 3600,
    bucket
  } = options;

  // 1. Check local directory
  if (localDir) {
    const localPath = path.join(localDir, path.basename(s3Key));
    try {
      const validated = resolveAndValidateLocalUploadPath(localPath);
      // File exists (realpathSync in validator confirms existence)
      logger.debug(`${TAG} File found locally`, { localPath: validated });
      return { source: 'local', path: validated };
    } catch {
      // File doesn't exist locally or path invalid — fall through to S3
    }
  }

  // 2. Fall back to S3 signed URL
  try {
    const signOpts = { protected: isProtected, expiresIn };
    if (bucket) signOpts.bucket = bucket;
    const signedUrl = await s3GetSignedUrl(s3Key, signOpts);
    logger.debug(`${TAG} Generated signed URL`, { s3Key });
    return { source: 's3', signedUrl };
  } catch (s3Err) {
    logger.warn(`${TAG} Failed to generate signed URL`, {
      s3Key,
      error: s3Err.message
    });
  }

  // 3. Both failed
  return null;
}

/**
 * Transfer a file between S3 buckets (e.g. protected → public).
 *
 * Downloads from the source bucket, writes to a temp file, uploads to the
 * target bucket, then cleans up. Optionally deletes the source object.
 *
 * @param {string} s3Key  Source S3 object key.
 * @param {Object} [options]
 * @param {boolean} [options.fromProtected=true]   Source is protected bucket.
 * @param {string}  [options.toPrefix='photos/']   Destination key prefix.
 * @param {boolean} [options.deleteSource=true]     Delete source after transfer.
 * @param {string}  [options.newName]               Override destination filename.
 * @returns {Promise<{key: string, location: string, bucket: string}>}
 */
async function transferBucket(s3Key, options = {}) {
  const {
    fromProtected = true,
    toPrefix = 'photos/',
    deleteSource = true,
    newName
  } = options;

  const fileName = newName || path.basename(s3Key);
  const REPO_ROOT = path.resolve(__dirname, '..');
  const tempDir = path.resolve(REPO_ROOT, 'uploads', 'temp');
  const tempPath = path.join(tempDir, `${Date.now()}-transfer-${fileName}`);

  try {
    // Ensure temp directory exists
    await fs.promises.mkdir(tempDir, { recursive: true });

    // 1. Download from source bucket
    const { buffer, contentType } = await s3DownloadBuffer(s3Key, { protected: fromProtected });
    logger.debug(`${TAG} Downloaded from source`, { s3Key, contentType, size: buffer.length });

    // 2. Write to temp file
    await fs.promises.writeFile(tempPath, buffer);

    // 3. Upload to target bucket
    const targetProtected = !fromProtected;
    const targetKey = `${toPrefix}${fileName}`;
    const uploadResult = await s3Upload(tempPath, fileName, targetKey, { protected: targetProtected });

    logger.info(`${TAG} Bucket transfer complete`, {
      sourceKey: s3Key,
      targetKey: uploadResult.key,
      targetBucket: uploadResult.bucket
    });

    // 4. Delete source if requested
    if (deleteSource) {
      try {
        await s3Delete(s3Key, { protected: fromProtected });
        logger.debug(`${TAG} Source deleted after transfer`, { s3Key });
      } catch (delErr) {
        logger.warn(`${TAG} Failed to delete source after transfer`, {
          s3Key,
          error: delErr.message
        });
      }
    }

    return {
      key: uploadResult.key,
      location: uploadResult.Location,
      bucket: uploadResult.bucket
    };
  } finally {
    // Always clean up temp file
    try {
      await fs.promises.unlink(tempPath);
    } catch (unlinkErr) {
      if (unlinkErr.code !== 'ENOENT') {
        logger.warn(`${TAG} Failed to delete transfer temp file`, {
          tempPath,
          error: unlinkErr.message
        });
      }
    }
  }
}

/**
 * Delete a file from S3. Throws on failure.
 *
 * @param {string} s3KeyOrUrl  S3 object key or full URL.
 * @param {Object} [options]
 * @param {boolean} [options.protected=false]  Target protected bucket.
 * @param {string}  [options.bucket]           Explicit bucket name.
 * @returns {Promise<void>}
 */
async function deleteFile(s3KeyOrUrl, options = {}) {
  await s3Delete(s3KeyOrUrl, options);
  logger.info(`${TAG} File deleted from S3`, { s3KeyOrUrl });
}

/**
 * Delete a file from S3, swallowing errors. For cleanup paths where
 * failure is non-fatal.
 *
 * @param {string} s3KeyOrUrl  S3 object key or full URL.
 * @param {Object} [options]
 * @param {boolean} [options.protected=false]  Target protected bucket.
 * @param {string}  [options.bucket]           Explicit bucket name.
 * @returns {Promise<{deleted: boolean, error?: string}>}
 */
async function deleteFileSafe(s3KeyOrUrl, options = {}) {
  try {
    await s3Delete(s3KeyOrUrl, options);
    logger.info(`${TAG} File deleted from S3`, { s3KeyOrUrl });
    return { deleted: true };
  } catch (err) {
    logger.warn(`${TAG} Failed to delete file from S3 (non-fatal)`, {
      s3KeyOrUrl,
      error: err.message
    });
    return { deleted: false, error: err.message };
  }
}

/**
 * Download a file from S3 to a local temp directory.
 *
 * @param {string} s3Key  S3 object key.
 * @param {string} originalFilename  Original filename (for local naming).
 * @param {Object} [options]
 * @param {boolean} [options.protected=false]  Download from protected bucket.
 * @param {string}  [options.tempDir]          Override temp directory.
 * @returns {Promise<{localPath: string, contentType: string, size: number}>}
 */
async function downloadToLocal(s3Key, originalFilename, options = {}) {
  const {
    protected: isProtected = false,
    tempDir: customTempDir
  } = options;

  const REPO_ROOT = path.resolve(__dirname, '..');
  const tempDir = customTempDir || path.resolve(REPO_ROOT, 'uploads', 'temp');
  const timestamp = Date.now();
  const sanitizedName = path.basename(originalFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
  const localPath = path.join(tempDir, `${timestamp}-${sanitizedName}`);

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    const { buffer, contentType } = await s3DownloadBuffer(s3Key, { protected: isProtected });
    await fs.promises.writeFile(localPath, buffer);
    logger.debug(`${TAG} Downloaded to local`, { s3Key, localPath, size: buffer.length });
    return { localPath, contentType, size: buffer.length };
  } catch (err) {
    // Clean up partial file on error
    try { await fs.promises.unlink(localPath); } catch { /* ignore */ }
    throw err;
  }
}

module.exports = {
  uploadWithPipeline,
  retrieveFile,
  transferBucket,
  deleteFile,
  deleteFileSafe,
  downloadToLocal,
  S3_STATUS,
  resolveAndValidateLocalUploadPath
};
