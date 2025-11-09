import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/dashboard';

/**
 * Get dashboard data for the current user
 * Returns stats, recent activity, and upcoming plans
 */
export async function getDashboardData() {
  try {
    const result = await sendRequest(BASE_URL);
    logger.debug('[dashboard-api] Dashboard data fetched', {
      stats: result.stats,
      activityCount: result.recentActivity?.length || 0,
      upcomingPlansCount: result.upcomingPlans?.length || 0
    });
    return result;
  } catch (error) {
    logger.error('[dashboard-api] Failed to fetch dashboard data', error);
    throw error;
  }
}