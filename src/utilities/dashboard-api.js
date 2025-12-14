import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/dashboard';

/**
 * Get dashboard data for the current user
 * Returns stats, recent activity, and upcoming plans
 */
export async function getDashboardData() {
  try {
    // Add timestamp to prevent caching
    const url = `${BASE_URL}?_t=${Date.now()}`;
    const result = await sendRequest(url);
    // The API controllers use a standard success response wrapper:
    // { success: true, data: { stats, recentActivity, upcomingPlans } }
    // Unwrap `data` for callers so they receive { stats, recentActivity, upcomingPlans } directly.
    const payload = (result && result.data) ? result.data : result || {};

    logger.debug('[dashboard-api] Dashboard data fetched', {
      stats: payload.stats,
      activityCount: payload.recentActivity?.length || 0,
      upcomingPlansCount: payload.upcomingPlans?.length || 0
    });

    return payload;
  } catch (error) {
    logger.error('[dashboard-api] Failed to fetch dashboard data', error);
    throw error;
  }
}

/**
 * Get paginated activity feed for the current user
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @param {Object} options - Additional options
 * @param {Array<string>} options.actions - Filter by specific action types
 * @param {Array<string>} options.resourceTypes - Filter by specific resource types (e.g., 'Experience', 'Destination')
 * @returns {Promise<Object>} Activities and pagination metadata
 */
export async function getActivityFeed(page = 1, limit = 20, options = {}) {
  try {
    const params = new URLSearchParams({ page, limit });

    // Add actions filter if provided
    if (options.actions && Array.isArray(options.actions) && options.actions.length > 0) {
      params.set('actions', options.actions.join(','));
    }

    // Add resourceTypes filter if provided
    if (options.resourceTypes && Array.isArray(options.resourceTypes) && options.resourceTypes.length > 0) {
      params.set('resourceTypes', options.resourceTypes.join(','));
    }

    const url = `${BASE_URL}/activity-feed?${params.toString()}`;
    const result = await sendRequest(url);
    const payload = (result && result.data) ? result.data : result || {};

    logger.debug('[dashboard-api] Activity feed fetched', {
      page,
      limit,
      actions: options.actions,
      resourceTypes: options.resourceTypes,
      activitiesCount: payload.activities?.length || 0,
      hasMore: payload.pagination?.hasMore
    });

    return payload;
  } catch (error) {
    logger.error('[dashboard-api] Failed to fetch activity feed', error);
    throw error;
  }
}

/**
 * Get paginated upcoming plans from server
 * @param {number} page
 * @param {number} limit
 */
export async function getUpcomingPlans(page = 1, limit = 5) {
  try {
    const url = `${BASE_URL}/upcoming-plans?page=${page}&limit=${limit}`;
    const result = await sendRequest(url);
    const payload = (result && result.data) ? result.data : result || {};

    logger.debug('[dashboard-api] Upcoming plans fetched', {
      page,
      limit,
      plansCount: payload.plans?.length || 0,
      totalPages: payload.pagination?.totalPages
    });

    return payload;
  } catch (error) {
    logger.error('[dashboard-api] Failed to fetch upcoming plans', error);
    throw error;
  }
}