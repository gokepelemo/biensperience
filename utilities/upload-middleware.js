/**
 * Shared Multer Middleware Factory
 *
 * Consolidates multer configuration across route files into a single factory.
 * Supports both simple dest-based and custom diskStorage configurations.
 *
 * @module utilities/upload-middleware
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Create a configured multer upload middleware.
 *
 * @param {Object} options
 * @param {string} options.dest - Upload destination directory (relative to project root or absolute)
 * @param {number} [options.maxSize] - Max file size in bytes
 * @param {string[]} [options.allowedTypes] - Array of allowed MIME types
 * @param {number} [options.maxFiles=1] - Max number of files
 * @param {boolean} [options.customFilename=false] - Use diskStorage with timestamp-based filenames
 * @returns {{ upload: multer.Multer, handleError: Function }}
 */
function createUploadMiddleware(options) {
  const {
    dest,
    maxSize,
    allowedTypes,
    maxFiles = 1,
    customFilename = false
  } = options;

  // Resolve destination path
  const resolvedDest = path.isAbsolute(dest)
    ? dest
    : path.join(__dirname, '..', dest);

  // Ensure upload directory exists
  if (!fs.existsSync(resolvedDest)) {
    fs.mkdirSync(resolvedDest, { recursive: true });
  }

  // Build multer options
  const multerOptions = { limits: {} };

  if (customFilename) {
    multerOptions.storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, resolvedDest);
      },
      filename: function (req, file, cb) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(file.originalname);
        const sanitizedName = path.basename(file.originalname, ext)
          .replace(/[^a-zA-Z0-9-_]/g, '_')
          .substring(0, 50);
        cb(null, `${timestamp}-${random}-${sanitizedName}${ext}`);
      }
    });
  } else {
    multerOptions.dest = resolvedDest;
  }

  if (allowedTypes && allowedTypes.length > 0) {
    multerOptions.fileFilter = (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
      }
    };
  }

  if (maxSize) {
    multerOptions.limits.fileSize = maxSize;
  }

  if (maxFiles) {
    multerOptions.limits.files = maxFiles;
  }

  const upload = multer(multerOptions);

  /**
   * Express error-handling middleware for multer errors.
   * Use after upload middleware: router.post('/', upload.single('file'), handleError, ctrl.action)
   */
  const handleError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const sizeMB = maxSize ? Math.round(maxSize / (1024 * 1024)) : '?';
        return res.status(400).json({ error: `File too large. Maximum size is ${sizeMB}MB.` });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `Too many files. Maximum is ${maxFiles}.` });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }

    if (err) {
      return res.status(400).json({ error: err.message });
    }

    next();
  };

  return { upload, handleError };
}

module.exports = { createUploadMiddleware };
