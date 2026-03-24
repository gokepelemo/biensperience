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
const { createUploadMiddleware } = require('../../utilities/upload-middleware');
const documentsCtrl = require('../../controllers/api/documents');
const ensureLoggedIn = require('../../config/ensureLoggedIn');

const { upload, handleError: handleMulterError } = createUploadMiddleware({
  dest: 'uploads/documents',
  maxSize: 50 * 1024 * 1024, // 50MB max (highest limit, individual types checked in controller)
  allowedTypes: [
    // PDF
    'application/pdf',
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Text
    'text/plain', 'text/csv', 'text/markdown'
  ],
  customFilename: true
});

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
 * @desc    Soft delete a document (disables it, keeps in S3)
 * @access  Private (owner only)
 */
router.delete('/:id', ensureLoggedIn, documentsCtrl.delete);

/**
 * @route   DELETE /api/documents/:id/permanent
 * @desc    Permanently delete a document (removes from S3 and database)
 * @access  Private (super admin only)
 */
router.delete('/:id/permanent', ensureLoggedIn, documentsCtrl.permanentDelete);

/**
 * @route   POST /api/documents/:id/restore
 * @desc    Restore a disabled document
 * @access  Private (super admin only)
 */
router.post('/:id/restore', ensureLoggedIn, documentsCtrl.restore);

/**
 * @route   PATCH /api/documents/:id/visibility
 * @desc    Update document visibility (collaborators or private)
 * @access  Private (owner only)
 * @body    { visibility: 'collaborators' | 'private' }
 */
router.patch('/:id/visibility', ensureLoggedIn, documentsCtrl.updateVisibility);

/**
 * @route   GET /api/documents/:id/preview
 * @desc    Get a signed URL for document preview/download
 * @access  Private (owner, collaborator, or entity access)
 * @returns { url: string, filename: string, mimeType: string, expiresIn: number }
 */
router.get('/:id/preview', ensureLoggedIn, documentsCtrl.getPreviewUrl);

module.exports = router;
