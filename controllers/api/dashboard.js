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
    console.log('getDashboard called with user:', req.user._id.toString());
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

    console.log('API Response dashboardData:', dashboardData);
    console.log('API Response stats:', dashboardData.stats);
    console.log('API Response activePlansDetails:', dashboardData.stats?.activePlansDetails);

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
    backendLogger.info('Calculating dashboard stats for user', { userId: userId.toString() });

    // Fetch plans the user owns or has permissions on
    const plans = await Plan.find({
      $or: [
        { user: userId },
        { 'permissions._id': userId, 'permissions.entity': 'user' }
      ]
    }).populate('experience', 'name').lean();

    // If no plans found for the user, fall back to a lightweight sample check to aid debugging
    if (plans.length === 0) {
      const allPlans = await Plan.find({}).populate('experience', 'name').limit(10).lean();
      backendLogger.info('No plans found for user, sample from DB', {
        userId: userId.toString(),
        totalPlansInDb: allPlans.length,
        samplePlanUsers: allPlans.slice(0, 3).map(p => ({ planId: p._id?.toString(), user: p.user?.toString(), permissions: p.permissions }))
      });
    }

    // Calculate detailed plan metrics
    let totalSpent = 0;
    let ownedPlans = 0;
    let sharedPlans = 0;
    let completedPlans = 0;

    plans.forEach(plan => {
      // Sum costs
      (plan.plan || []).forEach(item => {
        totalSpent += item.cost || 0;
      });

      // Determine user's permission on the plan
      const userPermission = (plan.permissions || []).find(p => p._id?.toString() === userId.toString() && p.entity === 'user');

      backendLogger.debug('Processing plan for stats', {
        planId: plan._id?.toString(),
        planUser: plan.user?.toString(),
        userPermission
      });

      if (userPermission) {
        if (userPermission.type === 'owner') ownedPlans++;
        else if (userPermission.type === 'collaborator') sharedPlans++;
        // contributors don't count as active plans
      } else if (plan.user?.toString() === userId.toString()) {
        // fallback: direct owner
        ownedPlans++;
      }

      const totalItems = (plan.plan || []).length;
      const completedItems = (plan.plan || []).filter(i => i.complete).length;
      if (totalItems > 0 && completedItems === totalItems) completedPlans++;
    });

    const totalPlans = ownedPlans + sharedPlans;

    backendLogger.info('Dashboard stats calculated', {
      userId: userId.toString(),
      totalPlans,
      ownedPlans,
      sharedPlans,
      completedPlans,
      totalSpent
    });

    // Efficient counts for experiences and destinations related to the user
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
      activePlans: totalPlans || 0,
      activePlansDetails: {
        totalPlans: totalPlans || 0,
        ownedPlans: ownedPlans || 0,
        sharedPlans: sharedPlans || 0,
        completedPlans: completedPlans || 0
      },
      experiences: experienceCount || 0,
      destinations: destinationCount || 0,
      totalSpent: totalSpent || 0
    };
  } catch (error) {
    backendLogger.error('Error in getDashboardStats', { userId: userId.toString(), error: error.message });
    // Return safe defaults on error
    return {
      activePlans: 0,
      activePlansDetails: {
        totalPlans: 0,
        ownedPlans: 0,
        sharedPlans: 0,
        completedPlans: 0
      },
      experiences: 0,
      destinations: 0,
      totalSpent: 0
    };
  }
}

/**
 * Get recent activity for the user
    if (plans.length === 0) {
      const allPlans = await Plan.find({}).populate('experience', 'name').limit(10).lean();
      backendLogger.info('No plans found with user query, checking all plans', {
        userId: userId.toString(),
        totalPlansInDb: allPlans.length,
        samplePlanUsers: allPlans.slice(0, 3).map(p => ({
          planId: p._id.toString(),
          user: p.user?.toString(),
          permissions: p.permissions
        }))
      });
    }

    // Calculate detailed plan metrics
    let totalSpent = 0;
    let ownedPlans = 0;
    let sharedPlans = 0;
    let completedPlans = 0;

    plans.forEach(plan => {
      // Calculate total spent
      plan.plan.forEach(item => {
        totalSpent += item.cost || 0;
      });

      // Check user's permission level for this plan
      const userPermission = plan.permissions?.find(p =>
        p._id?.toString() === userId.toString() && p.entity === 'user'
      );

      backendLogger.info('Processing plan', {
        planId: plan._id.toString(),
        planUser: plan.user?.toString(),
        userPermission: userPermission,
        permissions: plan.permissions
      });

      // Determine if this is an owned or shared plan
      if (userPermission) {
        if (userPermission.type === 'owner') {
          ownedPlans++;
        } else if (userPermission.type === 'collaborator') {
          sharedPlans++;
        }
        // Skip contributor permissions - they don't count as active plans
      } else if (plan.user?.toString() === userId.toString()) {
        // Fallback: if no permissions but user is the direct owner, count as owned
        ownedPlans++;
      }

      // Count completed plans (all items completed)
      const totalItems = plan.plan.length;
      const completedItems = plan.plan.filter(item => item.complete).length;
      if (totalItems > 0 && completedItems === totalItems) {
        completedPlans++;
      }
    });

    const totalPlans = ownedPlans + sharedPlans;

    backendLogger.info('Dashboard stats calculated', {
      userId: userId.toString(),
      totalPlans,
      ownedPlans,
      sharedPlans,
      completedPlans,
      totalSpent
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
      activePlans: totalPlans || 0,
      activePlansDetails: {
        totalPlans: totalPlans || 0,
        ownedPlans: ownedPlans || 0,
        sharedPlans: sharedPlans || 0,
        completedPlans: completedPlans || 0,
      },
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
 * @param {ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of activities to return (default: 10)
 * @param {number} options.skip - Number of activities to skip (default: 0)
 * @returns {Promise<Array>} Array of enriched activities
 */
async function getRecentActivity(userId, options = {}) {
  try {
    const { limit = 10, skip = 0 } = options;

    const activities = await Activity.find({
      'actor._id': userId // Activities performed by the user
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

    // For each activity, populate related data if needed
    const enrichedActivities = await Promise.all(activities.map(async (activity) => {
      let resourceName = activity.resource?.name || 'Unnamed';
      let resourceLink = null;
      let targetName = activity.target?.name || null;

      // For plan-related activities, populate the experience name and create deep link
      if (activity.resource?.type === 'Plan') {
        try {
          const plan = await Plan.findById(activity.resource.id).populate('experience', 'name').lean();
          if (plan && plan.experience) {
            resourceName = plan.experience.name;
            // Create hash-based deep link to specific plan
            resourceLink = `/experiences/${plan.experience._id}#plan-${plan._id}`;
          }
        } catch (err) {
          backendLogger.warn('Failed to populate plan experience for activity', { activityId: activity._id });
        }
      }

      // For experience activities
      if (activity.resource?.type === 'Experience') {
        resourceLink = `/experiences/${activity.resource.id}`;
      }

      // For destination activities
      if (activity.resource?.type === 'Destination') {
        resourceLink = `/destinations/${activity.resource.id}`;
      }

      // For plan item completion, show both the plan (experience) and the item
      if ((activity.action === 'plan_item_completed' || activity.action === 'plan_item_uncompleted') && activity.target) {
        targetName = activity.target.name;
      }

      return {
        id: activity._id.toString(),
        action: formatActivityAction(activity.action),
        item: resourceName,
        targetItem: targetName,
        link: resourceLink,
        time: formatTimeAgo(activity.timestamp),
        timestamp: activity.timestamp,
        resourceType: activity.resource?.type
      };
    }));

    return enrichedActivities;
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
      experienceId: plan.experience?._id,
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
    'plan_created': 'Created a plan on',
    'plan_updated': 'Updated a plan on',
    'plan_deleted': 'Deleted a plan from',
    'permission_added': 'Shared',
    'permission_removed': 'Unshared',
    'user_registered': 'Joined Biensperience',
    'email_verified': 'Verified email address',
    'plan_item_completed': 'Marked a plan item complete on',
    'plan_item_uncompleted': 'Marked a plan item incomplete on'
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

/**
 * Get paginated activity feed for the authenticated user
 * Supports infinite scroll with cursor-based pagination
 */
async function getActivityFeed(req, res) {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    backendLogger.info('Fetching activity feed', {
      userId: userId.toString(),
      page,
      limit,
      skip
    });

    // Get total count for pagination metadata
    const totalCount = await Activity.countDocuments({
      'actor._id': userId
    });

    // Get activities with pagination
    const activities = await getRecentActivity(userId, { limit, skip });

    const response = {
      activities,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + activities.length < totalCount
      }
    };

    backendLogger.info('Activity feed fetched successfully', {
      userId: userId.toString(),
      activitiesCount: activities.length,
      totalCount,
      hasMore: response.pagination.hasMore
    });

    return successResponse(res, response);
  } catch (error) {
    backendLogger.error('Error fetching activity feed', {
      userId: req.user._id.toString(),
      error: error.message
    }, error);
    return errorResponse(res, error, 'Error fetching activity feed');
  }
}

module.exports = {
  getDashboard,
  getActivityFeed
};