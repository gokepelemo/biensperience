/**
 * BienBot Context — User
 *
 * Builds LLM context blocks for User profiles and the greeting/overview
 * surfaced when BienBot is opened from a non-entity page.
 * Extracted verbatim from utilities/bienbot-context-builders.js — mechanical
 * move, no logic changes.
 *
 * @module utilities/bienbot-context/user-context
 */

const logger = require('../backend-logger');
const { validateObjectId } = require('../controller-helpers');
const { getTravelOriginContext } = require('../travel-origin');

const {
  loadModels,
  getModels,
  entityJSON,
  trimToTokenBudget,
  DEFAULT_TOKEN_BUDGET,
  computeDaysUntil,
  buildTemporalBuckets,
  renderAttentionBlock,
  formatSignalBlock,
} = require('./_shared');

/**
 * Build context block for a User profile.
 */
async function buildUserProfileContext(targetUserId, requestingUserId, options = {}) {
  loadModels();
  const { Experience, User } = getModels();

  const { valid: userIdValid, objectId: userOid } = validateObjectId(targetUserId, 'targetUserId');
  if (!userIdValid) return null;

  try {
    const { Types } = require('mongoose');
    const Follow = require('../../models/follow');

    const [user, experienceCount, followerCount, followingCount] = await Promise.all([
      // NOT .lean(): preserves resource.constructor.modelName for permission visibility check.
      User.findById(userOid)
        .select('name email preferences bio links feature_flags'),
      Experience.countDocuments({
        permissions: { $elemMatch: { _id: new Types.ObjectId(targetUserId), entity: 'user', type: 'owner' } }
      }),
      Follow.countDocuments({ following: userOid }),
      Follow.countDocuments({ user: userOid })
    ]);

    if (!user) return null;

    const lines = [
      `[User] ${user.name || '(unnamed)'}`,
      `Entity: ${entityJSON(user._id.toString(), user.name || '(unnamed)', 'user')}`,
      user.email ? `Email: ${user.email}` : null,
      user.bio ? `Bio: ${user.bio}` : null,
      user.preferences?.currency ? `Currency: ${user.preferences.currency}` : null,
      user.preferences?.timezone ? `Timezone: ${user.preferences.timezone}` : null,
      getTravelOriginContext(user),
      user.links?.length ? `Links: ${user.links.map(l => l.title || l.url).join(', ')}` : null,
      experienceCount > 0
        ? `Experiences created: ${experienceCount}  (use list_user_experiences to fetch them)`
        : null,
      `Followers: ${followerCount}  Following: ${followingCount}  (use list_user_followers to list them)`
    ];

    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || DEFAULT_TOKEN_BUDGET);
  } catch (err) {
    logger.error('[bienbot-context] buildUserProfileContext failed', { targetUserId, error: err.message });
    return null;
  }
}

/**
 * Build a greeting/overview context for a user — used when BienBot is opened
 * from a non-entity page (e.g. FAB on dashboard or profile).
 * Includes: active plans with experience + destination entity refs, temporal
 * proximity, today/next7 items, recent activity with entity refs, imminent
 * incomplete items, plans without dates, hidden travel signals, and overdue items.
 * Every entity mentioned carries an inline entityJSON ref so follow-up questions
 * ("which item is overdue?", "show me my Paris plans", "what did I do recently?")
 * can be answered with real IDs and navigation can be proposed immediately.
 */

/** Maps Activity model resource.type values to entityJSON type strings. */
const ACTIVITY_TYPE_MAP = {
  Experience: 'experience',
  Destination: 'destination',
  Plan: 'plan',
  PlanItem: 'plan_item',
  User: 'user'
};

/**
 * @private
 * Builds the "Active plans (N):" block for the greeting context.
 * @param {Array} plans - lean plan documents with populated experience + destination
 * @returns {string[]} Lines to push into the parent array
 */
function _buildActivePlansSection(plans) {
  const lines = [];
  if (plans.length === 0) {
    lines.push('\nNo active plans yet.');
    return lines;
  }
  lines.push(`\nActive plans (${plans.length}):`);
  for (const plan of plans) {
    const expName = plan.experience?.name || '(unknown)';
    const expId = plan.experience?._id?.toString() || null;
    const destName = plan.experience?.destination?.name || null;
    const destId = plan.experience?.destination?._id?.toString() || null;
    const planId = plan._id.toString();
    const planItems = plan.plan || [];
    const totalItems = planItems.length;
    const completedItems = planItems.filter(i => i.complete).length;
    const daysUntil = plan.planned_date ? computeDaysUntil(plan.planned_date) : null;

    let proximityTag = '';
    if (daysUntil !== null) {
      if (daysUntil === 0) proximityTag = ' [TODAY]';
      else if (daysUntil > 0 && daysUntil <= 30) proximityTag = ` [in ${daysUntil}d]`;
      else if (daysUntil < 0) proximityTag = ` [${Math.abs(daysUntil)}d ago]`;
    }
    const dateStr = plan.planned_date
      ? new Date(plan.planned_date).toISOString().split('T')[0]
      : 'no date set';
    const itemsLabel = totalItems === 0
      ? 'no items yet'
      : `${totalItems} item${totalItems !== 1 ? 's' : ''} (${completedItems} completed)`;

    let entityRefs = `Plan: ${entityJSON(planId, expName, 'plan')}`;
    if (expId) entityRefs += ` Experience: ${entityJSON(expId, expName, 'experience')}`;
    if (destId && destName) entityRefs += ` Destination: ${entityJSON(destId, destName, 'destination')}`;

    lines.push(`  • ${expName}${proximityTag} (${dateStr}) — ${itemsLabel} — ${entityRefs}`);

    const { todayItems, next7Items } = buildTemporalBuckets(planItems);
    for (const it of todayItems.slice(0, 2)) {
      const lbl = it.content || it.text || it.name || '(unnamed)';
      lines.push(`    ↳ TODAY: ${lbl} — ${entityJSON(it._id.toString(), lbl, 'plan_item')}`);
    }
    for (const it of next7Items.slice(0, 2)) {
      const lbl = it.content || it.text || it.name || '(unnamed)';
      const days = computeDaysUntil(it.scheduled_date);
      lines.push(`    ↳ in ${days}d: ${lbl} — ${entityJSON(it._id.toString(), lbl, 'plan_item')}`);
    }
  }
  return lines;
}

/**
 * @private
 * Builds the [RECENT ACTIVITY (48h)] block for the greeting context.
 * @param {Array} recentActivities - lean Activity documents (last 20, sorted desc)
 * @returns {string[]} Lines to push, or empty array
 */
function _buildRecentActivitySection(recentActivities) {
  const lines = [];
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent48h = recentActivities.filter(a => new Date(a.createdAt).getTime() > cutoff);
  if (recent48h.length === 0) return lines;
  lines.push(`\n[RECENT ACTIVITY (48h)]`);
  for (const a of recent48h.slice(0, 10)) {
    const resourceName = a.resource?.name || null;
    const resourceId = a.resource?.id?.toString() || null;
    const resourceType = ACTIVITY_TYPE_MAP[a.resource?.type] || null;

    let activityLine = `  • ${a.action}`;
    if (resourceName) activityLine += ` — "${resourceName}"`;
    if (resourceId && resourceType && resourceName) {
      activityLine += ` ${entityJSON(resourceId, resourceName, resourceType)}`;
    }
    if (a.target?.id && a.target?.name && ACTIVITY_TYPE_MAP[a.target?.type]) {
      activityLine += ` → ${entityJSON(a.target.id.toString(), a.target.name, ACTIVITY_TYPE_MAP[a.target.type])}`;
    }
    lines.push(activityLine);
  }
  lines.push(`[/RECENT ACTIVITY]`);
  return lines;
}

/**
 * @private
 * Builds [ATTENTION], [OVERDUE ITEMS], [IMMINENT INCOMPLETE ITEMS], and
 * [PLANS WITHOUT DATE] blocks for the greeting context.
 * Uses a single pass over plans to collect overdue items alongside attention
 * signals, avoiding the duplicate loop present in the pre-refactor version.
 * @param {Array} plans - lean plan documents (same as passed to buildUserGreetingContext)
 * @returns {string[]} Lines to push into the parent array
 */
function _buildGreetingAttentionSection(plans) {
  const lines = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const attentionSignals = [];
  const imminentIncompleteItems = [];
  const emptyPlanRefs = [];
  const undatedPlanRefs = [];
  const overdueItemDetails = [];

  for (const plan of plans) {
    const planItems = plan.plan || [];
    const expName = plan.experience?.name || 'this trip';
    const expId = plan.experience?._id?.toString() || null;
    const destName = plan.experience?.destination?.name || null;
    const destId = plan.experience?.destination?._id?.toString() || null;
    const planId = plan._id.toString();

    const daysUntilTrip = plan.planned_date
      ? Math.round((new Date(plan.planned_date).setHours(0, 0, 0, 0) - today) / 86400000)
      : null;

    if (!plan.planned_date) {
      undatedPlanRefs.push({ planId, expName, expId, destName, destId });
    }

    if (planItems.length === 0) {
      const planRef = entityJSON(planId, expName, 'plan');
      const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
      attentionSignals.push(`⚠ Your "${expName}" plan has no items yet — Plan: ${planRef}${expRef}`);
      emptyPlanRefs.push({ planId, expName, expId, destName, destId });
    }

    if (daysUntilTrip !== null && daysUntilTrip >= 0 && daysUntilTrip <= 7) {
      const incomplete = planItems.filter(i => !i.complete);
      if (incomplete.length > 0) {
        const planRef = entityJSON(planId, expName, 'plan');
        attentionSignals.push(
          `⚠ ${incomplete.length} item${incomplete.length !== 1 ? 's' : ''} still open on your "${expName}" trip in ${daysUntilTrip} day${daysUntilTrip !== 1 ? 's' : ''} — Plan: ${planRef}`
        );
        for (const item of incomplete.slice(0, 5)) {
          const itemName = item.content || item.text || '(unnamed item)';
          imminentIncompleteItems.push({ planId, expName, expId, destName, destId, item, itemName, daysUntilTrip });
        }
      }
    }

    // Collect overdue items in the same pass — avoids a second loop over plans
    for (const item of planItems) {
      if (item.complete || !item.scheduled_date) continue;
      const d = new Date(item.scheduled_date); d.setHours(0, 0, 0, 0);
      if (d < today) {
        const daysOverdue = Math.round((today - d) / 86400000);
        const itemName = item.content || item.text || '(unnamed item)';
        overdueItemDetails.push({ planId, expName, expId, destName, destId, item, itemName, daysOverdue });
      }
    }
  }

  const totalOverdue = overdueItemDetails.length;
  if (totalOverdue > 0) {
    attentionSignals.push(`⚠ You have ${totalOverdue} overdue item${totalOverdue !== 1 ? 's' : ''} across your plans—worth reviewing first`);
  }

  const attentionBlock = renderAttentionBlock(attentionSignals, 6);
  if (attentionBlock) lines.push(attentionBlock);

  if (overdueItemDetails.length > 0) {
    lines.push(`\n[OVERDUE ITEMS]`);
    for (const { planId, expName, expId, destName, destId, item, itemName, daysOverdue } of overdueItemDetails.slice(0, 10)) {
      const planRef = entityJSON(planId, expName, 'plan');
      const itemRef = entityJSON(item._id.toString(), itemName, 'plan_item');
      const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
      const destRef = destId && destName ? ` Destination: ${entityJSON(destId, destName, 'destination')}` : '';
      lines.push(`  • ${itemName} (${daysOverdue}d overdue) in "${expName}" — Item: ${itemRef} Plan: ${planRef}${expRef}${destRef}`);
    }
    lines.push(`[/OVERDUE ITEMS]`);
  }

  if (imminentIncompleteItems.length > 0) {
    lines.push(`\n[IMMINENT INCOMPLETE ITEMS]`);
    for (const { planId, expName, expId, destName, destId, item, itemName, daysUntilTrip } of imminentIncompleteItems.slice(0, 10)) {
      const planRef = entityJSON(planId, expName, 'plan');
      const itemRef = entityJSON(item._id.toString(), itemName, 'plan_item');
      const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
      const destRef = destId && destName ? ` Destination: ${entityJSON(destId, destName, 'destination')}` : '';
      lines.push(`  • ${itemName} (trip in ${daysUntilTrip}d — "${expName}") — Item: ${itemRef} Plan: ${planRef}${expRef}${destRef}`);
    }
    lines.push(`[/IMMINENT INCOMPLETE ITEMS]`);
  }

  if (undatedPlanRefs.length > 0) {
    lines.push(`\n[PLANS WITHOUT DATE]`);
    for (const { planId, expName, expId, destName, destId } of undatedPlanRefs.slice(0, 5)) {
      const planRef = entityJSON(planId, expName, 'plan');
      const expRef = expId ? ` Experience: ${entityJSON(expId, expName, 'experience')}` : '';
      const destRef = destId && destName ? ` Destination: ${entityJSON(destId, destName, 'destination')}` : '';
      lines.push(`  • "${expName}" — no trip date set — Plan: ${planRef}${expRef}${destRef}`);
    }
    lines.push(`[/PLANS WITHOUT DATE]`);
  }

  return lines;
}

async function buildUserGreetingContext(userId, options = {}) {
  loadModels();
  const { Plan, User, Activity } = getModels();
  const { valid: userIdValid, objectId: userOid } = validateObjectId(userId, 'userId');
  if (!userIdValid) return null;

  try {
    const { Types } = require('mongoose');

    // Fetch user profile, plans (with experience + destination), and recent activities in parallel.
    // Activity model stores resource.name and resource.id so no additional lookups are needed.
    const [userDoc, plans, recentActivities] = await Promise.all([
      User.findById(userOid).select('name hidden_signals preferences').lean(),
      Plan.find({ 'permissions': { $elemMatch: { _id: new Types.ObjectId(userId), entity: 'user' } } })
        .populate({ path: 'experience', select: 'name destination', populate: { path: 'destination', select: 'name' } })
        .select('experience planned_date plan permissions')
        .sort({ planned_date: 1 })
        .limit(10)
        .lean(),
      Activity.find({ 'actor._id': new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('resource target action createdAt')
        .lean()
    ]);

    if (!userDoc) return null;

    const lines = [
      `[User Greeting] Hello, ${userDoc.name || 'traveler'}`,
      `Entity: ${entityJSON(userId, userDoc.name || 'traveler', 'user')}`
    ];

    // Default travel origin (departure point for transport / route queries)
    const originCtx = getTravelOriginContext(userDoc);
    if (originCtx) lines.push(originCtx);

    // Active plans
    lines.push(..._buildActivePlansSection(plans));

    // Recent activity
    try {
      lines.push(..._buildRecentActivitySection(recentActivities));
    } catch (actErr) {
      logger.debug('[bienbot-context] Greeting activity section skipped', { error: actErr.message });
    }

    // Travel signals
    try {
      const signalBlock = formatSignalBlock(userDoc.hidden_signals, 'traveler');
      if (signalBlock) lines.push('\n' + signalBlock);
    } catch (sigErr) {
      logger.debug('[bienbot-context] Greeting signal injection skipped', { error: sigErr.message });
    }

    // Attention, overdue, imminent, undated
    try {
      lines.push(..._buildGreetingAttentionSection(plans));
    } catch (sigErr) {
      logger.debug('[bienbot-context] Greeting attention signals skipped', { error: sigErr.message });
    }

    // Greeting context is the sole context block for QUERY_DASHBOARD — use a larger
    // budget (2500 tokens) so the enriched entity refs are not truncated.
    return trimToTokenBudget(lines.filter(Boolean).join('\n'), options.tokenBudget || 2500);
  } catch (err) {
    logger.error('[bienbot-context] buildUserGreetingContext failed', { userId, error: err.message });
    return null;
  }
}

module.exports = {
  buildUserProfileContext,
  buildUserGreetingContext,
  // Exported for tests and direct use
  ACTIVITY_TYPE_MAP,
};
