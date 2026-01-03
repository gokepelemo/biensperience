/**
 * Document Upload Utilities (Frontend)
 * Handles document uploads to plan items with AI text extraction
 *
 * Works with: utilities/ai-document-utils.js (backend)
 */

import { sendRequest, uploadFile } from './send-request';
import { logger } from './logger';

// Supported document types (must match backend)
export const SUPPORTED_DOCUMENT_TYPES = {
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'],
  word: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  text: ['text/plain', 'text/csv', 'text/markdown']
};

// Flatten for quick lookup
export const ALL_SUPPORTED_MIMES = Object.values(SUPPORTED_DOCUMENT_TYPES).flat();

// Maximum file sizes (in bytes) - must match backend
export const MAX_FILE_SIZES = {
  pdf: 50 * 1024 * 1024, // 50MB
  image: 10 * 1024 * 1024, // 10MB
  word: 25 * 1024 * 1024, // 25MB
  text: 5 * 1024 * 1024 // 5MB
};

// Document type labels for UI
export const DOCUMENT_TYPE_LABELS = {
  flight: { label: 'Flight', icon: '✈️', description: 'Flight confirmation or boarding pass' },
  hotel: { label: 'Hotel', icon: '🏨', description: 'Hotel booking confirmation' },
  activity: { label: 'Activity', icon: '🎫', description: 'Tour or activity booking' },
  restaurant: { label: 'Restaurant', icon: '🍽️', description: 'Restaurant reservation' },
  transport: { label: 'Transport', icon: '🚗', description: 'Car, train, or ferry booking' },
  travel: { label: 'Travel Document', icon: '📄', description: 'Other travel-related document' }
};

/**
 * Validate a file before upload
 * @param {File} file - File to validate
 * @returns {Object} { valid: boolean, error?: string, type?: string }
 */
export function validateDocument(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  const mimeType = file.type.toLowerCase();

  if (!ALL_SUPPORTED_MIMES.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Supported: PDF, images, Word documents, text files.`
    };
  }

  // Determine document type
  let docType = null;
  for (const [type, mimes] of Object.entries(SUPPORTED_DOCUMENT_TYPES)) {
    if (mimes.includes(mimeType)) {
      docType = type;
      break;
    }
  }

  // Check file size
  const maxSize = MAX_FILE_SIZES[docType] || MAX_FILE_SIZES.text;
  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File too large. Maximum size for ${docType} files is ${maxSizeMB}MB.`
    };
  }

  return { valid: true, type: docType };
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "2.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Upload a document for a plan item
 * @param {File} file - File to upload
 * @param {string} planId - Plan ID
 * @param {string} itemId - Plan item ID
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result with extracted text and AI parsing
 */
export async function uploadPlanItemDocument(file, planId, itemId, options = {}) {
  const {
    documentType = 'travel',
    extractText = true,
    aiParse = true,
    onProgress
  } = options;

  // Validate
  const validation = validateDocument(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create FormData
  const formData = new FormData();
  formData.append('document', file);
  formData.append('documentType', documentType);
  formData.append('extractText', String(extractText));
  formData.append('aiParse', String(aiParse));

  logger.debug('[document-upload] Uploading document', {
    planId,
    itemId,
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    documentType
  });

  try {
    // Upload with progress tracking if supported
    const response = await fetch(`/api/plans/${planId}/items/${itemId}/documents`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();

    logger.info('[document-upload] Document uploaded successfully', {
      planId,
      itemId,
      url: result.url,
      aiParsed: !!result.aiParsed
    });

    return result;
  } catch (error) {
    logger.error('[document-upload] Upload failed', {
      error: error.message,
      planId,
      itemId
    });
    throw error;
  }
}

/**
 * Delete a document from a plan item
 * @param {string} planId - Plan ID
 * @param {string} itemId - Plan item ID
 * @param {string} documentId - Document ID or URL
 * @returns {Promise<void>}
 */
export async function deletePlanItemDocument(planId, itemId, documentId) {
  logger.debug('[document-upload] Deleting document', { planId, itemId, documentId });

  const response = await sendRequest(
    `/api/plans/${planId}/items/${itemId}/documents/${encodeURIComponent(documentId)}`,
    'DELETE'
  );

  logger.info('[document-upload] Document deleted', { planId, itemId, documentId });
  return response;
}

/**
 * Get all documents for a plan item
 * @param {string} planId - Plan ID
 * @param {string} itemId - Plan item ID
 * @returns {Promise<Array>} List of documents
 */
export async function getPlanItemDocuments(planId, itemId) {
  return sendRequest(`/api/plans/${planId}/items/${itemId}/documents`, 'GET');
}

/**
 * Get accept attribute value for file input
 * @param {string|null} category - Optional category to filter (pdf, image, word, text)
 * @returns {string} Accept attribute value
 */
export function getAcceptAttribute(category = null) {
  if (category && SUPPORTED_DOCUMENT_TYPES[category]) {
    return SUPPORTED_DOCUMENT_TYPES[category].join(',');
  }
  return ALL_SUPPORTED_MIMES.join(',');
}

/**
 * Detect document type from filename
 * @param {string} filename - File name
 * @returns {string} Detected document type hint
 */
export function detectDocumentTypeFromFilename(filename) {
  const lowerName = filename.toLowerCase();

  // Check for common keywords
  if (/flight|boarding|airline|itinerary/.test(lowerName)) return 'flight';
  if (/hotel|accommodation|booking|reservation/.test(lowerName)) return 'hotel';
  if (/tour|activity|ticket|admission/.test(lowerName)) return 'activity';
  if (/restaurant|dining|reservation/.test(lowerName)) return 'restaurant';
  if (/car|rental|train|ferry|transfer|transport/.test(lowerName)) return 'transport';

  return 'travel';
}

/**
 * Create a document preview URL (data URL for local preview)
 * @param {File} file - File to preview
 * @returns {Promise<string>} Data URL for preview
 */
export function createDocumentPreview(file) {
  return new Promise((resolve, reject) => {
    // Only create preview for images
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get documents for an entity (plan, plan_item, experience, destination)
 * Uses the /api/documents/entity endpoint with visibility filtering
 * @param {string} entityType - Entity type: 'plan', 'plan_item', 'experience', 'destination'
 * @param {string} entityId - Entity ID
 * @param {Object} options - Options
 * @param {string} options.planId - Plan ID (required for plan_item entity type)
 * @param {boolean} options.includeDisabled - Include disabled documents (super admin only)
 * @param {number} options.page - Page number (1-based, default: 1)
 * @param {number} options.limit - Documents per page (default: 10)
 * @returns {Promise<Object>} { documents: Array, pagination: Object }
 */
export async function getDocumentsByEntity(entityType, entityId, options = {}) {
  logger.debug('[document-upload] Getting documents by entity', { entityType, entityId, options });

  // Build URL with query params
  let url = `/api/documents/entity/${entityType}/${entityId}`;
  const params = new URLSearchParams();

  if (options.planId) {
    params.append('planId', options.planId);
  }
  if (options.includeDisabled) {
    params.append('includeDisabled', 'true');
  }
  if (options.page) {
    params.append('page', String(options.page));
  }
  if (options.limit) {
    params.append('limit', String(options.limit));
  }

  const queryString = params.toString();
  if (queryString) {
    url += `?${queryString}`;
  }

  const response = await sendRequest(url, 'GET');
  
  // Return both documents and pagination info
  return {
    documents: response.documents || [],
    pagination: response.pagination || {
      page: 1,
      limit: options.limit || 10,
      total: response.documents?.length || 0,
      totalPages: 1,
      hasMore: false
    }
  };
}

/**
 * Upload a document for any entity type
 * Uses the /api/documents endpoint
 * @param {File} file - File to upload
 * @param {Object} options - Upload options
 * @param {string} options.entityType - Entity type: 'plan', 'plan_item', 'experience', 'destination'
 * @param {string} options.entityId - Entity ID
 * @param {string} options.planId - Plan ID (required for plan_item)
 * @param {string} options.planItemId - Plan item ID (required for plan_item)
 * @param {string} options.visibility - 'collaborators' or 'private' (default: 'collaborators')
 * @param {boolean} options.aiParsingEnabled - Enable AI parsing (default: true)
 * @param {string} options.documentTypeHint - Hint for document type
 * @returns {Promise<Object>} Upload result with document data
 */
export async function uploadDocument(file, options = {}) {
  const {
    entityType,
    entityId,
    planId,
    planItemId,
    visibility = 'collaborators',
    aiParsingEnabled = true,
    documentTypeHint,
    timeoutMs
  } = options;

  // Validate
  const validation = validateDocument(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Create FormData
  const formData = new FormData();
  formData.append('document', file);
  formData.append('entityType', entityType);
  formData.append('entityId', entityId);
  formData.append('visibility', visibility);
  formData.append('aiParsingEnabled', String(aiParsingEnabled));

  if (planId) formData.append('planId', planId);
  if (planItemId) formData.append('planItemId', planItemId);
  if (documentTypeHint) formData.append('documentTypeHint', documentTypeHint);

  logger.debug('[document-upload] Uploading document', {
    entityType,
    entityId,
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    visibility
  });

  try {
    // Documents can be large and processing can be slow (OCR + AI parsing).
    // If not provided, compute a size-aware timeout with a reasonable upper bound.
    // The timeout covers: upload + text extraction (OCR) + AI parsing + S3 upload + DB save.
    // OCR alone can take 30-60s per page, and AI parsing can take 10-30s.
    const computedTimeoutMs = Number.isFinite(timeoutMs)
      ? timeoutMs
      : Math.min(
        10 * 60 * 1000, // cap at 10 minutes
        Math.max(
          5 * 60 * 1000, // floor at 5 minutes (OCR + AI parsing takes time)
          3 * 60 * 1000 + Math.ceil(file.size / (1024 * 1024)) * 15000 // 3min base + 15s per MB
        )
      );

    // Use uploadFile to handle CSRF token and authentication
    const result = await uploadFile('/api/documents', 'POST', formData, { timeoutMs: computedTimeoutMs });

    logger.info('[document-upload] Document uploaded successfully', {
      entityType,
      entityId,
      documentId: result.document?._id,
      visibility
    });

    return result.document;
  } catch (error) {
    logger.error('[document-upload] Upload failed', {
      error: error.message,
      entityType,
      entityId
    });
    throw error;
  }
}

/**
 * Update document visibility
 * @param {string} documentId - Document ID
 * @param {string} visibility - 'collaborators' or 'private'
 * @returns {Promise<Object>} Updated document
 */
export async function updateDocumentVisibility(documentId, visibility) {
  logger.debug('[document-upload] Updating document visibility', { documentId, visibility });

  const response = await sendRequest(`/api/documents/${documentId}/visibility`, 'PATCH', { visibility });

  logger.info('[document-upload] Document visibility updated', { documentId, visibility });
  return response.document;
}

/**
 * Delete a document (soft delete - disables the document)
 * @param {string} documentId - Document ID
 * @param {string} reason - Optional reason for deletion
 * @returns {Promise<void>}
 */
export async function deleteDocument(documentId, reason = '') {
  logger.debug('[document-upload] Deleting document (soft)', { documentId });

  await sendRequest(`/api/documents/${documentId}`, 'DELETE', reason ? { reason } : undefined);

  logger.info('[document-upload] Document disabled', { documentId });
}

/**
 * Permanently delete a document (super admin only)
 * Removes from S3 and database
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 */
export async function permanentDeleteDocument(documentId) {
  logger.debug('[document-upload] Permanently deleting document', { documentId });

  await sendRequest(`/api/documents/${documentId}/permanent`, 'DELETE');

  logger.info('[document-upload] Document permanently deleted', { documentId });
}

/**
 * Restore a disabled document (super admin only)
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Restored document
 */
export async function restoreDocument(documentId) {
  logger.debug('[document-upload] Restoring document', { documentId });

  const response = await sendRequest(`/api/documents/${documentId}/restore`, 'POST');

  logger.info('[document-upload] Document restored', { documentId });
  return response.document;
}

/**
 * Get a single document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Document data
 */
export async function getDocument(documentId) {
  const response = await sendRequest(`/api/documents/${documentId}`, 'GET');
  return response.document;
}

/**
 * Get a signed URL for document preview/download
 * Protected documents require a signed URL to access
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} { url: string, filename: string, mimeType: string, expiresIn: number }
 */
export async function getDocumentPreviewUrl(documentId) {
  logger.debug('[document-upload] Getting preview URL', { documentId });
  const response = await sendRequest(`/api/documents/${documentId}/preview`, 'GET');
  logger.info('[document-upload] Preview URL retrieved', { documentId, expiresIn: response.expiresIn });
  return response;
}

/**
 * Parse AI-extracted data to populate plan item fields
 * @param {Object} aiData - AI-parsed data from backend
 * @param {string} documentType - Type of document
 * @returns {Object} Plan item field updates
 */
export function mapAIDataToPlanItem(aiData, documentType) {
  if (!aiData) return {};

  const updates = {};

  // Common fields
  if (aiData.confirmationNumber) {
    updates.confirmationNumber = aiData.confirmationNumber;
  }

  // Map based on document type
  switch (documentType) {
    case 'flight':
      if (aiData.airline && aiData.flightNumber) {
        updates.text = `${aiData.airline} ${aiData.flightNumber}`;
      }
      if (aiData.departureDate) {
        updates.date = aiData.departureDate;
      }
      if (aiData.departureTime) {
        updates.time = aiData.departureTime;
      }
      if (aiData.departureCity && aiData.arrivalCity) {
        updates.notes = `${aiData.departureCity} → ${aiData.arrivalCity}`;
      }
      break;

    case 'hotel':
      if (aiData.hotelName) {
        updates.text = aiData.hotelName;
      }
      if (aiData.checkInDate) {
        updates.date = aiData.checkInDate;
      }
      if (aiData.address) {
        updates.location = aiData.address;
      }
      if (aiData.totalCost) {
        updates.estimatedCost = parseFloat(aiData.totalCost) || null;
      }
      break;

    case 'activity':
      if (aiData.activityName) {
        updates.text = aiData.activityName;
      }
      if (aiData.date) {
        updates.date = aiData.date;
      }
      if (aiData.time) {
        updates.time = aiData.time;
      }
      if (aiData.location || aiData.meetingPoint) {
        updates.location = aiData.location || aiData.meetingPoint;
      }
      if (aiData.totalCost) {
        updates.estimatedCost = parseFloat(aiData.totalCost) || null;
      }
      break;

    case 'restaurant':
      if (aiData.restaurantName) {
        updates.text = aiData.restaurantName;
      }
      if (aiData.date) {
        updates.date = aiData.date;
      }
      if (aiData.time) {
        updates.time = aiData.time;
      }
      if (aiData.address) {
        updates.location = aiData.address;
      }
      break;

    case 'transport':
      if (aiData.type && aiData.provider) {
        updates.text = `${aiData.provider} (${aiData.type})`;
      }
      if (aiData.pickupDate) {
        updates.date = aiData.pickupDate;
      }
      if (aiData.pickupLocation) {
        updates.location = aiData.pickupLocation;
      }
      if (aiData.totalCost) {
        updates.estimatedCost = parseFloat(aiData.totalCost) || null;
      }
      break;

    default:
      // Generic travel document
      if (aiData.summary) {
        updates.notes = aiData.summary;
      }
  }

  return updates;
}
