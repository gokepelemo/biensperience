const mongoose = require('mongoose');
const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Activity = require('../../models/activity');
const { successResponse, errorResponse } = require('../../utilities/controller-helpers');
const backendLogger = require('../../utilities/backend-logger');
const { fetchRates, calculateTotal, convertCostsToTarget } = require('../../utilities/currency-utils');

/**
 * Get dashboard data for the authenticated user
 * Optimized with efficient MongoDB aggregation queries
 */
async function getDashboard(req, res) {
  try {
    const userId = req.user._id;
    // Get user's preferred currency from preferences, query param, or default to USD
    const targetCurrency = req.query.currency || req.user?.preferences?.currency || 'USD';
    backendLogger.info('Fetching dashboard data', { userId: userId.toString(), targetCurrency });

    // Pre-fetch exchange rates for currency conversion
    try {
      await fetchRates(targetCurrency);
    } catch (rateErr) {
      backendLogger.warn('Failed to fetch exchange rates for dashboard', { error: rateErr.message });
      // Continue with default rates (will return unconverted amounts if rates unavailable)
    }

    // Execute all dashboard queries in parallel for optimal performance
    const [
      statsResult,
      recentActivityResult,
      upcomingPlansResult
    ] = await Promise.all([
      getDashboardStats(userId, targetCurrency),
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
 * @param {ObjectId} userId - User ID
 * @param {string} targetCurrency - Target currency for cost totals (default: USD)
 */
async function getDashboardStats(userId, targetCurrency = 'USD') {
  try {
    backendLogger.info('Calculating dashboard stats for user', { userId: userId.toString(), targetCurrency });

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
      // Sum costs from plan.costs array with currency conversion
      // Each cost entry has { cost, currency } fields
      if (plan.costs && plan.costs.length > 0) {
        totalSpent += calculateTotal(plan.costs, targetCurrency);
      }

      // Also sum costs from plan items (legacy support)
      // Plan items have cost but no currency field - assume plan's currency or USD
      const planCurrency = plan.currency || 'USD';
      (plan.plan || []).forEach(item => {
        if (item.cost && item.cost > 0) {
          // Convert plan item cost from plan currency to target currency
          const costObj = { cost: item.cost, currency: planCurrency };
          totalSpent += calculateTotal([costObj], targetCurrency);
        }
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
      totalSpent,
      targetCurrency
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
      totalSpent: totalSpent || 0,
      currency: targetCurrency
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
      totalSpent: 0,
      currency: targetCurrency
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

    backendLogger.debug('Activities found', {
      userId: userId.toString(),
      count: activities.length
    });

    // OPTIMIZATION: Batch fetch all plan IDs upfront instead of N+1 individual queries
    const planIds = activities
      .filter(a => a.resource?.type === 'Plan' && a.resource?.id)
      .map(a => a.resource.id);

    // Single query to fetch all plans with populated experiences
    const plansMap = new Map();
    if (planIds.length > 0) {
      const plans = await Plan.find({ _id: { $in: planIds } })
        .populate('experience', 'name')
        .lean();
      plans.forEach(plan => plansMap.set(plan._id.toString(), plan));
    }

    // Enrich activities synchronously using the pre-fetched plans map
    const enrichedActivities = activities.map((activity) => {
      let resourceName = activity.resource?.name || 'Unnamed';
      let resourceLink = null;
      let targetName = activity.target?.name || null;

      // For plan-related activities, use the batched plan data
      if (activity.resource?.type === 'Plan') {
        const plan = plansMap.get(activity.resource.id?.toString());

        if (plan && plan.experience) {
          // Prefer a meaningful plan name when present
          const recordedName = activity.resource?.name;
          if (recordedName && typeof recordedName === 'string' && recordedName.trim().toLowerCase() !== 'plan') {
            resourceName = recordedName;
          } else {
            resourceName = plan.experience.name;
          }

          // Create hash-based deep link to specific plan
          resourceLink = `/experiences/${plan.experience._id}#plan-${plan._id}`;

          // If this activity targets a specific plan item, include the item id in the hash
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
          // Plan record might have been deleted. Try to recover from previousState
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

      // For cost activities, show the cost title from metadata
      if ((activity.action === 'cost_added' || activity.action === 'cost_updated' || activity.action === 'cost_deleted') &&
          activity.metadata?.costTitle) {
        if (activity.target?.type !== 'User' && activity.target?.name) {
          targetName = activity.target.name;
        } else {
          targetName = activity.metadata.costTitle;
        }
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
        actorId: activity.actor?._id?.toString(),
        targetId: activity.target?.id?.toString(),
        actorName: activity.actor?.name || null,
        targetName: targetName || activity.target?.name || null
      };
    });

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
    'collaborator_removed': 'Removed from collaboration on',
    'cost_added': 'Added a cost to',
    'cost_updated': 'Updated a cost on',
    'cost_deleted': 'Deleted a cost from'
  };

  return actionMap[action] || action.replace(/_/g, ' ');
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 * For dates older than 7 days, uses format "Fri, Jan 9 2026"
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

  // For older dates, use format: "Fri, Jan 9 2026"
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
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