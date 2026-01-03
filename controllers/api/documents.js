/**
 * Document Controller
 * Handles document upload, processing, retrieval, and deletion
 *
 * Workflow:
 * 1. Upload: File received → stored locally → processed → uploaded to S3 → DB record created → local file deleted
 * 2. Retrieve: Fetch from DB (includes S3 URL for download)
 * 3. Reprocess: Download from S3 → process locally → update DB → delete local
 * 4. Delete: Remove from S3 → Remove from DB
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const slugify = require('slugify');
const mime = require('mime-types');
const sanitizeFileName = require('../../uploads/sanitize-filename');

const Document = require('../../models/document');
const Plan = require('../../models/plan');
const User = require('../../models/user');
const { s3Upload, s3Delete, s3GetSignedUrl } = require('../../uploads/aws-s3');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const { isOwner, isCollaborator } = require('../../utilities/permissions');
const { broadcastEvent } = require('../../utilities/websocket-server');
const backendLogger = require('../../utilities/backend-logger');
const {
  validateDocument,
  extractText,
  parseWithAI,
  SUPPORTED_DOCUMENT_TYPES,
  MAX_FILE_SIZES
} = require('../../utilities/ai-document-utils');

// Temporary directory for processing
const TEMP_DIR = path.resolve(__dirname, '../../uploads/temp');
// Upload directory for incoming documents (matches multer config in routes/api/documents.js)
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/documents');

// Ensure directories exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed directories for file operations
const ALLOWED_DIRS = [
  path.resolve(TEMP_DIR),
  path.resolve(UPLOAD_DIR)
];

/**
 * Sanitize file path to prevent path traversal attacks
 * Only allows paths within the uploads/temp or uploads/documents directories
 * Uses path.join with relative path extraction to ensure path is within allowed directory
 * @param {string} filePath - Path to validate
 * @returns {string} Sanitized absolute path
 * @throws {Error} If path is invalid or outside allowed directory
 */
function sanitizeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }

  // Check for null bytes - immediate rejection
  if (filePath.includes('\0')) {
    backendLogger.warn('[Document] Null byte in path blocked', { path: filePath });
    throw new Error('Invalid file path: null bytes not allowed');
  }

  // Normalize and resolve to absolute path
  const normalizedPath = path.normalize(filePath);
  const absolutePath = path.resolve(normalizedPath);

  // Find which allowed directory this path belongs to
  let matchedDir = null;
  for (const allowedDir of ALLOWED_DIRS) {
    if (absolutePath === allowedDir || absolutePath.startsWith(allowedDir + path.sep)) {
      matchedDir = allowedDir;
      break;
    }
  }

  if (!matchedDir) {
    backendLogger.warn('[Document] Access outside allowed directories blocked', {
      requestedPath: filePath,
      resolvedPath: absolutePath,
      allowedDirs: ALLOWED_DIRS
    });
    throw new Error('Invalid file path: access denied');
  }

  // Double-check: extract relative path from base and reconstruct
  // This ensures no traversal sequences remain after normalization
  const relativePath = path.relative(matchedDir, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    backendLogger.warn('[Document] Path traversal attempt blocked', {
      path: filePath,
      relativePath
    });
    throw new Error('Invalid file path: path traversal not allowed');
  }

  // Reconstruct the safe absolute path from base + relative
  const safePath = path.join(matchedDir, relativePath);

  // Final validation: ensure reconstructed path matches original resolution
  if (safePath !== absolutePath) {
    throw new Error('Invalid file path: path validation failed');
  }

  return safePath;
}

/**
 * Sanitize MongoDB ObjectId to prevent injection
 * @param {string} id - The ID to validate
 * @returns {mongoose.Types.ObjectId} Valid ObjectId
 * @throws {Error} If ID is invalid
 */
function sanitizeObjectId(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid ID: must be a string');
  }

  // Strict ObjectId validation - only hex characters, exactly 24 chars
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new Error('Invalid ID format');
  }

  return new mongoose.Types.ObjectId(id);
}

/**
 * Upload and process a document
 * POST /api/documents
 */
async function uploadDocument(req, res) {
  let localFilePath = null;

  try {
    // Validate request
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { entityType, entityId, planId, planItemId, aiParsingEnabled = true, documentTypeHint, visibility = 'collaborators' } = req.body;

    // Validate entity type
    if (!entityType || !['plan', 'plan_item', 'experience', 'destination'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entityType. Must be: plan, plan_item, experience, or destination' });
    }

    if (!entityId || !mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({ error: 'Invalid entityId' });
    }

    // For plan_item, planId is required
    if (entityType === 'plan_item' && (!planId || !mongoose.Types.ObjectId.isValid(planId))) {
      return res.status(400).json({ error: 'planId is required for plan_item documents' });
    }

    // Validate document type and size
    const validation = validateDocument(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Sanitize file path to prevent path traversal
    try {
      localFilePath = sanitizeFilePath(req.file.path);
    } catch (pathError) {
      backendLogger.error('[Document] Invalid file path', { error: pathError.message });
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Verify user has access to the entity
    const hasAccess = await verifyEntityAccess(req.user._id, entityType, entityId, planId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this entity' });
    }

    backendLogger.info('[Document] Starting upload', {
      userId: req.user._id,
      entityType,
      entityId,
      filename: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });

    // Step 1: Extract text from the document locally
    let extractedText = '';
    let processingResult = null;

    const ALLOWED_PROCESSING_METHODS = new Set([
      'tesseract-ocr',
      'llm-vision',
      'pdf-parse',
      'mammoth',
      'direct-read',
      'placeholder',
      'failed'
    ]);

    try {
      const extractionResult = await extractText(localFilePath, req.file.mimetype, {
        language: req.body.language || 'eng',
        forceLLM: req.body.forceLLM === 'true',
        skipLLMFallback: req.body.skipLLMFallback === 'true'
      });

      extractedText = extractionResult.text || '';
      processingResult = {
        method: extractionResult.metadata.method,
        confidence: extractionResult.metadata.confidence,
        characterCount: extractionResult.metadata.characterCount || extractedText.length,
        pageCount: extractionResult.metadata.pages,
        language: extractionResult.metadata.language,
        model: extractionResult.metadata.model,
        usage: extractionResult.metadata.usage,
        processedAt: new Date(),
        warning: extractionResult.metadata.warning
      };

      if (processingResult.method && !ALLOWED_PROCESSING_METHODS.has(processingResult.method)) {
        const originalMethod = processingResult.method;
        processingResult.method = 'failed';
        processingResult.error = processingResult.error || `Unsupported processing method: ${originalMethod}`;
        processingResult.warning = processingResult.warning
          ? `${processingResult.warning}; normalized unsupported method: ${originalMethod}`
          : `Normalized unsupported method: ${originalMethod}`;
      }

      backendLogger.debug('[Document] Text extracted', {
        method: processingResult.method,
        textLength: extractedText.length
      });
    } catch (extractError) {
      backendLogger.error('[Document] Text extraction failed', {
        error: extractError.message,
        filename: req.file.originalname
      });
      processingResult = {
        method: 'failed',
        error: extractError.message,
        processedAt: new Date()
      };
    }

    // Step 2: AI parsing (if enabled and text was extracted)
    let aiParsedData = null;
    if (aiParsingEnabled !== 'false' && extractedText.length > 0) {
      try {
        const parseResult = await parseWithAI(extractedText, documentTypeHint || 'travel', {
          model: req.body.aiModel
        });

        if (parseResult.parsed && parseResult.data) {
          aiParsedData = {
            ...parseResult.data,
            rawAiResponse: parseResult.aiResponse
          };
          processingResult.model = parseResult.model;

          backendLogger.debug('[Document] AI parsing complete', {
            documentType: aiParsedData.documentType,
            parsed: true
          });
        }
      } catch (parseError) {
        backendLogger.error('[Document] AI parsing failed', {
          error: parseError.message
        });
        // Continue without AI parsing - it's not critical
      }
    }

    // Step 3: Upload to S3 protected bucket
    // All plan item documents are stored in the protected bucket for security
    // S3 prefix based on document type:
    // - documents/ for PDF, Word, Text files
    // - images/ for images uploaded as documents for processing
    const timestamp = Date.now();
    // NOTE: s3Upload() appends the extension derived from the MIME type.
    // If we include the extension in `newName`, we end up with keys like
    // `.../file.pdf.pdf` and then mistakenly store a mismatched `s3Key`.
    // So we pass a basename WITHOUT extension and then persist the actual
    // key returned by s3Upload().
    const originalExt = path.extname(req.file.originalname);
    const originalBase = path.basename(req.file.originalname, originalExt);
    const sanitizedBase = String(originalBase).replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Prefix = validation.type === 'image' ? 'images' : 'documents';
    const s3KeyBase = `${s3Prefix}/${req.user._id}/${timestamp}-${sanitizedBase}`;

    // Upload to protected bucket - documents require signed URLs to access
    const uploadResult = await s3Upload(localFilePath, req.file.originalname, s3KeyBase, { protected: true });
    const s3Key = uploadResult.key;
    const s3Url = uploadResult.Location;

    backendLogger.info('[Document] Uploaded to S3', { s3Url, s3Key });

    // Step 4: Create database record
    const document = await Document.create({
      user: req.user._id,
      entityType,
      entityId,
      planId: entityType === 'plan_item' ? planId : (entityType === 'plan' ? entityId : undefined),
      planItemId: entityType === 'plan_item' ? planItemId : undefined,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      documentType: validation.type,
      s3Key,
      s3Url,
      s3Bucket: uploadResult.bucket,
      isProtected: true,
      bucketType: 'protected',
      status: processingResult.method === 'failed' ? 'failed' : 'completed',
      extractedText,
      processingResult,
      aiParsedData,
      aiParsingEnabled: aiParsingEnabled !== 'false',
      visibility: ['collaborators', 'private'].includes(visibility) ? visibility : 'collaborators',
      permissions: [{
        _id: req.user._id,
        entity: 'user',
        type: 'owner',
        granted_by: req.user._id
      }],
      processingOptions: {
        language: req.body.language || 'eng',
        forceLLM: req.body.forceLLM === 'true',
        skipLLMFallback: req.body.skipLLMFallback === 'true',
        documentTypeHint
      },
      lastProcessedAt: new Date(),
      processAttempts: 1
    });

    backendLogger.info('[Document] Record created', {
      documentId: document._id,
      status: document.status
    });

    // Step 5: Delete local file
    try {
      await fs.promises.unlink(localFilePath);
      localFilePath = null;
      backendLogger.debug('[Document] Local file cleaned up');
    } catch (unlinkError) {
      backendLogger.warn('[Document] Failed to delete local file', {
        error: unlinkError.message,
        path: localFilePath
      });
    }

    // Broadcast document:created event to relevant room
    try {
      const roomType = entityType === 'plan' || entityType === 'plan_item' ? 'plan' : entityType;
      const roomId = entityType === 'plan_item' ? planId : entityId;
      broadcastEvent(roomType, roomId.toString(), {
        type: 'document:created',
        payload: { document: document.toObject() }
      });
    } catch (err) {
      backendLogger.error('Failed to broadcast document:created event', { error: err.message, documentId: document._id });
    }
    
    // Return the document
    res.status(201).json({
      success: true,
      document: document.toObject()
    });

  } catch (error) {
    backendLogger.error('[Document] Upload failed', {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id
    });

    // Cleanup local file on error
    if (localFilePath) {
      try {
        await fs.promises.unlink(localFilePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    res.status(500).json({ error: 'Failed to upload document', details: error.message });
  }
}

/**
 * Get a document by ID
 * GET /api/documents/:id
 */
async function getDocument(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const document = await Document.findById(req.params.id)
      .populate('user', 'name email')
      .lean();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const hasAccess = await canAccessDocument(req.user._id, document);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this document' });
    }

    res.json({ document });
  } catch (error) {
    backendLogger.error('[Document] Get failed', { error: error.message, documentId: req.params.id });
    res.status(500).json({ error: 'Failed to get document' });
  }
}

/**
 * Get documents for an entity
 * GET /api/documents/entity/:entityType/:entityId
 * Query params:
 *   - planId: Plan ID (required for plan_item entity type)
 *   - includeDisabled: Include disabled documents (super admin only)
 *   - page: Page number (1-based, default: 1)
 *   - limit: Documents per page (default: 10, max: 50)
 */
async function getDocumentsByEntity(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const { planId, includeDisabled, page = 1, limit = 10 } = req.query;

    if (!['plan', 'plan_item', 'experience', 'destination'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({ error: 'Invalid entity ID' });
    }

    // Validate planId if provided
    if (planId && !mongoose.Types.ObjectId.isValid(planId)) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Verify access to entity (pass planId for plan_item access checks)
    const hasAccess = await verifyEntityAccess(req.user._id, entityType, entityId, planId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this entity' });
    }

    // Parse pagination params
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Determine if user is super admin
    const isSuperAdmin = req.user.role === 'super_admin';

    // Build query: show all documents visible to collaborators, plus user's private documents
    const query = {
      entityType,
      entityId,
      $or: [
        { visibility: 'collaborators' },
        { visibility: 'private', user: req.user._id }
      ]
    };

    // Only include disabled documents if super admin AND explicitly requested
    if (!isSuperAdmin || includeDisabled !== 'true') {
      query.isDisabled = { $ne: true };
    }

    // Count total for pagination
    const total = await Document.countDocuments(query);

    const documents = await Document.find(query)
      .populate('user', 'name email')
      .populate('disabledBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.json({
      documents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + documents.length < total
      }
    });
  } catch (error) {
    backendLogger.error('[Document] Get by entity failed', {
      error: error.message,
      entityType: req.params.entityType,
      entityId: req.params.entityId
    });
    res.status(500).json({ error: 'Failed to get documents' });
  }
}

/**
 * Reprocess a document (download from S3, re-extract, update DB)
 * POST /api/documents/:id/reprocess
 */
async function reprocessDocument(req, res) {
  let localFilePath = null;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access
    const hasAccess = await canAccessDocument(req.user._id, document);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this document' });
    }

    // Check if can reprocess
    if (!document.canReprocess) {
      return res.status(400).json({
        error: 'Document cannot be reprocessed',
        reason: document.processAttempts >= document.maxProcessAttempts
          ? 'Maximum processing attempts reached'
          : 'Document is currently being processed'
      });
    }

    backendLogger.info('[Document] Starting reprocess', {
      documentId: document._id,
      attempt: document.processAttempts + 1
    });

    // Update options if provided
    const options = {
      language: req.body.language || document.processingOptions.language,
      forceLLM: req.body.forceLLM !== undefined ? req.body.forceLLM : document.processingOptions.forceLLM,
      skipLLMFallback: req.body.skipLLMFallback !== undefined ? req.body.skipLLMFallback : document.processingOptions.skipLLMFallback,
      documentTypeHint: req.body.documentTypeHint || document.processingOptions.documentTypeHint
    };

    // Mark as reprocessing
    await document.queueReprocess(options);

    // Download from S3
    localFilePath = await downloadFromS3(document.s3Url, document.originalFilename);

    backendLogger.debug('[Document] Downloaded from S3 for reprocessing', { localFilePath });

    // Re-extract text
    let extractedText = '';
    let processingResult = null;

    try {
      const extractionResult = await extractText(localFilePath, document.mimeType, options);

      extractedText = extractionResult.text || '';
      processingResult = {
        method: extractionResult.metadata.method,
        confidence: extractionResult.metadata.confidence,
        characterCount: extractionResult.metadata.characterCount || extractedText.length,
        pageCount: extractionResult.metadata.pages,
        language: extractionResult.metadata.language,
        model: extractionResult.metadata.model,
        usage: extractionResult.metadata.usage,
        processedAt: new Date(),
        warning: extractionResult.metadata.warning
      };
    } catch (extractError) {
      backendLogger.error('[Document] Reprocess extraction failed', { error: extractError.message });
      await document.markFailed(extractError);
      throw extractError;
    }

    // Re-parse with AI if enabled
    let aiParsedData = null;
    if (document.aiParsingEnabled && extractedText.length > 0) {
      try {
        const parseResult = await parseWithAI(extractedText, options.documentTypeHint || 'travel');

        if (parseResult.parsed && parseResult.data) {
          aiParsedData = {
            ...parseResult.data,
            rawAiResponse: parseResult.aiResponse
          };
          processingResult.model = parseResult.model;
        }
      } catch (parseError) {
        backendLogger.warn('[Document] Reprocess AI parsing failed', { error: parseError.message });
      }
    }

    // Update document
    await document.markCompleted(extractedText, processingResult, aiParsedData);

    backendLogger.info('[Document] Reprocess complete', {
      documentId: document._id,
      status: document.status
    });

    // Cleanup
    try {
      await fs.promises.unlink(localFilePath);
    } catch (e) {
      // Ignore
    }

    res.json({
      success: true,
      document: document.toObject()
    });

  } catch (error) {
    backendLogger.error('[Document] Reprocess failed', {
      error: error.message,
      documentId: req.params.id
    });

    if (localFilePath) {
      try {
        await fs.promises.unlink(localFilePath);
      } catch (e) {
        // Ignore
      }
    }

    res.status(500).json({ error: 'Failed to reprocess document', details: error.message });
  }
}

/**
 * Delete a document (soft delete - disables the document)
 * DELETE /api/documents/:id
 * 
 * This performs a soft delete by setting isDisabled=true.
 * The document remains in S3 and can be restored by a super admin.
 * Use permanentDelete for actual S3 and DB deletion (super admin only).
 */
async function deleteDocument(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only owner can delete
    if (!isOwner(req.user._id, document)) {
      return res.status(403).json({ error: 'Only the owner can delete this document' });
    }

    // Check if already disabled
    if (document.isDisabled) {
      return res.status(400).json({ error: 'Document is already disabled' });
    }

    backendLogger.info('[Document] Soft deleting (disabling)', {
      documentId: document._id,
      userId: req.user._id
    });

    // Soft delete - disable the document
    await document.disable(req.user._id, req.body.reason || 'Deleted by user');

    // Broadcast document:deleted event to relevant room
    const documentId = document._id.toString();
    const entityType = document.entityType;
    const entityId = document.entityId.toString();
    const planId = document.planId ? document.planId.toString() : null;

    try {
      const roomType = entityType === 'plan' || entityType === 'plan_item' ? 'plan' : entityType;
      const roomId = entityType === 'plan_item' ? planId : entityId;
      broadcastEvent(roomType, roomId, {
        type: 'document:deleted',
        payload: { documentId, entityType, entityId, isDisabled: true }
      });
    } catch (err) {
      backendLogger.error('Failed to broadcast document:deleted event', { error: err.message, documentId });
    }

    res.json({ success: true, message: 'Document disabled successfully' });

  } catch (error) {
    backendLogger.error('[Document] Delete (soft) failed', {
      error: error.message,
      documentId: req.params.id
    });
    res.status(500).json({ error: 'Failed to delete document' });
  }
}

/**
 * Permanently delete a document (super admin only)
 * DELETE /api/documents/:id/permanent
 * 
 * This permanently removes the document from S3 and database.
 * Only super admins can perform this action.
 */
async function permanentDeleteDocument(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Only super admin can permanently delete
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can permanently delete documents' });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    backendLogger.info('[Document] Permanently deleting', {
      documentId: document._id,
      s3Key: document.s3Key,
      adminUserId: req.user._id
    });

    // Delete from S3
    try {
      await s3Delete(document.s3Url);
      backendLogger.debug('[Document] Deleted from S3');
    } catch (s3Error) {
      backendLogger.error('[Document] S3 delete failed', { error: s3Error.message });
      // Continue with DB deletion
    }

    // Delete from database
    const documentId = document._id.toString();
    const entityType = document.entityType;
    const entityId = document.entityId.toString();
    const planId = document.planId ? document.planId.toString() : null;
    
    await document.deleteOne();
    
    // Broadcast document:permanentlyDeleted event
    try {
      const roomType = entityType === 'plan' || entityType === 'plan_item' ? 'plan' : entityType;
      const roomId = entityType === 'plan_item' ? planId : entityId;
      broadcastEvent(roomType, roomId, {
        type: 'document:permanentlyDeleted',
        payload: { documentId, entityType, entityId }
      });
    } catch (err) {
      backendLogger.error('Failed to broadcast document:permanentlyDeleted event', { error: err.message, documentId });
    }

    res.json({ success: true, message: 'Document permanently deleted' });

  } catch (error) {
    backendLogger.error('[Document] Permanent delete failed', {
      error: error.message,
      documentId: req.params.id
    });
    res.status(500).json({ error: 'Failed to permanently delete document' });
  }
}

/**
 * Restore a disabled document (super admin only)
 * POST /api/documents/:id/restore
 */
async function restoreDocument(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Only super admin can restore
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admins can restore documents' });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.isDisabled) {
      return res.status(400).json({ error: 'Document is not disabled' });
    }

    backendLogger.info('[Document] Restoring disabled document', {
      documentId: document._id,
      adminUserId: req.user._id
    });

    // Restore the document
    await document.restore();

    // Broadcast document:restored event
    const entityType = document.entityType;
    const entityId = document.entityId.toString();
    const planId = document.planId ? document.planId.toString() : null;

    try {
      const roomType = entityType === 'plan' || entityType === 'plan_item' ? 'plan' : entityType;
      const roomId = entityType === 'plan_item' ? planId : entityId;
      broadcastEvent(roomType, roomId, {
        type: 'document:restored',
        payload: { document: document.toObject() }
      });
    } catch (err) {
      backendLogger.error('Failed to broadcast document:restored event', { error: err.message, documentId: document._id });
    }

    res.json({ success: true, document: document.toObject() });

  } catch (error) {
    backendLogger.error('[Document] Restore failed', {
      error: error.message,
      documentId: req.params.id
    });
    res.status(500).json({ error: 'Failed to restore document' });
  }
}

/**
 * Get supported document types (for frontend validation)
 * GET /api/documents/supported-types
 */
async function getSupportedTypes(req, res) {
  res.json({
    types: SUPPORTED_DOCUMENT_TYPES,
    maxSizes: MAX_FILE_SIZES,
    accept: Object.values(SUPPORTED_DOCUMENT_TYPES).flat().join(',')
  });
}

/**
 * Update document visibility
 * PATCH /api/documents/:id/visibility
 */
async function updateVisibility(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const { visibility } = req.body;

    if (!visibility || !['collaborators', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility. Must be: collaborators or private' });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Only owner can change visibility
    if (!isOwner(req.user._id, document)) {
      return res.status(403).json({ error: 'Only the owner can change document visibility' });
    }

    document.visibility = visibility;
    await document.save();

    backendLogger.info('[Document] Visibility updated', {
      documentId: document._id,
      visibility,
      userId: req.user._id
    });

    // Broadcast document:updated event
    try {
      const roomType = document.entityType === 'plan' || document.entityType === 'plan_item' ? 'plan' : document.entityType;
      const roomId = document.entityType === 'plan_item' ? document.planId?.toString() : document.entityId.toString();
      if (roomId) {
        broadcastEvent(roomType, roomId, {
          type: 'document:updated',
          payload: { document: document.toObject() }
        }, req.user._id.toString());
      }
    } catch (err) {
      backendLogger.error('Failed to broadcast document:updated event', { error: err.message, documentId: document._id });
    }

    res.json({ success: true, document: document.toObject() });
  } catch (error) {
    backendLogger.error('[Document] Update visibility failed', {
      error: error.message,
      documentId: req.params.id
    });
    res.status(500).json({ error: 'Failed to update document visibility' });
  }
}

/**
 * Get a signed URL for document preview/download
 * GET /api/documents/:id/preview
 * Returns a temporary signed URL (valid for 1 hour) to access protected documents
 */
async function getDocumentPreviewUrl(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permissions
    const hasAccess = await canAccessDocument(req.user._id, document);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this document' });
    }

    // Check visibility - private documents only accessible by owner
    if (document.visibility === 'private' && !isOwner(req.user._id, document)) {
      return res.status(403).json({ error: 'This document is private' });
    }

    // Generate signed URL for the protected document.
    // URL is valid for 1 hour (3600 seconds).
    // Important: signing does NOT validate object existence. If older records
    // stored a non-normalized key (e.g., uppercase or pre-slugify), S3 will
    // return 404 when the signed URL is used. Normalize to match our uploader.
    let keyToSign = normalizeS3KeyForSigning(document);
    let signedUrl;

    signedUrl = await s3GetSignedUrl(keyToSign, {
      protected: document.isProtected,
      bucket: document.s3Bucket,
      expiresIn: 3600
    });

    // Best-effort repair: persist normalized key so future calls are consistent.
    // This does not change the S3 object; it only aligns DB metadata.
    if (document.s3Key !== keyToSign) {
      try {
        document.s3Key = keyToSign;
        await document.save();
        backendLogger.info('[Document] Normalized stored s3Key for preview', {
          documentId: document._id,
          normalizedKey: keyToSign
        });
      } catch (repairErr) {
        backendLogger.warn('[Document] Failed to persist normalized s3Key', {
          documentId: document._id,
          error: repairErr.message
        });
      }
    }

    backendLogger.info('[Document] Preview URL generated', {
      documentId: document._id,
      userId: req.user._id
    });

    res.json({
      url: signedUrl,
      filename: document.originalFilename,
      mimeType: document.mimeType,
      expiresIn: 3600
    });
  } catch (error) {
    backendLogger.error('[Document] Get preview URL failed', {
      error: error.message,
      documentId: req.params.id
    });
    res.status(500).json({ error: 'Failed to get document preview URL' });
  }
}

/**
 * Normalize a stored S3 key to match the uploader behavior in uploads/aws-s3.js:
 * - preserves directory structure
 * - slugifies the final filename segment with lower-case
 * - ensures a single extension based on the document MIME type / filename
 */
function normalizeS3KeyForSigning(document) {
  const rawKey = document?.s3Key;
  if (!rawKey || typeof rawKey !== 'string') return rawKey;

  const parts = rawKey.split('/').filter(Boolean);
  if (parts.length === 0) return rawKey;

  const last = parts[parts.length - 1];

  const extFromName = document?.originalFilename
    ? path.extname(document.originalFilename).replace('.', '').toLowerCase()
    : '';
  const extFromMime = document?.mimeType ? String(mime.extension(document.mimeType) || '').toLowerCase() : '';
  const ext = extFromName || extFromMime;

  // Strip one or more occurrences of the extension (handles accidental double extensions)
  let base = last;
  if (ext) {
    const suffix = `.${ext}`;
    let baseLower = base.toLowerCase();
    while (base && baseLower.endsWith(suffix) && base.length > suffix.length) {
      base = base.slice(0, -suffix.length);
      baseLower = base.toLowerCase();
    }
  } else {
    // No known extension: remove the last extension-like suffix, if present
    const extGuess = path.extname(base);
    if (extGuess) base = base.slice(0, -extGuess.length);
  }

  const normalizedFileBase = sanitizeFileName(slugify(base, { lower: true }));
  const normalizedLast = ext ? `${normalizedFileBase}.${ext}` : normalizedFileBase;

  parts[parts.length - 1] = normalizedLast;
  return parts.join('/');
}

// ============================================
// Helper Functions
// ============================================

/**
 * Verify user has access to an entity
 */
async function verifyEntityAccess(userId, entityType, entityId, planId = null) {
  try {
    // Sanitize IDs to prevent query injection
    let safeEntityId, safePlanId;
    try {
      safeEntityId = sanitizeObjectId(entityId);
      if (planId) {
        safePlanId = sanitizeObjectId(planId);
      }
    } catch (idError) {
      backendLogger.warn('[Document] Invalid ObjectId in access check', { error: idError.message });
      return false;
    }

    switch (entityType) {
      case 'plan':
      case 'plan_item': {
        const checkPlanId = entityType === 'plan_item' ? safePlanId : safeEntityId;
        if (!checkPlanId) return false;
        const plan = await Plan.findById(checkPlanId);
        if (!plan) return false;

        // Check if user is owner or collaborator
        return isOwner(userId, plan) || isCollaborator(userId, plan);
      }

      case 'experience': {
        const Experience = require('../../models/experience');
        const experience = await Experience.findById(safeEntityId);
        if (!experience) return false;

        return isOwner(userId, experience) || isCollaborator(userId, experience);
      }

      case 'destination': {
        const Destination = require('../../models/destination');
        const destination = await Destination.findById(safeEntityId);
        if (!destination) return false;

        return isOwner(userId, destination) || isCollaborator(userId, destination);
      }

      default:
        return false;
    }
  } catch (error) {
    backendLogger.error('[Document] Entity access check failed', { error: error.message });
    return false;
  }
}

/**
 * Check if user can access a document
 */
async function canAccessDocument(userId, document) {
  // Owner always has access
  if (isOwner(userId, document)) return true;

  // Collaborator on document
  if (isCollaborator(userId, document)) return true;

  // Check entity access
  return verifyEntityAccess(userId, document.entityType, document.entityId, document.planId);
}

/**
 * Download file from S3 URL to local temp directory
 */
async function downloadFromS3(url, originalFilename) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const sanitizedName = path.basename(originalFilename).replace(/[^a-zA-Z0-9.-]/g, '_');
    const localPath = path.join(TEMP_DIR, `${timestamp}-${sanitizedName}`);

    const file = fs.createWriteStream(localPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(localPath, () => {}); // Cleanup
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(localPath);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(localPath, () => {}); // Cleanup
      reject(err);
    });
  });
}

module.exports = {
  upload: uploadDocument,
  get: getDocument,
  getByEntity: getDocumentsByEntity,
  reprocess: reprocessDocument,
  delete: deleteDocument,
  permanentDelete: permanentDeleteDocument,
  restore: restoreDocument,
  getSupportedTypes,
  updateVisibility,
  getPreviewUrl: getDocumentPreviewUrl
};
