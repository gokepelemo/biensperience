const mongoose = require('mongoose');
const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Activity = require('../../models/activity');
const { successResponse, errorResponse } = require('../../utilities/controller-helpers');
const backendLogger = require('../../utilities/backend-logger');

/**
 * Get dashboard data for the authenticated user
 * Optimized with efficient MongoDB aggregation queries
 */
async function getDashboard(req, res) {
  try {
    const userId = req.user._id;
    backendLogger.info('Fetching dashboard data', { userId: userId.toString() });

    // Execute all dashboard queries in parallel for optimal performance
    const [
      statsResult,
      recentActivityResult,
      upcomingPlansResult
    ] = await Promise.all([
      getDashboardStats(userId),
      getRecentActivity(userId),
      getUpcomingPlans(userId)
    ]);

    const dashboardData = {
      stats: statsResult,
      recentActivity: recentActivityResult,
      upcomingPlans: upcomingPlansResult
    };

    backendLogger.info('Dashboard data fetched successfully', {
      userId: userId.toString(),
      stats: statsResult,
      activityCount: recentActivityResult.length,
      upcomingPlansCount: upcomingPlansResult.length
    });

    return successResponse(res, dashboardData);
  } catch (error) {
    backendLogger.error('Error fetching dashboard data', {
      userId: req.user._id.toString(),
      error: error.message
    }, error);
    return errorResponse(res, error, 'Error fetching dashboard data');
  }
}

/**
 * Get dashboard statistics using optimized aggregation queries
 */
async function getDashboardStats(userId) {
  try {
    // Get plan count and total spent separately to avoid aggregation issues
    const planQuery = {
      $or: [
        { user: userId },
        { 'permissions._id': userId, 'permissions.entity': 'user' }
      ]
    };

    const planCount = await Plan.countDocuments(planQuery);

    // Calculate total spent by summing all plan item costs
    const plans = await Plan.find(planQuery).select('plan').lean();
    let totalSpent = 0;
    plans.forEach(plan => {
      plan.plan.forEach(item => {
        totalSpent += item.cost || 0;
      });
    });

    // Get experience and destination counts using efficient queries
    const [experienceCount, destinationCount] = await Promise.all([
      Experience.countDocuments({
        $or: [
          { user: userId },
          { 'permissions._id': userId, 'permissions.entity': 'user' }
        ]
      }),
      Destination.countDocuments({
        $or: [
          { user: userId },
          { 'permissions._id': userId, 'permissions.entity': 'user' }
        ]
      })
    ]);

    return {
      activePlans: planCount || 0,
      experiences: experienceCount || 0,
      destinations: destinationCount || 0,
      totalSpent: totalSpent || 0
    };
  } catch (error) {
    backendLogger.error('Error in getDashboardStats', { userId: userId.toString(), error: error.message });
    // Return default values on error
    return {
      activePlans: 0,
      experiences: 0,
      destinations: 0,
      totalSpent: 0
    };
  }
}

/**
 * Get recent activity for the user
 * Optimized query with proper indexing on timestamp
 */
async function getRecentActivity(userId) {
  try {
    const activities = await Activity.find({
      'actor._id': userId // Activities performed by the user
    })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

    // Transform activities into user-friendly format
    return activities.map(activity => ({
      id: activity._id,
      action: formatActivityAction(activity.action),
      item: activity.resource?.name || 'Unknown',
      time: formatTimeAgo(activity.timestamp),
      timestamp: activity.timestamp
    }));
  } catch (error) {
    backendLogger.error('Error in getRecentActivity', { userId: userId.toString(), error: error.message });
    return []; // Return empty array on error
  }
}

/**
 * Get upcoming plans for the user
 */
async function getUpcomingPlans(userId) {
  try {
    const plans = await Plan.find({
      $or: [
        { user: userId },
        { 'permissions._id': userId, 'permissions.entity': 'user' }
      ],
      planned_date: { $gte: new Date() } // Future dates only
    })
    .populate('experience', 'name')
    .sort({ planned_date: 1 })
    .limit(5)
    .lean();

    return plans.map(plan => ({
      id: plan._id,
      title: plan.experience?.name || 'Unknown Experience',
      date: plan.planned_date ? formatDate(plan.planned_date) : null
    }));
  } catch (error) {
    backendLogger.error('Error in getUpcomingPlans', { userId: userId.toString(), error: error.message });
    return []; // Return empty array on error
  }
}

/**
 * Format activity action into user-friendly text
 */
function formatActivityAction(action) {
  const actionMap = {
    'resource_created': 'Created',
    'resource_updated': 'Updated',
    'resource_deleted': 'Deleted',
    'plan_created': 'Created plan for',
    'plan_updated': 'Updated plan for',
    'plan_deleted': 'Removed plan for',
    'permission_added': 'Shared',
    'permission_removed': 'Unshared',
    'user_registered': 'Joined',
    'email_verified': 'Verified email',
    'plan_item_completed': 'Completed item in',
    'plan_item_uncompleted': 'Uncompleted item in'
  };

  return actionMap[action] || action.replace(/_/g, ' ');
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 */
function formatTimeAgo(timestamp) {
  const now = new Date();
  const diffMs = now - new Date(timestamp);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format date for display
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

module.exports = {
  getDashboard
};