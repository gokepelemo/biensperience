import { uploadFile, uploadFileWithProgress } from "./send-request.js";
import { sendApi } from "./api-client.js";
import { logger } from "./logger.js";
import { broadcastEvent, generateOptimisticId } from "./event-bus.js";

const BASE_URL = `/api/photos/`

// Maximum photo file size (10MB) - for UI display
export const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Human-readable size
 */
export function formatPhotoSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get photo file size limit for display
 * @returns {string} Human-readable max size
 */
export function getPhotoSizeLimit() {
  return formatPhotoSize(MAX_PHOTO_SIZE);
}

/**
 * Upload a single photo
 * @param {FormData} request - FormData with photo file
 * @param {Object} options - Upload options
 * @param {Function} options.onProgress - Progress callback: ({ loaded, total, percent }) => void
 * @param {AbortSignal} options.signal - AbortSignal for cancellation
 * @returns {Promise<Object>} Uploaded photo object
 */
export async function uploadPhoto(request, options = {}) {
    const { onProgress, signal } = options;
    const uploadId = generateOptimisticId('photo-upload');

    // Extract filename from FormData for progress display
    const file = request.get?.('image');
    const fileName = file?.name || 'photo';
    const fileSize = file?.size || 0;

    // Emit global upload started event
    broadcastEvent('upload:started', { uploadId, fileName, fileSize, type: 'photo' });

    // Use uploadFileWithProgress for progress tracking
    const wrappedProgress = (progress) => {
        broadcastEvent('upload:progress', { uploadId, loaded: progress.loaded, total: progress.total, percent: progress.percent });
        if (onProgress) onProgress(progress);
    };

    try {
        const result = await uploadFileWithProgress(`${BASE_URL}`, "POST", request, {
            onProgress: wrappedProgress,
            signal
        });

        broadcastEvent('upload:completed', { uploadId });

        // Emit entity event (handles local + cross-tab dispatch)
        try {
            if (result) {
                const ownerPermission = result?.permissions?.find(p => p.entity === 'user' && p.type === 'owner');
                const userId = ownerPermission?._id;
                broadcastEvent('photo:created', { photo: result, photoId: result._id, userId });
                logger.debug('[photos-api] Photo created event dispatched', { id: result._id });
            }
        } catch (e) {
            // ignore
        }

        return result;
    } catch (err) {
        broadcastEvent('upload:failed', { uploadId, error: err.message });
        throw err;
    }
}

export async function uploadPhotoBatch(request, options = {}) {
    const { onProgress, signal } = options;
    const uploadId = generateOptimisticId('photo-batch');

    // Count files in FormData for display
    let fileCount = 0;
    let totalSize = 0;
    if (request.getAll) {
        const files = request.getAll('images');
        fileCount = files.length;
        totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    }

    const fileName = `${fileCount} photos`;
    broadcastEvent('upload:started', { uploadId, fileName, fileSize: totalSize, type: 'photo' });

    const wrappedProgress = (progress) => {
        broadcastEvent('upload:progress', { uploadId, loaded: progress.loaded, total: progress.total, percent: progress.percent });
        if (onProgress) onProgress(progress);
    };

    try {
        const result = await uploadFileWithProgress(`${BASE_URL}batch`, "POST", request, {
            onProgress: wrappedProgress,
            signal
        });

        broadcastEvent('upload:completed', { uploadId });

        // Emit entity event (handles local + cross-tab dispatch)
        try {
            if (result) {
                const photoIds = Array.isArray(result) ? result.map(p => p._id) : [];
                broadcastEvent('photos:created', { photos: result, photoIds });
                logger.debug('[photos-api] Photos batch created event dispatched', { count: result?.length });
            }
        } catch (e) {
            // ignore
        }

        return result;
    } catch (err) {
        broadcastEvent('upload:failed', { uploadId, error: err.message });
        throw err;
    }
}

export async function uploadPhotoUrl(data) {
    const result = await sendApi("POST", `${BASE_URL}url`, data);

    // Emit event via event bus (handles local + cross-tab dispatch)
    // Standardized payload: { entity, entityId } for created events
    try {
        if (result) {
            const ownerPermission = result?.permissions?.find(p => p.entity === 'user' && p.type === 'owner');
            const userId = ownerPermission?._id;
            broadcastEvent('photo:created', { photo: result, photoId: result._id, userId });
            logger.debug('[photos-api] Photo URL created event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

export async function updatePhoto(id, data) {
    const result = await sendApi("PUT", `${BASE_URL}${id}`, data);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        if (result) {
            broadcastEvent('photo:updated', { photo: result, photoId: id });
            logger.debug('[photos-api] Photo updated event dispatched', { id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

export async function deletePhoto(id) {
    const result = await sendApi("DELETE", `${BASE_URL}${id}`);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        broadcastEvent('photo:deleted', { photoId: id });
        logger.debug('[photos-api] Photo deleted event dispatched', { id });
    } catch (e) {
        // ignore
    }

    return result;
}

/**
 * Normalize an ID to string format
 * Handles MongoDB ObjectIds which could be strings, objects with $oid, or toString()
 * @param {string|object} id - The ID to normalize
 * @returns {string|null} The normalized string ID or null
 */
function normalizePhotoId(id) {
    if (!id) return null;
    if (typeof id === 'string') return id;
    // MongoDB ObjectId serialized as { $oid: "..." }
    if (typeof id === 'object' && id.$oid) return id.$oid;
    // ObjectId with toString method
    if (typeof id === 'object' && typeof id.toString === 'function') {
        const str = id.toString();
        // Check if it's a valid ObjectId string (24 hex chars)
        if (/^[a-f\d]{24}$/i.test(str)) return str;
    }
    // ObjectId with _id property
    if (typeof id === 'object' && id._id) return normalizePhotoId(id._id);
    return null;
}

/**
 * Fetch photos by array of IDs
 * @param {string[]|object[]} ids - Array of photo IDs to fetch (strings or ObjectId-like objects)
 * @returns {Promise<Array>} Array of photo objects
 */
export async function getPhotosByIds(ids) {
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return [];
    }

    // Normalize all IDs to strings, handling ObjectIds
    const validIds = ids.map(normalizePhotoId).filter(Boolean);
    if (validIds.length === 0) {
        logger.debug('[photos-api] No valid photo IDs to fetch', { rawIds: ids });
        return [];
    }

    try {
        // sendApi returns the unwrapped data array directly
        const photos = await sendApi("POST", `${BASE_URL}batch-get`, { ids: validIds });
        const list = Array.isArray(photos) ? photos : [];
        logger.debug('[photos-api] Photos fetched by IDs', { count: list?.length, requestedCount: validIds.length });
        return list;
    } catch (e) {
        logger.error('[photos-api] Failed to fetch photos by IDs', { error: e.message, idsCount: validIds.length });
        return [];
    }
}