/**
 * Activity Controller
 * Handles activity tracking, history retrieval, and state restoration
 * Super admin only operations
 */

const Activity = require('../../models/activity');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Plan = require('../../models/plan');
const User = require('../../models/user');
const { restoreState, getHistory } = require('../../utilities/activity-tracker');
const { isSuperAdmin, isOwner, isCollaborator } = require('../../utilities/permissions');
const { insufficientPermissionsError, sendErrorResponse } = require('../../utilities/error-responses');
const backendLogger = require('../../utilities/backend-logger');
const mongoose = require('mongoose');

/**
 * Get activity history for a resource
 * Super admin, resource owner, or collaborator can view
 */
async function getResourceHistory(req, res) {
  try {
    const { resourceId } = req.params;
    const { action, startDate, endDate, limit } = req.query;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(resourceId)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }

    // Super admins can view any resource history
    if (!isSuperAdmin(req.user)) {
      // Need to determine resource type and check permissions
      // First, check if this is the user's own profile
      if (resourceId === req.user._id.toString()) {
        // User can view their own activity history
      } else {
        // Try to find the resource and check permissions
        const resource = await findResourceById(resourceId);

        if (!resource) {
          return res.status(404).json({ error: 'Resource not found' });
        }

        // Check if user has access to this resource
        const hasAccess = await checkResourceAccess(req.user, resource);

        if (!hasAccess) {
          const errorResponse = insufficientPermissionsError('owner or collaborator', 'none');
          return sendErrorResponse(res, errorResponse);
        }
      }
    }

    const options = {
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit, 10) : 100
    };

    const history = await getHistory(resourceId, options);

    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    backendLogger.error('Error fetching resource history', {
      error: error.message,
      resourceId: req.params.resourceId,
      userId: req.user?._id
    });
    res.status(500).json({ error: 'Failed to fetch resource history' });
  }
}

/**
 * Find a resource by ID across all resource types
 * @param {string} resourceId - The resource ID to find
 * @returns {Promise<Object|null>} - The resource with its type, or null if not found
 */
async function findResourceById(resourceId) {
  // Try each resource type in order of likelihood
  const resourceTypes = [
    { model: Experience, type: 'Experience' },
    { model: Destination, type: 'Destination' },
    { model: Plan, type: 'Plan' },
    { model: User, type: 'User' }
  ];

  for (const { model, type } of resourceTypes) {
    try {
      const resource = await model.findById(resourceId);
      if (resource) {
        return { resource, type };
      }
    } catch (e) {
      // Continue to next type
    }
  }

  return null;
}

/**
 * Check if user has access to view a resource's activity history
 * @param {Object} user - The requesting user
 * @param {Object} resourceData - Object with { resource, type }
 * @returns {Promise<boolean>} - True if user has access
 */
async function checkResourceAccess(user, resourceData) {
  const { resource, type } = resourceData;
  const models = { Destination, Experience };

  switch (type) {
    case 'User':
      // Users can only view their own user activity
      return resource._id.toString() === user._id.toString();

    case 'Experience':
    case 'Destination':
      // Check if owner or collaborator
      if (isOwner(user._id, resource)) {
        return true;
      }
      return await isCollaborator(user._id, resource, models);

    case 'Plan':
      // Plan owner or collaborator can view
      if (resource.user && resource.user.toString() === user._id.toString()) {
        return true;
      }
      // Check plan permissions array
      if (resource.permissions && Array.isArray(resource.permissions)) {
        return resource.permissions.some(p =>
          p.user && p.user.toString() === user._id.toString()
        );
      }
      return false;

    default:
      return false;
  }
}

/**
 * Get activity history by actor (user)
 * Super admin or the user themselves can view
 */
async function getActorHistory(req, res) {
  try {
    const { actorId } = req.params;
    const { action, limit } = req.query;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(actorId)) {
      return res.status(400).json({ error: 'Invalid actor ID' });
    }

    // Check permissions: super admin or user viewing their own history
    if (!isSuperAdmin(req.user) && req.user._id.toString() !== actorId) {
      const errorResponse = insufficientPermissionsError('super admin or self', 'none');
      return sendErrorResponse(res, errorResponse);
    }

    const options = {
      action,
      limit: limit ? parseInt(limit, 10) : 100
    };

    const history = await Activity.getByActor(actorId, options);

    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    backendLogger.error('Error fetching actor history', {
      error: error.message,
      actorId: req.params.actorId,
      userId: req.user?._id
    });
    res.status(500).json({ error: 'Failed to fetch actor history' });
  }
}

/**
 * Restore a resource to a previous state using rollback token
 * Super admin only
 */
async function restoreResourceState(req, res) {
  try {
    const { rollbackToken } = req.params;

    // Only super admins can restore states
    if (!isSuperAdmin(req.user)) {
      const errorResponse = insufficientPermissionsError('super admin', 'none');
      return sendErrorResponse(res, errorResponse);
    }

    if (!rollbackToken || rollbackToken.length !== 64) {
      return res.status(400).json({ error: 'Invalid rollback token' });
    }

    const result = await restoreState(rollbackToken, req.user);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to restore state' });
    }

    backendLogger.info('Resource state restored', {
      resourceId: result.resource._id,
      resourceType: result.resource.constructor.modelName,
      actor: req.user._id,
      rollbackToken
    });

    res.json({
      success: true,
      message: result.message,
      resource: result.resource,
      resourceType: result.resource.constructor.modelName,
      wasRecreated: result.wasRecreated || false
    });
  } catch (error) {
    backendLogger.error('Error restoring resource state', {
      error: error.message,
      rollbackToken: req.params.rollbackToken,
      userId: req.user?._id
    });
    res.status(500).json({ error: 'Failed to restore resource state' });
  }
}

/**
 * Get all activities with filtering and pagination
 * Super admin only
 */
async function getAllActivities(req, res) {
  try {
    // Only super admins can view all activities
    if (!isSuperAdmin(req.user)) {
      const errorResponse = insufficientPermissionsError('super admin', 'none');
      return sendErrorResponse(res, errorResponse);
    }

    const {
      action,
      resourceType,
      actorId,
      resourceId,
      status,
      tag,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      includePrivateProfiles = 'false' // By default, exclude private profile users
    } = req.query;

    // Build query with input validation to prevent NoSQL injection
    const query = {};

    // Get user IDs with private profiles to exclude from activity feeds
    // Super admins can include private profiles by passing includePrivateProfiles=true
    if (includePrivateProfiles !== 'true') {
      const privateProfileUsers = await User.find({
        'preferences.profileVisibility': 'private'
      }).select('_id').lean();

      const privateUserIds = privateProfileUsers.map(u => u._id);

      if (privateUserIds.length > 0) {
        query['actor._id'] = { $nin: privateUserIds };
      }
    }

    // Validate and sanitize string inputs - only allow alphanumeric, dash, underscore
    const SAFE_STRING_PATTERN = /^[a-zA-Z0-9_-]+$/;
    const VALID_ACTIONS = ['create', 'update', 'delete', 'restore', 'permission_change', 'completion'];
    const VALID_RESOURCE_TYPES = ['Plan', 'Experience', 'Destination', 'User', 'Photo'];
    const VALID_STATUSES = ['success', 'failure', 'pending'];

    if (action) {
      if (!VALID_ACTIONS.includes(action)) {
        return res.status(400).json({
          error: 'Invalid action parameter',
          message: 'Action must be one of: ' + VALID_ACTIONS.join(', ')
        });
      }
      query.action = action;
    }

    if (resourceType) {
      if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
        return res.status(400).json({
          error: 'Invalid resourceType parameter',
          message: 'Resource type must be one of: ' + VALID_RESOURCE_TYPES.join(', ')
        });
      }
      query['resource.type'] = resourceType;
    }

    if (actorId) {
      if (!mongoose.Types.ObjectId.isValid(actorId)) {
        return res.status(400).json({
          error: 'Invalid actorId parameter',
          message: 'Actor ID must be a valid MongoDB ObjectId'
        });
      }
      query['actor._id'] = new mongoose.Types.ObjectId(actorId);
    }

    if (resourceId) {
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        return res.status(400).json({
          error: 'Invalid resourceId parameter',
          message: 'Resource ID must be a valid MongoDB ObjectId'
        });
      }
      query['resource.id'] = new mongoose.Types.ObjectId(resourceId);
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status parameter',
          message: 'Status must be one of: ' + VALID_STATUSES.join(', ')
        });
      }
      query.status = status;
    }

    if (tag) {
      if (!SAFE_STRING_PATTERN.test(tag)) {
        return res.status(400).json({
          error: 'Invalid tag parameter',
          message: 'Tag must contain only alphanumeric characters, dashes, and underscores'
        });
      }
      query.tags = tag;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitNum = parseInt(limit, 10);

    // Execute query with pagination
    const [activities, totalCount] = await Promise.all([
      Activity.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Activity.countDocuments(query)
    ]);

    res.json({
      success: true,
      page: parseInt(page, 10),
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      totalCount,
      count: activities.length,
      activities
    });
  } catch (error) {
    backendLogger.error('Error fetching all activities', {
      error: error.message,
      userId: req.user?._id
    });
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
}

/**
 * Get activity statistics
 * Super admin only
 */
async function getActivityStats(req, res) {
  try {
    // Only super admins can view statistics
    if (!isSuperAdmin(req.user)) {
      const errorResponse = insufficientPermissionsError('super admin', 'none');
      return sendErrorResponse(res, errorResponse);
    }

    const { startDate, endDate, includePrivateProfiles = 'false' } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    // Exclude activities from users with private profiles
    if (includePrivateProfiles !== 'true') {
      const privateProfileUsers = await User.find({
        'preferences.profileVisibility': 'private'
      }).select('_id').lean();

      const privateUserIds = privateProfileUsers.map(u => u._id);

      if (privateUserIds.length > 0) {
        dateFilter['actor._id'] = { $nin: privateUserIds };
      }
    }

    // Run aggregation queries in parallel
    const [
      actionStats,
      resourceTypeStats,
      statusStats,
      totalCount,
      recentActivities
    ] = await Promise.all([
      // Action distribution
      Activity.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Resource type distribution
      Activity.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$resource.type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Status distribution
      Activity.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Total count
      Activity.countDocuments(dateFilter),

      // Recent activities (last 10)
      Activity.find(dateFilter)
        .sort({ timestamp: -1 })
        .limit(10)
        .select('action resource.type resource.name actor.name timestamp status')
        .lean()
    ]);

    res.json({
      success: true,
      stats: {
        totalActivities: totalCount,
        byAction: actionStats,
        byResourceType: resourceTypeStats,
        byStatus: statusStats,
        recentActivities
      }
    });
  } catch (error) {
    backendLogger.error('Error fetching activity statistics', {
      error: error.message,
      userId: req.user?._id
    });
    res.status(500).json({ error: 'Failed to fetch activity statistics' });
  }
}

module.exports = {
  getResourceHistory,
  getActorHistory,
  restoreResourceState,
  getAllActivities,
  getActivityStats
};
