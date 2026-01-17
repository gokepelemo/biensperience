require("dotenv").config();

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const slugify = require("slugify");
const path = require("path");
const backendLogger = require("../utilities/backend-logger");

// Create S3 client with v3 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

// Bucket configuration
const PUBLIC_BUCKET = process.env.BUCKET_NAME;
const PROTECTED_BUCKET = process.env.S3_PROTECTED_BUCKET_NAME;

const fs = require("fs");
const mime = require("mime-types");

const sanitizeFileName = require('./sanitize-filename');

// Resolve uploads directories relative to this repo, not the process CWD.
// PM2/Bun can run with unexpected working directories which would break
// allowlists that rely on './uploads'.
const REPO_ROOT = path.resolve(__dirname, '..');
const UPLOADS_ROOT = path.resolve(REPO_ROOT, 'uploads');

function resolveAndValidateLocalUploadPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Invalid file path');
  }

  // Reject null bytes early.
  if (inputPath.includes('\0')) {
    backendLogger.error('S3 upload blocked: null byte in path', { path: inputPath });
    throw new Error('Invalid file path: null bytes not allowed');
  }

  // Additional validation: reject paths with suspicious characters
  if (/[\x00-\x1f\x7f-\x9f]/.test(inputPath)) {
    backendLogger.error('S3 upload blocked: control characters in path', { path: inputPath });
    throw new Error('Invalid file path: control characters not allowed');
  }

  // Require absolute paths (multer typically provides absolute paths).
  // This prevents callers from smuggling relative traversal like "../../etc/passwd".
  if (!path.isAbsolute(inputPath)) {
    backendLogger.error('S3 upload blocked: non-absolute path', { path: inputPath });
    throw new Error('Invalid file path: must be absolute');
  }

  // Resolve symlinks and normalize the path.
  // realpath also ensures the target exists.
  let realPath;
  try {
    realPath = fs.realpathSync(inputPath);
  } catch (e) {
    backendLogger.error('File realpath resolution failed', { path: inputPath, error: e.message });
    throw new Error('Invalid file path - file does not exist or is not accessible');
  }

  // SECURITY: Verify that realPath is still absolute and within expected directory structure
  if (!path.isAbsolute(realPath)) {
    backendLogger.error('S3 upload blocked: realpath resolved to non-absolute path', { realPath, originalPath: inputPath });
    throw new Error('Invalid file path: resolved path must be absolute');
  }

  // Allowed directories for uploads
  const allowedDirs = [
    UPLOADS_ROOT,
    path.resolve(UPLOADS_ROOT, 'documents'),
    path.resolve(UPLOADS_ROOT, 'images'),
    path.resolve(UPLOADS_ROOT, 'temp')
  ];

  const isAllowed = allowedDirs.some((dir) => {
    try {
      const relative = path.relative(dir, realPath);
      if (relative === '') return true;
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch (e) {
      return false;
    }
  });

  if (!isAllowed) {
    backendLogger.error('S3 upload path validation failed', { realPath, allowedDirs, originalPath: inputPath });
    throw new Error('Invalid file path: access denied');
  }

  // Ensure it's a regular file and within size limit.
  // SECURITY: realPath is now validated - it's within allowedDirs and resolved via realpathSync
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  let stats;
  try {
    stats = fs.statSync(realPath);
  } catch (statErr) {
    backendLogger.error('File stat failed', { realPath, error: statErr.message });
    throw new Error('Invalid file path - file does not exist or is not accessible');
  }

  if (!stats.isFile()) {
    backendLogger.error('Path is not a regular file', { realPath });
    throw new Error('Path is not a regular file');
  }

  if (stats.size > MAX_FILE_SIZE) {
    backendLogger.error('File too large', { realPath, size: stats.size, maxSize: MAX_FILE_SIZE });
    throw new Error('File too large');
  }

  // Mark path as validated for downstream consumers
  // This is a security invariant: any path returned from this function is safe
  return realPath;
}

/**
 * Securely read a file that has been validated by resolveAndValidateLocalUploadPath.
 * This wrapper exists to make the security boundary explicit for static analysis tools.
 *
 * SECURITY INVARIANT: The validatedPath parameter MUST have been returned by
 * resolveAndValidateLocalUploadPath(). Passing any other path is a security violation.
 *
 * @param {string} validatedPath - A path that was returned by resolveAndValidateLocalUploadPath
 * @returns {Promise<Buffer>} The file contents as a Buffer
 * @throws {Error} If file cannot be read
 */
async function secureReadFile(validatedPath) {
  // Defense in depth: re-verify the path is within allowed directories
  // This provides an additional check even if called incorrectly
  if (!validatedPath || typeof validatedPath !== 'string') {
    throw new Error('Invalid validated path');
  }

  // Additional security: ensure path is absolute and doesn't contain suspicious characters
  if (!path.isAbsolute(validatedPath) || /[\x00-\x1f\x7f-\x9f]/.test(validatedPath)) {
    backendLogger.error('secureReadFile: invalid path format', { validatedPath });
    throw new Error('Invalid file path: path format not allowed');
  }

  // Verify path is still within allowed directories (defense in depth)
  const allowedDirs = [
    UPLOADS_ROOT,
    path.resolve(UPLOADS_ROOT, 'documents'),
    path.resolve(UPLOADS_ROOT, 'images'),
    path.resolve(UPLOADS_ROOT, 'temp')
  ];

  const isAllowed = allowedDirs.some((dir) => {
    try {
      const relative = path.relative(dir, validatedPath);
      if (relative === '') return true;
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch (_e) {
      return false;
    }
  });

  if (!isAllowed) {
    backendLogger.error('secureReadFile: path not in allowed directories', { validatedPath });
    throw new Error('Invalid file path: access denied');
  }

  // Final security check: ensure the file still exists and is accessible
  try {
    const stats = fs.statSync(validatedPath);
    if (!stats.isFile()) {
      throw new Error('Path is not a regular file');
    }
  } catch (statErr) {
    backendLogger.error('secureReadFile: file validation failed', { validatedPath, error: statErr.message });
    throw new Error('Invalid file path - file not accessible');
  }

  return fs.promises.readFile(validatedPath);
}

/**
 * Securely create a read stream for a file that has been validated.
 * This wrapper exists to make the security boundary explicit for static analysis tools.
 *
 * SECURITY INVARIANT: The validatedPath parameter MUST have been returned by
 * resolveAndValidateLocalUploadPath(). Passing any other path is a security violation.
 *
 * @param {string} validatedPath - A path that was returned by resolveAndValidateLocalUploadPath
 * @returns {fs.ReadStream} A readable stream for the file
 * @throws {Error} If file cannot be accessed
 */
function secureCreateReadStream(validatedPath) {
  // Defense in depth: re-verify the path is within allowed directories
  if (!validatedPath || typeof validatedPath !== 'string') {
    throw new Error('Invalid validated path');
  }

  // Additional security: ensure path is absolute and doesn't contain suspicious characters
  if (!path.isAbsolute(validatedPath) || /[\x00-\x1f\x7f-\x9f]/.test(validatedPath)) {
    backendLogger.error('secureCreateReadStream: invalid path format', { validatedPath });
    throw new Error('Invalid file path: path format not allowed');
  }

  // Verify path is still within allowed directories (defense in depth)
  const allowedDirs = [
    UPLOADS_ROOT,
    path.resolve(UPLOADS_ROOT, 'documents'),
    path.resolve(UPLOADS_ROOT, 'images'),
    path.resolve(UPLOADS_ROOT, 'temp')
  ];

  const isAllowed = allowedDirs.some((dir) => {
    try {
      const relative = path.relative(dir, validatedPath);
      if (relative === '') return true;
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch (_e) {
      return false;
    }
  });

  if (!isAllowed) {
    backendLogger.error('secureCreateReadStream: path not in allowed directories', { validatedPath });
    throw new Error('Invalid file path: access denied');
  }

  // Final security check: ensure the file still exists and is accessible
  try {
    const stats = fs.statSync(validatedPath);
    if (!stats.isFile()) {
      throw new Error('Path is not a regular file');
    }
  } catch (statErr) {
    backendLogger.error('secureCreateReadStream: file validation failed', { validatedPath, error: statErr.message });
    throw new Error('Invalid file path - file not accessible');
  }

  return fs.createReadStream(validatedPath);
}

function getS3UploadTimeoutMs() {
  const raw = process.env.S3_UPLOAD_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  // Default: 5 minutes. Long enough for 50MB on slow links, but not infinite.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60 * 1000;
}

/**
 * Upload a file to S3 bucket
 * @param {string} file - Path to the file to upload
 * @param {string} originalName - Original filename (for mime type detection)
 * @param {string} newName - New filename (will be slugified)
 * @param {Object} options - Upload options
 * @param {boolean} options.protected - If true, upload to protected bucket (default: false)
 * @returns {Promise<Object>} Upload result with Location, key, bucket, isProtected
 */
const s3Upload = async function (file, originalName, newName, options = {}) {
  const { protected: isProtected = false } = options;

  const validatedLocalPath = resolveAndValidateLocalUploadPath(file);

  // Determine which bucket to use
  const bucketName = isProtected ? PROTECTED_BUCKET : PUBLIC_BUCKET;

  // Validate protected bucket is configured if requested
  if (isProtected && !PROTECTED_BUCKET) {
    throw new Error('Protected bucket not configured. Set S3_PROTECTED_BUCKET_NAME environment variable.');
  }

  // Sanitize user-controlled file names while preserving path structure
  // Normalize the incoming name, split by '/' to handle paths like 'documents/userId/timestamp-filename'
  const normalizedNewName = String(newName || '').replace(/\\+/g, '/'); // convert backslashes to slashes
  const pathParts = normalizedNewName.split('/');
  // Reject suspicious path segments like '.' or '..' or empty segments
  if (pathParts.some(p => p === '' || p === '.' || p === '..')) {
    backendLogger.error('S3 upload name validation failed', { newName });
    throw new Error('Invalid file name');
  }
  const sanitizedParts = pathParts.map((part, index) => {
    // Only slugify the final filename part, preserve directory structure
    if (index === pathParts.length - 1) {
      return sanitizeFileName(slugify(part, { lower: true }));
    }
    // For directory parts, just sanitize without slugify to preserve structure
    return sanitizeFileName(part);
  });
  const sanitizedName = sanitizedParts.join('/');

  backendLogger.debug('Processing file upload', { originalName, newName: sanitizedName, bucketName, isProtected });
  const contentType = mime.lookup(originalName);
  const extension = mime.extension(contentType);

  // Read file content using secure wrappers that include defense-in-depth validation.
  // Under Bun, Node.js stream compatibility can be imperfect for AWS SDK v3,
  // and we've seen uploads hang indefinitely when using fs.createReadStream().
  // Given our document limits (<= 50MB) and safety checks (<= 100MB), using a
  // Buffer is an acceptable tradeoff for reliability.
  let body;
  try {
    if (typeof Bun !== 'undefined') {
      // SECURITY: Use secureReadFile which re-validates the path before reading
      body = await secureReadFile(validatedLocalPath);
    } else {
      // SECURITY: Use secureCreateReadStream which re-validates the path before creating stream
      body = secureCreateReadStream(validatedLocalPath);
    }
  } catch (readErr) {
    backendLogger.error('Failed to read upload file', { path: validatedLocalPath, error: readErr.message });
    throw new Error('Unable to read file');
  }
  const key = `${sanitizedName}.${extension}`;
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  };

  // Use async/await with v3 SDK
  return (async () => {
    try {
      const command = new PutObjectCommand(params);

      // Ensure S3 uploads don't hang forever (network issues, SDK/runtime quirks, etc.).
      const uploadTimeoutMs = getS3UploadTimeoutMs();
      const abortController = new AbortController();
      let timeoutId;

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            abortController.abort();
          } catch (e) {
            // ignore
          }
          const err = new Error('S3 upload timed out');
          err.code = 'S3_UPLOAD_TIMEOUT';
          reject(err);
        }, uploadTimeoutMs);
      });

      let data;
      try {
        // Some runtime/SDK combinations (notably Bun) may not reliably honor abortSignal.
        // Promise.race ensures we still return control to the caller.
        data = await Promise.race([
          s3Client.send(command, { abortSignal: abortController.signal }),
          timeoutPromise
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      // AWS SDK v3 doesn't return Location, so construct it manually
      const region = process.env.AWS_REGION || "us-east-1";
      const location = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

      // Add metadata to response
      data.Location = location;
      data.key = key;
      data.bucket = bucketName;
      data.isProtected = isProtected;
      data.bucketType = isProtected ? 'protected' : 'public';

      backendLogger.info('S3 upload successful', { location, key, bucket: bucketName, isProtected });
      return data;
    } catch (err) {
      backendLogger.error('S3 upload error', { error: err.message, key, bucket: bucketName, isProtected });
      throw err;
    }
  })();
};

/**
 * Delete a file from S3 bucket
 * @param {string} fileUrl - The full S3 URL or just the key
 * @param {Object} options - Delete options
 * @param {boolean} options.protected - If true, delete from protected bucket (default: false)
 * @param {string} options.bucket - Explicit bucket name (overrides protected flag)
 * @returns {Promise} Resolves when file is deleted
 */
const s3Delete = function (fileUrl, options = {}) {
  const { protected: isProtected = false, bucket: explicitBucket } = options;

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw new Error('Invalid file URL');
  }

  // Determine which bucket to use
  let bucketName = explicitBucket || (isProtected ? PROTECTED_BUCKET : PUBLIC_BUCKET);

  // Extract the key from the full URL if needed
  // URL format: https://<bucket>.s3.<region>.amazonaws.com/<key>
  // or: https://s3.<region>.amazonaws.com/<bucket>/<key>
  let key = fileUrl;

  try {
    const url = new URL(fileUrl);
    const pathname = url.pathname;

    // Remove leading slash and bucket name if present
    key = pathname.startsWith('/') ? pathname.substring(1) : pathname;

    // Try to detect bucket from URL hostname if not explicitly provided
    if (!explicitBucket) {
      const hostname = url.hostname;
      // Format: bucket-name.s3.region.amazonaws.com
      if (hostname.endsWith('.amazonaws.com')) {
        const possibleBucket = hostname.split('.s3.')[0];
        if (possibleBucket && possibleBucket !== hostname) {
          bucketName = possibleBucket;
        }
      }
    }

    // If the bucket name is in the path, remove it
    if (key.startsWith(`${bucketName}/`)) {
      key = key.substring(bucketName.length + 1);
    }
  } catch (err) {
    // If it's not a valid URL, assume it's already just the key
    backendLogger.debug('Using fileUrl as key directly', { fileUrl });
  }

  backendLogger.debug('Deleting from S3', { bucket: bucketName, key, isProtected });

  const params = {
    Bucket: bucketName,
    Key: key,
  };

  // Use async/await with v3 SDK
  return (async () => {
    try {
      const command = new DeleteObjectCommand(params);
      const data = await s3Client.send(command);
      backendLogger.info('S3 delete successful', { bucket: bucketName, key });
      return data;
    } catch (err) {
      backendLogger.error('S3 delete error', { error: err.message, key: params.Key, bucket: params.Bucket });
      throw err;
    }
  })();
};

/**
 * Get a signed URL for accessing a protected S3 object
 * @param {string} key - The S3 object key
 * @param {Object} options - Options for signed URL
 * @param {boolean} options.protected - If true, use protected bucket (default: true)
 * @param {string} options.bucket - Explicit bucket name (overrides protected flag)
 * @param {number} options.expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Signed URL for accessing the object
 */
const s3GetSignedUrl = async function (key, options = {}) {
  const {
    protected: isProtected = true,
    bucket: explicitBucket,
    expiresIn = 3600
  } = options;

  if (!key || typeof key !== 'string') {
    throw new Error('Invalid S3 key');
  }

  // Determine which bucket to use
  const bucketName = explicitBucket || (isProtected ? PROTECTED_BUCKET : PUBLIC_BUCKET);

  if (!bucketName) {
    throw new Error('Bucket not configured. Check S3_PROTECTED_BUCKET_NAME or BUCKET_NAME environment variables.');
  }

  backendLogger.debug('Generating signed URL', { bucket: bucketName, key, expiresIn });

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    backendLogger.info('Signed URL generated', { bucket: bucketName, key, expiresIn });
    return signedUrl;
  } catch (err) {
    backendLogger.error('Error generating signed URL', { error: err.message, key, bucket: bucketName });
    throw err;
  }
};

/**
 * Download a file from S3 bucket (retrieves the object content)
 * Use this for server-side processing of protected files
 * @param {string} key - The S3 object key
 * @param {Object} options - Download options
 * @param {boolean} options.protected - If true, download from protected bucket (default: true)
 * @param {string} options.bucket - Explicit bucket name (overrides protected flag)
 * @returns {Promise<Object>} Object with body (readable stream), contentType, contentLength, metadata
 */
const s3Download = async function (key, options = {}) {
  const {
    protected: isProtected = true,
    bucket: explicitBucket
  } = options;

  if (!key || typeof key !== 'string') {
    throw new Error('Invalid S3 key');
  }

  // Determine which bucket to use
  const bucketName = explicitBucket || (isProtected ? PROTECTED_BUCKET : PUBLIC_BUCKET);

  if (!bucketName) {
    throw new Error('Bucket not configured. Check S3_PROTECTED_BUCKET_NAME or BUCKET_NAME environment variables.');
  }

  backendLogger.debug('Downloading from S3', { bucket: bucketName, key, isProtected });

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    const response = await s3Client.send(command);

    backendLogger.info('S3 download successful', { bucket: bucketName, key, contentLength: response.ContentLength });

    return {
      body: response.Body,                    // Readable stream
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      etag: response.ETag,
      metadata: response.Metadata || {},
      bucket: bucketName,
      key: key,
      isProtected
    };
  } catch (err) {
    backendLogger.error('S3 download error', { error: err.message, key, bucket: bucketName });
    throw err;
  }
};

/**
 * Download a file from S3 and convert to Buffer
 * Useful for processing file contents in memory
 * @param {string} key - The S3 object key
 * @param {Object} options - Download options (same as s3Download)
 * @returns {Promise<Object>} Object with buffer, contentType, contentLength, metadata
 */
const s3DownloadBuffer = async function (key, options = {}) {
  const downloadResult = await s3Download(key, options);

  // Convert stream to buffer
  const chunks = [];
  for await (const chunk of downloadResult.body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  return {
    buffer,
    contentType: downloadResult.contentType,
    contentLength: downloadResult.contentLength,
    lastModified: downloadResult.lastModified,
    etag: downloadResult.etag,
    metadata: downloadResult.metadata,
    bucket: downloadResult.bucket,
    key: downloadResult.key,
    isProtected: downloadResult.isProtected
  };
};

/**
 * Get bucket configuration
 * @returns {Object} Bucket configuration with public and protected bucket names
 */
const getBucketConfig = function () {
  return {
    publicBucket: PUBLIC_BUCKET,
    protectedBucket: PROTECTED_BUCKET,
    hasProtectedBucket: !!PROTECTED_BUCKET,
  };
};

module.exports = {
  s3Upload,
  s3Delete,
  s3GetSignedUrl,
  s3Download,
  s3DownloadBuffer,
  getBucketConfig,
  // Security functions exported for testing
  resolveAndValidateLocalUploadPath,
  secureReadFile,
  secureCreateReadStream
};
