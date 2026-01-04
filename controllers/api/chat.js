const backendLogger = require('../../utilities/backend-logger');
const { successResponse, errorResponse, validateObjectId } = require('../../utilities/controller-helpers');
const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const User = require('../../models/user');
const Follow = require('../../models/follow');
const {
  createUserToken,
  upsertMessagingChannel,
  deleteBienBotChannelForUser
} = require('../../utilities/stream-chat');
const {
  createFlagDenialResponse,
  hasFeatureFlagInContext,
  hasFeatureFlag,
  FEATURE_FLAG_CONTEXT
} = require('../../utilities/feature-flags');

/**
 * Check if a user is eligible to send direct messages to another user.
 *
 * Eligibility rules (any one grants access):
 * 1. Actor is a super admin
 * 2. Users mutually follow each other
 * 3. Actor is a curator AND target has planned one of actor's experiences
 *
 * @param {Object} actor - The user initiating the DM (req.user)
 * @param {ObjectId|string} targetUserId - The user being messaged
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
async function checkDmEligibility(actor, targetUserId) {
  const actorId = actor?._id;
  if (!actorId || !targetUserId) {
    return { allowed: false, reason: 'Invalid user IDs' };
  }

  const actorIdStr = actorId.toString();
  const targetIdStr = targetUserId.toString();

  // Cannot message yourself
  if (actorIdStr === targetIdStr) {
    return { allowed: false, reason: 'Cannot message yourself' };
  }

  // Rule 1: Super admins can message anyone
  if (actor.role === 'super_admin' || actor.isSuperAdmin) {
    backendLogger.debug('DM eligibility: super admin bypass', { actorId: actorIdStr, targetId: targetIdStr });
    return { allowed: true };
  }

  // Rule 2: Check mutual follow relationship
  const [actorFollowsTarget, targetFollowsActor] = await Promise.all([
    Follow.isFollowing(actorId, targetUserId),
    Follow.isFollowing(targetUserId, actorId)
  ]);

  if (actorFollowsTarget && targetFollowsActor) {
    backendLogger.debug('DM eligibility: mutual follow', { actorId: actorIdStr, targetId: targetIdStr });
    return { allowed: true };
  }

  // Rule 3: Check if actor is a curator and target has planned actor's experience
  // Need to fetch actor's feature_flags if not already on the object
  let actorHasCurator = hasFeatureFlag(actor, 'curator', { allowSuperAdmin: false });

  // If actor object doesn't have feature_flags populated, fetch it
  if (!actor.feature_flags && !actorHasCurator) {
    try {
      const actorFull = await User.findById(actorId).select('feature_flags').lean();
      actorHasCurator = hasFeatureFlag(actorFull, 'curator', { allowSuperAdmin: false });
    } catch (err) {
      backendLogger.warn('Failed to fetch actor feature flags for curator check', { error: err.message });
    }
  }

  if (actorHasCurator) {
    // Find experiences where actor is the owner
    const curatorExperiences = await Experience.find({
      'permissions': {
        $elemMatch: {
          _id: actorId,
          entity: 'user',
          type: 'owner'
        }
      }
    }).select('_id').lean();

    if (curatorExperiences.length > 0) {
      const experienceIds = curatorExperiences.map(e => e._id);

      // Check if target has planned any of these experiences
      const targetPlanned = await Plan.exists({
        user: targetUserId,
        experience: { $in: experienceIds }
      });

      if (targetPlanned) {
        backendLogger.debug('DM eligibility: curator to planner', {
          actorId: actorIdStr,
          targetId: targetIdStr,
          curatorExperienceCount: experienceIds.length
        });
        return { allowed: true };
      }
    }
  }

  // No eligibility rule matched
  return {
    allowed: false,
    reason: 'You can only message users you mutually follow, or users who have planned your curated experiences.'
  };
}

function ensurePlanOwnerChatEnabledOrDeny(req, res, ownerUser) {
  const enabled = hasFeatureFlagInContext({
    loggedInUser: req.user,
    entityCreatorUser: ownerUser,
    flagKey: 'stream_chat',
    context: FEATURE_FLAG_CONTEXT.ENTITY_CREATOR,
    options: { allowSuperAdmin: true }
  });
  if (enabled) return true;

  res.status(403).json(
    createFlagDenialResponse('stream_chat', {
      message: 'Chat is not enabled for this plan. Ask the plan owner to enable messaging.'
    })
  );
  return false;
}

function getPlanMemberUserIds(plan) {
  if (!plan || !Array.isArray(plan.permissions)) return [];
  return plan.permissions
    .filter(p => p && p.entity === 'user' && p._id && ['owner', 'collaborator'].includes(p.type))
    .map(p => p._id.toString());
}

function userHasPlanAccess({ userId, plan }) {
  const userIdStr = userId?.toString();
  if (!userIdStr || !plan) return false;

  // Legacy owner field
  if (plan.user && plan.user.toString() === userIdStr) return true;

  // New permissions array
  return getPlanMemberUserIds(plan).includes(userIdStr);
}

function getDeterministicDmChannelId(userIdA, userIdB) {
  const a = userIdA.toString();
  const b = userIdB.toString();
  const [min, max] = a < b ? [a, b] : [b, a];
  return `dm_${min}_${max}`;
}

async function token(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return errorResponse(res, null, 'Authentication required', 401);
    }

    const tokenValue = createUserToken(userId);

    return successResponse(
      res,
      {
        token: tokenValue,
        user: {
          id: userId.toString(),
          name: req.user?.name || 'User'
        }
      },
      'Chat token created'
    );
  } catch (err) {
    backendLogger.error('Failed to create Stream Chat token', { error: err.message, code: err.code });

    if (err.code === 'STREAM_CHAT_NOT_CONFIGURED') {
      return errorResponse(res, err, 'Chat service not configured', 501);
    }

    return errorResponse(res, err, 'Failed to create chat token', 500);
  }
}

async function dmChannel(req, res) {
  try {
    const otherUserIdRaw = req.body?.otherUserId;
    const otherUserIdCheck = validateObjectId(otherUserIdRaw, 'otherUserId');
    if (!otherUserIdCheck.valid) {
      return errorResponse(res, null, otherUserIdCheck.error, 400);
    }

    const otherUser = await User.findById(otherUserIdCheck.objectId).select('name');
    if (!otherUser) {
      return errorResponse(res, null, 'User not found', 404);
    }

    // Check if actor is eligible to message this user
    const eligibility = await checkDmEligibility(req.user, otherUser._id);
    if (!eligibility.allowed) {
      backendLogger.info('DM channel denied', {
        actorId: req.user?._id?.toString(),
        targetId: otherUser._id.toString(),
        reason: eligibility.reason
      });
      return errorResponse(res, null, eligibility.reason, 403);
    }

    const currentUserId = req.user?._id;
    const channelId = getDeterministicDmChannelId(currentUserId, otherUser._id);

    const members = [currentUserId.toString(), otherUser._id.toString()];

    await upsertMessagingChannel({
      channelId,
      members,
      createdById: currentUserId,
      name: otherUser.name || 'User'
    });

    return successResponse(
      res,
      {
        type: 'messaging',
        id: channelId,
        members
      },
      'DM channel ready'
    );
  } catch (err) {
    backendLogger.error('Failed to create DM channel', { error: err.message, code: err.code });

    if (err.code === 'STREAM_CHAT_NOT_CONFIGURED') {
      return errorResponse(res, err, 'Chat service not configured', 501);
    }

    return errorResponse(res, err, 'Failed to create DM channel', 500);
  }
}

async function planChannel(req, res) {
  try {
    const planIdCheck = validateObjectId(req.body?.planId, 'planId');
    if (!planIdCheck.valid) {
      return errorResponse(res, null, planIdCheck.error, 400);
    }

    const plan = await Plan.findById(planIdCheck.objectId).select('user permissions experience');
    if (!plan) {
      return errorResponse(res, null, 'Plan not found', 404);
    }

    const ownerId = plan.user?.toString();
    if (!ownerId) {
      return errorResponse(res, null, 'Plan owner not found', 404);
    }

    const ownerUserForFlag = await User.findById(ownerId).select('feature_flags role isSuperAdmin').lean();
    if (!ownerUserForFlag) {
      return errorResponse(res, null, 'Plan owner not found', 404);
    }

    if (!ensurePlanOwnerChatEnabledOrDeny(req, res, ownerUserForFlag)) {
      return;
    }

    if (!userHasPlanAccess({ userId: req.user?._id, plan })) {
      return errorResponse(res, null, 'Not authorized to access this plan chat', 403);
    }

    // Build members list: owner + all collaborators + the requesting user
    // The requesting user MUST be included since they passed userHasPlanAccess check
    const requestingUserId = req.user._id.toString();
    const members = Array.from(
      new Set([
        ownerId,
        requestingUserId,
        ...getPlanMemberUserIds(plan)
      ].filter(Boolean))
    );
    const channelId = `plan_${plan._id.toString()}`;

    // Use required naming: {experience_name - plan_owner_name}
    const [experienceDoc, ownerUser] = await Promise.all([
      Experience.findById(plan.experience).select('name').lean(),
      ownerId ? User.findById(ownerId).select('name').lean() : Promise.resolve(null)
    ]);

    const channelName = `${experienceDoc?.name || 'Experience'} - ${ownerUser?.name || 'Owner'}`;

    await upsertMessagingChannel({
      channelId,
      members,
      createdById: req.user._id,
      name: channelName,
      planId: plan._id.toString()
    });

    return successResponse(
      res,
      {
        type: 'messaging',
        id: channelId,
        members
      },
      'Plan channel ready'
    );
  } catch (err) {
    backendLogger.error('Failed to create plan channel', { error: err.message, code: err.code });

    if (err.code === 'STREAM_CHAT_NOT_CONFIGURED') {
      return errorResponse(res, err, 'Chat service not configured', 501);
    }

    return errorResponse(res, err, 'Failed to create plan channel', 500);
  }
}

async function planItemChannel(req, res) {
  try {
    const planIdCheck = validateObjectId(req.body?.planId, 'planId');
    if (!planIdCheck.valid) {
      return errorResponse(res, null, planIdCheck.error, 400);
    }

    const planItemIdCheck = validateObjectId(req.body?.planItemId, 'planItemId');
    if (!planItemIdCheck.valid) {
      return errorResponse(res, null, planItemIdCheck.error, 400);
    }

    const plan = await Plan.findById(planIdCheck.objectId).select('user permissions plan experience');
    if (!plan) {
      return errorResponse(res, null, 'Plan not found', 404);
    }

    const ownerId = plan.user?.toString();
    if (!ownerId) {
      return errorResponse(res, null, 'Plan owner not found', 404);
    }

    const ownerUserForFlag = await User.findById(ownerId).select('feature_flags role isSuperAdmin').lean();
    if (!ownerUserForFlag) {
      return errorResponse(res, null, 'Plan owner not found', 404);
    }

    if (!ensurePlanOwnerChatEnabledOrDeny(req, res, ownerUserForFlag)) {
      return;
    }

    if (!userHasPlanAccess({ userId: req.user?._id, plan })) {
      return errorResponse(res, null, 'Not authorized to access this plan chat', 403);
    }

    const planItemIdStr = planItemIdCheck.objectId.toString();
    const items = Array.isArray(plan.plan) ? plan.plan : [];
    const matchedItem = items.find(item => {
      const itemId = item?._id ? item._id.toString() : null;
      const legacyId = item?.plan_item_id ? item.plan_item_id.toString() : null;
      return itemId === planItemIdStr || legacyId === planItemIdStr;
    });

    if (!matchedItem) {
      return errorResponse(res, null, 'Plan item not found in this plan', 404);
    }

    // Build members list: owner + all collaborators + the requesting user
    // The requesting user MUST be included since they passed userHasPlanAccess check
    const requestingUserId = req.user._id.toString();
    const members = Array.from(
      new Set([
        ownerId,
        requestingUserId,
        ...getPlanMemberUserIds(plan)
      ].filter(Boolean))
    );
    const channelId = `planItem_${plan._id.toString()}_${planItemIdStr}`;

    const experienceDoc = await Experience.findById(plan.experience).select('name').lean();
    const planItemName = matchedItem?.text || 'Plan Item';
    const channelName = `${experienceDoc?.name || 'Experience'} - ${planItemName}`;

    await upsertMessagingChannel({
      channelId,
      members,
      createdById: req.user._id,
      name: channelName,
      planId: plan._id.toString(),
      planItemId: planItemIdStr
    });

    return successResponse(
      res,
      {
        type: 'messaging',
        id: channelId,
        members
      },
      'Plan item channel ready'
    );
  } catch (err) {
    backendLogger.error('Failed to create plan item channel', { error: err.message, code: err.code });

    if (err.code === 'STREAM_CHAT_NOT_CONFIGURED') {
      return errorResponse(res, err, 'Chat service not configured', 501);
    }

    return errorResponse(res, err, 'Failed to create plan item channel', 500);
  }
}

async function cancelBienBot(req, res) {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return errorResponse(res, null, 'Authentication required', 401);
    }

    const result = await deleteBienBotChannelForUser(userId);
    return successResponse(res, result, 'BienBot channel cancelled');
  } catch (err) {
    backendLogger.error('Failed to cancel BienBot channel', { error: err.message, code: err.code });

    if (err.code === 'STREAM_CHAT_NOT_CONFIGURED') {
      return errorResponse(res, err, 'Chat service not configured', 501);
    }

    return errorResponse(res, err, 'Failed to cancel BienBot channel', 500);
  }
}

module.exports = {
  token,
  dmChannel,
  planChannel,
  planItemChannel,
  cancelBienBot,
  // Exported for testing and potential reuse
  checkDmEligibility
};
