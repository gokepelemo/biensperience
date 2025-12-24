import { uploadFile, sendRequest } from "./send-request.js";
import { logger } from "./logger.js";
import { broadcastEvent } from "./event-bus.js";

const BASE_URL = `/api/photos/`

export async function uploadPhoto(request) {
    const result = await uploadFile(`${BASE_URL}`, "POST", request);

    // Emit event via event bus (handles local + cross-tab dispatch)
    // Standardized payload: { entity, entityId } for created events
    try {
        if (result) {
            broadcastEvent('photo:created', { photo: result, photoId: result._id });
            logger.debug('[photos-api] Photo created event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

export async function uploadPhotoBatch(request) {
    const result = await uploadFile(`${BASE_URL}batch`, "POST", request);

    // Emit event via event bus (handles local + cross-tab dispatch)
    // Standardized payload: { entities, entityIds } for batch created events
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
}

export async function uploadPhotoUrl(data) {
    const result = await sendRequest(`${BASE_URL}url`, "POST", data);

    // Emit event via event bus (handles local + cross-tab dispatch)
    // Standardized payload: { entity, entityId } for created events
    try {
        if (result) {
            broadcastEvent('photo:created', { photo: result, photoId: result._id });
            logger.debug('[photos-api] Photo URL created event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

export async function updatePhoto(id, data) {
    const result = await sendRequest(`${BASE_URL}${id}`, "PUT", data);

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
    const result = await sendRequest(`${BASE_URL}${id}`, "DELETE");

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
        const result = await sendRequest(`${BASE_URL}batch-get`, "POST", { ids: validIds });
        // API returns { success: true, data: [...] }
        const photos = result?.data || result || [];
        logger.debug('[photos-api] Photos fetched by IDs', { count: photos?.length, requestedCount: validIds.length });
        return photos;
    } catch (e) {
        logger.error('[photos-api] Failed to fetch photos by IDs', { error: e.message, idsCount: validIds.length });
        return [];
    }
}