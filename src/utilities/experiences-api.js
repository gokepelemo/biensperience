import { sendRequest } from "./send-request.js";
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
  const resp = await sendRequest(url, "GET");
  // Return full response with { data, meta } for pagination support
  return resp;
}

export async function getExperiencesPage(page = 1, limit = 30, filters = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  Object.entries(filters || {}).forEach(([k, v]) => {
    if (k.startsWith('__')) return; // Skip client-only filters like __viewSpecific, __noApiParam
    if (v !== undefined && v !== null) params.append(k, v);
  });
  return await sendRequest(`${BASE_URL}?${params.toString()}`, "GET");
}

export async function getExperienceTags(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.append('q', filters.q);
  const url = params.toString() ? `${BASE_URL}tags?${params.toString()}` : `${BASE_URL}tags`;
  const resp = await sendRequest(url, "GET");
  // Return full response for consistency
  return resp;
}

export async function createExperience(experienceData) {
  const result = await sendRequest(`${BASE_URL}`, "POST", experienceData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result) {
      broadcastEvent('experience:created', { experience: result });
      logger.debug('[experiences-api] Experience created event dispatched', { id: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function showExperience(id) {
  return await sendRequest(`${BASE_URL}${id}`, "GET");
}

// OPTIMIZATION: Fetch experience with full context (experience + userPlan + collaborativePlans)
// Reduces 3 API calls to 1 for dramatically faster page load
export async function showExperienceWithContext(id) {
  return await sendRequest(`${BASE_URL}${id}/with-context`, "GET");
}

export async function deleteExperience(id) {
  const result = await sendRequest(`${BASE_URL}${id}`, "DELETE");

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    broadcastEvent('experience:deleted', { experienceId: id });
    logger.debug('[experiences-api] Experience deleted event dispatched', { id });
  } catch (e) {
    // ignore
  }

  return result;
}

export async function transferOwnership(experienceId, newOwnerId) {
  return await sendRequest(
    `${BASE_URL}${experienceId}/transfer-ownership`,
    "PUT",
    { newOwnerId }
  );
}

export async function updateExperience(experienceId, experienceData) {
  const result = await sendRequest(
    `${BASE_URL}${experienceId}`,
    "PUT",
    experienceData
  );

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result) {
      broadcastEvent('experience:updated', { experience: result });
      logger.debug('[experiences-api] Experience updated event dispatched', { id: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
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
  // Only add pagination params if explicitly requested
  if (page !== undefined || limit !== undefined) {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    return await sendRequest(`${BASE_URL}user/${userId}?${params}`, "GET");
  }
  // Default: return all (backwards compatible)
  return await sendRequest(`${BASE_URL}user/${userId}`, "GET");
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
  // Only add pagination params if explicitly requested
  if (page !== undefined || limit !== undefined) {
    const params = new URLSearchParams();
    if (page !== undefined) params.set('page', String(page));
    if (limit !== undefined) params.set('limit', String(limit));
    return await sendRequest(`${BASE_URL}user/${userId}/created?${params}`, "GET");
  }
  // Default: return all (backwards compatible)
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

    const result = await sendRequest(
      `${BASE_URL}${experienceId}/reorder-plan-items`,
      "PUT",
      { plan_items: reorderedItems }
    );

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
