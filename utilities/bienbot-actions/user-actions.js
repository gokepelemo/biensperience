/**
 * BienBot user-domain action handlers.
 *
 * Pure relocation from utilities/bienbot-action-executor.js — no behavior change.
 * Covers user-permission inviting/removing on plans+experiences, follow graph,
 * profile updates, activity feed, user-experience listing, and the read-only
 * fetch_user_plans fetcher.
 *
 * @module utilities/bienbot-actions/user-actions
 */

const {
  MS_PER_DAY,
  DEFAULT_INVITE_EXPIRY_DAYS,
  DEFAULT_LIST_LIMIT,
  loadControllers,
  buildMockReq,
  buildMockRes,
  logger
} = require('./_shared');

// ---------------------------------------------------------------------------
// Collaborator management (cross-entity user permissions)
// ---------------------------------------------------------------------------

/**
 * invite_collaborator
 * payload: { plan_id?, experience_id?, user_id, type? }
 *
 * Delegates to either plans.addCollaborator or experiences.addExperiencePermission
 * depending on which entity ID is provided.
 */
async function executeInviteCollaborator(payload, user) {
  const { plansController, experiencesController } = loadControllers();

  if (payload.plan_id) {
    const req = buildMockReq(
      user,
      { userId: payload.user_id },
      { id: payload.plan_id }
    );
    const { res, getResult } = buildMockRes();
    await plansController.addCollaborator(req, res);
    return getResult();
  }

  if (payload.experience_id) {
    const req = buildMockReq(
      user,
      {
        _id: payload.user_id,
        entity: 'user',
        type: payload.type || 'collaborator'
      },
      { id: payload.experience_id }
    );
    const { res, getResult } = buildMockRes();
    await experiencesController.addExperiencePermission(req, res);
    return getResult();
  }

  return {
    statusCode: 400,
    body: { success: false, error: 'invite_collaborator requires plan_id or experience_id' }
  };
}

/**
 * remove_collaborator
 * payload: { plan_id?, experience_id?, user_id }
 */
async function executeRemoveCollaborator(payload, user) {
  const { plansController, experiencesController } = loadControllers();

  if (payload.plan_id) {
    const req = buildMockReq(user, {}, { id: payload.plan_id, userId: payload.user_id });
    const { res, getResult } = buildMockRes();
    await plansController.removeCollaborator(req, res);
    return getResult();
  }

  if (payload.experience_id) {
    const req = buildMockReq(user, {}, {
      id: payload.experience_id,
      entityId: payload.user_id,
      entityType: 'user'
    });
    const { res, getResult } = buildMockRes();
    await experiencesController.removeExperiencePermission(req, res);
    return getResult();
  }

  return {
    statusCode: 400,
    body: { success: false, error: 'remove_collaborator requires plan_id or experience_id' }
  };
}

// ---------------------------------------------------------------------------
// Follow graph
// ---------------------------------------------------------------------------

/**
 * follow_user — mutating, requires confirmation.
 * payload: { user_id }
 */
async function executeFollowUser(payload, user) {
  const { user_id } = payload || {};
  if (!user_id) return { statusCode: 400, body: { success: false, error: 'user_id is required' } };

  const { followsController } = loadControllers();
  const req = buildMockReq(user, {}, { userId: user_id });
  const { res, getResult } = buildMockRes();
  await followsController.followUser(req, res);
  return getResult();
}

/**
 * unfollow_user — mutating, requires confirmation.
 * payload: { user_id }
 */
async function executeUnfollowUser(payload, user) {
  const { user_id } = payload || {};
  if (!user_id) return { statusCode: 400, body: { success: false, error: 'user_id is required' } };

  const { followsController } = loadControllers();
  const req = buildMockReq(user, {}, { userId: user_id });
  const { res, getResult } = buildMockRes();
  await followsController.unfollowUser(req, res);
  return getResult();
}

/**
 * accept_follow_request — mutating, requires confirmation.
 * payload: { follower_id }
 */
async function executeAcceptFollowRequest(payload, user) {
  const { follower_id } = payload || {};
  if (!follower_id) return { statusCode: 400, body: { success: false, error: 'follower_id is required' } };

  const { followsController } = loadControllers();
  const req = buildMockReq(user, {}, { followerId: follower_id });
  const { res, getResult } = buildMockRes();
  await followsController.acceptFollowRequest(req, res);
  return getResult();
}

/**
 * list_user_followers — read-only, no confirmation.
 * payload: { user_id, type?: 'followers'|'following', limit?: 20 }
 * Returns followers or following list for the given user.
 */
async function executeListUserFollowers(payload, user) {
  const { user_id, type = 'followers', limit = 20 } = payload || {};
  if (!user_id) return { statusCode: 400, body: { success: false, error: 'user_id is required' } };

  const { followsController } = loadControllers();
  const controllerFn = type === 'following' ? followsController.getFollowing : followsController.getFollowers;
  const req = buildMockReq(user, {}, { userId: user_id }, { limit });
  const { res, getResult } = buildMockRes();
  await controllerFn(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// Profile + activities
// ---------------------------------------------------------------------------

/**
 * update_user_profile — mutating, requires confirmation.
 * payload: { name?, bio?, preferences?: { currency?, timezone?, theme? } }
 * Always scoped to the logged-in user — never accepts a target user_id.
 */
async function executeUpdateUserProfile(payload, user) {
  const { name, bio, preferences } = payload || {};
  const { usersController } = loadControllers();
  const req = buildMockReq(
    user,
    { name, bio, preferences },
    { id: user._id.toString() }
  );
  const { res, getResult } = buildMockRes();
  await usersController.updateUser(req, res);
  return getResult();
}

/**
 * list_user_activities — read-only, no confirmation.
 * payload: { limit?: 10 }
 * Returns the activity feed for the logged-in user.
 */
async function executeListUserActivities(payload, user) {
  const { limit = 10 } = payload || {};
  const { activitiesController } = loadControllers();
  const req = buildMockReq(
    user,
    {},
    { actorId: user._id.toString() },
    { limit }
  );
  const { res, getResult } = buildMockRes();
  await activitiesController.getActorHistory(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// User-scoped read-only listings
// ---------------------------------------------------------------------------

/**
 * list_user_experiences — read-only, no confirmation.
 * payload: { user_id: string, limit?: number }
 * Returns experiences where the target user is an owner.
 */
async function executeListUserExperiences(payload, user) {
  const { user_id, limit = DEFAULT_LIST_LIMIT } = payload || {};

  if (!user_id) {
    return { statusCode: 400, body: { success: false, error: 'user_id is required' } };
  }

  const Experience = require('../../models/experience');

  try {
    const { Types } = require('mongoose');
    if (!Types.ObjectId.isValid(user_id)) {
      return { statusCode: 400, body: { success: false, error: 'Invalid user_id format' } };
    }
    const userOid = new Types.ObjectId(user_id);

    // Public-profile listing: only return experiences the target user owns
    // *and* that are publicly visible. Without the `public: true` filter,
    // any authenticated caller could enumerate another user's private work.
    // Callers that need their own private list can hit a permission-checked
    // endpoint directly.
    const rawExperiences = await Experience.find({
      public: true,
      permissions: { $elemMatch: { _id: userOid, entity: 'user', type: 'owner' } }
    })
      .populate('destination', 'name country')
      .select('name overview destination plan_items')
      .limit(limit)
      .lean();

    const experiences = rawExperiences.map(exp => ({
      _id: exp._id.toString(),
      name: exp.name,
      overview: exp.overview || null,
      destination: exp.destination
        ? { name: exp.destination.name, country: exp.destination.country }
        : null,
      plan_item_count: (exp.plan_items || []).length
    }));

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          experiences,
          user_id,
          total: experiences.length
        }
      }
    };
  } catch (err) {
    logger.error('[bienbot-executor] executeListUserExperiences failed', { user_id, error: err.message });
    return { statusCode: 500, body: { success: false, error: 'Failed to fetch experiences' } };
  }
}

/**
 * fetch_user_plans — read-only, no confirmation.
 * Returns plans owned by a user, defaulting to the requesting user.
 * Returns { plans: [{ _id, experience_name, destination_name, planned_date, completion_pct, item_count }], total, returned }.
 *
 * Permission rule:
 * - user_id omitted → defaults to requesting user; always allowed.
 * - user_id provided + matches requesting user → always allowed.
 * - user_id provided + DIFFERENT user → only return plans where the requesting
 *   user is also in permissions[] (owner/collaborator/contributor). Super admin
 *   sees all.
 *
 * The permission filter is applied at the Mongo query level via permissions._id,
 * so .lean() is safe — the enforcer is not invoked.
 *
 * payload: { user_id?: string, status?: 'active'|'completed'|'all', limit?: number }
 */
async function executeFetchUserPlans(payload, user) {
  const Plan = require('../../models/plan');
  const mongoose = require('mongoose');

  const targetIdStr = payload?.user_id ? String(payload.user_id) : String(user._id);
  if (!mongoose.Types.ObjectId.isValid(targetIdStr)) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_id' } };
  }

  const FETCH_USER_PLANS_MAX = 50;
  const requestedLimit = Number.isFinite(payload?.limit)
    ? Math.max(1, Math.floor(payload.limit))
    : FETCH_USER_PLANS_MAX;
  const limit = Math.min(requestedLimit, FETCH_USER_PLANS_MAX);

  const requestingUserId = user._id.toString();
  const isSelf = targetIdStr === requestingUserId;
  const isSuperAdmin = user.role === 'super_admin';

  // Build the query: target user must be plan owner; requesting user must
  // also have a permissions entry on the same plan (unless super_admin or
  // querying themselves).
  const query = { user: targetIdStr };
  if (!isSelf && !isSuperAdmin) {
    query['permissions._id'] = new mongoose.Types.ObjectId(requestingUserId);
  }

  const status = payload?.status || 'all';
  if (status === 'active') {
    query.$or = [
      { planned_date: { $gte: new Date() } },
      { planned_date: null }
    ];
  } else if (status === 'completed') {
    query.planned_date = { $lt: new Date() };
  }

  const total = await Plan.countDocuments(query);
  const plans = await Plan.find(query)
    .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
    .select('experience planned_date plan')
    .limit(limit)
    .lean();

  const sliced = plans.map(p => {
    const itemCount = (p.plan || []).length;
    const completedCount = (p.plan || []).filter(i => i.complete).length;
    return {
      _id: p._id.toString(),
      experience_name: p.experience?.name || null,
      destination_name: p.experience?.destination?.name || null,
      planned_date: p.planned_date || null,
      completion_pct: itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0,
      item_count: itemCount
    };
  });

  return { statusCode: 200, body: { plans: sliced, total, returned: sliced.length } };
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

/**
 * create_invite — mutating, requires confirmation.
 * payload: { max_uses?: 1, expires_in_days?: 7, email?: string, invitee_name?: string, send_email?: boolean }
 * Creates a shareable invite code for the logged-in user.
 * When email is provided the code is tied to that address; when send_email is true
 * an invitation email is dispatched via the email service.
 *
 * Delegates to InviteCode.createInvite() to reuse the model's collision-resistant
 * code generation (crypto.randomInt-based) and uniqueness retry logic.
 * The frontend bienbot-api.js broadcasts 'invite:created' via the event bus
 * when the executed action result is processed.
 */
async function executeCreateInvite(payload, user) {
  const InviteCode = require('../../models/inviteCode');
  const { max_uses = 1, expires_in_days = DEFAULT_INVITE_EXPIRY_DAYS, email, invitee_name, send_email = false } = payload || {};
  const expiresAt = new Date(Date.now() + expires_in_days * MS_PER_DAY);

  // Validate email format when provided. Mirrors the controller's stricter
  // RFC-ish check; rejects empty TLDs / missing dot in domain.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid email address format' } };
  }

  const invite = await InviteCode.createInvite({
    createdBy: user._id,
    maxUses: max_uses,
    expiresAt,
    ...(email ? { email: email.toLowerCase().trim() } : {}),
    ...(invitee_name ? { inviteeName: invitee_name.trim() } : {})
  });

  let emailSent = false;
  if (send_email && email) {
    try {
      const { sendInviteEmail } = require('../email-service');
      await sendInviteEmail({
        toEmail: email,
        inviterName: user.name,
        inviteCode: invite.code,
        inviteeName: invitee_name || undefined
      });
      emailSent = true;
      invite.inviteMetadata = {
        ...(invite.inviteMetadata || {}),
        emailSent: true,
        sentAt: new Date(),
        sentFrom: user._id
      };
      await invite.save();
    } catch (emailError) {
      // Mask the local-part of the recipient email so logs only retain the
      // domain — useful for triage without storing PII in plaintext.
      const maskedEmail = typeof email === 'string'
        ? email.replace(/^[^@]+/, '***')
        : null;
      logger.error('[bienbot] executeCreateInvite: failed to send invite email', {
        userId: user._id,
        inviteId: invite._id,
        emailDomain: maskedEmail
      }, emailError);
      // Don't fail the action — invite code was created successfully
    }
  }

  return { statusCode: 201, body: { success: true, data: { ...invite.toObject(), emailSent } } };
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

const HANDLERS = {
  invite_collaborator: executeInviteCollaborator,
  remove_collaborator: executeRemoveCollaborator,
  follow_user: executeFollowUser,
  unfollow_user: executeUnfollowUser,
  accept_follow_request: executeAcceptFollowRequest,
  list_user_followers: executeListUserFollowers,
  update_user_profile: executeUpdateUserProfile,
  list_user_activities: executeListUserActivities,
  list_user_experiences: executeListUserExperiences,
  fetch_user_plans: executeFetchUserPlans,
  create_invite: executeCreateInvite
};

const ALLOWED_TYPES = Object.keys(HANDLERS);

const READ_ONLY_TYPES = [
  'list_user_followers',
  'list_user_activities',
  'list_user_experiences',
  'fetch_user_plans'
];

const TOOL_CALL_TYPES = ['fetch_user_plans'];

module.exports = {
  ALLOWED_TYPES,
  READ_ONLY_TYPES,
  TOOL_CALL_TYPES,
  HANDLERS
};
