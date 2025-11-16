import { sendRequest } from "./send-request";
import { normalizeUrl } from "./url-utils.js";
import { logger } from "./logger";
import { broadcastEvent } from "./event-bus";

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
export async function createPlan(experienceId, plannedDate) {
  try {
    const result = await sendRequest(`${BASE_URL}/experience/${experienceId}`, "POST", {
      planned_date: plannedDate,
    });
    logger.info('[plans-api] Plan created', {
      planId: result._id,
      experienceId
    });
    // Emit events so components can react
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        // Normalize experienceId for consumers: prefer explicit param, then plan.experience
        const rawExp = experienceId || result?.experience?._id || result?.experience;
        const normalizedExpId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;

        // Legacy event for backward compatibility (SingleExperience still uses this)
        window.dispatchEvent(new CustomEvent('bien:plan_created', { detail: { plan: result, experienceId: normalizedExpId } }));
        broadcastEvent('bien:plan_created', { plan: result, experienceId: normalizedExpId });

        // Standardized event for DataContext
        window.dispatchEvent(new CustomEvent('plan:created', { detail: { plan: result } }));
        broadcastEvent('plan:created', { plan: result });
      }
    } catch (e) {
      // ignore
    }
    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to create plan', {
      experienceId,
      plannedDate,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Get all plans for a specific experience that the user can view
 */
export function getExperiencePlans(experienceId) {
  return sendRequest(`${BASE_URL}/experience/${experienceId}/all`);
}

/**
 * Check if user has a plan for a specific experience (lightweight)
 * Returns only plan ID - much faster than getUserPlans()
 */
export function checkUserPlanForExperience(experienceId) {
  return sendRequest(`${BASE_URL}/experience/${experienceId}/check`);
}

/**
 * Update a plan
 */
export function updatePlan(planId, updates) {
  return sendRequest(`${BASE_URL}/${planId}`, "PUT", updates)
    .then((result) => {
      // Emit events so components can react to plan edits (planned_date changes, etc.)
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          const rawExp = result?.experience?._id || result?.experience || null;
          const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;

          // Legacy event for backward compatibility (SingleExperience still uses this)
          window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: { plan: result, experienceId } }));
          broadcastEvent('bien:plan_updated', { plan: result, experienceId });

          // Standardized event for DataContext
          window.dispatchEvent(new CustomEvent('plan:updated', { detail: { plan: result, planId } }));
          broadcastEvent('plan:updated', { plan: result, planId });
        }
      } catch (e) {
        // ignore
      }
      return result;
    });
}

/**
 * Delete a plan
 */
export async function deletePlan(planId) {
  const result = await sendRequest(`${BASE_URL}/${planId}`, "DELETE");

  // Emit events so components can react (e.g., ExperienceCard)
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const rawExp = result?.experience?._id || result?.experience || null;
      const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;

      // Legacy event for backward compatibility (SingleExperience still uses this)
      window.dispatchEvent(new CustomEvent('bien:plan_deleted', { detail: { plan: result, experienceId } }));
      broadcastEvent('bien:plan_deleted', { plan: result, experienceId });

      // Standardized event for DataContext
      window.dispatchEvent(new CustomEvent('plan:deleted', { detail: { planId } }));
      broadcastEvent('plan:deleted', { planId });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

/**
 * Update a specific plan item
 */
export function updatePlanItem(planId, itemId, updates) {
  // Normalize URL if present in updates
  const normalizedUpdates = {
    ...updates,
    url: updates.url ? normalizeUrl(updates.url) : updates.url
  };
  
  return sendRequest(`${BASE_URL}/${planId}/items/${itemId}`, "PATCH", normalizedUpdates)
    .then((result) => {
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
          const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
          const plan = result?.plan || result;

          // Legacy event for backward compatibility
          window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: { plan, experienceId } }));
          broadcastEvent('bien:plan_updated', { plan, experienceId });

          // Standardized event for DataContext and Dashboard
          window.dispatchEvent(new CustomEvent('plan:updated', { detail: { plan, planId } }));
          broadcastEvent('plan:updated', { plan, planId });
        }
      } catch (e) {
        // ignore
      }
      return result;
    });
}

/**
 * Add a new plan item to a plan
 */
export function addPlanItem(planId, planItem) {
  // Normalize URL if present
  const normalizedItem = {
    ...planItem,
    url: planItem.url ? normalizeUrl(planItem.url) : planItem.url
  };
  
  return sendRequest(`${BASE_URL}/${planId}/items`, "POST", normalizedItem)
    .then((result) => {
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          // server may return the new item or an updated plan; try to extract experience id
          const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
          const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
          const plan = result?.plan || null;
          window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: { plan: plan || result, experienceId, planItem: result } }));
          // Broadcast for other tabs
          broadcastEvent('bien:plan_updated', { plan: plan || result, experienceId, planItem: result });
        }
      } catch (e) {
        // ignore
      }
      return result;
    });
}

/**
 * Delete a plan item from a plan
 */
export function deletePlanItem(planId, itemId) {
  return sendRequest(`${BASE_URL}/${planId}/items/${itemId}`, "DELETE")
    .then((result) => {
      try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          const experienceId = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
          const normalizedExpId = experienceId && experienceId.toString ? experienceId.toString() : experienceId;
          const plan = result?.plan || null;
          window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: { plan: plan || result, experienceId: normalizedExpId, deletedItemId: itemId } }));
          // Broadcast for other tabs
          broadcastEvent('bien:plan_updated', { plan: plan || result, experienceId: normalizedExpId, deletedItemId: itemId });
        }
      } catch (e) {
        // ignore
      }
      return result;
    });
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
  }).then((result) => {
    try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
        const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
        const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        const plan = result?.plan || null;
        window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: { plan: plan || result, experienceId, collaboratorAdded: userId } }));
        // Broadcast for other tabs
        broadcastEvent('bien:plan_updated', { plan: plan || result, experienceId, collaboratorAdded: userId });
      }
    } catch (e) {
      // ignore
    }
    return result;
  });
}

/**
 * Remove a collaborator from a plan
 */
export function removeCollaborator(planId, userId) {
  return sendRequest(
    `${BASE_URL}/${planId}/permissions/collaborator/${userId}`,
    "DELETE"
  ).then((result) => {
    try {
        if (typeof window !== 'undefined' && window.dispatchEvent) {
        const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
        const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        const plan = result?.plan || null;
        window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: { plan: plan || result, experienceId, collaboratorRemoved: userId } }));
        // Broadcast for other tabs
        broadcastEvent('bien:plan_updated', { plan: plan || result, experienceId, collaboratorRemoved: userId });
      }
    } catch (e) {
      // ignore
    }
    return result;
  });
}
