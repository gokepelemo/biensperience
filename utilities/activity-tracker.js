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

  // Determine resource name based on type
  let resourceName = 'Unnamed';
  let action = 'resource_created';

  if (resourceType === 'Plan') {
    // For plans, use the experience name
    if (resource.experience) {
      if (typeof resource.experience === 'object' && resource.experience.name) {
        resourceName = resource.experience.name;
      } else {
        resourceName = 'Plan';
      }
    }
    action = 'plan_created'; // Use specific plan action
  } else {
    resourceName = resource.name || resource.email || 'Unnamed';
  }

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action,
    actor: extractActor(actor),
    resource: {
      id: resource._id,
      type: resourceType,
      name: resourceName
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

  // Determine resource name based on type
  let resourceName = 'Unnamed';
  let action = 'resource_updated';

  if (resourceType === 'Plan') {
    // For plans, use the experience name
    if (resource.experience) {
      if (typeof resource.experience === 'object' && resource.experience.name) {
        resourceName = resource.experience.name;
      } else {
        resourceName = 'Plan';
      }
    }
    action = 'plan_updated'; // Use specific plan action
  } else {
    resourceName = resource.name || resource.email || 'Unnamed';
  }

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action,
    actor: extractActor(actor),
    resource: {
      id: resource._id,
      type: resourceType,
      name: resourceName
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

  // Determine resource name based on type
  let resourceName = 'Unnamed';
  let action = 'resource_deleted';

  if (resourceType === 'Plan') {
    // For plans, use the experience name
    if (resource.experience) {
      if (typeof resource.experience === 'object' && resource.experience.name) {
        resourceName = resource.experience.name;
      } else {
        resourceName = 'Plan';
      }
    }
    action = 'plan_deleted'; // Use specific plan action
  } else {
    resourceName = resource.name || resource.email || 'Unnamed';
  }

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action,
    actor: extractActor(actor),
    resource: {
      id: resource._id,
      type: resourceType,
      name: resourceName
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
    // Accept either `plan` or legacy `resource`, and either `planItem` or `planItemId`.
    plan = options.plan || options.resource,
    planItem = options.planItem,
    planItemId = options.planItemId,
    completed = options.completed,
    actor = options.actor,
    req = options.req
  } = options;

  // Resolve planItem when only an ID is provided
  let resolvedPlanItem = planItem;
  try {
    backendLogger.info('trackPlanItemCompletion called', {
      hasPlan: !!plan,
      hasPlanItem: !!planItem,
      planItemId,
      planId: plan?._id?.toString(),
      planItemsCount: plan?.plan?.length,
      isPlanArray: Array.isArray(plan?.plan),
      hasPlanIdMethod: typeof plan?.plan?.id === 'function'
    });

    if (!resolvedPlanItem && planItemId && plan) {
      // plan could be a mongoose doc or a plain object
      if (typeof plan.plan.id === 'function') {
        // Mongoose subdocument accessor
        backendLogger.info('Using Mongoose plan.id() method to find plan item');
        resolvedPlanItem = plan.plan.id(planItemId);
      } else if (Array.isArray(plan.plan)) {
        backendLogger.info('Using Array.find() to find plan item', {
          planItemId,
          planItemsCount: plan.plan.length
        });
        resolvedPlanItem = plan.plan.find(i => String(i._id) === String(planItemId));
      }
    }

    backendLogger.info('Plan item resolution result', {
      resolved: !!resolvedPlanItem,
      planItemId: resolvedPlanItem?._id?.toString(),
      planItemText: resolvedPlanItem?.text
    });

    if (!resolvedPlanItem) {
      backendLogger.warn('trackPlanItemCompletion called without a valid planItem', {
        planId: plan?._id || null,
        planItemId: planItemId || null,
        planItemsInPlan: plan?.plan?.length || 0
      });
      return; // Nothing to track
    }

    const action = completed ? 'plan_item_completed' : 'plan_item_uncompleted';
    const itemName = resolvedPlanItem.text || resolvedPlanItem.name || String(resolvedPlanItem._id);
    const reason = completed
      ? `Plan item "${itemName}" marked as completed`
      : `Plan item "${itemName}" marked as incomplete`;

    // Determine the plan name and experience ID for deep linking
    let planName = 'Unnamed Plan';
    let experienceId = null;
    if (plan.experience) {
      // Experience might be populated or just an ID
      if (typeof plan.experience === 'object' && plan.experience.name) {
        planName = plan.experience.name;
        experienceId = plan.experience._id;
      } else if (plan.experience.toString) {
        // If it's just an ID, store it for deep linking
        experienceId = plan.experience;
        planName = 'Plan';
      }
    }

    // Create deep link to specific plan item
    // Format: /experiences/{experienceId}#plan-{planId}-item-{itemId}
    let resourceLink = null;
    if (experienceId) {
      const expId = experienceId.toString ? experienceId.toString() : experienceId;
      const planIdStr = plan._id.toString ? plan._id.toString() : plan._id;
      const itemIdStr = resolvedPlanItem._id.toString ? resolvedPlanItem._id.toString() : resolvedPlanItem._id;
      resourceLink = `/experiences/${expId}#plan-${planIdStr}-item-${itemIdStr}`;
    }

    // Non-blocking: Fire and forget
    const activityData = {
      timestamp: new Date(),
      action,
      actor: extractActor(actor),
      resource: {
        id: plan._id,
        type: 'Plan',
        name: planName
      },
      target: {
        id: resolvedPlanItem._id,
        type: 'PlanItem',
        name: itemName
      },
      previousState: { completed: !completed },
      newState: { completed },
      reason,
      metadata: {
        ...(req ? extractMetadata(req) : {}),
        resourceLink // Deep link to specific plan item
      },
      status: 'success',
      tags: ['plan', 'plan_item', completed ? 'completed' : 'uncompleted']
    };

    backendLogger.info('Creating activity record', {
      action: activityData.action,
      actorId: activityData.actor._id?.toString(),
      actorEmail: activityData.actor.email,
      resourceId: activityData.resource.id.toString(),
      resourceName: activityData.resource.name,
      targetId: activityData.target.id.toString(),
      targetName: activityData.target.name,
      completed
    });

    Activity.create(activityData).then(activity => {
      backendLogger.info('Activity record created successfully', {
        activityId: activity._id.toString(),
        action: activity.action,
        actorId: activity.actor._id?.toString()
      });
    }).catch(err => {
      backendLogger.error('Failed to track plan item completion', {
        error: err.message,
        stack: err.stack,
        planId: plan._id,
        planItemId: resolvedPlanItem._id,
        activityData: JSON.stringify(activityData, null, 2)
      });
    });
  } catch (err) {
    // Defensive: log unexpected errors in resolution logic
    backendLogger.error('Error in trackPlanItemCompletion', {
      error: err?.message || String(err),
      planId: plan?._id || null,
      planItemId: planItemId || (resolvedPlanItem && resolvedPlanItem._id) || null
    });
    return;
  }
}

/**
 * Track cost added to plan (non-blocking)
 * Creates activities for:
 * - The actor who added the cost
 * - If individual cost: the collaborator assigned (if different from actor)
 * - If shared cost: all collaborators (excluding actor)
 *
 * @param {Object} options - Tracking options
 * @param {Object} options.plan - Plan the cost was added to
 * @param {Object} options.cost - Cost entry that was added
 * @param {Object} options.planItem - Plan item the cost is tied to (optional)
 * @param {Object} options.actor - User who added the cost
 * @param {Array<Object>} options.collaborators - All collaborators on the plan (User objects with _id, name, email)
 * @param {Object} options.req - Express request object
 */
async function trackCostAdded(options) {
  const {
    plan,
    cost,
    planItem = null,
    actor,
    collaborators = [],
    req
  } = options;

  try {
    // Determine the plan/experience name for display
    let planName = 'Plan';
    let experienceId = null;
    if (plan.experience) {
      if (typeof plan.experience === 'object' && plan.experience.name) {
        planName = plan.experience.name;
        experienceId = plan.experience._id;
      } else if (plan.experience.toString) {
        experienceId = plan.experience;
      }
    }

    // Get plan item name if tied to a specific item
    const itemName = planItem?.text || planItem?.name || null;

    // Create deep link to plan (or specific item if tied to one)
    let resourceLink = null;
    if (experienceId) {
      const expId = experienceId.toString ? experienceId.toString() : experienceId;
      const planIdStr = plan._id.toString ? plan._id.toString() : plan._id;
      if (planItem && planItem._id) {
        const itemIdStr = planItem._id.toString ? planItem._id.toString() : planItem._id;
        resourceLink = `/experiences/${expId}#plan-${planIdStr}-item-${itemIdStr}`;
      } else {
        resourceLink = `/experiences/${expId}#plan-${planIdStr}`;
      }
    }

    const costAmount = cost.cost || 0;
    const costTitle = cost.title || 'Cost';
    const currency = cost.currency || 'USD';
    const formattedCost = `${currency} ${costAmount.toLocaleString()}`;

    // Check if this is a shared cost or individual cost
    const isSharedCost = !cost.collaborator;
    const assignedCollaboratorId = cost.collaborator?.toString ? cost.collaborator.toString() : cost.collaborator;
    const actorId = actor._id?.toString ? actor._id.toString() : actor._id;

    // Activity 1: For the actor who added the cost
    // Message: "Added a cost to {plan_name}" or "Added a cost to {plan_item}"
    const actorReason = itemName
      ? `Added ${formattedCost} cost "${costTitle}" to ${itemName}`
      : `Added ${formattedCost} cost "${costTitle}" to ${planName}`;

    Activity.create({
      timestamp: new Date(),
      action: 'cost_added',
      actor: extractActor(actor),
      resource: {
        id: plan._id,
        type: 'Plan',
        name: planName
      },
      target: planItem ? {
        id: planItem._id,
        type: 'PlanItem',
        name: itemName
      } : null,
      newState: cost,
      reason: actorReason,
      metadata: {
        ...(req ? extractMetadata(req) : {}),
        resourceLink,
        costAmount,
        costTitle,
        currency,
        isSharedCost
      },
      status: 'success',
      tags: ['plan', 'cost', 'added', isSharedCost ? 'shared' : 'individual']
    }).catch(err => {
      backendLogger.error('Failed to track cost added activity for actor', {
        error: err.message,
        planId: plan._id,
        costId: cost._id,
        actorId
      });
    });

    // Activity 2+: For affected collaborators
    if (isSharedCost) {
      // Shared cost: notify all collaborators except the actor
      const otherCollaborators = collaborators.filter(c => {
        const collabId = c._id?.toString ? c._id.toString() : c._id;
        return collabId !== actorId;
      });

      // Include plan owner if not the actor
      const ownerId = plan.user?.toString ? plan.user.toString() : plan.user;
      const ownerIsActor = ownerId === actorId;
      const ownerInCollaborators = otherCollaborators.some(c => {
        const collabId = c._id?.toString ? c._id.toString() : c._id;
        return collabId === ownerId;
      });

      for (const collab of otherCollaborators) {
        const collabName = actor.name || 'Someone';
        const targetLocation = itemName ? itemName : planName;
        const collabReason = `${collabName} added a shared ${formattedCost} cost to ${targetLocation}`;

        Activity.create({
          timestamp: new Date(),
          action: 'cost_added',
          actor: extractActor(actor),
          resource: {
            id: plan._id,
            type: 'Plan',
            name: planName
          },
          target: {
            id: collab._id,
            type: 'User',
            name: collab.name || collab.email
          },
          newState: cost,
          reason: collabReason,
          metadata: {
            ...(req ? extractMetadata(req) : {}),
            resourceLink,
            costAmount,
            costTitle,
            currency,
            isSharedCost: true,
            affectedUserId: collab._id
          },
          status: 'success',
          tags: ['plan', 'cost', 'added', 'shared', 'notification']
        }).catch(err => {
          backendLogger.error('Failed to track shared cost activity for collaborator', {
            error: err.message,
            planId: plan._id,
            costId: cost._id,
            collaboratorId: collab._id
          });
        });
      }
    } else {
      // Individual cost: notify only the assigned collaborator (if different from actor)
      if (assignedCollaboratorId && assignedCollaboratorId !== actorId) {
        // Find the collaborator's info
        const assignedCollab = collaborators.find(c => {
          const collabId = c._id?.toString ? c._id.toString() : c._id;
          return collabId === assignedCollaboratorId;
        });

        if (assignedCollab) {
          const actorName = actor.name || 'Someone';
          const targetLocation = itemName ? itemName : planName;
          const collabReason = `${actorName} added a ${formattedCost} cost to ${targetLocation} incurred by you`;

          Activity.create({
            timestamp: new Date(),
            action: 'cost_added',
            actor: extractActor(actor),
            resource: {
              id: plan._id,
              type: 'Plan',
              name: planName
            },
            target: {
              id: assignedCollab._id,
              type: 'User',
              name: assignedCollab.name || assignedCollab.email
            },
            newState: cost,
            reason: collabReason,
            metadata: {
              ...(req ? extractMetadata(req) : {}),
              resourceLink,
              costAmount,
              costTitle,
              currency,
              isSharedCost: false,
              affectedUserId: assignedCollab._id
            },
            status: 'success',
            tags: ['plan', 'cost', 'added', 'individual', 'notification']
          }).catch(err => {
            backendLogger.error('Failed to track individual cost activity for collaborator', {
              error: err.message,
              planId: plan._id,
              costId: cost._id,
              collaboratorId: assignedCollab._id
            });
          });
        }
      }
    }

    backendLogger.info('Cost activity tracking initiated', {
      planId: plan._id?.toString(),
      costTitle,
      costAmount,
      isSharedCost,
      assignedCollaboratorId: assignedCollaboratorId || null,
      actorId,
      collaboratorsCount: collaborators.length
    });

  } catch (err) {
    backendLogger.error('Error in trackCostAdded', {
      error: err?.message || String(err),
      planId: plan?._id || null,
      costId: cost?._id || null
    });
  }
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

    // Normalize previousState for schema migrations
    // Map old field names to new field names
    const normalizedState = { ...previousState };

    // Destination: description -> overview migration
    if (resourceType === 'Destination' && normalizedState.description !== undefined && normalizedState.overview === undefined) {
      normalizedState.overview = normalizedState.description;
      delete normalizedState.description;
    }

    // Find the resource
    let resource = await Model.findById(resourceId);
    let wasRecreated = false;
    let currentState = null;

    if (!resource) {
      // Resource was deleted - recreate it from previousState
      backendLogger.info('Resource not found, recreating from previousState', {
        resourceType,
        resourceId
      });

      // Create new document with the previousState data
      // Remove _id to let MongoDB generate a new one, but keep track of original
      const recreateData = { ...normalizedState };
      delete recreateData._id;
      delete recreateData.__v;

      // Create the resource
      resource = new Model(recreateData);
      await resource.save();
      wasRecreated = true;
      currentState = null; // No previous state since resource was deleted
    } else {
      // Resource exists - update it
      currentState = resource.toObject();
      Object.assign(resource, normalizedState);
      await resource.save();
    }

    // Track the rollback
    Activity.create({
      timestamp: new Date(),
      action: 'rollback_performed',
      actor: extractActor(actor),
      resource: {
        id: resource._id, // Use new ID if recreated
        type: resourceType,
        name: resource.name || resource.email || 'Unnamed'
      },
      previousState: currentState,
      newState: normalizedState,
      reason: wasRecreated
        ? `Deleted resource recreated using rollback token (original ID: ${resourceId})`
        : `State restored using rollback token`,
      rollbackToken: generateRollbackToken(),
      status: 'success',
      tags: [resourceType.toLowerCase(), 'rollback', 'admin', ...(wasRecreated ? ['recreated'] : [])]
    }).catch(err => {
      backendLogger.error('Failed to track rollback activity', {
        error: err.message,
        resourceType,
        resourceId: resource._id
      });
    });

    backendLogger.info(wasRecreated ? 'Deleted resource recreated successfully' : 'State restored successfully', {
      resourceType,
      originalResourceId: resourceId,
      newResourceId: resource._id.toString(),
      wasRecreated,
      actor: actor._id
    });

    return {
      success: true,
      resource,
      message: wasRecreated
        ? `Deleted ${resourceType.toLowerCase()} has been recreated with a new ID`
        : 'State restored successfully',
      wasRecreated
    };
  } catch (error) {
    backendLogger.error('Error restoring state', {
      error: error.message || error.toString(),
      rollbackToken
    });
    return {
      success: false,
      error: error.message || error.toString() || 'Unknown error during state restoration'
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

module.exports = {
  trackCreate,
  trackUpdate,
  trackDelete,
  trackPlanItemCompletion,
  trackCostAdded,
  restoreState,
  getHistory,
  extractMetadata,
  extractActor,
  generateRollbackToken,
  calculateChanges
};
