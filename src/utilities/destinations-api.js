import { sendApi, sendApiWithMeta } from './api-client.js';
import { sendQueuedRequest, PRIORITY } from './send-request.js';
import { logger } from './logger';
import { broadcastEvent } from './event-bus';

const BASE_URL = `/api/destinations/`;

/**
 * Helper for queued GETs that need envelope unwrapping.
 * Mirrors sendApi but goes through sendQueuedRequest for rate limiting.
 */
async function queuedSendApi(path, opts = {}) {
    const resp = await sendQueuedRequest(path, "GET", null, opts);
    if (resp && typeof resp === 'object' && 'success' in resp) {
        return resp.data;
    }
    return resp;
}

/**
 * Helper for queued GETs that need both data and meta (pagination).
 */
async function queuedSendApiWithMeta(path, opts = {}) {
    const resp = await sendQueuedRequest(path, "GET", null, opts);
    if (resp && typeof resp === 'object' && 'success' in resp) {
        return { data: resp.data, meta: resp.meta };
    }
    return resp;
}

/**
 * Fetches all destinations from the API.
 *
 * @async
 * @param {Object} filters - Query filters
 * @param {Object} options - Additional options
 * @param {boolean} options.shuffle - Whether to shuffle results on backend
 * @returns {Promise<Object>} Response with { data: Array, meta: Object } for pagination
 */
export async function getDestinations (filters = {}, options = {}) {
    // Fetch first page of destinations (default limit=30)
    const params = new URLSearchParams({ page: '1', limit: '30' });
    Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
    });

    // Add shuffle parameter if requested
    if (options.shuffle) {
        params.append('shuffle', 'true');
    }

    // Use queued request for rate limiting and coalescing
    return await queuedSendApiWithMeta(`${BASE_URL}?${params.toString()}`, {
        label: 'destinations/list',
        priority: PRIORITY.HIGH
    });
}

/**
 * Fetches destinations favorited by a specific user.
 * Returns an array of destination objects.
 */
export async function getFavorites(userId) {
    if (!userId) return [];
    const params = new URLSearchParams({ favorited_by: String(userId) });
    const data = await queuedSendApi(`${BASE_URL}?${params.toString()}`, {
        label: 'destinations/favorites',
        priority: PRIORITY.HIGH
    });
    return Array.isArray(data) ? data : [];
}

export async function getDestinationsPage(page = 1, limit = 30, filters = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
    });
    return await queuedSendApiWithMeta(`${BASE_URL}?${params.toString()}`, {
        label: 'destinations/page',
        priority: PRIORITY.HIGH
    });
}

/**
 * Creates a new destination.
 *
 * @async
 * @param {Object} destinationData - Destination data to create
 * @param {string} destinationData.name - Name of the destination
 * @param {string} [destinationData.photo] - Photo URL for the destination
 * @returns {Promise<Object>} Created destination object
 */
export async function createDestination (destinationData) {
    // Need access to envelope to read meta.activityId, so unwrap=false then handle.
    const resp = await sendApi("POST", `${BASE_URL}`, destinationData, { unwrap: false });
    const result = (resp && typeof resp === 'object' && 'success' in resp) ? resp.data : resp;

    // If the server returned an activity id for the create action, attach it
    // as a non-persisted field for wizard-style multi-step flows.
    try {
        const activityId = resp?.meta?.activityId;
        if (activityId && result && typeof result === 'object') {
            result._activityId = activityId;
        }
    } catch (e) {
        // ignore
    }

    // Emit event via event bus (handles local + cross-tab dispatch)
    // Standardized payload: { entity, entityId } for created events
    try {
        if (result) {
            broadcastEvent('destination:created', { destination: result, destinationId: result._id });
            logger.debug('[destinations-api] Destination created event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

/**
 * Fetches a single destination by ID.
 *
 * @async
 * @param {string} id - Destination ID
 * @returns {Promise<Object>} Destination object
 */
export async function showDestination (id) {
    // Critical navigation - use high priority for instant perception
    return await queuedSendApi(`${BASE_URL}${id}`, {
        priority: PRIORITY.HIGH,
        label: `destination/${id}`
    });
}

/**
 * Updates an existing destination.
 *
 * @async
 * @param {string} id - Destination ID
 * @param {Object} destinationData - Destination data to update
 * @returns {Promise<Object>} Updated destination object
 */
export async function updateDestination (id, destinationData) {
    const result = await sendApi("PUT", `${BASE_URL}${id}`, destinationData);

    // Emit event via event bus (handles local + cross-tab dispatch)
    // Standardized payload: { entity, entityId } for updated events
    try {
        if (result) {
            broadcastEvent('destination:updated', { destination: result, destinationId: result._id });
            logger.debug('[destinations-api] Destination updated event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

/**
 * Deletes a destination by ID.
 *
 * @async
 * @param {string} id - Destination ID to delete
 * @returns {Promise<Object>} Deletion response
 */
export async function deleteDestination (id) {
    const result = await sendApi("DELETE", `${BASE_URL}${id}`);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        broadcastEvent('destination:deleted', { destinationId: id });
        logger.debug('[destinations-api] Destination deleted event dispatched', { id });
    } catch (e) {
        // ignore
    }

    return result;
}

/**
 * Toggles favorite status for a destination for a specific user.
 *
 * @async
 * @param {string} destinationId - Destination ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated destination object
 */
export async function toggleUserFavoriteDestination (destinationId, userId) {
    const result = await sendApi("POST", `${BASE_URL}${destinationId}/user/${userId}`);

    // Emit event via event bus (handles local + cross-tab dispatch)
    // Standardized payload: { entity, entityId } for updated events
    try {
        if (result) {
            broadcastEvent('destination:updated', { destination: result, destinationId: result._id });
            logger.debug('[destinations-api] Destination favorite toggled event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}

/**
 * Get permissions for a destination (direct permissions array).
 * Used to replicate collaborators from an owned destination to another entity.
 * @param {string} destinationId - Destination ID
 * @returns {Promise<Object>} { owner, permissions, directPermissions }
 */
export async function getDestinationPermissions(destinationId) {
  return await sendApi("GET", `${BASE_URL}${destinationId}/permissions`);
}
