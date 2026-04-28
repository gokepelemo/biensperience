import { sendApi, sendApiWithMeta } from "./api-client.js";
import { sendQueuedRequest, PRIORITY } from "./send-request.js";
import { normalizeUrl } from "./url-utils.js";
import { logger } from './logger';
import { broadcastEvent } from './event-bus';

const BASE_URL = `/api/experiences/`

/**
 * Determine whether a queued response is a standard envelope.
 */
function isEnvelope(response) {
  return response && typeof response === 'object' && 'success' in response;
}

export async function getExperiences(filters = {}, requestOptions = {}) {
  // Fetch first page of experiences (default limit=30)
  // Allow callers to override page/limit by passing them in `filters`.
  const pageParam = filters && filters.page ? String(filters.page) : '1';
  const limitParam = filters && filters.limit ? String(filters.limit) : '30';
  const params = new URLSearchParams({ page: pageParam, limit: limitParam });
  // append filters (skip page/limit since already applied, skip client-only filters starting with __)
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (k === 'page' || k === 'limit') return;
    if (k.startsWith('__')) return; // Skip client-only filters like __viewSpecific, __noApiParam
    if (v !== undefined && v !== null) params.append(k, v);
  });
  const url = `${BASE_URL}?${params.toString()}`;
  logger.debug('getExperiences request', { url, filters });
  // Use queued request for rate limiting and coalescing.
  // Return the full envelope { data, meta } for pagination support — preserves
  // the historical contract where callers receive { success, data, meta }.
  return await sendQueuedRequest(url, "GET", null, { label: 'experiences/list', ...requestOptions });
}

export async function getExperiencesPage(page = 1, limit = 30, filters = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (k.startsWith('__')) return; // Skip client-only filters like __viewSpecific, __noApiParam
    if (v !== undefined && v !== null) params.append(k, v);
  });
  return await sendQueuedRequest(`${BASE_URL}?${params.toString()}`, "GET", null, { label: 'experiences/page', priority: PRIORITY.HIGH });
}

export async function getExperienceTags(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.append('q', filters.q);
  const url = params.toString() ? `${BASE_URL}tags?${params.toString()}` : `${BASE_URL}tags`;
  // Return full response for consistency
  return await sendQueuedRequest(url, "GET", null, { label: 'experiences/tags', priority: PRIORITY.HIGH });
}

export async function createExperience(experienceData) {
  const result = await sendApi("POST", `${BASE_URL}`, experienceData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for created events
  try {
    if (result) {
      broadcastEvent('experience:created', { experience: result, experienceId: result._id });
      logger.debug('[experiences-api] Experience created event dispatched', { id: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function showExperience(id) {
  // Critical navigation - use high priority for instant perception
  const response = await sendQueuedRequest(`${BASE_URL}${id}`, "GET", null, {
    priority: PRIORITY.HIGH,
    label: `experience/${id}`
  });
  return isEnvelope(response) ? response.data : response;
}

// OPTIMIZATION: Fetch experience with full context (experience + userPlan + sharedPlans)
// Reduces 3 API calls to 1 for dramatically faster page load
export async function showExperienceWithContext(id) {
  // Critical navigation - bypass queue entirely for instant perception
  const response = await sendQueuedRequest(`${BASE_URL}${id}/with-context`, "GET", null, {
    priority: PRIORITY.CRITICAL,
    label: `experience/${id}/context`
  });
  if (isEnvelope(response)) {
    return response.data;
  }
  if (!response) {
    throw new Error('Failed to fetch experience data');
  }
  return response;
}

export async function deleteExperience(id) {
  // Backend returns { success, data: { deletedPlans, ... } }
  const result = await sendApi("DELETE", `${BASE_URL}${id}`);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    // Emit experience:deleted event
    broadcastEvent('experience:deleted', { experienceId: id });
    logger.debug('[experiences-api] Experience deleted event dispatched', { id });

    // Emit plan:deleted events for cascade-deleted plans
    // This allows Dashboard and other views to update their plan lists
    if (result?.deletedPlans?.plans?.length > 0) {
      for (const deletedPlan of result.deletedPlans.plans) {
        broadcastEvent('plan:deleted', {
          planId: deletedPlan.planId,
          experienceId: id,
          userId: deletedPlan.userId,
          cascadeDelete: true
        });
      }
      logger.debug('[experiences-api] Cascade plan:deleted events dispatched', {
        experienceId: id,
        planCount: result.deletedPlans.count
      });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function transferOwnership(experienceId, newOwnerId) {
  const result = await sendApi("PUT", `${BASE_URL}${experienceId}/transfer-ownership`, { newOwnerId });

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result && result.experience) {
      broadcastEvent('experience:updated', { experience: result.experience, experienceId });
      logger.debug('[experiences-api] Experience ownership transferred event dispatched', { experienceId, newOwnerId });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

/**
 * Check if an experience has plans before deletion
 * Returns plan count and users with plans for ownership transfer UI
 * @param {string} experienceId - Experience ID to check
 * @returns {Promise<Object>} Object with plan info and users with plans
 */
export async function checkExperiencePlans(experienceId) {
  return await sendApi("GET", `${BASE_URL}${experienceId}/check-plans`);
}

/**
 * Archive an experience by transferring ownership to Archive User
 * Stores original owner in archived_owner field
 * Used when owner wants to delete but plans exist
 * @param {string} experienceId - Experience ID to archive
 * @returns {Promise<Object>} Archive result with previous owner info
 */
export async function archiveExperience(experienceId) {
  const result = await sendApi("POST", `${BASE_URL}${experienceId}/archive`);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result && result.experience) {
      broadcastEvent('experience:archived', { experience: result.experience, experienceId });
      logger.debug('[experiences-api] Experience archived event dispatched', { experienceId });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function updateExperience(experienceId, experienceData) {
  const result = await sendApi("PUT", `${BASE_URL}${experienceId}`, experienceData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for updated events
  try {
    if (result) {
      broadcastEvent('experience:updated', { experience: result, experienceId: result._id });
      logger.debug('[experiences-api] Experience updated event dispatched', { id: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function userRemoveExperience(userId, experienceId) {
  const result = await sendApi("DELETE", `${BASE_URL}${experienceId}/user/${userId}`);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    broadcastEvent('plan:deleted', { planId: result?._id, experienceId, userId });
    logger.debug('[experiences-api] User plan removed event dispatched', { experienceId, userId });
  } catch (e) {
    // ignore
  }

  return result;
}

export async function userAddExperience(userId, experienceId, data = {}) {
  const result = await sendApi("POST", `${BASE_URL}${experienceId}/user/${userId}`, data);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId, ...context } for created events
  try {
    if (result) {
      broadcastEvent('plan:created', { plan: result, planId: result._id, experienceId, userId });
      logger.debug('[experiences-api] User plan created event dispatched', { experienceId, userId, planId: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function addPlanItem(experienceId, planItemData) {
  // Normalize URL if present
  const normalizedData = {
    ...planItemData,
    url: planItemData.url ? normalizeUrl(planItemData.url) : planItemData.url
  };

  const result = await sendApi("POST", `${BASE_URL}${experienceId}/plan-item`, normalizedData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result) {
      broadcastEvent('experience:item:added', { experienceId, planItem: result });
      logger.debug('[experiences-api] Plan item added event dispatched', { experienceId, planItemId: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function updatePlanItem(experienceId, planItemData) {
  // Normalize URL if present
  const normalizedData = {
    ...planItemData,
    url: planItemData.url ? normalizeUrl(planItemData.url) : planItemData.url
  };

  const result = await sendApi("PUT", `${BASE_URL}${experienceId}/plan-item/${planItemData._id}`, normalizedData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result) {
      broadcastEvent('experience:item:updated', { experienceId, planItem: result, planItemId: planItemData._id });
      logger.debug('[experiences-api] Plan item updated event dispatched', { experienceId, planItemId: planItemData._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function deletePlanItem(experienceId, planItemId) {
  const result = await sendApi("DELETE", `${BASE_URL}${experienceId}/plan-item/${planItemId}`);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    broadcastEvent('experience:item:deleted', { experienceId, planItemId });
    logger.debug('[experiences-api] Plan item deleted event dispatched', { experienceId, planItemId });
  } catch (e) {
    // ignore
  }

  return result;
}

export async function userPlanItemDone(experienceId, planItemId) {
  const result = await sendApi("POST", `${BASE_URL}${experienceId}/plan-item/${planItemId}`);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result) {
      broadcastEvent('experience:item:completed', { experienceId, planItemId, planItem: result });
      logger.debug('[experiences-api] Plan item completed event dispatched', { experienceId, planItemId });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

/**
 * Get experiences where a user has created plans
 * @param {string} userId - User ID
 * @param {Object} [options] - Optional pagination options
 * @param {number} [options.page] - Page number (1-indexed) - if provided, enables pagination
 * @param {number} [options.limit] - Items per page (default 12 when paginated)
 * @returns {Promise<Array|{data: Array, meta: {page, limit, total, totalPages, hasMore}}>}
 *          Returns array if no pagination, or paginated response if page/limit provided
 */
export async function showUserExperiences(userId, options = {}) {
  const { page, limit } = options;
  // For paginated requests, callers expect { data, meta }; for non-paginated, the array.
  if (page !== undefined || limit !== undefined) {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    return await sendApiWithMeta("GET", `${BASE_URL}user/${userId}?${params}`);
  }
  // Default: return all (backwards compatible) - just the data array.
  return await sendApi("GET", `${BASE_URL}user/${userId}`);
}

/**
 * Get experiences created/owned by a user
 * @param {string} userId - User ID
 * @param {Object} [options] - Optional pagination options
 * @param {number} [options.page] - Page number (1-indexed) - if provided, enables pagination
 * @param {number} [options.limit] - Items per page (default 12 when paginated)
 * @returns {Promise<Array|{data: Array, meta: {page, limit, total, totalPages, hasMore}}>}
 *          Returns array if no pagination, or paginated response if page/limit provided
 */
export async function showUserCreatedExperiences(userId, options = {}) {
  const { page, limit } = options;
  if (page !== undefined || limit !== undefined) {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    return await sendApiWithMeta("GET", `${BASE_URL}user/${userId}/created?${params}`);
  }
  return await sendApi("GET", `${BASE_URL}user/${userId}/created`);
}

export async function getTagName(tagSlug) {
  return await sendApi("GET", `${BASE_URL}tag/${tagSlug}`);
}

/**
 * Get permissions for an experience (direct permissions array).
 * Used to replicate collaborators from an owned experience to another entity.
 * @param {string} experienceId - Experience ID
 * @returns {Promise<Object>} { owner, permissions, directPermissions }
 */
export async function getExperiencePermissions(experienceId) {
  return await sendApi("GET", `${BASE_URL}${experienceId}/permissions`);
}

/**
 * Add a collaborator permission to an experience
 */
export async function addExperienceCollaborator(experienceId, userId) {
  const result = await sendApi("POST", `${BASE_URL}${experienceId}/permissions`, {
    _id: userId,
    entity: 'user',
    type: 'collaborator'
  });

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result) {
      broadcastEvent('experience:collaborator:added', { experienceId, userId, experience: result });
      logger.debug('[experiences-api] Experience collaborator added event dispatched', { experienceId, userId });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

/**
 * Remove a collaborator permission from an experience
 */
export async function removeExperienceCollaborator(experienceId, userId) {
  const result = await sendApi("DELETE", `${BASE_URL}${experienceId}/permissions/${userId}/user`);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    broadcastEvent('experience:collaborator:removed', { experienceId, userId, experience: result });
    logger.debug('[experiences-api] Experience collaborator removed event dispatched', { experienceId, userId });
  } catch (e) {
    // ignore
  }

  return result;
}

/**
 * Reorder experience plan items
 */
export async function reorderExperiencePlanItems(experienceId, reorderedItems) {
  try {
    logger.debug('[experiences-api] Reordering experience plan items', {
      experienceId,
      itemCount: reorderedItems.length,
      firstItemSample: reorderedItems[0] ? {
        _id: reorderedItems[0]._id,
        name: reorderedItems[0].name,
        hasAllFields: !!(reorderedItems[0]._id && reorderedItems[0].name)
      } : null
    });

    const result = await sendApi("PUT", `${BASE_URL}${experienceId}/reorder-plan-items`, { plan_items: reorderedItems });

    logger.info('[experiences-api] Experience plan items reordered successfully', {
      experienceId,
      itemCount: reorderedItems.length
    });

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      const version = Date.now();

      const eventPayload = {
        experienceId: result._id,
        version,
        data: result,
        experience: result, // DataContext expects 'experience' key
        reordered: true
      };

      broadcastEvent('experience:updated', eventPayload);

      // Also emit experience:item:reordered for usePlanSync to detect divergence
      broadcastEvent('experience:item:reordered', {
        experienceId: result._id,
        planItems: result.plan_items,
        version
      });

      logger.debug('[experiences-api] Reorder events dispatched successfully', { version });
    } catch (e) {
      logger.warn('[experiences-api] Failed to dispatch reorder events', {}, e);
    }

    return result;
  } catch (error) {
    logger.error('[experiences-api] Failed to reorder experience plan items', {
      experienceId,
      error: error.message
    }, error);
    throw error;
  }
}
