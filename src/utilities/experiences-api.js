import sendRequest from './send-request';

export async function getExperiences () {
    return await sendRequest(`/api/experiences/`, "GET")
}

export async function createExperience (experienceData) {
    return await sendRequest(`/api/experiences/`, "POST", experienceData)
}

export async function showExperience (id) {
    return await sendRequest(`/api/experiences/${id}`, "GET")
}

export async function updateExperience (experienceData) {
    return await sendRequest(`/api/experiences/${experienceData.id}`, "PUT", experienceData)
}

export async function deleteExperience (id) {
    return await sendRequest(`/api/experiences/${id}`, "DELETE")
}
