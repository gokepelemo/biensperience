import { sendRequest } from './send-request.js';

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
    return await sendRequest(`${BASE_URL}`, "POST", destinationData)
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
    return await sendRequest(`${BASE_URL}${id}`, "PUT", destinationData)
}

/**
 * Deletes a destination by ID.
 *
 * @async
 * @param {string} id - Destination ID to delete
 * @returns {Promise<Object>} Deletion response
 */
export async function deleteDestination (id) {
    return await sendRequest(`${BASE_URL}${id}`, "DELETE")
}

/**
 * Toggles favorite status for a destination for a specific user.
 *
 * @async
 * @param {string} destinationId - Destination ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Favorite toggle response
 */
export async function toggleUserFavoriteDestination (destinationId, userId) {
    return await sendRequest(`${BASE_URL}${destinationId}/user/${userId}`, "POST")
}
