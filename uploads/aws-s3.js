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

  // Validate file path to prevent path traversal attacks
  if (!file || typeof file !== 'string') {
    throw new Error('Invalid file path');
  }

  // Check for null bytes - immediate rejection
  if (file.includes('\0')) {
    backendLogger.error('S3 upload blocked: null byte in path', { path: file });
    throw new Error('Invalid file path: null bytes not allowed');
  }

  // Resolve the path and ensure it's within the expected directories.
  // Multer commonly provides absolute paths; those are allowed as long as they
  // resolve inside our uploads directories.
  const resolvedPath = path.resolve(file);

  // Allowed directories for uploads
  const allowedDirs = [
    UPLOADS_ROOT,
    path.resolve(UPLOADS_ROOT, 'documents'),
    path.resolve(UPLOADS_ROOT, 'images'),
    path.resolve(UPLOADS_ROOT, 'temp')
  ];

  // Check if the resolved path is within any allowed directory
  const isAllowed = allowedDirs.some(dir => {
    try {
      const relative = path.relative(dir, resolvedPath);
      // `relative` will start with '..' if resolvedPath is outside `dir`.
      // Also guard against edgecases by ensuring the relative path is not absolute.
      if (relative === '') return true; // exact match
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return true;
      return false;
    } catch (e) {
      return false;
    }
  });

  if (!isAllowed) {
    backendLogger.error('S3 upload path validation failed', { resolvedPath, allowedDirs, originalPath: file });
    throw new Error('Invalid file path: access denied');
  }

  // Additional security: ensure the file actually exists and is a regular file
  try {
    const stats = fs.statSync(resolvedPath);
    if (!stats.isFile()) {
      throw new Error('Path is not a regular file');
    }
    // Check file size is reasonable (prevent huge files)
    if (stats.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error('File too large');
    }
  } catch (statErr) {
    backendLogger.error('File validation failed', { resolvedPath, error: statErr.message });
    throw new Error('Invalid file path - file does not exist or is not accessible');
  }

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

  // Final security check: ensure file path hasn't changed since validation
  const finalResolvedPath = path.resolve(file);
  if (finalResolvedPath !== resolvedPath) {
    backendLogger.error('File path changed during processing', { original: resolvedPath, final: finalResolvedPath });
    throw new Error('File path validation failed');
  }

  // Read file content.
  // Under Bun, Node.js stream compatibility can be imperfect for AWS SDK v3,
  // and we've seen uploads hang indefinitely when using fs.createReadStream().
  // Given our document limits (<= 50MB) and safety checks (<= 100MB), using a
  // Buffer is an acceptable tradeoff for reliability.
  let body;
  try {
    if (typeof Bun !== 'undefined') {
      body = await fs.promises.readFile(finalResolvedPath);
    } else {
      body = fs.createReadStream(finalResolvedPath);
    }
  } catch (readErr) {
    backendLogger.error('Failed to read upload file', { path: finalResolvedPath, error: readErr.message });
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

module.exports = { s3Upload, s3Delete, s3GetSignedUrl, s3Download, s3DownloadBuffer, getBucketConfig };
