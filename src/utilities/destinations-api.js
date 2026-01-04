import { sendRequest, sendQueuedRequest, PRIORITY } from './send-request.js';
import { logger } from './logger';
import { broadcastEvent } from './event-bus';

const BASE_URL = `/api/destinations/`;

/**
 * Extracts data from standardized API response format.
 * Handles both new format { success: true, data: ... } and legacy format (direct data).
 * @param {Object} response - API response
 * @returns {*} Extracted data or original response
 */
function extractData(response) {
    if (response && typeof response === 'object' && 'success' in response) {
        return response.data;
    }
    return response;
}

/**
 * Fetches all destinations from the API.
 *
 * @async
 * @returns {Promise<Object>} Response with { data: Array, meta: Object } for pagination
 */
export async function getDestinations (filters = {}) {
    // Fetch first page of destinations (default limit=30)
    const params = new URLSearchParams({ page: '1', limit: '30' });
    Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
    });
    // Use queued request for rate limiting and coalescing
    const resp = await sendQueuedRequest(`${BASE_URL}?${params.toString()}`, "GET", null, { label: 'destinations/list' });
    // Handle standardized response format { success, data, meta }
    // Return { data, meta } for pagination support
    if (resp && resp.success !== undefined) {
        return { data: resp.data, meta: resp.meta };
    }
    // Legacy format support
    return resp;
}

/**
 * Fetches destinations favorited by a specific user.
 * Returns an array of destination objects.
 */
export async function getFavorites(userId) {
    if (!userId) return [];
    const params = new URLSearchParams({ favorited_by: String(userId) });
    const resp = await sendQueuedRequest(`${BASE_URL}?${params.toString()}`, "GET", null, { label: 'destinations/favorites' });

    // Handle standardized response format { success, data }
    const data = extractData(resp);
    if (Array.isArray(data)) return data;
    return [];
}

export async function getDestinationsPage(page = 1, limit = 30, filters = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
    });
    const resp = await sendQueuedRequest(`${BASE_URL}?${params.toString()}`, "GET", null, { label: 'destinations/page' });
    // Handle standardized response format { success, data, meta }
    if (resp && resp.success !== undefined) {
        return { data: resp.data, meta: resp.meta };
    }
    return resp;
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
    const resp = await sendRequest(`${BASE_URL}`, "POST", destinationData);
    const result = extractData(resp);

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
    const resp = await sendQueuedRequest(`${BASE_URL}${id}`, "GET", null, {
        priority: PRIORITY.HIGH,
        label: `destination/${id}`
    });
    return extractData(resp);
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
    const resp = await sendRequest(`${BASE_URL}${id}`, "PUT", destinationData);
    const result = extractData(resp);

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
    const resp = await sendRequest(`${BASE_URL}${id}`, "DELETE");
    const result = extractData(resp);

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
    const resp = await sendRequest(`${BASE_URL}${destinationId}/user/${userId}`, "POST");
    const result = extractData(resp);

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
