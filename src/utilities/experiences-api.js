import { sendRequest } from "./send-request";

const BASE_URL = process.env.PRODUCTION ? `/api/experiences/` : `https://biensperience.onrender.com/api/experiences/`

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

export async function userAddExperience(userId, experienceId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/user/${userId}`,
    "POST"
  );
}

export async function addPlanItem(experienceId, planItemData) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/plan-item`,
    "POST",
    planItemData
  );
}

export async function updatePlanItem(experienceId, planItemData) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/plan-item/${planItemData._id}`,
    "PUT",
    planItemData
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
