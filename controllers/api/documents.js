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

const Document = require('../../models/document');
const Plan = require('../../models/plan');
const User = require('../../models/user');
const { s3Upload, s3Delete } = require('../../uploads/aws-s3');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const { isOwner, isCollaborator } = require('../../utilities/permissions');
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

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Sanitize file path to prevent path traversal attacks
 * Only allows paths within the uploads/temp directory
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

  // Resolve TEMP_DIR to absolute path for comparison
  const resolvedTempDir = path.resolve(TEMP_DIR);

  // Verify path is within TEMP_DIR using secure startsWith check
  if (absolutePath !== resolvedTempDir &&
      !absolutePath.startsWith(resolvedTempDir + path.sep)) {
    backendLogger.warn('[Document] Access outside temp directory blocked', {
      requestedPath: filePath,
      resolvedPath: absolutePath,
      allowedDir: resolvedTempDir
    });
    throw new Error('Invalid file path: access denied');
  }

  // Double-check: extract relative path from base and reconstruct
  // This ensures no traversal sequences remain after normalization
  const relativePath = path.relative(resolvedTempDir, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    backendLogger.warn('[Document] Path traversal attempt blocked', {
      path: filePath,
      relativePath
    });
    throw new Error('Invalid file path: path traversal not allowed');
  }

  // Reconstruct the safe absolute path from base + relative
  const safePath = path.join(resolvedTempDir, relativePath);

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

    const { entityType, entityId, planId, planItemId, aiParsingEnabled = true, documentTypeHint } = req.body;

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

    // Step 3: Upload to S3
    // S3 prefix based on document type:
    // - documents/ for PDF, Word, Text files
    // - images/ for images uploaded as documents for processing
    const timestamp = Date.now();
    const sanitizedName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Prefix = validation.type === 'image' ? 'images' : 'documents';
    const s3Key = `${s3Prefix}/${req.user._id}/${timestamp}-${sanitizedName}`;

    const uploadResult = await s3Upload(localFilePath, req.file.originalname, s3Key);
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
      s3Bucket: process.env.BUCKET_NAME,
      status: processingResult.method === 'failed' ? 'failed' : 'completed',
      extractedText,
      processingResult,
      aiParsedData,
      aiParsingEnabled: aiParsingEnabled !== 'false',
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
 */
async function getDocumentsByEntity(req, res) {
  try {
    const { entityType, entityId } = req.params;

    if (!['plan', 'plan_item', 'experience', 'destination'].includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({ error: 'Invalid entity ID' });
    }

    // Verify access to entity
    const hasAccess = await verifyEntityAccess(req.user._id, entityType, entityId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this entity' });
    }

    const documents = await Document.find({ entityType, entityId })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ documents });
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
 * Delete a document
 * DELETE /api/documents/:id
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

    backendLogger.info('[Document] Deleting', {
      documentId: document._id,
      s3Key: document.s3Key
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
    await document.deleteOne();

    res.json({ success: true, message: 'Document deleted successfully' });

  } catch (error) {
    backendLogger.error('[Document] Delete failed', {
      error: error.message,
      documentId: req.params.id
    });
    res.status(500).json({ error: 'Failed to delete document' });
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
  getSupportedTypes
};
