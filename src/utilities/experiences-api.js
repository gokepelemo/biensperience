import sendRequest from "./send-request";

export async function getExperiences() {
  return await sendRequest(`/api/experiences/`, "GET");
}

export async function createExperience(experienceData) {
  return await sendRequest(`/api/experiences/`, "POST", experienceData);
}

export async function showExperience(id) {
  return await sendRequest(`/api/experiences/${id}`, "GET");
}

export async function updateExperience(experienceId, experienceData) {
  return await sendRequest(
    `/api/experiences/${experienceId}`,
    "PUT",
    experienceData
  );
}

export async function userRemoveExperience(userId, experienceId) {
  return await sendRequest(
    `/api/experiences/${experienceId}/user/${userId}`,
    "DELETE"
  );
}

export async function userAddExperience(userId, experienceId) {
  return await sendRequest(
    `/api/experiences/${experienceId}/user/${userId}`,
    "POST"
  );
}

export async function addPlanItem(experienceId, planItemData) {
  return await sendRequest(
    `/api/experiences/${experienceId}/plan-item`,
    "POST",
    planItemData
  );
}

export async function updatePlanItem(experienceId, planItemData) {
  return await sendRequest(
    `/api/experiences/${experienceId}/plan-item/${planItemData._id}`,
    "PUT",
    planItemData
  );
}

export async function deletePlanItem(experienceId, planItemId) {
  return await sendRequest(
    `/api/experiences/${experienceId}/plan-item/${planItemId}`,
    "DELETE"
  );
}

export async function userPlanItemDone(experienceId, planItemId) {
  return await sendRequest(
    `/api/experiences/${experienceId}/plan-item/${planItemId}`,
    "POST"
  );
}

export async function showUserExperiences(userId) {
  return await sendRequest(`/api/experiences/user/${userId}`, "GET");
}
