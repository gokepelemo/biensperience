/**
 * Plan collaborators, access requests, member-location handlers.
 *
 * Pure relocation from controllers/api/plans.js (bd #97c6).
 * Imports + helper signatures unchanged.
 */

const Plan = require("../../../models/plan");
const Experience = require("../../../models/experience");
const Destination = require("../../../models/destination");
const User = require("../../../models/user");
const Photo = require("../../../models/photo");
const permissions = require("../../../utilities/permissions");
const { getEnforcer } = require("../../../utilities/permission-enforcer");
const { asyncHandler, successResponse, errorResponse, validateObjectId } = require("../../../utilities/controller-helpers");
const backendLogger = require("../../../utilities/backend-logger");
const mongoose = require("mongoose");
const Activity = require('../../../models/activity');
const { sendCollaboratorInviteEmail, sendPlanAccessRequestEmail } = require('../../../utilities/email-service');
const { sendIfAllowed, notifyUser } = require('../../../utilities/notifications');

const { trackCreate, trackUpdate, trackDelete, trackPlanItemCompletion, trackCostAdded } = require('../../../utilities/activity-tracker');
const { hasFeatureFlag, hasFeatureFlagInContext, FEATURE_FLAG_CONTEXT } = require('../../../utilities/feature-flags');
const { broadcastEvent, sendEventToUser } = require('../../../utilities/websocket-server');
const {
  upsertMessagingChannel,
  getStreamServerClient,
  syncChannelMembers
} = require('../../../utilities/stream-chat');
const { insufficientPermissionsError } = require('../../../utilities/error-responses');
const crypto = require('crypto');
const planUnplanQueue = require('../../../utilities/plan-unplan-queue');
const { updateExperienceSignals, refreshSignalsAndAffinity } = require('../../../utilities/hidden-signals');

const { sanitizeLocation, filterNotesByVisibility, isPlanMember } = require('./_shared');


const requestPlanAccess = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message = '' } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  const plan = await Plan.findById(id)
    .select('user experience accessRequests')
    .populate({
      path: 'user',
      select: 'name email preferences'
    })
    .populate({
      path: 'experience',
      select: 'name'
    });

  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  // If user already has view access, no need to request
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canView({
    userId: req.user._id,
    resource: plan
  });

  if (permCheck.allowed) {
    return errorResponse(res, null, 'You already have access to this plan', 400);
  }

  if (plan.user?._id?.toString() === req.user._id.toString()) {
    return errorResponse(res, null, 'You already own this plan', 400);
  }

  // Gate behind plan_access_requests feature flag on the plan owner
  const flagAllowed = hasFeatureFlagInContext({
    loggedInUser: req.user,
    entityCreatorUser: plan.user,
    flagKey: 'plan_access_requests',
    context: FEATURE_FLAG_CONTEXT.ENTITY_CREATOR
  });

  if (!flagAllowed) {
    return errorResponse(res, null, 'Plan access requests are not available for this plan', 403);
  }

  // Check for existing access request in embedded array
  const existingRequest = plan.accessRequests?.find(
    r => r.requester?.toString() === req.user._id.toString()
  );

  if (existingRequest) {
    // If the request was previously handled, don't spam the owner
    if (existingRequest.status !== 'pending') {
      return errorResponse(res, null, 'An access request already exists and has been processed', 409);
    }

    // Pending: update message (optional)
    existingRequest.message = typeof message === 'string' ? message.trim() : '';
    await plan.save();

    return successResponse(res, existingRequest, 'Access request updated');
  }

  // Create new embedded access request with approval token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const accessRequest = {
    requester: req.user._id,
    message: typeof message === 'string' ? message.trim() : '',
    status: 'pending',
    approvalToken: hashedToken,
    approvalTokenExpires: new Date(Date.now() + 7 * 24 * 3600000), // 7 days
    approvalTokenUsed: false
  };

  plan.accessRequests.push(accessRequest);
  await plan.save();

  // Get the newly created request with its _id
  const newRequest = plan.accessRequests[plan.accessRequests.length - 1];

  // Notify plan owner (preference gated)
  try {
    const owner = plan.user;
    const requesterName = req.user?.name || 'A user';

    if (owner?.email) {
      await notifyUser({
        user: owner,
        channel: 'email',
        type: 'activity',
        message: `${requesterName} requested access to your plan for ${plan.experience?.name || 'an experience'}.`,
        data: {
          kind: 'plan_access_request',
          planId: id,
          experienceId: plan.experience?._id?.toString()
        },
        logContext: {
          feature: 'plan_access_request',
          channel: 'email',
          planId: id,
          ownerId: owner._id,
          requesterId: req.user._id
        },
        send: async () => {
          await sendPlanAccessRequestEmail({
            toEmail: owner.email,
            ownerName: owner.name,
            requesterName,
            experienceName: plan.experience?.name || 'an experience',
            experienceId: plan.experience?._id?.toString(),
            planId: id,
            requestMessage: newRequest.message,
            approvalToken: rawToken
          });
        }
      });
    }

    const messageText = `${requesterName} requested access to your plan for ${plan.experience?.name || 'an experience'}.`;
    const messageData = {
      kind: 'plan_access_request',
      planId: id,
      experienceId: plan.experience?._id?.toString()
    };

    await notifyUser({
      user: owner,
      channel: 'bienbot',
      type: 'activity',
      message: messageText,
      data: messageData,
      logContext: {
        feature: 'plan_access_request',
        planId: id,
        ownerId: owner._id,
        requesterId: req.user._id
      }
    });

    // Optional webhook channel (only delivers if user enabled + configured endpoints)
    await notifyUser({
      user: owner,
      channel: 'webhook',
      type: 'activity',
      message: messageText,
      data: messageData,
      logContext: {
        feature: 'plan_access_request',
        channel: 'webhook',
        planId: id,
        ownerId: owner._id,
        requesterId: req.user._id
      }
    });
  } catch (e) {
    backendLogger.warn('Failed to notify plan owner of access request', {
      planId: id,
      error: e?.message || String(e)
    });
  }

  return successResponse(res, newRequest, 'Access request submitted');
});

/**
 * Respond to an access request (approve or decline)
 * PATCH /api/plans/:id/access-requests/:requestId
 *
 * Only the plan owner (or super admin) can respond to access requests.
 * Approving adds the requester as a collaborator.
 */

const respondToAccessRequest = asyncHandler(async (req, res) => {
  const { id, requestId } = req.params;
  const { action } = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return errorResponse(res, null, 'Invalid request ID', 400);
  }

  if (!['approve', 'decline'].includes(action)) {
    return errorResponse(res, null, 'Action must be "approve" or "decline"', 400);
  }

  const plan = await Plan.findById(id)
    .select('user experience accessRequests permissions')
    .populate({
      path: 'user',
      select: 'name email'
    })
    .populate({
      path: 'experience',
      select: 'name'
    });

  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  // Only plan owner or super admin can respond to access requests
  const isOwner = plan.user?._id?.toString() === req.user._id.toString();
  const isSuperAdmin = req.user.role === 'super_admin';

  if (!isOwner && !isSuperAdmin) {
    return errorResponse(res, null, 'Only the plan owner can respond to access requests', 403);
  }

  // Find the access request
  const accessRequest = plan.accessRequests?.id(requestId);

  if (!accessRequest) {
    return errorResponse(res, null, 'Access request not found', 404);
  }

  if (accessRequest.status !== 'pending') {
    return errorResponse(res, null, `This request has already been ${accessRequest.status}`, 400);
  }

  // Update the request status
  accessRequest.status = action === 'approve' ? 'approved' : 'declined';
  accessRequest.respondedAt = new Date();
  accessRequest.respondedBy = req.user._id;

  // If approved, add the requester as a collaborator
  if (action === 'approve') {
    const requesterId = accessRequest.requester;

    // Check if requester already has permissions
    const existingPerm = plan.permissions?.find(
      p => p.entity === 'user' && p._id?.toString() === requesterId.toString()
    );

    if (!existingPerm) {
      plan.permissions.push({
        _id: requesterId,
        entity: 'user',
        type: 'collaborator',
        granted_at: new Date(),
        granted_by: req.user._id
      });
    }
  }

  await plan.save();

  // Notify the requester of the decision
  try {
    const requester = await User.findById(accessRequest.requester).select('name email preferences');
    if (requester?.email) {
      const ownerName = req.user?.name || 'The plan owner';
      const experienceName = plan.experience?.name || 'an experience';
      const statusText = action === 'approve' ? 'approved' : 'declined';

      await notifyUser({
        user: requester,
        channel: 'email',
        type: 'activity',
        message: `${ownerName} has ${statusText} your request to access their plan for ${experienceName}.`,
        data: {
          kind: 'plan_access_response',
          planId: id,
          experienceId: plan.experience?._id?.toString(),
          status: statusText
        },
        logContext: {
          feature: 'plan_access_response',
          channel: 'email',
          planId: id,
          requesterId: accessRequest.requester,
          responderId: req.user._id
        }
      });

      await notifyUser({
        user: requester,
        channel: 'bienbot',
        type: 'activity',
        message: `${ownerName} has ${statusText} your request to access their plan for ${experienceName}.`,
        data: {
          kind: 'plan_access_response',
          planId: id,
          experienceId: plan.experience?._id?.toString(),
          status: statusText
        },
        logContext: {
          feature: 'plan_access_response',
          planId: id,
          requesterId: accessRequest.requester,
          responderId: req.user._id
        }
      });
    }
  } catch (e) {
    backendLogger.warn('Failed to notify requester of access request response', {
      planId: id,
      requestId,
      error: e?.message || String(e)
    });
  }

  backendLogger.info('Access request responded', {
    planId: id,
    requestId,
    action,
    responderId: req.user._id.toString()
  });

  return successResponse(res, accessRequest, `Access request ${action === 'approve' ? 'approved' : 'declined'}`);
});

/**
 * Get pending access requests for a plan
 * GET /api/plans/:id/access-requests
 *
 * Only the plan owner (or super admin) can view access requests.
 */

const getAccessRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  const plan = await Plan.findById(id)
    .select('user accessRequests')
    .populate({
      path: 'accessRequests.requester',
      select: 'name email photos oauthProfilePhoto photo',
      populate: {
        path: 'photos.photo',
        select: 'url caption'
      }
    });

  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  // Only plan owner or super admin can view access requests
  const isOwner = plan.user?.toString() === req.user._id.toString();
  const isSuperAdmin = req.user.role === 'super_admin';

  if (!isOwner && !isSuperAdmin) {
    return errorResponse(res, null, 'Only the plan owner can view access requests', 403);
  }

  // Filter to only pending requests by default, or return all if ?all=true
  const showAll = req.query.all === 'true';
  const requests = showAll
    ? plan.accessRequests
    : plan.accessRequests.filter(r => r.status === 'pending');

  return successResponse(res, requests);
});

/**
 * Get all plans for a specific experience
 * Returns plans the current user can view
 * Optimized to use single query instead of N+1
 */

const addCollaborator = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return errorResponse(res, null, "Invalid ID", 400);
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return errorResponse(res, null, "Plan not found", 404);
  }

  // Only owner can add collaborators
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  // Lightweight short-circuit: if the requester is the plan owner (plan.user), allow immediately.
  try {
    if (plan.user && plan.user.toString() === req.user._id.toString()) {
      // Owner detected - skip enforcer check
      backendLogger.debug('Add collaborator: short-circuit owner check passed', {
        planId: plan._id.toString(),
        ownerId: plan.user.toString(),
        actorId: req.user._id.toString()
      });
    } else {
      const permCheck = await enforcer.canManagePermissions({
        userId: req.user._id,
        resource: plan
      });

      if (!permCheck.allowed) {
        return errorResponse(res, null, permCheck.reason || "Only the plan owner can add collaborators", 403);
      }
    }
  } catch (err) {
    backendLogger.error('Error checking permissions for addCollaborator', { error: err?.message, stack: err?.stack });
    return errorResponse(res, err, 'Error checking permissions', 500);
  }

  // Check if user already has permission
  const existingPerm = plan.permissions.find(
    p => p.entity === 'user' && p._id.toString() === userId
  );

  if (existingPerm) {
    return res.status(400).json({ error: "User already has permissions on this plan" });
  }

  // Add collaborator using enforcer (SECURE)
  const result = await enforcer.addPermission({
    resource: plan,
    permission: {
      _id: userId,
      entity: 'user',
      type: 'collaborator'
    },
    actorId: req.user._id,
    reason: 'Collaborator added to plan',
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    }
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Best-effort: ensure plan group chat membership stays in sync.
  // Requirement: plan owner + all collaborators are auto-added to plan group chat.
  try {
    const updatedForChat = await Plan.findById(plan._id).select('user permissions experience');
    const ownerId = updatedForChat?.user?.toString();

    const [experienceDoc, ownerUser] = await Promise.all([
      Experience.findById(updatedForChat.experience).select('name').lean(),
      ownerId ? User.findById(ownerId).select('name role flags').lean() : Promise.resolve(null)
    ]);

    const chatEnabled = hasFeatureFlagInContext({
      loggedInUser: req.user,
      entityCreatorUser: ownerUser,
      flagKey: 'chat',
      context: FEATURE_FLAG_CONTEXT.ENTITY_CREATOR
    });

    if (chatEnabled) {
      const collaboratorIds = (updatedForChat?.permissions || [])
        .filter(p => p && p.entity === 'user' && p._id && ['owner', 'collaborator'].includes(p.type))
        .map(p => p._id.toString());

      const members = Array.from(new Set([ownerId, ...collaboratorIds].filter(Boolean)));
      const channelId = `plan_${plan._id.toString()}`;

      const channelName = `${experienceDoc?.name || 'Experience'} - ${ownerUser?.name || 'Owner'}`;

      await upsertMessagingChannel({
        channelId,
        members,
        createdById: ownerId || req.user._id,
        name: channelName,
        planId: plan._id.toString()
      });

      // Also sync membership across any existing plan-scoped group chats (e.g. plan item chats).
      try {
        const streamClient = getStreamServerClient();
        const planChannels = await streamClient.queryChannels(
          { type: 'messaging', planId: plan._id.toString() },
          { last_message_at: -1 },
          { limit: 100 }
        );

        await Promise.all(
          (planChannels || []).map(ch => syncChannelMembers({ channel: ch, desiredMembers: members }))
        );
      } catch (syncErr) {
        backendLogger.warn('[Stream Chat] Failed to sync plan-scoped channels after addCollaborator', {
          planId: plan._id.toString(),
          error: syncErr.message,
          code: syncErr.code
        });
      }
    }
  } catch (chatErr) {
    backendLogger.warn('[Stream Chat] Failed to sync plan chat after addCollaborator', {
      planId: plan._id.toString(),
      error: chatErr.message,
      code: chatErr.code
    });
  }

  // Broadcast collaborator addition via WebSocket.
  // Important: the newly-added collaborator might already be viewing this experience,
  // but may NOT have been able to join the experience room before the permission existed.
  // Sending directly to the user ensures their UI updates immediately.
  try {
    const experienceId = (plan.experience?._id || plan.experience)?.toString?.() || plan.experience;
    const planId = plan._id.toString();
    const collaboratorUserId = userId.toString();

    // Notify the collaborator directly (covers the "currently on the experience" case)
    sendEventToUser(collaboratorUserId, {
      type: 'plan:collaborator:added',
      payload: {
        planId,
        experienceId,
        collaboratorAdded: collaboratorUserId,
        action: 'collaborator_added'
      }
    });

    // Also notify anyone already in the experience room (best effort)
    if (experienceId) {
      broadcastEvent('experience', experienceId, {
        type: 'plan:collaborator:added',
        payload: {
          planId,
          experienceId,
          collaboratorAdded: collaboratorUserId,
          action: 'collaborator_added'
        }
      }, req.user._id.toString());
    }
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast plan collaborator addition', {
      error: wsErr.message
    });
  }

  // Permission saved by enforcer, no need to save again

  // Create activity records for BOTH users:
  // 1. Activity for the owner who added the collaborator
  // 2. Activity for the collaborator who was added
  // Also send an email asynchronously (do not block the API response on email success).
  try {
    // Fetch target user and experience details for the activity and email
    const [targetUser, experienceDoc, actorUser] = await Promise.all([
      User.findById(userId).select('name email preferences').lean(),
      Experience.findById(plan.experience).populate('destination', 'name').select('name destination').lean()
      ,
      User.findById(req.user._id).select('name preferences').lean()
    ]);

    const ownerInfo = {
      _id: req.user._id,
      email: req.user.email || null,
      name: req.user.name || null,
      role: req.user.role || null
    };

    const collaboratorInfo = {
      _id: targetUser?._id || userId,
      email: targetUser?.email || null,
      name: targetUser?.name || null,
      role: 'regular_user'
    };

    const resourceLink = `/experiences/${experienceDoc?._id || plan.experience}#plan-${plan._id}`;

    // Best-effort: notifications for both users.
    // Requirement: actor and target should get a notification when a user is added to a plan.
    try {
      const experienceId = (experienceDoc?._id || plan.experience)?.toString?.() || plan.experience;

      const targetMessage = `You were added as a collaborator on ${experienceDoc?.name || 'a plan'} by ${req.user.name || 'a user'}.`;
      const actorMessage = `You added ${targetUser?.name || 'a user'} as a collaborator on ${experienceDoc?.name || 'a plan'}.`;

      const targetData = {
        kind: 'plan',
        action: 'collaborator_added',
        planId: plan._id.toString(),
        experienceId,
        actorId: req.user._id.toString(),
        resourceLink
      };

      const actorData = {
        kind: 'plan',
        action: 'permission_added',
        planId: plan._id.toString(),
        experienceId,
        targetId: userId.toString(),
        resourceLink
      };

      await Promise.all([
        notifyUser({
          user: targetUser,
          channel: 'bienbot',
          type: 'activity',
          message: targetMessage,
          data: targetData,
          logContext: {
            feature: 'plan_collaborator_added',
            kind: 'target',
            planId: plan._id.toString(),
            actorId: req.user._id.toString(),
            targetId: userId.toString()
          }
        }),
        notifyUser({
          user: targetUser,
          channel: 'webhook',
          type: 'activity',
          message: targetMessage,
          data: targetData,
          logContext: {
            feature: 'plan_collaborator_added',
            kind: 'target',
            channel: 'webhook',
            planId: plan._id.toString(),
            actorId: req.user._id.toString(),
            targetId: userId.toString()
          }
        }),
        notifyUser({
          user: actorUser,
          channel: 'bienbot',
          type: 'activity',
          message: actorMessage,
          data: actorData,
          logContext: {
            feature: 'plan_collaborator_added',
            kind: 'actor',
            planId: plan._id.toString(),
            actorId: req.user._id.toString(),
            targetId: userId.toString()
          }
        }),
        notifyUser({
          user: actorUser,
          channel: 'webhook',
          type: 'activity',
          message: actorMessage,
          data: actorData,
          logContext: {
            feature: 'plan_collaborator_added',
            kind: 'actor',
            channel: 'webhook',
            planId: plan._id.toString(),
            actorId: req.user._id.toString(),
            targetId: userId.toString()
          }
        })
      ]);
    } catch (notifyErr) {
      backendLogger.warn('Failed to send plan collaborator notifications (continuing)', {
        error: notifyErr.message,
        planId: plan._id.toString(),
        actorId: req.user._id.toString(),
        targetId: userId.toString()
      });
    }

    // Activity 1: For the owner (shows "Added [user] as collaborator to [experience]")
    // Use allowed action enum values from Activity model ('permission_added' or 'collaborator_added')
    const ownerActivityData = {
      timestamp: new Date(),
      action: 'permission_added',
      actor: ownerInfo,
      resource: {
        id: plan._id,
        type: 'Plan',
        name: experienceDoc?.name || ''
      },
      target: {
        id: targetUser?._id || userId,
        type: 'User',
        name: targetUser?.name || ''
      },
      previousState: null,
      newState: {
        permissions: plan.permissions
      },
      reason: `Added ${targetUser?.name || 'a user'} as a collaborator to ${experienceDoc?.name || 'an experience'}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method,
        resourceLink
      },
      tags: ['collaboration', 'permission_grant'],
      status: 'success'
    };

    // Activity 2: For the collaborator (shows "You were added as a collaborator to [experience]")
    const collaboratorActivityData = {
      timestamp: new Date(),
      action: 'collaborator_added',
      actor: collaboratorInfo, // Actor is the collaborator so it shows in their feed
      resource: {
        id: plan._id,
        type: 'Plan',
        name: experienceDoc?.name || ''
      },
      target: {
        id: req.user._id,
        type: 'User',
        name: req.user.name || ''
      },
      previousState: null,
      newState: {
        permissions: plan.permissions
      },
      reason: `You were added as a collaborator to ${experienceDoc?.name || 'an experience'} by ${req.user.name || 'someone'}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method,
        resourceLink
      },
      tags: ['collaboration', 'permission_received', 'notification'],
      status: 'success'
    };

    // Log both activities
    backendLogger.info('Creating collaborator activities', {
      ownerActorId: ownerActivityData.actor._id.toString(),
      collaboratorActorId: collaboratorActivityData.actor._id.toString(),
      ownerAction: ownerActivityData.action,
      collaboratorAction: collaboratorActivityData.action
    });

    const [ownerLogResult, collaboratorLogResult] = await Promise.all([
      Activity.log(ownerActivityData),
      Activity.log(collaboratorActivityData)
    ]);

    if (!ownerLogResult.success) {
      backendLogger.error('Failed to log owner collaborator activity', { error: ownerLogResult.error, planId: plan._id, userId });
    } else {
      backendLogger.info('Logged owner collaborator activity', {
        activityId: ownerLogResult.activity._id,
        actorId: ownerLogResult.activity.actor._id.toString(),
        action: ownerLogResult.activity.action,
        timestamp: ownerLogResult.activity.timestamp,
        planId: plan._id,
        userId
      });
    }

    if (!collaboratorLogResult.success) {
      backendLogger.error('Failed to log collaborator activity', { error: collaboratorLogResult.error, planId: plan._id, userId });
    } else {
      backendLogger.info('Logged collaborator activity', {
        activityId: collaboratorLogResult.activity._id,
        actorId: collaboratorLogResult.activity.actor._id.toString(),
        action: collaboratorLogResult.activity.action,
        timestamp: collaboratorLogResult.activity.timestamp,
        planId: plan._id,
        userId
      });

      // Push real-time notification badge update to the target user
      try {
        sendEventToUser(userId.toString(), {
          type: 'notification:received',
          payload: { notification: collaboratorLogResult.activity }
        });
      } catch (wsErr) {
        backendLogger.warn('[WebSocket] Failed to push notification to collaborator', { error: wsErr.message });
      }
    }

    // Send email asynchronously — do not await so API response is fast.
    (async () => {
      try {
        if (targetUser && targetUser.email) {
          const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
          const signupUrl = `${frontendBase}/experiences/${experienceDoc?._id || plan.experience}`;

          await sendCollaboratorInviteEmail({
            toEmail: targetUser.email,
            inviterName: req.user.name || 'A user',
            experienceName: experienceDoc?.name || '',
            destinationName: experienceDoc?.destination?.name || '',
            signupUrl
          });

          backendLogger.info('Collaborator invite email sent (async)', { to: targetUser.email, userId, planId: plan._id });
        } else {
          backendLogger.warn('No email address for collaborator; skipping invite email', { userId });
        }
      } catch (emailErr) {
        backendLogger.error('Failed to send collaborator invite email', { error: emailErr?.message, userId });
      }
    })();
  } catch (activityErr) {
    backendLogger.error('Error while creating collaborator activity or preparing email', { error: activityErr?.message, userId });
  }

  const updatedPlan = await Plan.findById(plan._id)
    .populate('experience', 'name photos')
    .populate({
      path: 'user',
      select: 'name email photos oauthProfilePhoto photo',
      populate: {
        path: 'photos.photo',
        select: 'url caption'
      }
    });

  res.json(updatedPlan);
});

/**
 * Remove a collaborator from a plan
 */

const removeCollaborator = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Only owner can remove collaborators
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  try {
    if (plan.user && plan.user.toString() === req.user._id.toString()) {
      backendLogger.debug('Remove collaborator: short-circuit owner check passed', {
        planId: plan._id.toString(),
        ownerId: plan.user.toString(),
        actorId: req.user._id.toString()
      });
    } else {
      const permCheck = await enforcer.canManagePermissions({
        userId: req.user._id,
        resource: plan
      });

      if (!permCheck.allowed) {
        return res.status(403).json({
          error: "Only the plan owner can remove collaborators",
          message: permCheck.reason
        });
      }
    }
  } catch (err) {
    backendLogger.error('Error checking permissions for removeCollaborator', { error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Error checking permissions' });
  }

  // Remove collaborator using enforcer (SECURE)
  const result = await enforcer.removePermission({
    resource: plan,
    permissionId: userId,
    entityType: 'user',
    actorId: req.user._id,
    reason: 'Collaborator removed from plan',
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    }
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Best-effort: keep plan group chat membership in sync after removal.
  try {
    const updatedForChat = await Plan.findById(plan._id).select('user permissions experience');
    const ownerId = updatedForChat?.user?.toString();

    const [experienceDoc, ownerUser] = await Promise.all([
      Experience.findById(updatedForChat.experience).select('name').lean(),
      ownerId ? User.findById(ownerId).select('name role flags').lean() : Promise.resolve(null)
    ]);

    const chatEnabled = hasFeatureFlagInContext({
      loggedInUser: req.user,
      entityCreatorUser: ownerUser,
      flagKey: 'chat',
      context: FEATURE_FLAG_CONTEXT.ENTITY_CREATOR
    });

    if (chatEnabled) {
      const collaboratorIds = (updatedForChat?.permissions || [])
        .filter(p => p && p.entity === 'user' && p._id && ['owner', 'collaborator'].includes(p.type))
        .map(p => p._id.toString());

      const members = Array.from(new Set([ownerId, ...collaboratorIds].filter(Boolean)));
      const channelId = `plan_${plan._id.toString()}`;

      const channelName = `${experienceDoc?.name || 'Experience'} - ${ownerUser?.name || 'Owner'}`;

      await upsertMessagingChannel({
        channelId,
        members,
        createdById: ownerId || req.user._id,
        name: channelName,
        planId: plan._id.toString()
      });

      // Also sync membership across any existing plan-scoped group chats (e.g. plan item chats).
      try {
        const streamClient = getStreamServerClient();
        const planChannels = await streamClient.queryChannels(
          { type: 'messaging', planId: plan._id.toString() },
          { last_message_at: -1 },
          { limit: 100 }
        );

        await Promise.all(
          (planChannels || []).map(ch => syncChannelMembers({ channel: ch, desiredMembers: members }))
        );
      } catch (syncErr) {
        backendLogger.warn('[Stream Chat] Failed to sync plan-scoped channels after removeCollaborator', {
          planId: plan._id.toString(),
          error: syncErr.message,
          code: syncErr.code
        });
      }
    }
  } catch (chatErr) {
    backendLogger.warn('[Stream Chat] Failed to sync plan chat after removeCollaborator', {
      planId: plan._id.toString(),
      error: chatErr.message,
      code: chatErr.code
    });
  }

  await plan.save();

  res.json({ message: "Collaborator removed successfully" });
});

/**
 * Update a specific plan item within a plan
 * Accepts: complete, cost, planning_days, text, url, activity_type, location, lat, lng, address,
 *          scheduled_date, scheduled_time, photos (array of photo ObjectIds)
 */

const getCollaborators = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid plan ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Check if user has permission to view (owner, collaborator, or contributor)
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canView({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: "Insufficient permissions to view this plan",
      message: permCheck.reason
    });
  }

  // Get all user collaborators (not owner, only collaborators)
  const collaboratorIds = plan.permissions
    .filter(p => p.entity === 'user' && p.type === 'collaborator')
    .map(p => p._id);

  if (collaboratorIds.length === 0) {
    return res.json([]);
  }

  // Fetch user details
  const collaborators = await User.find({ 
    _id: { $in: collaboratorIds } 
  })
    .select('_id name email photo photos oauthProfilePhoto')
    .populate('photos.photo', 'url caption');

  res.json(collaborators);
});

/**
 * Add a new plan item to a plan
 * Allows plan owners and collaborators to add items
 * Accepts location.address and location.geo (or lat/lng) and converts to GeoJSON
 */

const approveByToken = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { token } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || '';

  if (!token || !mongoose.Types.ObjectId.isValid(id)) {
    return res.redirect(`${frontendUrl}/?error=invalid_token`);
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const plan = await Plan.findById(id)
    .select('user experience accessRequests permissions')
    .populate({ path: 'experience', select: 'name' })
    .populate({ path: 'user', select: 'name email' });

  if (!plan) {
    return res.redirect(`${frontendUrl}/?error=plan_not_found`);
  }

  const experienceId = plan.experience?._id?.toString();
  const planUrl = `${frontendUrl}/experiences/${experienceId}#plan-${id}`;

  // Find the access request by token hash
  const accessRequest = plan.accessRequests?.find(
    r => r.approvalToken === hashedToken
  );

  if (!accessRequest) {
    return res.redirect(`${frontendUrl}/?error=invalid_token`);
  }

  // Already used — redirect to plan (idempotent)
  if (accessRequest.approvalTokenUsed || accessRequest.status !== 'pending') {
    return res.redirect(planUrl);
  }

  // Token expired
  if (accessRequest.approvalTokenExpires && accessRequest.approvalTokenExpires < new Date()) {
    return res.redirect(`${frontendUrl}/?error=token_expired`);
  }

  // Approve: update request status and add requester as collaborator
  accessRequest.status = 'approved';
  accessRequest.respondedAt = new Date();
  accessRequest.respondedBy = plan.user?._id;
  accessRequest.approvalTokenUsed = true;

  const requesterId = accessRequest.requester;
  const existingPerm = plan.permissions?.find(
    p => p.entity === 'user' && p._id?.toString() === requesterId.toString()
  );
  if (!existingPerm) {
    plan.permissions.push({
      _id: requesterId,
      entity: 'user',
      type: 'collaborator',
      granted_at: new Date(),
      granted_by: plan.user?._id
    });
  }

  await plan.save();

  // Notify the requester of approval
  try {
    const requester = await User.findById(requesterId).select('name email preferences');
    if (requester?.email) {
      const ownerName = plan.user?.name || 'The plan owner';
      const experienceName = plan.experience?.name || 'an experience';

      await notifyUser({
        user: requester,
        channel: 'email',
        type: 'activity',
        message: `${ownerName} has approved your request to access their plan for ${experienceName}.`,
        data: {
          kind: 'plan_access_response',
          planId: id,
          experienceId,
          status: 'approved'
        },
        logContext: {
          feature: 'plan_access_response',
          channel: 'email',
          planId: id,
          requesterId: requesterId.toString(),
          responderId: plan.user?._id?.toString()
        }
      });

      await notifyUser({
        user: requester,
        channel: 'bienbot',
        type: 'activity',
        message: `${ownerName} has approved your request to access their plan for ${experienceName}.`,
        data: {
          kind: 'plan_access_response',
          planId: id,
          experienceId,
          status: 'approved'
        },
        logContext: {
          feature: 'plan_access_response',
          planId: id,
          requesterId: requesterId.toString(),
          responderId: plan.user?._id?.toString()
        }
      });
    }
  } catch (e) {
    backendLogger.warn('Failed to notify requester of token-based approval', {
      planId: id,
      error: e?.message || String(e)
    });
  }

  backendLogger.info('Access request approved via token', {
    planId: id,
    requesterId: requesterId.toString()
  });

  return res.redirect(planUrl);
});

/**
 * Get minimal plan preview (no auth required)
 * GET /api/plans/:id/preview
 *
 * Returns non-sensitive plan metadata for access-denied screens.
 */

const setMemberLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  // Only plan members may call this
  const isMember = await isPlanMember(plan, req.user._id);
  if (!isMember) {
    return errorResponse(res, null, 'You must be a plan member to set a travel origin', 403);
  }

  const { location, travel_cost_estimate, currency } = req.body;

  // Validate location object
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return errorResponse(res, null, 'A location object is required', 400);
  }
  if (location.address !== undefined && (typeof location.address !== 'string' || location.address.length > 500)) {
    return errorResponse(res, null, 'location.address must be a string up to 500 characters', 400);
  }
  if (location.geo && location.geo.coordinates) {
    const [lng, lat] = location.geo.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' ||
        lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return errorResponse(res, null, 'Invalid geo coordinates', 400);
    }
  }

  // Validate optional travel_cost_estimate
  if (travel_cost_estimate !== undefined && travel_cost_estimate !== null) {
    if (typeof travel_cost_estimate !== 'number' || !isFinite(travel_cost_estimate) || travel_cost_estimate < 0) {
      return errorResponse(res, null, 'travel_cost_estimate must be a non-negative number', 400);
    }
  }

  // Validate optional currency
  const normalizedCurrency = (typeof currency === 'string' && currency.trim().length === 3)
    ? currency.trim().toUpperCase()
    : 'USD';

  const userIdStr = req.user._id.toString();

  // Upsert: update existing entry or push a new one
  if (!Array.isArray(plan.member_locations)) {
    plan.member_locations = [];
  }
  const existingIndex = plan.member_locations.findIndex(
    ml => ml.user && ml.user.toString() === userIdStr
  );

  const entry = {
    user: req.user._id,
    location,
    travel_cost_estimate: travel_cost_estimate ?? null,
    currency: normalizedCurrency,
    updated_at: new Date()
  };

  if (existingIndex >= 0) {
    plan.member_locations[existingIndex] = entry;
  } else {
    plan.member_locations.push(entry);
  }

  // Use atomic update to avoid triggering full-doc validators on unrelated fields
  await Plan.findByIdAndUpdate(
    plan._id,
    { $set: { member_locations: plan.member_locations } },
    { new: false, runValidators: false }
  );

  backendLogger.info('Plan member location set', {
    planId: id,
    userId: userIdStr,
    address: location.address
  });

  return successResponse(res, { member_locations: plan.member_locations }, 'Travel origin updated');
});

/**
 * Remove the calling user's travel origin from a plan.
 * Any plan member may remove their own location.
 * Plan owners may additionally pass ?userId= to remove another member's location.
 *
 * DELETE /api/plans/:id/member-location
 */

const removeMemberLocation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  // Determine whose location to remove
  let targetUserId = req.user._id.toString();
  if (req.query.userId && req.query.userId !== targetUserId) {
    // Only plan owners (or super admins) can remove another member's location
    const isOwner = plan.permissions?.some(
      p => p.entity === 'user' && p.type === 'owner' && p._id.toString() === req.user._id.toString()
    );
    const isSuperAdminUser = req.user.role === 'super_admin';
    if (!isOwner && !isSuperAdminUser) {
      return errorResponse(res, null, 'Only the plan owner can remove another member\'s location', 403);
    }
    if (!mongoose.Types.ObjectId.isValid(req.query.userId)) {
      return errorResponse(res, null, 'Invalid userId', 400);
    }
    targetUserId = req.query.userId;
  }

  // Verify caller is at least a plan member
  const isMember = await isPlanMember(plan, req.user._id);
  if (!isMember) {
    return errorResponse(res, null, 'You must be a plan member to modify locations', 403);
  }

  if (!Array.isArray(plan.member_locations)) {
    return successResponse(res, { member_locations: [] }, 'No location to remove');
  }

  const updated = plan.member_locations.filter(
    ml => !(ml.user && ml.user.toString() === targetUserId)
  );

  await Plan.findByIdAndUpdate(
    plan._id,
    { $set: { member_locations: updated } },
    { new: false, runValidators: false }
  );

  backendLogger.info('Plan member location removed', { planId: id, targetUserId });

  return successResponse(res, { member_locations: updated }, 'Travel origin removed');
});

// ---------------------------------------------------------------------------
// Entity AI Config
// ---------------------------------------------------------------------------


module.exports = {
  requestPlanAccess,
  respondToAccessRequest,
  getAccessRequests,
  addCollaborator,
  removeCollaborator,
  getCollaborators,
  approveByToken,
  setMemberLocation,
  removeMemberLocation,
};
