import { sendRequest } from "./send-request";
import { normalizeUrl } from "./url-utils.js";
import { logger } from "./logger";
import { broadcastEvent, eventBus } from "./event-bus";
import { createOperation, OperationType } from "./plan-operations";

const BASE_URL = "/api/plans";

/**
 * Helper to emit an operation via event bus
 * Operations are emitted alongside state-based events for backward compatibility
 * @param {string} planId - Plan ID
 * @param {string} type - Operation type from OperationType
 * @param {Object} payload - Operation payload
 */
function emitOperation(planId, type, payload) {
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const sessionId = eventBus.getSessionId();
      const operation = createOperation(type, payload, sessionId);

      const eventPayload = { planId, operation };

      // Emit operation event locally
      window.dispatchEvent(new CustomEvent('plan:operation', { detail: eventPayload }));
      // Broadcast to other tabs
      broadcastEvent('plan:operation', eventPayload);

      logger.debug('[plans-api] Operation emitted', {
        planId,
        operationId: operation.id,
        type
      });
    }
  } catch (e) {
    logger.warn('[plans-api] Failed to emit operation', { type, planId }, e);
  }
}

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
          // The API returns the full Plan object directly (not wrapped in a { plan } container)
          // result._id is the plan ID, result.plan is the items array
          const plan = result; // The full plan object
          const rawExp = result?.experience?._id || result?.experience || null;
          const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;

          // Legacy event for backward compatibility
          window.dispatchEvent(new CustomEvent('bien:plan_updated', { detail: { plan, experienceId } }));
          broadcastEvent('bien:plan_updated', { plan, experienceId });

          // Standardized event for DataContext and Dashboard
          window.dispatchEvent(new CustomEvent('plan:updated', { detail: { plan, planId } }));
          broadcastEvent('plan:updated', { plan, planId });

          // Operation-based event for CRDT sync
          // Check if this is a completion toggle
          if (normalizedUpdates.completed !== undefined) {
            const opType = normalizedUpdates.completed ? OperationType.COMPLETE_ITEM : OperationType.UNCOMPLETE_ITEM;
            emitOperation(planId, opType, { itemId });
          } else {
            // General item update
            emitOperation(planId, OperationType.UPDATE_ITEM, { itemId, changes: normalizedUpdates });
          }
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

          // Operation-based event for CRDT sync
          // Extract the added item from result
          const addedItem = result?.item || result;
          emitOperation(planId, OperationType.ADD_ITEM, { item: addedItem });
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

          // Operation-based event for CRDT sync
          emitOperation(planId, OperationType.DELETE_ITEM, { itemId });
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

        // Operation-based event for CRDT sync
        // Find the collaborator entry from the result
        const permissions = result?.plan?.permissions || result?.permissions || [];
        const collaborator = permissions.find(p => {
          const permUserId = p.user?._id || p.user;
          return permUserId?.toString() === userId?.toString();
        });
        emitOperation(planId, OperationType.ADD_COLLABORATOR, { collaborator: collaborator || { user: userId, role: 'collaborator' } });
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

        // Operation-based event for CRDT sync
        emitOperation(planId, OperationType.REMOVE_COLLABORATOR, { userId });
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

        // Operation-based event for CRDT sync
        // Extract item IDs from reordered items
        const itemIds = reorderedItems.map(item => item._id || item.plan_item_id).filter(Boolean);
        emitOperation(planId, OperationType.REORDER_ITEMS, { itemIds });

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

// ============================================
// COST MANAGEMENT API FUNCTIONS
// ============================================

/**
 * Get all costs for a plan with optional filters
 * @param {string} planId - Plan ID
 * @param {Object} filters - Optional filters: { collaborator, plan_item, dateFrom, dateTo }
 */
export async function getPlanCosts(planId, filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.collaborator) queryParams.append('collaborator', filters.collaborator);
    if (filters.plan_item) queryParams.append('plan_item', filters.plan_item);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

    const queryString = queryParams.toString();
    const url = `${BASE_URL}/${planId}/costs${queryString ? `?${queryString}` : ''}`;

    return await sendRequest(url);
  } catch (error) {
    logger.error('[plans-api] Failed to get plan costs', {
      planId,
      filters,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Get cost summary for a plan
 * @param {string} planId - Plan ID
 */
export async function getPlanCostSummary(planId) {
  try {
    return await sendRequest(`${BASE_URL}/${planId}/costs/summary`);
  } catch (error) {
    logger.error('[plans-api] Failed to get cost summary', {
      planId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Add a cost entry to a plan
 * @param {string} planId - Plan ID
 * @param {Object} costData - { title, description, cost, currency, plan_item, collaborator }
 */
export async function addPlanCost(planId, costData) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/costs`, "POST", costData);

    // Return the newly added cost (last item in the costs array)
    const newCost = result.costs[result.costs.length - 1];

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:cost_added', {
          detail: { plan: result, planId, costData, cost: newCost, version }
        }));
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { plan: result, version }
        }));
        broadcastEvent('plan:cost_added', { plan: result, planId, costData, cost: newCost, version });
        broadcastEvent('plan:updated', { plan: result, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch cost added events', {}, e);
    }

    return newCost;
  } catch (error) {
    logger.error('[plans-api] Failed to add cost', {
      planId,
      costData,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Update a cost entry
 * @param {string} planId - Plan ID
 * @param {string} costId - Cost entry ID
 * @param {Object} updates - { title, description, cost, currency, plan_item, collaborator }
 */
export async function updatePlanCost(planId, costId, updates) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/costs/${costId}`, "PATCH", updates);

    // Find and return the updated cost
    const updatedCost = result.costs.find(cost => cost._id === costId);

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:cost_updated', {
          detail: { plan: result, planId, costId, updates, cost: updatedCost, version }
        }));
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { plan: result, version }
        }));
        broadcastEvent('plan:cost_updated', { plan: result, planId, costId, updates, cost: updatedCost, version });
        broadcastEvent('plan:updated', { plan: result, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch cost updated events', {}, e);
    }

    return updatedCost;
  } catch (error) {
    logger.error('[plans-api] Failed to update cost', {
      planId,
      costId,
      updates,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Delete a cost entry
 * @param {string} planId - Plan ID
 * @param {string} costId - Cost entry ID
 */
export async function deletePlanCost(planId, costId) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/costs/${costId}`, "DELETE");

    // Emit events
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        const version = Date.now();
        window.dispatchEvent(new CustomEvent('plan:cost_deleted', {
          detail: { planId, costId, version }
        }));
        window.dispatchEvent(new CustomEvent('plan:updated', {
          detail: { planId, version }
        }));
        broadcastEvent('plan:cost_deleted', { planId, costId, version });
        broadcastEvent('plan:updated', { planId, version });
      }
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch cost deleted events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to delete cost', {
      planId,
      costId,
      error: error.message
    }, error);
    throw error;
  }
}
