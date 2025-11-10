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