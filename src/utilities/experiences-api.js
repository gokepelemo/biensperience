import { sendRequest } from "./send-request.js";
import { normalizeUrl } from "./url-utils.js";

const BASE_URL = `/api/experiences/`

export async function getExperiences() {
  return await sendRequest(`${BASE_URL}`, "GET");
}

export async function createExperience(experienceData) {
  return await sendRequest(`${BASE_URL}`, "POST", experienceData);
}

export async function showExperience(id) {
  return await sendRequest(`${BASE_URL}${id}`, "GET");
}

export async function deleteExperience(id) {
  return await sendRequest(`${BASE_URL}${id}`, "DELETE");
}

export async function transferOwnership(experienceId, newOwnerId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/transfer-ownership`,
    "PUT",
    { newOwnerId }
  );
}

export async function updateExperience(experienceId, experienceData) {
  return await sendRequest(
    `${BASE_URL}${experienceId}`,
    "PUT",
    experienceData
  );
}

export async function userRemoveExperience(userId, experienceId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/user/${userId}`,
    "DELETE"
  );
}

export async function userAddExperience(userId, experienceId, data = {}) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/user/${userId}`,
    "POST",
    data
  );
}

export async function addPlanItem(experienceId, planItemData) {
  // Normalize URL if present
  const normalizedData = {
    ...planItemData,
    url: planItemData.url ? normalizeUrl(planItemData.url) : planItemData.url
  };
  
  return await sendRequest(
    `${BASE_URL}${experienceId}/plan-item`,
    "POST",
    normalizedData
  );
}

export async function updatePlanItem(experienceId, planItemData) {
  // Normalize URL if present
  const normalizedData = {
    ...planItemData,
    url: planItemData.url ? normalizeUrl(planItemData.url) : planItemData.url
  };
  
  return await sendRequest(
    `${BASE_URL}${experienceId}/plan-item/${planItemData._id}`,
    "PUT",
    normalizedData
  );
}

export async function deletePlanItem(experienceId, planItemId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/plan-item/${planItemId}`,
    "DELETE"
  );
}

export async function userPlanItemDone(experienceId, planItemId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/plan-item/${planItemId}`,
    "POST"
  );
}

export async function showUserExperiences(userId) {
  return await sendRequest(`${BASE_URL}user/${userId}`, "GET");
}

export async function showUserCreatedExperiences(userId) {
  return await sendRequest(`${BASE_URL}user/${userId}/created`, "GET");
}

export async function getTagName(tagSlug) {
  return await sendRequest(`${BASE_URL}tag/${tagSlug}`, "GET");
}

/**
 * Add a collaborator permission to an experience
 */
export async function addExperienceCollaborator(experienceId, userId) {
  return await sendRequest(`${BASE_URL}${experienceId}/permissions`, "POST", {
    _id: userId,
    entity: 'user',
    type: 'collaborator'
  });
}

/**
 * Remove a collaborator permission from an experience
 */
export async function removeExperienceCollaborator(experienceId, userId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/permissions/${userId}/user`,
    "DELETE"
  );
}
