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

    backendLogger.info('Fetching recent activity', {
      userId: userId.toString(),
      limit,
      skip
    });

    // Find activities where user is either:
    // 1. The actor (performed the action)
    // 2. The target (action was performed on them)
    // This ensures users see all relevant activities including:
    // - Actions they performed (plan item completions, adding collaborators)
    // - Actions performed on them (being added as collaborator)
    const activities = await Activity.find({
      $or: [
        { 'actor._id': userId },    // Activities performed by the user
        { 'target.id': userId }      // Activities performed on the user
      ]
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

    backendLogger.info('Activities found', {
      userId: userId.toString(),
      count: activities.length,
      actions: activities.map(a => ({
        id: a._id?.toString(),
        action: a.action,
        timestamp: a.timestamp,
        resourceType: a.resource?.type,
        resourceId: a.resource?.id?.toString(),
        resourceName: a.resource?.name,
        actorId: a.actor?._id?.toString(),
        actorName: a.actor?.name,
        targetId: a.target?.id?.toString(),
        targetName: a.target?.name
      }))
    });

    // For each activity, populate related data if needed
    const enrichedActivities = await Promise.all(activities.map(async (activity) => {
      let resourceName = activity.resource?.name || 'Unnamed';
      let resourceLink = null;
      let targetName = activity.target?.name || null;

      // For plan-related activities, populate the experience name and create deep link
      if (activity.resource?.type === 'Plan') {
        try {
          const plan = await Plan.findById(activity.resource.id).populate('experience', 'name').lean();

          // Prefer an explicit plan name recorded on the activity (resource.name) if present.
          // Fall back to the experience name when a plan-level name isn't available.
          if (plan && plan.experience) {
            // Prefer a meaningful plan name when present. If the recorded resource name
            // is the generic label "Plan" (or missing), prefer the experience name.
            const recordedName = activity.resource?.name;
            if (recordedName && typeof recordedName === 'string' && recordedName.trim().toLowerCase() !== 'plan') {
              resourceName = recordedName;
            } else {
              resourceName = plan.experience.name;
            }

            // Create hash-based deep link to specific plan
            resourceLink = `/experiences/${plan.experience._id}#plan-${plan._id}`;

            // If this activity targets a specific plan item (e.g. plan_item_completed, plan_item_note_added),
            // include the item id in the hash so the UI can deep-link directly to it.
            if ((activity.action === 'plan_item_completed' || activity.action === 'plan_item_uncompleted' ||
                 activity.action === 'plan_item_note_added' || activity.action === 'plan_item_note_updated' ||
                 activity.action === 'plan_item_note_deleted') && activity.target && activity.target.id) {
              try {
                const itemId = activity.target.id.toString();
                resourceLink = `/experiences/${plan.experience._id}#plan-${plan._id}-item-${itemId}`;
              } catch (err) {
                // ignore conversion errors and fall back to plan-level link
              }
            }
          } else {
            // Plan record might have been deleted (plan_deleted). Try to recover experience
            // information from previousState or metadata so links still point to the experience.
            if (activity.previousState && activity.previousState.experience) {
              try {
                const exp = activity.previousState.experience;
                const expId = (typeof exp === 'object' && exp._id) ? exp._id.toString() : exp.toString();
                const expName = (typeof exp === 'object' && exp.name) ? exp.name : activity.resource?.name || 'Experience';
                resourceName = expName;
                resourceLink = `/experiences/${expId}`;
              } catch (err) {
                backendLogger.debug('Failed to recover experience from previousState for deleted plan activity', { activityId: activity._id });
              }
            }
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

      // For plan item actions, show both the plan (experience) and the item
      if ((activity.action === 'plan_item_completed' || activity.action === 'plan_item_uncompleted' ||
           activity.action === 'plan_item_note_added' || activity.action === 'plan_item_note_updated' ||
           activity.action === 'plan_item_note_deleted') && activity.target) {
        targetName = activity.target.name;
      }

      // For collaborator activities, use the target user's name
      if ((activity.action === 'permission_added' || activity.action === 'permission_removed' ||
           activity.action === 'collaborator_added' || activity.action === 'collaborator_removed') &&
          activity.target && activity.resource?.type === 'Plan') {
        targetName = activity.target.name;
      }

      // Use resourceLink from metadata if available (for hash-based deep links)
      if (activity.metadata?.resourceLink) {
        resourceLink = activity.metadata.resourceLink;
      }

      // Format action text, with special-casing for destination permission events
      let actionText = formatActivityAction(activity.action);
      if (activity.resource?.type === 'Destination') {
        if (activity.action === 'permission_added') actionText = 'Favorited';
        if (activity.action === 'permission_removed') actionText = 'Unfavorited';
      }

      return {
        id: activity._id.toString(),
        action: actionText,
        item: resourceName,
        targetItem: targetName,
        link: resourceLink,
        time: formatTimeAgo(activity.timestamp),
        timestamp: activity.timestamp,
        resourceType: activity.resource?.type,
        // Include actor/target ids so clients can filter reliably
        actorId: activity.actor?._id?.toString(),
        targetId: activity.target?.id?.toString(),
        // Also include actor/target display names so UI can render them without extra lookups
        actorName: activity.actor?.name || null,
        targetName: targetName || activity.target?.name || null
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
 * Paginated upcoming plans endpoint
 */
async function getUpcomingPlansEndpoint(req, res) {
  try {
    const userId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 5);
    const skip = (page - 1) * limit;

    backendLogger.info('Fetching paginated upcoming plans', { userId: userId.toString(), page, limit, skip });

    const filter = {
      $or: [
        { user: userId },
        { 'permissions._id': userId, 'permissions.entity': 'user' }
      ],
      planned_date: { $gte: new Date() }
    };

    const [totalCount, plans] = await Promise.all([
      Plan.countDocuments(filter),
      Plan.find(filter)
        .populate('experience', 'name')
        .sort({ planned_date: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const mapped = plans.map(plan => ({
      id: plan._id,
      experienceId: plan.experience?._id,
      title: plan.experience?.name || 'Unknown Experience',
      date: plan.planned_date ? formatDate(plan.planned_date) : null
    }));

    const response = {
      plans: mapped,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        hasMore: skip + mapped.length < totalCount
      }
    };

    return successResponse(res, response);
  } catch (error) {
    backendLogger.error('Error fetching paginated upcoming plans', { error: error.message });
    return errorResponse(res, error, 'Error fetching upcoming plans');
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
    'permission_added': 'Added a collaborator to',
    'permission_removed': 'Removed a collaborator from',
    'user_registered': 'Joined Biensperience',
    'email_verified': 'Verified email address',
    'plan_item_completed': 'Completed a plan item on',
    'plan_item_uncompleted': 'Uncompleted a plan item on',
    'plan_item_note_added': 'Added a note to a plan item on',
    'plan_item_note_updated': 'Updated a note on a plan item in',
    'plan_item_note_deleted': 'Deleted a note from a plan item in',
    'collaborator_added': 'Became a collaborator on',
    'collaborator_removed': 'Removed from collaboration on'
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
    // Count activities where user is actor OR target
    const totalCount = await Activity.countDocuments({
      $or: [
        { 'actor._id': userId },
        { 'target.id': userId }
      ]
    });

    // Get activities with pagination
    const activities = await getRecentActivity(userId, { limit, skip });

    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const response = {
      activities,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        // numPages kept for caller convenience (explicit name requested)
        numPages: totalPages,
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
  getActivityFeed,
  getUpcomingPlansEndpoint
};