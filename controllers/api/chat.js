const backendLogger = require('../../utilities/backend-logger');
const { successResponse, errorResponse, validateObjectId } = require('../../utilities/controller-helpers');
const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const User = require('../../models/user');
const { createUserToken, upsertMessagingChannel } = require('../../utilities/stream-chat');
const {
  createFlagDenialResponse,
  hasFeatureFlagInContext,
  FEATURE_FLAG_CONTEXT
} = require('../../utilities/feature-flags');

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

    const currentUserId = req.user?._id;
    const channelId = getDeterministicDmChannelId(currentUserId, otherUser._id);

    const members = [currentUserId.toString(), otherUser._id.toString()];

    await upsertMessagingChannel({
      channelId,
      members,
      createdById: currentUserId,
      name: `${req.user?.name || 'User'} & ${otherUser.name || 'User'}`
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

    const members = Array.from(
      new Set([
        ownerId,
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

    const members = Array.from(
      new Set([
        ownerId,
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

module.exports = {
  token,
  dmChannel,
  planChannel,
  planItemChannel
};
