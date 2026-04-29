/**
 * BienBot — session lifecycle: list, get, resume, delete, update context,
 * collaborator management, cross-session memory, apply tips.
 *
 * Split out from `controllers/api/bienbot.js` (bd #f4ed).
 *
 * @module controllers/api/bienbot/sessions
 */

const {
  crypto, mongoose, logger, path,
  validateObjectId, successResponse, errorResponse,
  getEnforcer,
  loadModels, Destination, Experience, Plan, User,
  BienBotSession,
  callProvider, getApiKey, getProviderForTask, AI_TASKS, GatewayError,
  summarizeSession,
  extractMemoryFromSession, extractMemoryForCollaborators, formatMemoryBlock,
  validateNavigationSchema, extractContextIds,
  resolveEntities,
  affinityCache, computeAndCacheAffinity,
  HISTORY_TOKEN_BUDGET, HISTORY_CHARS_PER_TOKEN, HISTORY_MAX_CHARS,
  CONTEXT_TOKEN_BUDGET, CONTEXT_CHAR_BUDGET,
  SUMMARY_CACHE_TTL_MS,
  resolveEntityLabel, findPlanContainingItem,
  mergeReferencedEntitiesIntoContext,
  enforceContextBudget,
} = require('./_shared');

/**
 * POST /api/bienbot/sessions/:id/resume
 *
 * Resume a past session. Generates or returns cached summary + greeting.
 * - Sessions with < 3 messages get a static welcome-back greeting.
 * - Otherwise runs the session summarizer.
 * - Caches result in session.summary with 6-hour TTL.
 */
exports.resume = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  // Validate session ID
  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  // Load session (non-lean so we can call instance methods)
  let session;
  try {
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for resume', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // Detect if the user is currently viewing a different entity than the last
  // entity discussed in this session. Used to annotate the greeting.
  const currentPageContext = req.body?.current_page_context || null;

  // Determine the last entity from accumulated session context (most specific first).
  // Falls back to invoke_context if no entities have been resolved yet.
  const ctx = session.context;
  let lastContextEntity = null;
  let lastContextEntityId = null;
  if (ctx?.plan_item_id) {
    lastContextEntity = 'plan_item';
    lastContextEntityId = ctx.plan_item_id.toString();
  } else if (ctx?.plan_id) {
    lastContextEntity = 'plan';
    lastContextEntityId = ctx.plan_id.toString();
  } else if (ctx?.experience_id) {
    lastContextEntity = 'experience';
    lastContextEntityId = ctx.experience_id.toString();
  } else if (ctx?.destination_id) {
    lastContextEntity = 'destination';
    lastContextEntityId = ctx.destination_id.toString();
  } else {
    lastContextEntity = session.invoke_context?.entity;
    lastContextEntityId = session.invoke_context?.entity_id?.toString() ?? null;
  }

  let lastContextEntityLabel = session.invoke_context?.entity_label ?? null;
  if (lastContextEntity && lastContextEntityId) {
    try {
      lastContextEntityLabel = (await resolveEntityLabel(lastContextEntity, lastContextEntityId))
        || lastContextEntityLabel;
    } catch (_) { /* keep fallback label */ }
  }

  const isContextSwitch = currentPageContext?.entity && currentPageContext?.id &&
    (currentPageContext.entity !== lastContextEntity || currentPageContext.id !== lastContextEntityId);
  const contextSwitchNote = isContextSwitch && currentPageContext.label
    ? ` You're currently viewing **${currentPageContext.label}**${
        lastContextEntityLabel ? `, which is different from the ${lastContextEntity || 'destination'} we last talked about` : ''
      }.`
    : '';

  // Sessions with fewer than 3 messages: static greeting
  if ((session.messages || []).length < 3) {
    const shortFirstName = req.user?.name?.split(/\s+/)[0];
    const baseContent = shortFirstName
      ? `Welcome back, ${shortFirstName}! How can I help you continue?`
      : 'Welcome back! How can I help you continue?';
    const staticGreeting = {
      role: 'assistant',
      content: `${baseContent}${contextSwitchNote}`,
      suggested_next_steps: ['Continue where you left off', 'Ask BienBot a new question']
    };

    return successResponse(res, {
      session: {
        ...session.toObject(),
        pending_actions: (session.pending_actions || []).filter(a =>
          !a.executed && a.type !== 'select_plan' && a.type !== 'select_destination'
        )
      },
      greeting: staticGreeting
    });
  }

  // Check cached summary (6-hour TTL)
  let summaryData;

  if (!session.isSummaryStale(SUMMARY_CACHE_TTL_MS)) {
    // Use cached summary
    summaryData = {
      summary: session.summary.text,
      next_steps: session.summary.suggested_next_steps || [],
      referenced_entities: session.summary.referenced_entities || []
    };
  } else {
    // Generate new summary
    try {
      summaryData = await summarizeSession({
        messages: session.messages,
        context: session.context,
        session: session.toObject(),
        user: req.user
      });
    } catch (err) {
      if (err instanceof GatewayError) {
        const status = err.statusCode || 429;
        return errorResponse(res, null, err.message, status);
      }
      throw err;
    }

    // Cache the result (including referenced entities for future resumes)
    try {
      await session.cacheSummary(
        summaryData.summary,
        summaryData.next_steps,
        summaryData.referenced_entities || []
      );
    } catch (err) {
      logger.warn('[bienbot] Failed to cache summary', { error: err.message });
    }
  }

  // Thread referenced_entities into session.context so follow-up questions
  // about an entity the recap focused on (e.g. "show the Casablanca plan
  // details" when the recap mentioned a specific Casablanca plan) don't
  // trigger redundant disambiguation.
  if (Array.isArray(summaryData.referenced_entities) && summaryData.referenced_entities.length > 0) {
    try {
      const merged = await mergeReferencedEntitiesIntoContext({
        referencedEntities: summaryData.referenced_entities,
        session,
        userId: req.user._id.toString()
      });
      if (merged.appliedCount > 0) {
        logger.info('[bienbot] Resume: seeded session.context from summary referenced_entities', {
          sessionId: session._id.toString(),
          applied: merged.applied
        });
      }
    } catch (refErr) {
      logger.warn('[bienbot] Resume: failed to merge referenced_entities', { error: refErr.message });
    }
  }

  // Build greeting message from summary
  const firstName = req.user?.name?.split(/\s+/)[0];
  const greeting = firstName ? `Welcome back, ${firstName}!` : 'Welcome back!';
  const greetingContent = `${greeting} Here's a quick recap: ${summaryData.summary}${contextSwitchNote}`;

  // Append greeting to session messages
  try {
    await session.addMessage('assistant', greetingContent);
  } catch (err) {
    logger.warn('[bienbot] Failed to append greeting message', { error: err.message });
  }

  return successResponse(res, {
    session: {
      ...session.toObject(),
      // Disambiguation actions (select_plan, select_destination) are contextual to
      // the moment they were shown. On resume the user is on a fresh page; stale
      // pickers should not reappear. Clear them so only true pending actions (create,
      // update, delete, etc.) are restored.
      pending_actions: (session.pending_actions || []).filter(a =>
        !a.executed && a.type !== 'select_plan' && a.type !== 'select_destination'
      )
    },
    greeting: {
      role: 'assistant',
      content: greetingContent,
      suggested_next_steps: summaryData.next_steps
    }
  });
};

/**
 * GET /api/bienbot/sessions
 *
 * List sessions for the authenticated user, most recent first.
 * Query params: ?status=active|archived  (optional filter)
 */
exports.listSessions = async (req, res) => {
  const userId = req.user._id.toString();
  const { status } = req.query;

  const options = {};
  if (status === 'active' || status === 'archived') {
    options.status = status;
  }

  try {
    const sessions = await BienBotSession.listSessions(userId, options);
    return successResponse(res, { sessions });
  } catch (err) {
    logger.error('[bienbot] Failed to list sessions', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to list sessions', 500);
  }
};

/**
 * GET /api/bienbot/sessions/:id
 *
 * Get a single session by ID. Only the session owner can access it.
 */
exports.getSession = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId).lean();
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Inline access check (lean documents don't have instance methods)
    const isOwner = session.user.toString() === userId;
    const isCollaborator = (session.shared_with || []).some(c => c.user_id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    return successResponse(res, { session });
  } catch (err) {
    logger.error('[bienbot] Failed to get session', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to get session', 500);
  }
};

/**
 * DELETE /api/bienbot/sessions/:id
 *
 * Delete (archive) a session. Only the session owner can delete it.
 */
exports.deleteSession = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only the session owner can delete (archive) it
    if (session.user.toString() !== userId) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    await session.archive();

    const archivedSession = session.toObject();

    // Clean up any cached photos that were never assigned to an entity — fire-and-forget
    require('../../../utilities/bienbot-external-data').cleanupSessionPhotos(archivedSession)
      .catch(err => logger.error('[bienbot] Session photo cleanup failed', { error: err.message, sessionId: id }));

    // Trigger async memory extraction — fire-and-forget, never delays the response
    extractMemoryFromSession({ session: archivedSession, user: req.user })
      .catch(err => logger.error('[bienbot] Async memory extraction failed', { error: err.message, sessionId: id }));

    // Extract memory for collaborators who contributed to this shared session
    if ((archivedSession.shared_with || []).length > 0) {
      extractMemoryForCollaborators(archivedSession)
        .catch(err => logger.error('[bienbot] Async collaborator memory extraction failed', { error: err.message, sessionId: id }));
    }

    logger.info('[bienbot] Session archived', { userId, sessionId: id });
    return successResponse(res, { message: 'Session deleted' });
  } catch (err) {
    logger.error('[bienbot] Failed to delete session', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to delete session', 500);
  }
};

/**
 * POST /api/bienbot/sessions/:id/context
 *
 * Update the session context mid-conversation (e.g. when the user opens a
 * plan-item modal while the chat drawer is already open). Returns the
 * resolved entity label so the frontend can display an acknowledgment.
 */
exports.updateContext = async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  const { entity, entityId } = req.body;
  if (!entity || !entityId) {
    return errorResponse(res, null, 'entity and entityId are required', 400);
  }

  const { valid: entityIdValid, objectId: entityObjId } = validateObjectId(entityId, 'entityId');
  if (!entityIdValid) {
    return errorResponse(res, null, 'Invalid entityId format', 400);
  }

  const allowedEntities = ['destination', 'experience', 'plan', 'plan_item', 'user'];
  if (!allowedEntities.includes(entity)) {
    return errorResponse(res, null, 'Unknown entity type', 400);
  }

  let session;
  try {
    session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    const access = session.checkAccess(userId);
    if (!access.hasAccess) {
      return errorResponse(res, null, 'Session not found', 404);
    }
    // Only owner and editors can update context
    if (access.role === 'viewer') {
      return errorResponse(res, null, 'You have view-only access to this session', 403);
    }
  } catch (err) {
    logger.error('[bienbot] Failed to load session for context update', { error: err.message });
    return errorResponse(res, null, 'Failed to load session', 500);
  }

  // Resolve entity label (never trust client)
  const entityLabel = await resolveEntityLabel(entity, entityId);
  if (!entityLabel) {
    return errorResponse(res, null, 'Entity not found', 404);
  }

  // Permission check
  loadModels();
  const enforcer = getEnforcer({ Destination, Experience, Plan, User });
  let resource;

  try {
    switch (entity) {
      case 'destination':
        resource = await Destination.findById(entityObjId).lean();
        break;
      case 'experience':
        resource = await Experience.findById(entityObjId).lean();
        break;
      case 'plan':
        resource = await Plan.findById(entityObjId).lean();
        break;
      case 'plan_item': {
        const parentPlan = await findPlanContainingItem(entityObjId);
        if (parentPlan) resource = parentPlan;
        break;
      }
      case 'user':
        resource = await User.findById(entityObjId).lean();
        break;
    }
  } catch (err) {
    logger.error('[bienbot] Entity load failed during context update', { error: err.message });
    return errorResponse(res, null, 'Failed to verify permissions', 500);
  }

  if (!resource) {
    return errorResponse(res, null, 'Entity not found', 404);
  }

  if (entity !== 'user') {
    const permCheck = await enforcer.canView({ userId: req.user._id, resource });
    if (!permCheck.allowed) {
      return errorResponse(res, null, 'You do not have permission to view this entity', 403);
    }
  }

  // Build context update
  const contextUpdate = {};
  // Keys to clear when the parent context switches to a different entity.
  // Switching destination → clear experience, plan, plan_item (stale chain).
  // Switching experience → clear plan, plan_item (they belonged to the old experience).
  const contextUnset = {};
  const existingCtx = session.context || {};

  switch (entity) {
    case 'destination':
      contextUpdate.destination_id = entityId;
      // Cascade-clear experience/plan/plan_item if switching to a different destination
      if (existingCtx.destination_id && existingCtx.destination_id.toString() !== entityId) {
        if (existingCtx.experience_id) contextUnset['context.experience_id'] = '';
        if (existingCtx.plan_id) contextUnset['context.plan_id'] = '';
        if (existingCtx.plan_item_id) contextUnset['context.plan_item_id'] = '';
      }
      break;
    case 'experience':
      contextUpdate.experience_id = entityId;
      // Cascade-clear plan/plan_item if switching to a different experience
      if (existingCtx.experience_id && existingCtx.experience_id.toString() !== entityId) {
        if (existingCtx.plan_id) contextUnset['context.plan_id'] = '';
        if (existingCtx.plan_item_id) contextUnset['context.plan_item_id'] = '';
      }
      break;
    case 'plan':
      contextUpdate.plan_id = entityId;
      if (existingCtx.plan_item_id) contextUnset['context.plan_item_id'] = '';
      break;
    case 'plan_item': {
      contextUpdate.plan_item_id = entityId;
      const parentPlan = await findPlanContainingItem(entityObjId, { select: '_id', lean: true });
      if (parentPlan) contextUpdate.plan_id = parentPlan._id.toString();
      break;
    }
    case 'user':
      break;
  }

  try {
    // Use atomic findByIdAndUpdate to avoid a lost-update race condition.
    // If a concurrent chat turn saves pending_actions between when we loaded
    // the session (above) and when we save here, a plain session.save() would
    // overwrite those pending_actions with the stale empty array we loaded.
    // $set on individual context keys and $push to messages avoids that.
    const newMsg = {
      msg_id: `msg_${crypto.randomBytes(4).toString('hex')}`,
      role: 'assistant',
      content: `Now viewing: ${entityLabel}`,
      timestamp: new Date(),
      intent: null,
      actions_taken: ['context_update'],
      message_type: 'bot_query'
    };

    const atomicUpdate = { $push: { messages: newMsg } };
    if (Object.keys(contextUpdate).length > 0) {
      atomicUpdate.$set = {};
      for (const [k, v] of Object.entries(contextUpdate)) {
        atomicUpdate.$set[`context.${k}`] = v;
      }
    }
    if (Object.keys(contextUnset).length > 0) {
      atomicUpdate.$unset = contextUnset;
    }

    await BienBotSession.findByIdAndUpdate(sessionObjId, atomicUpdate);

    logger.info('[bienbot] Session context updated', { userId, sessionId: id, entity, entityId, unset: Object.keys(contextUnset) });
    // Compute the response context by merging the update into the loaded snapshot and removing unset fields
    const responseContext = { ...session.context, ...contextUpdate };
    for (const key of Object.keys(contextUnset)) {
      // keys are 'context.plan_id' etc — strip the 'context.' prefix
      delete responseContext[key.replace(/^context\./, '')];
    }
    return successResponse(res, { entityLabel, context: responseContext });
  } catch (err) {
    logger.error('[bienbot] Context update failed', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to update context', 500);
  }
};

// ---------------------------------------------------------------------------
// Session sharing
// ---------------------------------------------------------------------------

/**
 * POST /api/bienbot/sessions/:id/collaborators
 *
 * Share a session with another user. Only the session owner can share.
 * The target user must have the 'ai_features' flag.
 *
 * Body: { userId: string, role?: 'viewer' | 'editor' }
 */
exports.addSessionCollaborator = async (req, res) => {
  const ownerId = req.user._id.toString();
  const { id } = req.params;
  const { userId: targetUserId, role = 'viewer' } = req.body;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }

  if (!targetUserId) {
    return errorResponse(res, null, 'userId is required', 400);
  }
  const { valid: targetValid, objectId: targetUserObjId } = validateObjectId(targetUserId, 'userId');
  if (!targetValid) {
    return errorResponse(res, null, 'Invalid userId format', 400);
  }

  if (!['viewer', 'editor'].includes(role)) {
    return errorResponse(res, null, 'Role must be "viewer" or "editor"', 400);
  }

  if (targetUserId === ownerId) {
    return errorResponse(res, null, 'Cannot share a session with yourself', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    // Only the session owner can share
    if (session.user.toString() !== ownerId) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    // Verify target user exists and has ai_features
    loadModels();
    const targetUser = await User.findById(targetUserObjId);
    if (!targetUser) {
      return errorResponse(res, null, 'User not found', 404);
    }

    const { hasFeatureFlag } = require('../../../utilities/feature-flags');
    if (!hasFeatureFlag(targetUser, 'ai_features')) {
      return errorResponse(res, null, 'Target user does not have access to AI features', 403);
    }

    // Require mutual follow — both users must follow each other
    const Follow = require('../../models/follow');
    const [ownerFollowsTarget, targetFollowsOwner] = await Promise.all([
      Follow.isFollowing(ownerId, targetUserId),
      Follow.isFollowing(targetUserId, ownerId)
    ]);
    if (!ownerFollowsTarget || !targetFollowsOwner) {
      return errorResponse(res, null, 'You can only share sessions with users who mutually follow you', 403);
    }

    await session.addCollaborator(targetUserId, role, ownerId, targetUser.name || null);

    logger.info('[bienbot] Session collaborator added', {
      sessionId: id,
      ownerId,
      targetUserId,
      role
    });

    // Notify the target user and create an activity so the notification badge counts it
    try {
      const Activity = require('../../models/activity');
      const { notifyUser } = require('../../../utilities/notifications');

      const ownerName = req.user.name || 'Someone';
      const sessionTitle = session.title || 'a BienBot session';
      const reason = `${ownerName} shared ${sessionTitle} with you`;

      // Activity record for the target user (actor = target so it shows in their feed)
      const createdActivity = await Activity.create({
        action: 'collaborator_added',
        actor: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        },
        resource: {
          id: session._id,
          type: 'BienBotSession',
          name: sessionTitle
        },
        target: {
          id: req.user._id,
          type: 'User',
          name: req.user.name || ''
        },
        reason,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          requestPath: req.path,
          requestMethod: req.method
        },
        status: 'success'
      });

      // In-app notification (bienbot channel is informational; webhook for external)
      await notifyUser({
        user: targetUser,
        channel: 'bienbot',
        type: 'activity',
        message: reason,
        data: {
          kind: 'bienbot_session',
          action: 'collaborator_added',
          sessionId: session._id.toString(),
          ownerId: ownerId
        },
        logContext: { feature: 'bienbot_session_shared', sessionId: id, targetUserId }
      });

      // Push real-time notification badge update directly to the target user's WS connection
      try {
        const { sendEventToUser: wsSendToUser } = require('../../../utilities/websocket-server');
        wsSendToUser(targetUserId, {
          type: 'notification:received',
          payload: { notification: createdActivity.toObject ? createdActivity.toObject() : createdActivity }
        });
      } catch (wsErr) {
        logger.warn('[bienbot] Failed to push real-time notification to collaborator', { error: wsErr.message });
      }
    } catch (notifyErr) {
      logger.warn('[bienbot] Failed to create activity/notification for session share (continuing)', {
        error: notifyErr.message,
        sessionId: id,
        targetUserId
      });
    }

    return successResponse(res, {
      message: 'Collaborator added',
      shared_with: session.shared_with
    });
  } catch (err) {
    logger.error('[bienbot] Failed to add session collaborator', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to add collaborator', 500);
  }
};

/**
 * DELETE /api/bienbot/sessions/:id/collaborators/:userId
 *
 * Remove a collaborator from a session. The session owner can remove anyone;
 * a collaborator can remove themselves.
 */
exports.removeSessionCollaborator = async (req, res) => {
  const actorId = req.user._id.toString();
  const { id, userId: targetUserId } = req.params;

  const { valid, objectId: sessionObjId } = validateObjectId(id, 'session ID');
  if (!valid) {
    return errorResponse(res, null, 'Invalid session ID format', 400);
  }
  const { valid: targetValid } = validateObjectId(targetUserId, 'userId');
  if (!targetValid) {
    return errorResponse(res, null, 'Invalid userId format', 400);
  }

  try {
    const session = await BienBotSession.findById(sessionObjId);
    if (!session) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    const isOwner = session.user.toString() === actorId;
    const isSelf = targetUserId === actorId;

    // Only owner can remove others; collaborators can remove themselves
    if (!isOwner && !isSelf) {
      return errorResponse(res, null, 'Session not found', 404);
    }

    await session.removeCollaborator(targetUserId);

    logger.info('[bienbot] Session collaborator removed', {
      sessionId: id,
      actorId,
      targetUserId
    });

    return successResponse(res, {
      message: 'Collaborator removed',
      shared_with: session.shared_with
    });
  } catch (err) {
    logger.error('[bienbot] Failed to remove session collaborator', { error: err.message, sessionId: id });
    return errorResponse(res, err, 'Failed to remove collaborator', 500);
  }
};

/**
 * GET /api/bienbot/mutual-followers
 *
 * Return users who mutually follow the authenticated user, filtered by an
 * optional search query (name or email). Used by the Share Session popover
 * to populate the user search dropdown.
 *
 * Query params:
 *   q  - Optional search string matched against name/email (case-insensitive)
 */
exports.getMutualFollowers = async (req, res) => {
  const userId = req.user._id;
  const { q = '' } = req.query;
  const searchTerm = q.trim().toLowerCase();

  loadModels();

  try {
    const Follow = require('../../models/follow');

    // Step 1: Get IDs of users that the current user follows (active)
    const followingIds = await Follow.getFollowingIds(userId);

    if (followingIds.length === 0) {
      return successResponse(res, { users: [] });
    }

    // Step 2: Among those, find who also follows the current user back
    const mutualFollows = await Follow.find({
      follower: { $in: followingIds },
      following: userId,
      status: 'active'
    }).select('follower').lean();

    const mutualIds = mutualFollows.map(f => f.follower);

    if (mutualIds.length === 0) {
      return successResponse(res, { users: [] });
    }

    // Step 3: Fetch user details and apply search filter
    const query = { _id: { $in: mutualIds } };
    if (searchTerm) {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escapedTerm, $options: 'i' } },
        { email: { $regex: escapedTerm, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('_id name email')
      .limit(20)
      .lean();

    return successResponse(res, { users });
  } catch (err) {
    logger.error('[bienbot] Failed to get mutual followers', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to get mutual followers', 500);
  }
};

/**
 * GET /api/bienbot/memory
 *
 * Return the authenticated user's cross-session BienBot memory entries.
 * Each entry contains facts extracted from a past conversation session.
 */
exports.getMemory = async (req, res) => {
  const userId = req.user._id;
  loadModels();

  try {
    const user = await User.findById(userId).select('bienbot_memory').lean();
    const entries = user?.bienbot_memory?.entries || [];
    const updatedAt = user?.bienbot_memory?.updated_at || null;

    return successResponse(res, { entries, updated_at: updatedAt });
  } catch (err) {
    logger.error('[bienbot] Failed to get memory', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to retrieve memory', 500);
  }
};

/**
 * DELETE /api/bienbot/memory
 *
 * Clear all cross-session memory for the authenticated user.
 * Irreversible — the user must confirm this action in the UI.
 */
exports.clearMemory = async (req, res) => {
  const userId = req.user._id;
  loadModels();

  try {
    await User.findByIdAndUpdate(userId, {
      $set: {
        'bienbot_memory.entries': [],
        'bienbot_memory.updated_at': new Date()
      }
    });

    logger.info('[bienbot] User memory cleared', { userId });
    return successResponse(res, { message: 'Memory cleared' });
  } catch (err) {
    logger.error('[bienbot] Failed to clear memory', { error: err.message, userId });
    return errorResponse(res, err, 'Failed to clear memory', 500);
  }
};

// ---------------------------------------------------------------------------
// Apply Tips
// ---------------------------------------------------------------------------

/**
 * POST /api/bienbot/sessions/:id/tips
 *
 * Directly appends selected travel tips to a destination, bypassing the LLM.
 * Called from the TipSuggestionList UI when the user confirms their selection.
 *
 * Body: { destination_id: string, tips: Array<{ section?, type?, category?, content }> }
 *
 * Tips arrive in the registry's spec shape (`content`); persisted tips on the
 * destination model use `value` for backwards-compat with existing data.
 */
exports.applyTips = async (req, res) => {
  const userId = req.user._id.toString();
  const { destination_id, tips } = req.body || {};

  if (!destination_id || !Array.isArray(tips) || tips.length === 0) {
    return errorResponse(res, null, 'destination_id and a non-empty tips array are required', 400);
  }

  const { valid, objectId: destOid } = validateObjectId(destination_id, 'destination_id');
  if (!valid) {
    return errorResponse(res, null, 'Invalid destination_id format', 400);
  }

  // Sanitise: only keep allowed fields per tip. Map registry shape (content)
  // to the persisted shape (value).
  const sanitised = tips
    .map(t => ({
      ...t,
      _content: typeof t?.content === 'string' && t.content.trim()
        ? t.content.trim()
        : (typeof t?.value === 'string' ? t.value.trim() : '')
    }))
    .filter(t => t._content)
    .map(t => ({
      type: t.type || 'Custom',
      value: t._content,
      ...(t.category ? { category: t.category } : {}),
      ...(t.section ? { section: t.section } : {}),
      ...(t.icon ? { icon: t.icon } : {}),
      source: 'Wikivoyage'
    }));

  if (sanitised.length === 0) {
    return errorResponse(res, null, 'No valid tips provided', 400);
  }

  loadModels();

  try {
    const destination = await Destination.findById(destOid);
    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Permission check — must be able to edit the destination
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });
    const canEdit = await enforcer.canEdit({ userId, resource: destination });
    if (!canEdit.allowed) {
      return errorResponse(res, null, canEdit.reason || 'Forbidden', 403);
    }

    // Append tips (avoid exact-value duplicates)
    const existingValues = new Set(
      (destination.travel_tips || []).map(t =>
        (typeof t === 'string' ? t : t.value || '').toLowerCase().trim()
      )
    );

    const toAdd = sanitised.filter(
      t => !existingValues.has(t.value.toLowerCase().trim())
    );

    if (toAdd.length > 0) {
      destination.travel_tips = [...(destination.travel_tips || []), ...toAdd];
      destination.travel_tips_updated_at = new Date();
      await destination.save();
    }

    logger.info('[bienbot] Tips applied to destination', {
      userId,
      destinationId: destination_id,
      requested: sanitised.length,
      added: toAdd.length,
      skipped: sanitised.length - toAdd.length
    });

    return successResponse(res, {
      added: toAdd.length,
      skipped: sanitised.length - toAdd.length,
      destination_id
    });
  } catch (err) {
    logger.error('[bienbot] applyTips failed', { error: err.message, userId, destination_id });
    return errorResponse(res, err, 'Failed to apply tips', 500);
  }
};


module.exports = {
  resume: exports.resume,
  listSessions: exports.listSessions,
  getSession: exports.getSession,
  deleteSession: exports.deleteSession,
  updateContext: exports.updateContext,
  addSessionCollaborator: exports.addSessionCollaborator,
  removeSessionCollaborator: exports.removeSessionCollaborator,
  getMutualFollowers: exports.getMutualFollowers,
  getMemory: exports.getMemory,
  clearMemory: exports.clearMemory,
  applyTips: exports.applyTips,
};
