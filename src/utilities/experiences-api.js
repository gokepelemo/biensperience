import { sendRequest, sendQueuedRequest, PRIORITY } from "./send-request.js";
import { normalizeUrl } from "./url-utils.js";
import { logger } from './logger';
import { broadcastEvent } from './event-bus';

const BASE_URL = `/api/experiences/`

export async function getExperiences(filters = {}) {
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
  // Use queued request for rate limiting and coalescing
  const resp = await sendQueuedRequest(url, "GET", null, { label: 'experiences/list' });
  // Return full response with { data, meta } for pagination support
  return resp;
}

export async function getExperiencesPage(page = 1, limit = 30, filters = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (k.startsWith('__')) return; // Skip client-only filters like __viewSpecific, __noApiParam
    if (v !== undefined && v !== null) params.append(k, v);
  });
  return await sendQueuedRequest(`${BASE_URL}?${params.toString()}`, "GET", null, { label: 'experiences/page' });
}

export async function getExperienceTags(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.append('q', filters.q);
  const url = params.toString() ? `${BASE_URL}tags?${params.toString()}` : `${BASE_URL}tags`;
  const resp = await sendQueuedRequest(url, "GET", null, { label: 'experiences/tags' });
  // Return full response for consistency
  return resp;
}

export async function createExperience(experienceData) {
  const response = await sendRequest(`${BASE_URL}`, "POST", experienceData);
  // Handle standardized API response: { success: true, data: experience }
  const result = (response && response.success && response.data) ? response.data : response;

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
  // Handle standardized API response: { success: true, data: experience }
  if (response && response.success && response.data) {
    return response.data;
  }
  return response;
}

// OPTIMIZATION: Fetch experience with full context (experience + userPlan + sharedPlans)
// Reduces 3 API calls to 1 for dramatically faster page load
export async function showExperienceWithContext(id) {
  // Critical navigation - bypass queue entirely for instant perception
  const response = await sendQueuedRequest(`${BASE_URL}${id}/with-context`, "GET", null, {
    priority: PRIORITY.CRITICAL,
    label: `experience/${id}/context`
  });
  // Handle standardized API response: { success: true, data: { experience, userPlan, sharedPlans } }
  if (response && response.success && response.data) {
    return response.data;
  }
  // If response format is unexpected, throw error to prevent undefined access
  throw new Error(response?.error || 'Failed to fetch experience data');
}

export async function deleteExperience(id) {
  const response = await sendRequest(`${BASE_URL}${id}`, "DELETE");
  // Handle standardized API response: { success: true, data: { deletedPlans, ... } }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(
    `${BASE_URL}${experienceId}/transfer-ownership`,
    "PUT",
    { newOwnerId }
  );
  // Handle standardized API response: { success: true, data: { experience, previousOwner, newOwner } }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(`${BASE_URL}${experienceId}/check-plans`, "GET");
  // Handle standardized API response: { success: true, data: { ... } }
  if (response && response.success && response.data) {
    return response.data;
  }
  return response;
}

/**
 * Archive an experience by transferring ownership to Archive User
 * Stores original owner in archived_owner field
 * Used when owner wants to delete but plans exist
 * @param {string} experienceId - Experience ID to archive
 * @returns {Promise<Object>} Archive result with previous owner info
 */
export async function archiveExperience(experienceId) {
  const response = await sendRequest(`${BASE_URL}${experienceId}/archive`, "POST");
  // Handle standardized API response: { success: true, data: { experience, previousOwner } }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(
    `${BASE_URL}${experienceId}`,
    "PUT",
    experienceData
  );
  // Handle standardized API response: { success: true, data: experience }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(
    `${BASE_URL}${experienceId}/user/${userId}`,
    "DELETE"
  );
  // Handle standardized API response: { success: true, data: plan }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(
    `${BASE_URL}${experienceId}/user/${userId}`,
    "POST",
    data
  );
  // Handle standardized API response: { success: true, data: plan }
  const result = (response && response.success && response.data) ? response.data : response;

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

  const response = await sendRequest(
    `${BASE_URL}${experienceId}/plan-item`,
    "POST",
    normalizedData
  );
  // Handle standardized API response: { success: true, data: planItem }
  const result = (response && response.success && response.data) ? response.data : response;

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

  const response = await sendRequest(
    `${BASE_URL}${experienceId}/plan-item/${planItemData._id}`,
    "PUT",
    normalizedData
  );
  // Handle standardized API response: { success: true, data: planItem }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(
    `${BASE_URL}${experienceId}/plan-item/${planItemId}`,
    "DELETE"
  );
  // Handle standardized API response: { success: true, data: { message, ... } }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(
    `${BASE_URL}${experienceId}/plan-item/${planItemId}`,
    "POST"
  );
  // Handle standardized API response: { success: true, data: planItem }
  const result = (response && response.success && response.data) ? response.data : response;

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
  let response;
  // Only add pagination params if explicitly requested
  if (page !== undefined || limit !== undefined) {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    response = await sendRequest(`${BASE_URL}user/${userId}?${params}`, "GET");
  } else {
    // Default: return all (backwards compatible)
    response = await sendRequest(`${BASE_URL}user/${userId}`, "GET");
  }
  // Handle standardized API response: { success: true, data: [...], meta: {...} }
  // For paginated responses, return the full response with data and meta
  // For non-paginated, extract the data array
  if (response && response.success !== undefined) {
    if (page !== undefined || limit !== undefined) {
      return { data: response.data, meta: response.meta };
    }
    return response.data;
  }
  return response;
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
  let response;
  // Only add pagination params if explicitly requested
  if (page !== undefined || limit !== undefined) {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    response = await sendRequest(`${BASE_URL}user/${userId}/created?${params}`, "GET");
  } else {
    // Default: return all (backwards compatible)
    response = await sendRequest(`${BASE_URL}user/${userId}/created`, "GET");
  }
  // Handle standardized API response: { success: true, data: [...], meta: {...} }
  // For paginated responses, return the full response with data and meta
  // For non-paginated, extract the data array
  if (response && response.success !== undefined) {
    if (page !== undefined || limit !== undefined) {
      return { data: response.data, meta: response.meta };
    }
    return response.data;
  }
  return response;
}

export async function getTagName(tagSlug) {
  const response = await sendRequest(`${BASE_URL}tag/${tagSlug}`, "GET");
  // Handle standardized API response: { success: true, data: { tagName } }
  if (response && response.success && response.data) {
    return response.data;
  }
  return response;
}

/**
 * Add a collaborator permission to an experience
 */
export async function addExperienceCollaborator(experienceId, userId) {
  const response = await sendRequest(`${BASE_URL}${experienceId}/permissions`, "POST", {
    _id: userId,
    entity: 'user',
    type: 'collaborator'
  });
  // Handle standardized API response: { success: true, data: experience }
  const result = (response && response.success && response.data) ? response.data : response;

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
  const response = await sendRequest(
    `${BASE_URL}${experienceId}/permissions/${userId}/user`,
    "DELETE"
  );
  // Handle standardized API response: { success: true, data: experience }
  const result = (response && response.success && response.data) ? response.data : response;

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

    const response = await sendRequest(
      `${BASE_URL}${experienceId}/reorder-plan-items`,
      "PUT",
      { plan_items: reorderedItems }
    );
    // Handle standardized API response: { success: true, data: experience }
    const result = (response && response.success && response.data) ? response.data : response;

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
