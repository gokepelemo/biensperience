import sendRequest from './send-request';

export async function getDestinations () {
    return await sendRequest(`/api/destinations/`, "GET")
}

export async function createDestination (destinationData) {
    return await sendRequest(`/api/destinations/`, "POST", destinationData)
}

export async function showDestination (id) {
    return await sendRequest(`/api/destinations/${id}`, "GET")
}

export async function updateDestination (experienceData) {
    return await sendRequest(`/api/destinations/${experienceData.id}`, "PUT", experienceData)
}

export async function deleteDestination (id) {
    return await sendRequest(`/api/destinations/${id}`, "DELETE")
}

export async function toggleUserFavoriteDestination (destinationId, userId) {
    return await sendRequest(`/api/destinations/${destinationId}/user/${userId}`, "POST")
}
