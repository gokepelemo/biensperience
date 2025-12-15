import { sendRequest, sendQueuedRequest, PRIORITY } from "./send-request";
import { normalizeUrl } from "./url-utils.js";
import { logger } from "./logger";
import { broadcastEvent, eventBus } from "./event-bus";
import { createOperation, OperationType } from "./plan-operations";

const BASE_URL = "/api/plans";

/**
 * Extract data from API response
 * Handles responses that may be wrapped in { data, meta } or already unwrapped
 * @param {Object|Array} response - API response
 * @returns {Object|Array} Extracted data
 */
function extractData(response) {
  // If response has a 'data' property, unwrap it
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data;
  }
  // Otherwise return as-is (already unwrapped)
  return response;
}

/**
 * Helper to emit an operation via event bus
 * Operations are emitted alongside state-based events for backward compatibility
 * @param {string} planId - Plan ID
 * @param {string} type - Operation type from OperationType
 * @param {Object} payload - Operation payload
 */
function emitOperation(planId, type, payload) {
  try {
    const sessionId = eventBus.getSessionId();
    const operation = createOperation(type, payload, sessionId);

    const eventPayload = { planId, operation };

    // Emit via event bus (handles local + cross-tab dispatch)
    broadcastEvent('plan:operation', eventPayload);

    logger.debug('[plans-api] Operation emitted', {
      planId,
      operationId: operation.id,
      type
    });
  } catch (e) {
    logger.warn('[plans-api] Failed to emit operation', { type, planId }, e);
  }
}

/**
 * Get all plans for the current user
 * @param {Object} options - Optional pagination options
 * @param {boolean} options.paginate - Whether to paginate results (default: false)
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 10, max: 50)
 * @returns {Promise<Array|Object>} Array of plans or { data, pagination } if paginated
 */
export function getUserPlans(options = {}) {
  const { paginate = false, page = 1, limit = 10 } = options;

  if (paginate) {
    const params = new URLSearchParams({
      paginate: 'true',
      page: String(page),
      limit: String(limit)
    });
    return sendQueuedRequest(`${BASE_URL}?${params.toString()}`, "GET", null, { label: 'plans/user' });
  }

  return sendQueuedRequest(BASE_URL, "GET", null, { label: 'plans/user' });
}

/**
 * Get a specific plan by ID
 */
export function getPlanById(planId) {
  // Critical navigation - use high priority for instant perception
  return sendQueuedRequest(`${BASE_URL}/${planId}`, "GET", null, {
    priority: PRIORITY.HIGH,
    label: `plan/${planId}`
  });
}

/**
 * Create a new plan for an experience
 * @param {string} experienceId - Experience ID
 * @param {Date|string|null} plannedDate - Planned date for the experience
 * @param {Object} options - Optional parameters
 * @param {string} options.currency - Currency code (default: USD)
 */
export async function createPlan(experienceId, plannedDate, options = {}) {
  const { currency } = options;

  try {
    logger.debug('[plans-api] Calling createPlan API', {
      timestamp: Date.now(),
      experienceId,
      currency
    });

    const requestBody = {
      planned_date: plannedDate,
    };

    // Only include currency if provided
    if (currency) {
      requestBody.currency = currency;
    }

    const result = await sendRequest(`${BASE_URL}/experience/${experienceId}`, "POST", requestBody);

    logger.info('[plans-api] Plan created - API response received', {
      timestamp: Date.now(),
      planId: result._id,
      experienceId
    });

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      // Normalize experienceId for consumers: prefer explicit param, then plan.experience
      const rawExp = experienceId || result?.experience?._id || result?.experience;
      const normalizedExpId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;

      // Generate version for this event (timestamp-based)
      const version = Date.now();

      // Event payload with version and data structure
      const eventPayload = {
        planId: result._id,
        experienceId: normalizedExpId,
        version,
        data: result,
        action: 'plan_created'
      };

      logger.debug('[plans-api] Dispatching plan:created event', {
        timestamp: Date.now(),
        planId: result._id,
        version
      });

      // Standardized event for DataContext, Dashboard, and usePlanManagement
      broadcastEvent('plan:created', eventPayload);

      logger.debug('[plans-api] plan:created event dispatched successfully', {
        timestamp: Date.now(),
        version
      });
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
      // Emit event via event bus (handles local + cross-tab dispatch)
      try {
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
          data: result,
          action: 'plan_updated'
        };

        // Standardized event for DataContext, Dashboard, and usePlanManagement
        broadcastEvent('plan:updated', eventPayload);
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

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    const rawExp = result?.experience?._id || result?.experience || null;
    const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;

    // Generate version for this event
    const version = Date.now();

    // Event payload with version
    const eventPayload = {
      planId,
      experienceId,
      version,
      data: result,
      action: 'plan_deleted'
    };

    // Standardized event for DataContext, Dashboard, and usePlanManagement
    broadcastEvent('plan:deleted', eventPayload);
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
      // Emit events via event bus (handles local + cross-tab dispatch)
      try {
        const rawExp = result?.experience?._id || result?.experience || null;
        const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        const version = Date.now();

        // Standardized event payload
        const eventPayload = {
          planId,
          itemId,
          experienceId,
          version,
          data: result,
          changes: normalizedUpdates,
          action: normalizedUpdates.completed !== undefined
            ? (normalizedUpdates.completed ? 'item_completed' : 'item_uncompleted')
            : 'item_updated'
        };

        // Standardized event for DataContext, Dashboard, and usePlanManagement
        broadcastEvent('plan:updated', eventPayload);

        // Granular item event for real-time updates
        const itemEvent = normalizedUpdates.completed !== undefined
          ? (normalizedUpdates.completed ? 'plan:item:completed' : 'plan:item:uncompleted')
          : 'plan:item:updated';
        broadcastEvent(itemEvent, eventPayload);

        // Specific event for schedule date/time changes (for Timeline view refresh)
        if ('scheduled_date' in normalizedUpdates || 'scheduled_time' in normalizedUpdates) {
          broadcastEvent('plan:item:scheduled', {
            ...eventPayload,
            scheduledDate: normalizedUpdates.scheduled_date,
            scheduledTime: normalizedUpdates.scheduled_time
          });
        }

        // Operation-based event for CRDT sync
        if (normalizedUpdates.completed !== undefined) {
          const opType = normalizedUpdates.completed ? OperationType.COMPLETE_ITEM : OperationType.UNCOMPLETE_ITEM;
          emitOperation(planId, opType, { itemId });
        } else {
          emitOperation(planId, OperationType.UPDATE_ITEM, { itemId, changes: normalizedUpdates });
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
      // Emit events via event bus (handles local + cross-tab dispatch)
      try {
        const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
        const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        const version = Date.now();
        const addedItem = result?.item || result;

        // Standardized event payload
        const eventPayload = {
          planId,
          experienceId,
          version,
          data: result?.plan || result,
          item: addedItem,
          action: 'item_added'
        };

        // Standardized event for DataContext, Dashboard, and usePlanManagement
        broadcastEvent('plan:updated', eventPayload);

        // Granular item event for real-time updates
        broadcastEvent('plan:item:added', eventPayload);

        // Operation-based event for CRDT sync
        emitOperation(planId, OperationType.ADD_ITEM, { item: addedItem });
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
      // Emit events via event bus (handles local + cross-tab dispatch)
      try {
        const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
        const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
        const version = Date.now();

        // Standardized event payload
        const eventPayload = {
          planId,
          itemId,
          experienceId,
          version,
          data: result?.plan || result,
          deletedItemId: itemId,
          action: 'item_deleted'
        };

        // Standardized event for DataContext, Dashboard, and usePlanManagement
        broadcastEvent('plan:updated', eventPayload);

        // Granular item event for real-time updates
        broadcastEvent('plan:item:deleted', eventPayload);

        // Operation-based event for CRDT sync
        emitOperation(planId, OperationType.DELETE_ITEM, { itemId });
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
    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
      const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
      const version = Date.now();
      const permissions = result?.plan?.permissions || result?.permissions || [];
      const collaborator = permissions.find(p => {
        const permUserId = p.user?._id || p.user;
        return permUserId?.toString() === userId?.toString();
      });

      // Standardized event payload
      const eventPayload = {
        planId,
        experienceId,
        version,
        data: result?.plan || result,
        collaboratorAdded: userId,
        collaborator: collaborator || { user: userId, role: 'collaborator' },
        action: 'collaborator_added'
      };

      // Standardized event for DataContext, Dashboard, and usePlanManagement
      broadcastEvent('plan:updated', eventPayload);

      // Granular collaborator event for real-time updates
      broadcastEvent('plan:collaborator:added', eventPayload);

      // Operation-based event for CRDT sync
      emitOperation(planId, OperationType.ADD_COLLABORATOR, { collaborator: collaborator || { user: userId, role: 'collaborator' } });
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
    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const rawExp = result?.plan?.experience?._id || result?.plan?.experience || result?.experience?._id || result?.experience || null;
      const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
      const version = Date.now();

      // Standardized event payload
      const eventPayload = {
        planId,
        experienceId,
        version,
        data: result?.plan || result,
        collaboratorRemoved: userId,
        action: 'collaborator_removed'
      };

      // Standardized event for DataContext, Dashboard, and usePlanManagement
      broadcastEvent('plan:updated', eventPayload);

      // Granular collaborator event for real-time updates
      broadcastEvent('plan:collaborator:removed', eventPayload);

      // Operation-based event for CRDT sync
      emitOperation(planId, OperationType.REMOVE_COLLABORATOR, { userId });
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

    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const rawExp = result?.experience?._id || result?.experience || null;
      const experienceId = rawExp && rawExp.toString ? rawExp.toString() : rawExp;
      const version = Date.now();

      const itemIds = reorderedItems.map(item => item._id || item.plan_item_id).filter(Boolean);

      const eventPayload = {
        planId: result._id,
        experienceId,
        version,
        data: result,
        itemIds,
        action: 'items_reordered'
      };

      // Standardized event for DataContext, Dashboard, and usePlanManagement
      broadcastEvent('plan:updated', eventPayload);

      // Granular item event for real-time updates
      broadcastEvent('plan:item:reordered', eventPayload);

      // Operation-based event for CRDT sync
      emitOperation(planId, OperationType.REORDER_ITEMS, { itemIds });

      logger.debug('[plans-api] Reorder events dispatched successfully', {
        version
      });
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

    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        itemId,
        data: result,
        version,
        action: 'note_added'
      };
      broadcastEvent('plan:updated', eventPayload);

      // Also dispatch specific note event for granular handling
      broadcastEvent('plan:item:note:added', eventPayload);
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

    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        itemId,
        noteId,
        data: result,
        version,
        action: 'note_updated'
      };
      broadcastEvent('plan:updated', eventPayload);

      // Also dispatch specific note event for granular handling
      broadcastEvent('plan:item:note:updated', eventPayload);
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

    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        itemId,
        noteId,
        data: result,
        version,
        action: 'note_deleted'
      };
      broadcastEvent('plan:updated', eventPayload);

      // Also dispatch specific note event for granular handling
      broadcastEvent('plan:item:note:deleted', eventPayload);
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

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      broadcastEvent('plan:updated', { plan: result, version });
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

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      broadcastEvent('plan:updated', { plan: result, version });
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
 * @param {Object} costData - { title, description, cost, currency, category, date, plan_item, collaborator }
 */
export async function addPlanCost(planId, costData) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/costs`, "POST", costData);

    // Return the newly added cost (last item in the costs array)
    const newCost = result.costs[result.costs.length - 1];

    // Emit cost_added event via event bus (handles local + cross-tab dispatch)
    // NOTE: Do NOT emit plan:updated here - it causes duplicate cost rendering
    // The cost_added event is sufficient for state updates
    try {
      const version = Date.now();
      broadcastEvent('plan:cost_added', { plan: result, planId, costData, cost: newCost, version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch cost added event', {}, e);
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
 * @param {Object} updates - { title, description, cost, currency, category, date, plan_item, collaborator }
 */
export async function updatePlanCost(planId, costId, updates) {
  try {
    const result = await sendRequest(`${BASE_URL}/${planId}/costs/${costId}`, "PATCH", updates);

    // Find and return the updated cost
    const updatedCost = result.costs.find(cost => cost._id === costId);

    // Emit cost_updated event via event bus (handles local + cross-tab dispatch)
    // NOTE: Do NOT emit plan:updated here - it causes duplicate state updates
    try {
      const version = Date.now();
      broadcastEvent('plan:cost_updated', { plan: result, planId, costId, updates, cost: updatedCost, version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch cost updated event', {}, e);
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

    // Emit cost_deleted event via event bus (handles local + cross-tab dispatch)
    // NOTE: Do NOT emit plan:updated here - it causes duplicate state updates
    try {
      const version = Date.now();
      broadcastEvent('plan:cost_deleted', { planId, costId, version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch cost deleted event', {}, e);
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

// ============================================
// PLAN ITEM DETAIL MANAGEMENT API FUNCTIONS
// ============================================

/**
 * Add a detail to a plan item (transport, parking, discount, cost, etc.)
 * @param {string} planId - Plan ID
 * @param {string} itemId - Plan item ID
 * @param {Object} detailData - { type, data, document }
 *   - type: 'cost' | 'flight' | 'train' | 'cruise' | 'ferry' | 'bus' | 'hotel' | 'parking' | 'discount'
 *   - data: Object with type-specific fields
 *   - document: Optional document upload data
 */
export async function addPlanItemDetail(planId, itemId, detailData) {
  try {
    logger.debug('[plans-api] Adding plan item detail', {
      planId,
      itemId,
      type: detailData.type
    });

    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/details`, "POST", detailData);

    logger.info('[plans-api] Plan item detail added successfully', {
      planId,
      itemId,
      type: detailData.type
    });

    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        itemId,
        detailType: detailData.type,
        data: result,
        version,
        action: 'detail_added'
      };

      // Standardized event for DataContext and usePlanManagement
      broadcastEvent('plan:updated', eventPayload);

      // Granular detail event for real-time updates
      broadcastEvent('plan:item:detail:added', eventPayload);

      logger.debug('[plans-api] Plan item detail events dispatched', { version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch detail added events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to add plan item detail', {
      planId,
      itemId,
      type: detailData.type,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Update a detail on a plan item
 * @param {string} planId - Plan ID
 * @param {string} itemId - Plan item ID
 * @param {string} detailId - Detail ID
 * @param {Object} updates - Updated fields
 */
export async function updatePlanItemDetail(planId, itemId, detailId, updates) {
  try {
    logger.debug('[plans-api] Updating plan item detail', {
      planId,
      itemId,
      detailId
    });

    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/details/${detailId}`, "PATCH", updates);

    logger.info('[plans-api] Plan item detail updated successfully', {
      planId,
      itemId,
      detailId
    });

    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        itemId,
        detailId,
        data: result,
        updates,
        version,
        action: 'detail_updated'
      };

      // Standardized event for DataContext and usePlanManagement
      broadcastEvent('plan:updated', eventPayload);

      // Granular detail event for real-time updates
      broadcastEvent('plan:item:detail:updated', eventPayload);

      logger.debug('[plans-api] Plan item detail update events dispatched', { version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch detail updated events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to update plan item detail', {
      planId,
      itemId,
      detailId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Delete a detail from a plan item
 * @param {string} planId - Plan ID
 * @param {string} itemId - Plan item ID
 * @param {string} detailId - Detail ID
 */
export async function deletePlanItemDetail(planId, itemId, detailId) {
  try {
    logger.debug('[plans-api] Deleting plan item detail', {
      planId,
      itemId,
      detailId
    });

    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/details/${detailId}`, "DELETE");

    logger.info('[plans-api] Plan item detail deleted successfully', {
      planId,
      itemId,
      detailId
    });

    // Emit events via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        itemId,
        detailId,
        data: result,
        version,
        action: 'detail_deleted'
      };

      // Standardized event for DataContext and usePlanManagement
      broadcastEvent('plan:updated', eventPayload);

      // Granular detail event for real-time updates
      broadcastEvent('plan:item:detail:deleted', eventPayload);

      logger.debug('[plans-api] Plan item detail delete events dispatched', { version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch detail deleted events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to delete plan item detail', {
      planId,
      itemId,
      detailId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Pin or unpin a plan item (toggle)
 * Only one item can be pinned at a time per plan
 * @param {string} planId - Plan ID
 * @param {string} itemId - Plan item ID to pin/unpin
 * @returns {Promise<{success: boolean, pinnedItemId: string|null, action: 'pinned'|'unpinned', message: string}>}
 */
export async function pinPlanItem(planId, itemId) {
  try {
    logger.debug('[plans-api] Toggling plan item pin', { planId, itemId });

    const result = await sendRequest(`${BASE_URL}/${planId}/items/${itemId}/pin`, "PUT");

    logger.info('[plans-api] Plan item pin toggled', {
      planId,
      itemId,
      action: result.action,
      pinnedItemId: result.pinnedItemId
    });

    // Emit granular pin event only (NOT plan:updated)
    // The plan:updated event with partial data { pinnedItemId } causes issues with
    // reconcileState in usePlanManagement hook. The calling component (MyPlanTabContent)
    // handles the optimistic update directly via setSharedPlans, so we only need
    // the granular event for cross-tab sync if needed.
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        itemId,
        pinnedItemId: result.pinnedItemId,
        action: result.action,
        version
      };

      // Granular pin event only - NOT plan:updated to avoid reconcileState issues
      broadcastEvent('plan:item:pinned', eventPayload);

      logger.debug('[plans-api] Plan item pin event dispatched', { version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch pin event', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to toggle plan item pin', {
      planId,
      itemId,
      error: error.message
    }, error);
    throw error;
  }
}

/**
 * Unpin the currently pinned plan item
 * @param {string} planId - Plan ID
 * @returns {Promise<{success: boolean, pinnedItemId: null, message: string}>}
 */
export async function unpinPlanItem(planId) {
  try {
    logger.debug('[plans-api] Unpinning plan item', { planId });

    const result = await sendRequest(`${BASE_URL}/${planId}/pin`, "DELETE");

    logger.info('[plans-api] Plan item unpinned', { planId });

    // Emit events via event bus
    try {
      const version = Date.now();
      const eventPayload = {
        planId,
        pinnedItemId: null,
        action: 'unpinned',
        version
      };

      broadcastEvent('plan:updated', { planId, data: { pinnedItemId: null }, version });
      broadcastEvent('plan:item:pinned', eventPayload);

      logger.debug('[plans-api] Plan item unpin events dispatched', { version });
    } catch (e) {
      logger.warn('[plans-api] Failed to dispatch unpin events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[plans-api] Failed to unpin plan item', {
      planId,
      error: error.message
    }, error);
    throw error;
  }
}
