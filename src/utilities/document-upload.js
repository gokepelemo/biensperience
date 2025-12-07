/**
 * Document Upload Utilities (Frontend)
 * Handles document uploads to plan items with AI text extraction
 *
 * Works with: utilities/ai-document-utils.js (backend)
 */

import { sendRequest } from './send-request';
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
