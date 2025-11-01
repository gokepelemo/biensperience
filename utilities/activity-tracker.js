/**
 * Activity Tracker Utility
 * 
 * Provides non-blocking activity tracking for all entity changes.
 * All tracking operations are asynchronous and will not block the main request flow.
 */

const Activity = require('../models/activity');
const backendLogger = require('./backend-logger');
const crypto = require('crypto');

/**
 * Extract metadata from Express request
 * @param {Object} req - Express request object
 * @returns {Object} Metadata object
 */
function extractMetadata(req) {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    requestPath: req.path,
    requestMethod: req.method,
    sessionId: req.sessionId || null
  };
}

/**
 * Generate rollback token for state restoration
 * @returns {string} Unique rollback token
 */
function generateRollbackToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Extract actor information from user object
 * @param {Object} user - User object
 * @returns {Object} Actor object
 */
function extractActor(user) {
  if (!user) {
    return {
      _id: null,
      email: 'system',
      name: 'System',
      role: 'system'
    };
  }

  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role || 'regular_user'
  };
}

/**
 * Calculate field-level changes between two objects
 * @param {Object} oldObj - Previous state
 * @param {Object} newObj - New state
 * @param {Array<string>} fieldsToTrack - Fields to track changes for
 * @returns {Array<Object>} Array of changes
 */
function calculateChanges(oldObj, newObj, fieldsToTrack) {
  const changes = [];

  for (const field of fieldsToTrack) {
    const oldValue = oldObj?.[field];
    const newValue = newObj?.[field];

    // Deep comparison for objects/arrays
    const oldJson = JSON.stringify(oldValue);
    const newJson = JSON.stringify(newValue);

    if (oldJson !== newJson) {
      changes.push({
        field,
        oldValue: oldValue,
        newValue: newValue
      });
    }
  }

  return changes;
}

/**
 * Track resource creation (non-blocking)
 * @param {Object} options - Tracking options
 * @param {Object} options.resource - Created resource
 * @param {string} options.resourceType - Type of resource (Experience, Destination, etc.)
 * @param {Object} options.actor - User who created the resource
 * @param {Object} options.req - Express request object
 * @param {string} options.reason - Reason for creation
 */
async function trackCreate(options) {
  const {
    resource,
    resourceType,
    actor,
    req,
    reason = 'Resource created'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'resource_created',
    actor: extractActor(actor),
    resource: {
      id: resource._id,
      type: resourceType,
      name: resource.name || resource.email || 'Unnamed'
    },
    previousState: null,
    newState: resource.toObject ? resource.toObject() : resource,
    reason,
    metadata: req ? extractMetadata(req) : {},
    rollbackToken: generateRollbackToken(),
    status: 'success',
    tags: [resourceType.toLowerCase(), 'create']
  }).catch(err => {
    backendLogger.error('Failed to track create activity', {
      error: err.message,
      resourceType,
      resourceId: resource._id
    });
  });
}

/**
 * Track resource update (non-blocking)
 * @param {Object} options - Tracking options
 * @param {Object} options.resource - Updated resource
 * @param {Object} options.previousState - Previous state of resource
 * @param {string} options.resourceType - Type of resource
 * @param {Object} options.actor - User who updated the resource
 * @param {Object} options.req - Express request object
 * @param {Array<string>} options.fieldsToTrack - Fields to track changes for
 * @param {string} options.reason - Reason for update
 */
async function trackUpdate(options) {
  const {
    resource,
    previousState,
    resourceType,
    actor,
    req,
    fieldsToTrack = [],
    reason = 'Resource updated'
  } = options;

  const newState = resource.toObject ? resource.toObject() : resource;
  const changes = fieldsToTrack.length > 0
    ? calculateChanges(previousState, newState, fieldsToTrack)
    : [];

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'resource_updated',
    actor: extractActor(actor),
    resource: {
      id: resource._id,
      type: resourceType,
      name: resource.name || resource.email || 'Unnamed'
    },
    previousState,
    newState,
    changes,
    reason,
    metadata: req ? extractMetadata(req) : {},
    rollbackToken: generateRollbackToken(),
    status: 'success',
    tags: [resourceType.toLowerCase(), 'update']
  }).catch(err => {
    backendLogger.error('Failed to track update activity', {
      error: err.message,
      resourceType,
      resourceId: resource._id
    });
  });
}

/**
 * Track resource deletion (non-blocking)
 * @param {Object} options - Tracking options
 * @param {Object} options.resource - Deleted resource
 * @param {string} options.resourceType - Type of resource
 * @param {Object} options.actor - User who deleted the resource
 * @param {Object} options.req - Express request object
 * @param {string} options.reason - Reason for deletion
 */
async function trackDelete(options) {
  const {
    resource,
    resourceType,
    actor,
    req,
    reason = 'Resource deleted'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'resource_deleted',
    actor: extractActor(actor),
    resource: {
      id: resource._id,
      type: resourceType,
      name: resource.name || resource.email || 'Unnamed'
    },
    previousState: resource.toObject ? resource.toObject() : resource,
    newState: null,
    reason,
    metadata: req ? extractMetadata(req) : {},
    rollbackToken: generateRollbackToken(),
    status: 'success',
    tags: [resourceType.toLowerCase(), 'delete']
  }).catch(err => {
    backendLogger.error('Failed to track delete activity', {
      error: err.message,
      resourceType,
      resourceId: resource._id
    });
  });
}

/**
 * Track plan item completion (non-blocking)
 * @param {Object} options - Tracking options
 * @param {Object} options.plan - Plan containing the item
 * @param {Object} options.planItem - Completed plan item
 * @param {boolean} options.completed - Completion status
 * @param {Object} options.actor - User who completed the item
 * @param {Object} options.req - Express request object
 */
async function trackPlanItemCompletion(options) {
  const {
    plan,
    planItem,
    completed,
    actor,
    req
  } = options;

  const action = completed ? 'plan_item_completed' : 'plan_item_uncompleted';
  const reason = completed
    ? `Plan item "${planItem.text}" marked as completed`
    : `Plan item "${planItem.text}" marked as incomplete`;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action,
    actor: extractActor(actor),
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unnamed Plan'
    },
    target: {
      id: planItem._id,
      type: 'PlanItem',
      name: planItem.text
    },
    previousState: { completed: !completed },
    newState: { completed },
    reason,
    metadata: req ? extractMetadata(req) : {},
    status: 'success',
    tags: ['plan', 'plan_item', completed ? 'completed' : 'uncompleted']
  }).catch(err => {
    backendLogger.error('Failed to track plan item completion', {
      error: err.message,
      planId: plan._id,
      planItemId: planItem._id
    });
  });
}

/**
 * Restore resource state from activity (for super admin)
 * @param {string} rollbackToken - Rollback token from activity
 * @param {Object} actor - User performing the restore
 * @returns {Promise<Object>} Restoration result
 */
async function restoreState(rollbackToken, actor) {
  try {
    const result = await Activity.restoreState(rollbackToken);

    if (!result.success) {
      return result;
    }

    const { resourceId, resourceType, previousState } = result;

    // Get the appropriate model
    let Model;
    switch (resourceType) {
      case 'Experience':
        Model = require('../models/experience');
        break;
      case 'Destination':
        Model = require('../models/destination');
        break;
      case 'Plan':
        Model = require('../models/plan');
        break;
      case 'Photo':
        Model = require('../models/photo');
        break;
      case 'User':
        Model = require('../models/user');
        break;
      default:
        return { success: false, error: `Unknown resource type: ${resourceType}` };
    }

    // Find the resource
    const resource = await Model.findById(resourceId);

    if (!resource) {
      return { success: false, error: 'Resource not found' };
    }

    // Store current state for rollback of the rollback
    const currentState = resource.toObject();

    // Restore previous state
    Object.assign(resource, previousState);
    await resource.save();

    // Track the rollback
    Activity.create({
      timestamp: new Date(),
      action: 'rollback_performed',
      actor: extractActor(actor),
      resource: {
        id: resourceId,
        type: resourceType,
        name: resource.name || resource.email || 'Unnamed'
      },
      previousState: currentState,
      newState: previousState,
      reason: `State restored using rollback token`,
      rollbackToken: generateRollbackToken(),
      status: 'success',
      tags: [resourceType.toLowerCase(), 'rollback', 'admin']
    }).catch(err => {
      backendLogger.error('Failed to track rollback activity', {
        error: err.message,
        resourceType,
        resourceId
      });
    });

    backendLogger.info('State restored successfully', {
      resourceType,
      resourceId,
      actor: actor._id
    });

    return {
      success: true,
      resource,
      message: 'State restored successfully'
    };
  } catch (error) {
    backendLogger.error('Error restoring state', {
      error: error.message,
      rollbackToken
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get activity history for a resource
 * @param {string} resourceId - Resource ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Activity history
 */
async function getHistory(resourceId, options = {}) {
  try {
    return await Activity.getHistory(resourceId, options);
  } catch (error) {
    backendLogger.error('Error fetching activity history', {
      error: error.message,
      resourceId
    });
    return [];
  }
}

/**
 * Track successful login
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who logged in
 * @param {Object} options.req - Express request object
 * @param {string} options.method - Login method ('password', 'facebook', 'google', 'twitter')
 */
async function trackLogin(options) {
  const {
    user,
    req,
    method = 'password'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'user_login',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `User logged in via ${method}`,
    metadata: {
      ...extractMetadata(req),
      loginMethod: method
    },
    status: 'success',
    tags: ['auth', 'login', method]
  }).catch(err => {
    backendLogger.error('Failed to track login activity', {
      error: err.message,
      userId: user._id,
      method
    });
  });
}

/**
 * Track failed login attempt
 * @param {Object} options - Tracking options
 * @param {string} options.email - Email attempted
 * @param {Object} options.req - Express request object
 * @param {string} options.reason - Failure reason ('invalid_credentials', 'user_not_found', etc.)
 */
async function trackFailedLogin(options) {
  const {
    email,
    req,
    reason = 'invalid_credentials'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'login_failed',
    actor: {
      _id: null,
      email: email || 'unknown',
      name: 'Anonymous',
      role: 'unauthenticated'
    },
    resource: null,
    reason: `Failed login attempt: ${reason}`,
    metadata: {
      ...extractMetadata(req),
      failureReason: reason,
      attemptedEmail: email
    },
    status: 'failure',
    tags: ['auth', 'login_failed', reason]
  }).catch(err => {
    backendLogger.error('Failed to track failed login activity', {
      error: err.message,
      email
    });
  });
}

/**
 * Track OAuth authentication
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who authenticated
 * @param {Object} options.req - Express request object
 * @param {string} options.provider - OAuth provider ('facebook', 'google', 'twitter')
 * @param {boolean} options.success - Whether auth succeeded
 * @param {boolean} options.isLinking - Whether linking account (vs login)
 * @param {string} options.error - Error message if failed
 */
async function trackOAuthAuth(options) {
  const {
    user,
    req,
    provider,
    success = true,
    isLinking = false,
    error = null
  } = options;

  const action = isLinking
    ? (success ? 'oauth_account_linked' : 'oauth_link_failed')
    : (success ? 'oauth_login' : 'oauth_login_failed');

  const reason = isLinking
    ? (success ? `${provider} account linked successfully` : `Failed to link ${provider} account: ${error}`)
    : (success ? `User logged in via ${provider}` : `${provider} login failed: ${error}`);

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action,
    actor: user ? extractActor(user) : {
      _id: null,
      email: 'unknown',
      name: 'Anonymous',
      role: 'unauthenticated'
    },
    resource: user ? {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    } : null,
    reason,
    metadata: {
      ...extractMetadata(req),
      oauthProvider: provider,
      isLinking,
      error: error || undefined
    },
    status: success ? 'success' : 'failure',
    tags: ['auth', 'oauth', provider, isLinking ? 'link' : 'login', success ? 'success' : 'failure']
  }).catch(err => {
    backendLogger.error('Failed to track OAuth activity', {
      error: err.message,
      userId: user?._id,
      provider,
      isLinking
    });
  });
}

/**
 * Track account unlinking
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who unlinked account
 * @param {Object} options.req - Express request object
 * @param {string} options.provider - OAuth provider ('facebook', 'google', 'twitter')
 */
async function trackOAuthUnlink(options) {
  const {
    user,
    req,
    provider
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'oauth_account_unlinked',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `${provider} account unlinked`,
    metadata: {
      ...extractMetadata(req),
      oauthProvider: provider
    },
    status: 'success',
    tags: ['auth', 'oauth', provider, 'unlink']
  }).catch(err => {
    backendLogger.error('Failed to track OAuth unlink activity', {
      error: err.message,
      userId: user._id,
      provider
    });
  });
}

/**
 * Track logout
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who logged out
 * @param {Object} options.req - Express request object
 */
async function trackLogout(options) {
  const {
    user,
    req
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'user_logout',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: 'User logged out',
    metadata: extractMetadata(req),
    status: 'success',
    tags: ['auth', 'logout']
  }).catch(err => {
    backendLogger.error('Failed to track logout activity', {
      error: err.message,
      userId: user._id
    });
  });
}

/**
 * Track session creation
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User for whom session was created
 * @param {string} options.sessionId - Session ID
 * @param {Object} options.req - Express request object (optional)
 */
async function trackSessionCreated(options) {
  const {
    user,
    sessionId,
    req
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'session_created',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: 'New session created',
    metadata: {
      ...(req ? extractMetadata(req) : {}),
      sessionId
    },
    status: 'success',
    tags: ['auth', 'session', 'created']
  }).catch(err => {
    backendLogger.error('Failed to track session creation activity', {
      error: err.message,
      userId: user._id,
      sessionId
    });
  });
}

/**
 * Track session expiration
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User whose session expired
 * @param {string} options.sessionId - Session ID
 * @param {string} options.reason - Expiration reason ('timeout', 'manual', 'logout')
 */
async function trackSessionExpired(options) {
  const {
    user,
    sessionId,
    reason = 'timeout'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'session_expired',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `Session expired: ${reason}`,
    metadata: {
      sessionId,
      expirationReason: reason
    },
    status: 'success',
    tags: ['auth', 'session', 'expired', reason]
  }).catch(err => {
    backendLogger.error('Failed to track session expiration activity', {
      error: err.message,
      userId: user._id,
      sessionId
    });
  });
}

/**
 * Track user signup
 * @param {Object} options - Tracking options
 * @param {Object} options.user - Newly created user
 * @param {Object} options.req - Express request object
 * @param {string} options.method - Signup method ('password', 'oauth')
 */
async function trackSignup(options) {
  const {
    user,
    req,
    method = 'password'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'user_signup',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `New user signed up via ${method}`,
    metadata: {
      ...extractMetadata(req),
      signupMethod: method
    },
    status: 'success',
    tags: ['auth', 'signup', method]
  }).catch(err => {
    backendLogger.error('Failed to track signup activity', {
      error: err.message,
      userId: user._id,
      method
    });
  });
}

module.exports = {
  // Resource tracking
  trackCreate,
  trackUpdate,
  trackDelete,
  trackPlanItemCompletion,
  restoreState,
  getHistory,

  // Auth tracking
  trackLogin,
  trackFailedLogin,
  trackOAuthAuth,
  trackOAuthUnlink,
  trackLogout,
  trackSessionCreated,
  trackSessionExpired,
  trackSignup,

  // Utilities
  extractMetadata,
  extractActor,
  generateRollbackToken,
  calculateChanges
};
