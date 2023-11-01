import { sendRequest } from './send-request';

const BASE_URL = `/api/destinations/`

export async function getDestinations () {
    return await sendRequest(`${BASE_URL}`, "GET")
}

export async function createDestination (destinationData) {
    return await sendRequest(`${BASE_URL}`, "POST", destinationData)
}

export async function showDestination (id) {
    return await sendRequest(`${BASE_URL}${id}`, "GET")
}

export async function updateDestination (experienceData) {
    return await sendRequest(`${BASE_URL}${experienceData.id}`, "PUT", experienceData)
}

export async function deleteDestination (id) {
    return await sendRequest(`${BASE_URL}${id}`, "DELETE")
}

export async function toggleUserFavoriteDestination (destinationId, userId) {
    return await sendRequest(`${BASE_URL}${destinationId}/user/${userId}`, "POST")
}
