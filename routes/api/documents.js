/**
 * Document Routes
 * Handles document upload, retrieval, reprocessing, and deletion
 *
 * Supported file types:
 * - PDF: application/pdf (max 50MB)
 * - Images: image/jpeg, image/png, image/gif, image/webp, image/tiff (max 10MB)
 * - Word: application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document (max 25MB)
 * - Text: text/plain, text/csv, text/markdown (max 5MB)
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const documentsCtrl = require('../../controllers/api/documents');
const ensureLoggedIn = require('../../config/ensureLoggedIn');

// Ensure upload directories exist
const UPLOAD_DIR = path.join(__dirname, '../../uploads/documents');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer configuration for document uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const sanitizedName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    cb(null, `${timestamp}-${random}-${sanitizedName}${ext}`);
  }
});

// File filter to validate mime types
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // PDF
    'application/pdf',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Text
    'text/plain',
    'text/csv',
    'text/markdown'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// Configure multer with storage, file filter, and size limits
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (highest limit, individual types checked in controller)
    files: 1 // Single file upload only
  }
});

// Error handling middleware for multer errors
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only single file upload is supported.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
};

/**
 * @route   GET /api/documents/supported-types
 * @desc    Get supported document types and size limits
 * @access  Public
 */
router.get('/supported-types', documentsCtrl.getSupportedTypes);

/**
 * @route   POST /api/documents
 * @desc    Upload and process a document
 * @access  Private
 * @body    {
 *            entityType: 'plan' | 'plan_item' | 'experience' | 'destination',
 *            entityId: ObjectId,
 *            planId?: ObjectId (required for plan_item),
 *            planItemId?: ObjectId (optional for plan_item),
 *            aiParsingEnabled?: boolean (default: true),
 *            documentTypeHint?: 'flight' | 'hotel' | 'activity' | 'restaurant' | 'transport' | 'travel',
 *            language?: string (default: 'eng'),
 *            forceLLM?: boolean,
 *            skipLLMFallback?: boolean
 *          }
 */
router.post('/',
  ensureLoggedIn,
  upload.single('document'),
  handleMulterError,
  documentsCtrl.upload
);

/**
 * @route   GET /api/documents/:id
 * @desc    Get a document by ID
 * @access  Private (owner, collaborator, or entity access)
 */
router.get('/:id', ensureLoggedIn, documentsCtrl.get);

/**
 * @route   GET /api/documents/entity/:entityType/:entityId
 * @desc    Get all documents for an entity
 * @access  Private (entity access required)
 */
router.get('/entity/:entityType/:entityId', ensureLoggedIn, documentsCtrl.getByEntity);

/**
 * @route   POST /api/documents/:id/reprocess
 * @desc    Reprocess a document (re-extract text and/or re-parse with AI)
 * @access  Private (owner, collaborator, or entity access)
 * @body    {
 *            language?: string,
 *            forceLLM?: boolean,
 *            skipLLMFallback?: boolean,
 *            documentTypeHint?: string
 *          }
 */
router.post('/:id/reprocess', ensureLoggedIn, documentsCtrl.reprocess);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete a document (from S3 and database)
 * @access  Private (owner only)
 */
router.delete('/:id', ensureLoggedIn, documentsCtrl.delete);

module.exports = router;
