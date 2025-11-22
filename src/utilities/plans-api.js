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
    logger.debug('[plans-api] Calling createPlan API', {
      timestamp: Date.now(),
      experienceId
    });

    const result = await sendRequest(`${BASE_URL}/experience/${experienceId}`, "POST", {
      planned_date: plannedDate,
    });

    logger.info('[plans-api] Plan created - API response received', {
      timestamp: Date.now(),
      planId: result._id,
      experienceId
    });

    // Emit events so components can react
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        // Normalize experienceId for consumers: prefer explicit param, then plan.experience
        const rawExp = experienceId || result?.experience?._id || result?.experience;
        const normalizedExpId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;

        // Generate version for this event (timestamp-based)
        const version = Date.now();

        logger.debug('[plans-api] About to dispatch bien:plan_created and plan:created events', {
          timestamp: Date.now(),
          planId: result._id,
          version
        });

        // Event payload with version and data structure
        const eventPayload = {
          planId: result._id,
          experienceId: normalizedExpId,
          version,
          data: result
        };

        // Legacy event for backward compatibility (SingleExperience still uses this)
        window.dispatchEvent(new CustomEvent('bien:plan_created', { detail: eventPayload }));
        broadcastEvent('bien:plan_created', eventPayload);

        // Standardized event for DataContext
        window.dispatchEvent(new CustomEvent('plan:created', { detail: eventPayload }));
        broadcastEvent('plan:created', eventPayload);

        logger.debug('[plans-api] Events dispatched successfully', {
          timestamp: Date.now(),
          version
        });
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

          // Generate version for this event
          const version = Date.now();

          // Event payload with version and data structure
          const eventPayload = {
            planId,
            experienceId,
            version,
            changes: updates,
            data: result
          };

          // Legacy event for backward compatibility (SingleExperience still uses this)
          window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: eventPayload }));
          broadcastEvent('bien:plan_updated', eventPayload);

          // Standardized event for DataContext
          window.dispatchEvent(new CustomEvent('plan:updated', { detail: eventPayload }));
          broadcastEvent('plan:updated', eventPayload);
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

      // Generate version for this event
      const version = Date.now();

      // Event payload with version
      const eventPayload = {
        planId,
        experienceId,
        version,
        data: result
      };

      // Legacy event for backward compatibility (SingleExperience still uses this)
      window.dispatchEvent(new CustomEvent('bien:plan_deleted', { detail: eventPayload }));
      broadcastEvent('bien:plan_deleted', eventPayload);

      // Standardized event for DataContext
      window.dispatchEvent(new CustomEvent('plan:deleted', { detail: eventPayload }));
      broadcastEvent('plan:deleted', eventPayload);
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

/**
 * Reorder plan items
 * @param {string} planId - Plan ID
 * @param {Array} reorderedItems - Array of plan items in new order
 */
export async function reorderPlanItems(planId, reorderedItems) {
  try {
    logger.debug('[plans-api] Reordering plan items', {
      planId,
      itemCount: reorderedItems.length
    });

    const result = await sendRequest(
      `${BASE_URL}/${planId}/reorder`,
      "PUT",
      { plan: reorderedItems }
    );

    logger.info('[plans-api] Plan items reordered successfully', {
      planId,
      itemCount: reorderedItems.length
    });

    // Emit events so components can react
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const rawExp = result?.experience?._id || result?.experience || null;
        const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        const version = Date.now();

        const eventPayload = {
          planId: result._id,
          experienceId,
          version,
          data: result,
          reordered: true
        };

        // Legacy event for backward compatibility
        window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: eventPayload }));
        broadcastEvent('bien:plan_updated', eventPayload);

        // Standardized event for DataContext
        window.dispatchEvent(new CustomEvent('plan:updated', { detail: eventPayload }));
        broadcastEvent('plan:updated', eventPayload);

        logger.debug('[plans-api] Reorder events dispatched successfully', {
          version
        });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch reorder events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to reorder plan items', {
      planId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Add a note to a plan item
 */
export async function addPlanItemNote(planId, itemId, content) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/notes`, "POST", {
      content
    });

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { plan: result, version }
        }));
        broadcastEvent('plan:updated', { plan: result, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch note added events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to add note to plan item', {
      planId,
      itemId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Update a note on a plan item
 */
export async function updatePlanItemNote(planId, itemId, noteId, content) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/notes/${noteId}`, "PATCH", {
      content
    });

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { plan: result, version }
        }));
        broadcastEvent('plan:updated', { plan: result, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch note updated events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to update note', {
      planId,
      itemId,
      noteId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Delete a note from a plan item
 */
export async function deletePlanItemNote(planId, itemId, noteId) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/notes/${noteId}`, "DELETE");

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { plan: result, version }
        }));
        broadcastEvent('plan:updated', { plan: result, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch note deleted events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to delete note', {
      planId,
      itemId,
      noteId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Assign a plan item to a collaborator
 */
export async function assignPlanItem(planId, itemId, assignedTo) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/assign`, "POST", {
      assignedTo
    });

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { plan: result, version }
        }));
        broadcastEvent('plan:updated', { plan: result, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch assign events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to assign plan item', {
      planId,
      itemId,
      assignedTo,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Unassign a plan item
 */
export async function unassignPlanItem(planId, itemId) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/assign`, "DELETE");

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { plan: result, version }
        }));
        broadcastEvent('plan:updated', { plan: result, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch unassign events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to unassign plan item', {
      planId,
      itemId,
      error: error.message
    }, error);
    throw error;
  }
}
