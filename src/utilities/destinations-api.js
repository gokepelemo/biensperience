import { sendRequest } from './send-request.js';
import { logger } from './logger';
import { broadcastEvent } from './event-bus';

const BASE_URL = `/api/destinations/`

/**
 * Fetches all destinations from the API.
 *
 * @async
 * @returns {Promise<Array>} Array of destination objects
 */
export async function getDestinations (filters = {}) {
    // Fetch first page of destinations (default limit=30)
    const params = new URLSearchParams({ page: '1', limit: '30' });
    Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
    });
    const resp = await sendRequest(`${BASE_URL}?${params.toString()}`, "GET");
    // Return full response with { data, meta } for pagination support
    return resp;
}

/**
 * Fetches destinations favorited by a specific user.
 * Returns an array of destination objects.
 */
export async function getFavorites(userId) {
    if (!userId) return [];
    const params = new URLSearchParams({ favorited_by: String(userId) });
    const resp = await sendRequest(`${BASE_URL}?${params.toString()}`, "GET");

    // Controller returns an array when favorited_by is used
    if (Array.isArray(resp)) return resp;
    // Support possible { data } envelope
    if (resp && resp.data) return resp.data;
    return [];
}

export async function getDestinationsPage(page = 1, limit = 30, filters = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    Object.entries(filters || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.append(k, v);
    });
    return await sendRequest(`${BASE_URL}?${params.toString()}`, "GET");
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
    const result = await sendRequest(`${BASE_URL}`, "POST", destinationData);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        if (result) {
            broadcastEvent('destination:created', { destination: result });
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
    return await sendRequest(`${BASE_URL}${id}`, "GET")
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
    const result = await sendRequest(`${BASE_URL}${id}`, "PUT", destinationData);

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        if (result) {
            broadcastEvent('destination:updated', { destination: result });
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
    const result = await sendRequest(`${BASE_URL}${id}`, "DELETE");

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
    const result = await sendRequest(`${BASE_URL}${destinationId}/user/${userId}`, "POST");

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
        if (result) {
            broadcastEvent('destination:updated', { destination: result });
            logger.debug('[destinations-api] Destination favorite toggled event dispatched', { id: result._id });
        }
    } catch (e) {
        // ignore
    }

    return result;
}
