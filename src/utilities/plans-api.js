import { sendRequest } from "./send-request";

const BASE_URL = "/api/plans";

/**
 * Get all plans for the current user
 */
export function getUserPlans() {
  return sendRequest(BASE_URL);
}

/**
 * Get a specific plan by ID
 */
export function getPlanById(planId) {
  return sendRequest(`${BASE_URL}/${planId}`);
}

/**
 * Create a new plan for an experience
 */
export function createPlan(experienceId, plannedDate) {
  return sendRequest(`${BASE_URL}/experience/${experienceId}`, "POST", {
    planned_date: plannedDate,
  });
}

/**
 * Get all plans for a specific experience that the user can view
 */
export function getExperiencePlans(experienceId) {
  return sendRequest(`${BASE_URL}/experience/${experienceId}/all`);
}

/**
 * Update a plan
 */
export function updatePlan(planId, updates) {
  return sendRequest(`${BASE_URL}/${planId}`, "PUT", updates);
}

/**
 * Delete a plan
 */
export function deletePlan(planId) {
  return sendRequest(`${BASE_URL}/${planId}`, "DELETE");
}

/**
 * Update a specific plan item
 */
export function updatePlanItem(planId, itemId, updates) {
  return sendRequest(`${BASE_URL}/${planId}/items/${itemId}`, "PATCH", updates);
}

/**
 * Add a new plan item to a plan
 */
export function addPlanItem(planId, planItem) {
  return sendRequest(`${BASE_URL}/${planId}/items`, "POST", planItem);
}

/**
 * Delete a plan item from a plan
 */
export function deletePlanItem(planId, itemId) {
  return sendRequest(`${BASE_URL}/${planId}/items/${itemId}`, "DELETE");
}

/**
 * Get collaborators for a plan
 */
export function getCollaborators(planId) {
  return sendRequest(`${BASE_URL}/${planId}/collaborators`);
}

/**
 * Add a collaborator to a plan
 */
export function addCollaborator(planId, userId) {
  return sendRequest(`${BASE_URL}/${planId}/permissions/collaborator`, "POST", {
    userId,
  });
}

/**
 * Remove a collaborator from a plan
 */
export function removeCollaborator(planId, userId) {
  return sendRequest(
    `${BASE_URL}/${planId}/permissions/collaborator/${userId}`,
    "DELETE"
  );
}
