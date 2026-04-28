/**
 * BienBot plan-domain action handlers.
 *
 * Pure relocation from utilities/bienbot-action-executor.js — no behavior change.
 * Covers create_plan, plan-item CRUD, plan sub-resources (notes/details/costs),
 * plan-collaborator location, fetchers, and plan disambiguation.
 *
 * @module utilities/bienbot-actions/plan-actions
 */

const crypto = require('crypto');
const {
  MAX_PLAN_ITEMS_PER_BATCH,
  MAX_DATE_SHIFT_DAYS,
  MS_PER_DAY,
  INVITE_CODE_BYTES,
  loadControllers,
  loadModels,
  normalizeDateOnly,
  buildMockReq,
  buildMockRes,
  toExecutorResult,
  logger
} = require('./_shared');

// Service layer (depends on models + utilities only — never on controllers).
// Per bd #8f36.13 + bd #8667 — canonical CRUD handlers below call the plan
// service directly. Long-tail handlers (notes/details/costs/sub-resources)
// continue to delegate to controllers via the loadControllers() pattern.
const planService = require('../../services/plan-service');

// ---------------------------------------------------------------------------
// create_plan
// ---------------------------------------------------------------------------

/**
 * create_plan
 * payload: { experience_id, planned_date?, currency? }
 */
async function executeCreatePlan(payload, user) {
  const result = await planService.createPlan({
    experienceId: payload.experience_id,
    plannedDate: normalizeDateOnly(payload.planned_date),
    currency: payload.currency,
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'plan', successCode: 201 });
}

// ---------------------------------------------------------------------------
// add_plan_items
// ---------------------------------------------------------------------------

/**
 * add_plan_items (batch)
 * payload: { plan_id, items: [{ text, url?, cost?, planning_days?, parent?, activity_type? }] }
 */
async function executeAddPlanItems(payload, user) {
  const items = Array.isArray(payload.items) ? payload.items : [payload.items].filter(Boolean);

  if (items.length > MAX_PLAN_ITEMS_PER_BATCH) {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: `add_plan_items: cannot add more than ${MAX_PLAN_ITEMS_PER_BATCH} items in a single action (got ${items.length})`
      }
    };
  }

  const result = await planService.addPlanItems({
    planId: payload.plan_id,
    items,
    actor: user
  });

  if (result.error) {
    return {
      statusCode: result.code || 400,
      body: {
        success: false,
        error: `Failed to add item: ${result.error}`,
        partial_results: result.partialResults
      }
    };
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      data: result.plan,
      items_added: result.itemsAdded
    }
  };
}

// ---------------------------------------------------------------------------
// update_plan_item
// ---------------------------------------------------------------------------

/**
 * update_plan_item
 * payload: { plan_id, item_id, complete?, text?, cost?, planning_days?,
 *            activity_type?, scheduled_date?, scheduled_time?, visibility? }
 */
async function executeUpdatePlanItem(payload, user) {
  const updates = {};
  const updateFields = [
    'complete', 'text', 'cost', 'planning_days', 'url',
    'activity_type', 'scheduled_date', 'scheduled_time',
    'visibility', 'location'
  ];
  for (const field of updateFields) {
    if (payload[field] !== undefined) {
      updates[field] = payload[field];
    }
  }
  // Normalise date-only strings to noon UTC to prevent off-by-one shifts
  if (updates.scheduled_date) updates.scheduled_date = normalizeDateOnly(updates.scheduled_date);

  const result = await planService.updatePlanItem({
    planId: payload.plan_id,
    itemId: payload.item_id,
    updates,
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'plan' });
}

// ---------------------------------------------------------------------------
// sync_plan
// ---------------------------------------------------------------------------

/**
 * sync_plan
 * Re-snapshots plan items from the source experience into the user's plan.
 * Preserves completion state and user-added items.
 *
 * payload: { plan_id }
 */
async function executeSyncPlan(payload, user) {
  // sync_plan has no dedicated controller endpoint — implement directly
  // using models, but still respecting permission enforcer.
  const { mongoose, Plan, Experience, Destination, User, getEnforcer } = loadModels();

  const planId = payload.plan_id;

  if (!mongoose.Types.ObjectId.isValid(planId)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid plan ID' } };
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    return { statusCode: 404, body: { success: false, error: 'Plan not found' } };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({ userId: user._id, resource: plan });
  if (!permCheck.allowed) {
    return { statusCode: 403, body: { success: false, error: permCheck.reason || 'Insufficient permissions' } };
  }

  const experience = await Experience.findById(plan.experience);
  if (!experience) {
    return { statusCode: 404, body: { success: false, error: 'Source experience not found' } };
  }

  // Build a map of existing plan items by plan_item_id for completion state preservation
  const existingByItemId = new Map();
  for (const item of (plan.plan || [])) {
    const key = (item.plan_item_id || item._id)?.toString();
    if (key) existingByItemId.set(key, item);
  }

  // Re-snapshot experience items, preserving user completion + cost overrides
  const syncedItems = experience.plan_items.map(item => {
    const existing = existingByItemId.get(item._id?.toString());
    return {
      plan_item_id: item._id,
      complete: existing ? existing.complete : false,
      cost: existing?.cost ?? item.cost_estimate ?? 0,
      planning_days: existing?.planning_days ?? item.planning_days ?? 0,
      text: item.text,
      url: item.url,
      photo: item.photo,
      parent: item.parent,
      activity_type: item.activity_type || null,
      location: item.location || null
    };
  });

  // Preserve user-added items (those without a matching experience plan_item_id)
  const experienceItemIds = new Set(experience.plan_items.map(i => i._id?.toString()));
  const userAddedItems = (plan.plan || []).filter(item => {
    const key = (item.plan_item_id || item._id)?.toString();
    return key && !experienceItemIds.has(key);
  });

  plan.plan = [...syncedItems, ...userAddedItems];
  await plan.save();

  // Broadcast sync event
  try {
    const { broadcastEvent } = require('../websocket-server');
    broadcastEvent('plan', plan._id.toString(), {
      type: 'plan:updated',
      payload: { plan, planId: plan._id.toString(), userId: user._id.toString() }
    }, user._id.toString());
  } catch (wsErr) {
    logger.warn('[bienbot-action-executor] Failed to broadcast sync event', { error: wsErr.message });
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      data: plan,
      message: `Plan synced: ${syncedItems.length} experience items + ${userAddedItems.length} user-added items`
    }
  };
}

// ---------------------------------------------------------------------------
// Plan item completion + sub-resources
// ---------------------------------------------------------------------------

/**
 * mark_plan_item_complete
 * payload: { plan_id, item_id }
 */
async function executeMarkPlanItemComplete(payload, user) {
  const result = await planService.markItemComplete({
    planId: payload.plan_id,
    itemId: payload.item_id,
    complete: true,
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'plan' });
}

/**
 * mark_plan_item_incomplete
 * payload: { plan_id, item_id }
 */
async function executeMarkPlanItemIncomplete(payload, user) {
  const result = await planService.markItemComplete({
    planId: payload.plan_id,
    itemId: payload.item_id,
    complete: false,
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'plan' });
}

/**
 * add_plan_item_note
 * payload: { plan_id, item_id, content, visibility? }
 */
async function executeAddPlanItemNote(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    {
      content: payload.content,
      visibility: payload.visibility || 'contributors'
    },
    { id: payload.plan_id, itemId: payload.item_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.addPlanItemNote(req, res);
  return getResult();
}

/**
 * add_plan_item_detail
 * payload: { plan_id, item_id, type, data }
 */
async function executeAddPlanItemDetail(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    {
      type: payload.type,
      data: payload.data || {}
    },
    { id: payload.plan_id, itemId: payload.item_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.addPlanItemDetail(req, res);
  return getResult();
}

/**
 * update_plan_item_note
 * payload: { plan_id, item_id, note_id, content, visibility? }
 */
async function executeUpdatePlanItemNote(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    {
      content: payload.content,
      ...(payload.visibility && { visibility: payload.visibility })
    },
    { id: payload.plan_id, itemId: payload.item_id, noteId: payload.note_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.updatePlanItemNote(req, res);
  return getResult();
}

/**
 * delete_plan_item_note
 * payload: { plan_id, item_id, note_id }
 */
async function executeDeletePlanItemNote(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    {},
    { id: payload.plan_id, itemId: payload.item_id, noteId: payload.note_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.deletePlanItemNote(req, res);
  return getResult();
}

/**
 * update_plan_item_detail
 * payload: { plan_id, item_id, detail_id?, detail_type, data }
 */
async function executeUpdatePlanItemDetail(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    { type: payload.detail_type, data: payload.data || {} },
    { id: payload.plan_id, itemId: payload.item_id, detailId: payload.detail_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.updatePlanItemDetail(req, res);
  return getResult();
}

/**
 * delete_plan_item_detail
 * payload: { plan_id, item_id, detail_id?, detail_type }
 */
async function executeDeletePlanItemDetail(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    { type: payload.detail_type },
    { id: payload.plan_id, itemId: payload.item_id, detailId: payload.detail_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.deletePlanItemDetail(req, res);
  return getResult();
}

/**
 * assign_plan_item
 * payload: { plan_id, item_id, assigned_to }
 */
async function executeAssignPlanItem(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    { assignedTo: payload.assigned_to },
    { id: payload.plan_id, itemId: payload.item_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.assignPlanItem(req, res);
  return getResult();
}

/**
 * unassign_plan_item
 * payload: { plan_id, item_id }
 */
async function executeUnassignPlanItem(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    {},
    { id: payload.plan_id, itemId: payload.item_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.unassignPlanItem(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// Plan-level handlers
// ---------------------------------------------------------------------------

/**
 * update_plan
 * payload: { plan_id, planned_date?, currency?, notes? }
 */
async function executeUpdatePlan(payload, user, session) {
  const { plansController } = loadControllers();
  const body = {};
  if (payload.planned_date !== undefined) body.planned_date = normalizeDateOnly(payload.planned_date);
  if (payload.currency !== undefined) body.currency = payload.currency;
  if (payload.notes !== undefined) body.notes = payload.notes;
  const req = buildMockReq(user, body, { id: payload.plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.updatePlan(req, res);
  const result = getResult();

  // Auto-propose shift action if the plan date changed and there are scheduled items
  if (result.body?._shift_meta && result.body._shift_meta.scheduled_items_count > 0 && result.body._shift_meta.date_diff_days !== 0 && session) {
    const { scheduled_items_count, date_diff_days } = result.body._shift_meta;
    session.pending_actions = session.pending_actions || [];
    session.pending_actions.push({
      id: `action_${crypto.randomBytes(INVITE_CODE_BYTES).toString('hex')}`,
      type: 'shift_plan_item_dates',
      payload: { plan_id: payload.plan_id, diff_days: date_diff_days },
      description: `Shift ${scheduled_items_count} plan item date(s) by ${date_diff_days > 0 ? '+' : ''}${date_diff_days} day(s) to match your updated plan date`,
      executed: false,
    });
  }

  return result;
}

/**
 * shift_plan_item_dates
 * payload: { plan_id, diff_days }
 */
async function executeShiftPlanItemDates(payload, user) {
  const { plansController } = loadControllers();
  const { plan_id, diff_days } = payload;
  if (!Number.isFinite(diff_days)) {
    return { statusCode: 400, body: { success: false, error: 'diff_days must be a finite number' } };
  }
  if (Math.abs(diff_days) > MAX_DATE_SHIFT_DAYS) {
    return {
      statusCode: 400,
      body: { success: false, error: `diff_days exceeds the ±${MAX_DATE_SHIFT_DAYS} day limit` }
    };
  }
  const diffMs = diff_days * MS_PER_DAY;
  const req = buildMockReq(user, { diff_ms: diffMs }, { id: plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.shiftPlanItemDates(req, res);
  return getResult();
}

/**
 * delete_plan
 * payload: { plan_id?, experience_id? }
 *
 * Resolves the plan to delete in this order:
 *   1. payload.plan_id if provided.
 *   2. The logged-in user's plan for payload.experience_id (from payload or
 *      session context). This ensures that "Unplan this experience" from an
 *      experience page always targets the correct user's plan even when the
 *      LLM omits plan_id.
 *
 * The deletePlan controller enforces canDelete (owner-only), so even if
 * resolution produces a plan the user doesn't own, the call will 403 safely.
 */
async function executeDeletePlan(payload, user, session = null) {
  const { Plan } = loadModels();

  let planId = payload.plan_id;

  // Fallback: resolve from experience_id when plan_id is absent.
  // Check payload, session context, and session invoke_context (where BienBot was opened).
  if (!planId) {
    const invokeContextExpId =
      session?.invoke_context?.entity === 'experience'
        ? session?.invoke_context?.entity_id
        : null;
    const experienceId =
      payload.experience_id ||
      session?.context?.experience_id ||
      invokeContextExpId;

    if (experienceId) {
      try {
        const plan = await Plan.findOne({ user: user._id, experience: experienceId })
          .select('_id')
          .lean();
        if (plan) {
          planId = plan._id.toString();
          logger.info('[bienbot-action-executor] delete_plan: resolved plan_id from experience context', {
            userId: user._id.toString(),
            experienceId: experienceId.toString(),
            resolvedFrom: payload.experience_id
              ? 'payload'
              : session?.context?.experience_id
                ? 'session_context'
                : 'invoke_context',
            planId
          });
        }
      } catch (lookupErr) {
        logger.warn('[bienbot-action-executor] delete_plan: plan lookup from experience failed', {
          error: lookupErr.message
        });
      }
    }
  }

  if (!planId) {
    return {
      statusCode: 400,
      body: { success: false, error: 'delete_plan requires plan_id or an experience in context' }
    };
  }

  const result = await planService.deletePlan({ planId, actor: user });
  if (result.error) {
    return { statusCode: result.code || 400, body: { success: false, error: result.error } };
  }
  return { statusCode: 200, body: { success: true, message: 'Plan deleted successfully' } };
}

/**
 * delete_plan_item
 * payload: { plan_id, item_id }
 */
async function executeDeletePlanItem(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(user, {}, { id: payload.plan_id, itemId: payload.item_id });
  const { res, getResult } = buildMockRes();
  await plansController.deletePlanItem(req, res);
  return getResult();
}

/**
 * add_plan_cost
 * payload: { plan_id, title, cost, currency?, category?, description?, date?, plan_item?, collaborator? }
 */
async function executeAddPlanCost(payload, user) {
  const { plansController } = loadControllers();
  const body = {
    title: payload.title,
    cost: payload.cost,
    currency: payload.currency,
    category: payload.category,
    description: payload.description,
    date: payload.date,
    plan_item: payload.plan_item,
    collaborator: payload.collaborator
  };
  const req = buildMockReq(user, body, { id: payload.plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.addCost(req, res);
  return getResult();
}

/**
 * update_plan_cost
 * payload: { plan_id, cost_id, title?, cost?, currency?, category?, description?, date?, plan_item?, collaborator? }
 */
async function executeUpdatePlanCost(payload, user) {
  const { plansController } = loadControllers();
  const body = {};
  const updateFields = ['title', 'cost', 'currency', 'category', 'description', 'date', 'plan_item', 'collaborator'];
  for (const field of updateFields) {
    if (payload[field] !== undefined) {
      body[field] = payload[field];
    }
  }
  const req = buildMockReq(user, body, { id: payload.plan_id, costId: payload.cost_id });
  const { res, getResult } = buildMockRes();
  await plansController.updateCost(req, res);
  return getResult();
}

/**
 * delete_plan_cost
 * payload: { plan_id, cost_id }
 */
async function executeDeletePlanCost(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(user, {}, { id: payload.plan_id, costId: payload.cost_id });
  const { res, getResult } = buildMockRes();
  await plansController.deleteCost(req, res);
  return getResult();
}

/**
 * set_member_location
 * payload: { plan_id, location, travel_cost_estimate?, currency? }
 */
async function executeSetMemberLocation(payload, user) {
  const { plansController } = loadControllers();
  const body = {
    location: payload.location,
    travel_cost_estimate: payload.travel_cost_estimate,
    currency: payload.currency
  };
  const req = buildMockReq(user, body, { id: payload.plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.setMemberLocation(req, res);
  return getResult();
}

/**
 * remove_member_location
 * payload: { plan_id }
 *
 * Only removes the logged-in user's own location — no user_id accepted.
 */
async function executeRemoveMemberLocation(payload, user) {
  const { plansController } = loadControllers();
  const req = buildMockReq(user, {}, { id: payload.plan_id });
  // removeMemberLocation uses req.query for optional userId; we only allow self
  req.query = {};
  const { res, getResult } = buildMockRes();
  await plansController.removeMemberLocation(req, res);
  return getResult();
}

/**
 * pin_plan_item — mutating, requires confirmation.
 * payload: { plan_id, item_id }
 * Pins a plan item so it appears at the top of the plan timeline.
 */
async function executePinPlanItem(payload, user) {
  const { plan_id, item_id } = payload || {};
  if (!plan_id || !item_id) return { statusCode: 400, body: { success: false, error: 'plan_id and item_id are required' } };
  const { plansController } = loadControllers();
  const req = buildMockReq(user, {}, { id: plan_id, itemId: item_id });
  const { res, getResult } = buildMockRes();
  await plansController.pinPlanItem(req, res);
  return getResult();
}

/**
 * reorder_plan_items — mutating, requires confirmation.
 * payload: { plan_id, item_ids: string[] }
 * Reorders plan items to the specified order. item_ids must be an ordered array
 * containing ALL item IDs for the plan.
 */
async function executeReorderPlanItems(payload, user) {
  const { plan_id, item_ids } = payload || {};
  if (!plan_id || !Array.isArray(item_ids) || item_ids.length === 0) {
    return { statusCode: 400, body: { success: false, error: 'plan_id and item_ids (non-empty array) are required' } };
  }

  const { mongoose, Plan } = loadModels();

  if (!mongoose.Types.ObjectId.isValid(plan_id)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid plan_id format' } };
  }
  // Cast to ObjectId to break the taint chain for CodeQL
  const safePlanId = new mongoose.Types.ObjectId(plan_id);

  // The reorderPlanItems controller expects body.plan to be the full item objects
  // in the new order — not just IDs — so that plan.plan = reorderedItems does not
  // truncate subdocument fields. Fetch the current plan to sort the full objects.
  const currentPlan = await Plan.findById(safePlanId).lean();
  if (!currentPlan) {
    return { statusCode: 404, body: { success: false, error: 'Plan not found' } };
  }

  const itemMap = new Map((currentPlan.plan || []).map(item => [item._id.toString(), item]));
  const requestedSet = new Set(item_ids.map(id => id.toString()));

  // Requested IDs first (in provided order), then any items not in the list (preserved at end).
  const reorderedItems = item_ids
    .filter(id => itemMap.has(id.toString()))
    .map(id => itemMap.get(id.toString()));
  for (const item of (currentPlan.plan || [])) {
    if (!requestedSet.has(item._id.toString())) reorderedItems.push(item);
  }

  const { plansController } = loadControllers();
  const req = buildMockReq(user, { plan: reorderedItems }, { id: plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.reorderPlanItems(req, res);
  return getResult();
}

/**
 * unpin_plan_item — mutating, requires confirmation.
 * payload: { plan_id, item_id }
 * Unpins a plan item, removing its pinned status.
 */
async function executeUnpinPlanItem(payload, user) {
  const { plan_id, item_id } = payload || {};
  if (!plan_id || !item_id) return { statusCode: 400, body: { success: false, error: 'plan_id and item_id are required' } };
  const { plansController } = loadControllers();
  const req = buildMockReq(user, {}, { id: plan_id, itemId: item_id });
  const { res, getResult } = buildMockRes();
  await plansController.unpinPlanItem(req, res);
  return getResult();
}

/**
 * request_plan_access — mutating, requires confirmation.
 * payload: { plan_id, message? }
 * Requests access to a plan the user does not have permission to view.
 */
async function executeRequestPlanAccess(payload, user) {
  const { plan_id, message = '' } = payload || {};
  if (!plan_id) return { statusCode: 400, body: { success: false, error: 'plan_id is required' } };
  const { plansController } = loadControllers();
  const req = buildMockReq(
    user,
    { message },
    { id: plan_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.requestPlanAccess(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// Read-only fetchers
// ---------------------------------------------------------------------------

/**
 * fetch_plan_items — read-only, no confirmation.
 * Returns the plan's items with full scheduling/completion state for the LLM
 * to act on. See plan Task 2 for the full implementation.
 */
async function executeFetchPlanItems(payload, user) {
  const Plan = require('../../models/plan');
  const { getEnforcer } = require('../permission-enforcer');
  const Destination = require('../../models/destination');
  const Experience = require('../../models/experience');
  const User = require('../../models/user');
  const { buildInlineDetailSummary } = require('../bienbot-context-builders');
  const mongoose = require('mongoose');

  const planIdStr = String(payload?.plan_id || '');
  if (!mongoose.Types.ObjectId.isValid(planIdStr)) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_id' } };
  }

  // Cannot use .lean() here — enforcer._checkVisibility relies on
  // resource.constructor.modelName to apply Plan-specific RESTRICTED visibility.
  // .lean() returns a plain object, which falls back to AUTHENTICATED (any logged-in user).
  const plan = await Plan.findById(planIdStr).select('plan permissions experience user');
  if (!plan) return { statusCode: 404, body: { ok: false, error: 'not_found' } };

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const perm = await enforcer.canView({ userId: user._id, resource: plan });
  if (!perm.allowed) return { statusCode: 403, body: { ok: false, error: 'not_authorized' } };

  const FETCH_PLAN_ITEMS_MAX_LIMIT = 100;
  const requestedLimit = Number.isFinite(payload?.limit) ? Math.max(1, Math.floor(payload.limit)) : FETCH_PLAN_ITEMS_MAX_LIMIT;
  const limit = Math.min(requestedLimit, FETCH_PLAN_ITEMS_MAX_LIMIT);

  const filter = payload?.filter || 'all';
  const allItems = plan.plan || [];
  const now = Date.now();
  const matches = allItems.filter(item => {
    switch (filter) {
      case 'unscheduled': return !item.scheduled_date && !item.complete;
      case 'scheduled':   return !!item.scheduled_date;
      case 'incomplete':  return !item.complete;
      case 'overdue': {
        if (item.complete || !item.scheduled_date) return false;
        return new Date(item.scheduled_date).getTime() < now;
      }
      case 'all':
      default: return true;
    }
  });

  const sliced = matches.slice(0, limit);
  return {
    statusCode: 200,
    body: {
      items: sliced.map(item => ({
        _id: item._id?.toString(),
        content: item.content || item.text || item.name || null,
        scheduled_date: item.scheduled_date || null,
        scheduled_time: item.scheduled_time || null,
        complete: !!item.complete,
        pinned: !!item.pinned,
        parent_id: item.parent ? item.parent.toString() : null,
        details_summary: buildInlineDetailSummary(item) || null
      })),
      total: matches.length,
      returned: sliced.length
    }
  };
}

/**
 * fetch_plan_costs — read-only, no confirmation.
 * Returns the plan's costs grouped by category with totals in the user's currency.
 * payload: { plan_id }
 */
async function executeFetchPlanCosts(payload, user) {
  const Plan = require('../../models/plan');
  const Destination = require('../../models/destination');
  const Experience = require('../../models/experience');
  const User = require('../../models/user');
  const { getEnforcer } = require('../permission-enforcer');
  const mongoose = require('mongoose');

  const planIdStr = String(payload?.plan_id || '');
  if (!mongoose.Types.ObjectId.isValid(planIdStr)) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_id' } };
  }

  // Cannot use .lean() — enforcer needs the Mongoose-model class info.
  const plan = await Plan.findById(planIdStr).select('costs currency permissions experience user');
  if (!plan) return { statusCode: 404, body: { ok: false, error: 'not_found' } };

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const perm = await enforcer.canView({ userId: user._id, resource: plan });
  if (!perm.allowed) return { statusCode: 403, body: { ok: false, error: 'not_authorized' } };

  const costs = (plan.costs || []).map(c => ({
    _id: c._id?.toString(),
    label: c.title || c.label || null,
    amount: c.cost || c.amount || 0,
    currency: c.currency || plan.currency || 'USD',
    category: c.category || null,
    item_id: c.plan_item ? c.plan_item.toString() : null
  }));

  const totals_by_category = {};
  let total_in_user_currency = 0;
  for (const c of costs) {
    const key = c.category || 'uncategorized';
    totals_by_category[key] = (totals_by_category[key] || 0) + c.amount;
    total_in_user_currency += c.amount;
  }

  return {
    statusCode: 200,
    body: { costs, totals_by_category, total_in_user_currency }
  };
}

/**
 * fetch_plan_collaborators — read-only, no confirmation.
 * Returns the plan's user permissions joined with member_locations entries.
 * payload: { plan_id }
 */
async function executeFetchPlanCollaborators(payload, user) {
  const Plan = require('../../models/plan');
  const User = require('../../models/user');
  const Destination = require('../../models/destination');
  const Experience = require('../../models/experience');
  const { getEnforcer } = require('../permission-enforcer');
  const mongoose = require('mongoose');

  const planIdStr = String(payload?.plan_id || '');
  if (!mongoose.Types.ObjectId.isValid(planIdStr)) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_id' } };
  }

  // No .lean() — enforcer needs Mongoose class info
  const plan = await Plan.findById(planIdStr).select('permissions member_locations experience user');
  if (!plan) return { statusCode: 404, body: { ok: false, error: 'not_found' } };

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const perm = await enforcer.canView({ userId: user._id, resource: plan });
  if (!perm.allowed) return { statusCode: 403, body: { ok: false, error: 'not_authorized' } };

  const userPerms = (plan.permissions || []).filter(p => p.entity === 'user');
  const userIds = userPerms.map(p => p._id);
  const userDocs = await User.find({ _id: { $in: userIds } }).select('name').lean();
  const nameMap = Object.fromEntries(userDocs.map(u => [String(u._id), u.name]));
  const locMap = Object.fromEntries((plan.member_locations || []).map(ml => [String(ml.user), ml]));

  const collaborators = userPerms.map(p => {
    const uid = String(p._id);
    const ml = locMap[uid];
    return {
      user_id: uid,
      name: nameMap[uid] || 'Unknown',
      role: p.type || 'collaborator',
      granted_at: p.granted_at || null,
      location: ml?.location ? {
        city: ml.location.city || null,
        state: ml.location.state || null,
        country: ml.location.country || null
      } : null,
      travel_cost_estimate: ml?.travel_cost_estimate ?? null
    };
  });

  return { statusCode: 200, body: { collaborators } };
}

// ---------------------------------------------------------------------------
// select_plan — Plan disambiguation handler
// ---------------------------------------------------------------------------

/**
 * Execute a select_plan action: loads the full plan, verifies permission,
 * and returns plan data so the caller can update session context and make
 * a follow-up LLM call.
 *
 * @param {object} payload - { plan_id }
 * @param {object} user - Authenticated user
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function executeSelectPlan(payload, user) {
  if (!payload.plan_id) {
    return { statusCode: 400, body: { success: false, error: 'plan_id is required' } };
  }

  loadControllers();
  const Plan = require('../../models/plan');
  const mongoose = require('mongoose');
  const { getEnforcer } = require('../permission-enforcer');
  const Destination = require('../../models/destination');
  const Experience = require('../../models/experience');
  const User = require('../../models/user');

  if (!mongoose.Types.ObjectId.isValid(payload.plan_id)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid plan_id format' } };
  }
  const planOid = new mongoose.Types.ObjectId(payload.plan_id);

  const plan = await Plan.findById(planOid).populate('experience', 'name destination');
  if (!plan) {
    return { statusCode: 404, body: { success: false, error: 'Plan not found' } };
  }

  const enforcer = getEnforcer({ Plan, Destination, Experience, User });
  const perm = await enforcer.canView({ userId: user._id, resource: plan });
  if (!perm.allowed) {
    return { statusCode: 403, body: { success: false, error: 'Not authorized to view this plan' } };
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      data: {
        plan_id: plan._id.toString(),
        experience_id: plan.experience?._id?.toString() || null,
        experience_name: plan.experience?.name || null,
        destination_id: plan.experience?.destination?.toString() || null,
        planned_date: plan.planned_date || null,
        item_count: (plan.plan || []).length,
        completed_count: (plan.plan || []).filter(i => i.complete).length
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Module exports — registry-style metadata + handler map
// ---------------------------------------------------------------------------

const HANDLERS = {
  create_plan: executeCreatePlan,
  add_plan_items: executeAddPlanItems,
  update_plan_item: executeUpdatePlanItem,
  mark_plan_item_complete: executeMarkPlanItemComplete,
  mark_plan_item_incomplete: executeMarkPlanItemIncomplete,
  sync_plan: executeSyncPlan,
  add_plan_item_note: executeAddPlanItemNote,
  update_plan_item_note: executeUpdatePlanItemNote,
  delete_plan_item_note: executeDeletePlanItemNote,
  add_plan_item_detail: executeAddPlanItemDetail,
  update_plan_item_detail: executeUpdatePlanItemDetail,
  delete_plan_item_detail: executeDeletePlanItemDetail,
  assign_plan_item: executeAssignPlanItem,
  unassign_plan_item: executeUnassignPlanItem,
  update_plan: executeUpdatePlan,
  shift_plan_item_dates: executeShiftPlanItemDates,
  delete_plan: executeDeletePlan,
  delete_plan_item: executeDeletePlanItem,
  add_plan_cost: executeAddPlanCost,
  update_plan_cost: executeUpdatePlanCost,
  delete_plan_cost: executeDeletePlanCost,
  set_member_location: executeSetMemberLocation,
  remove_member_location: executeRemoveMemberLocation,
  pin_plan_item: executePinPlanItem,
  unpin_plan_item: executeUnpinPlanItem,
  reorder_plan_items: executeReorderPlanItems,
  request_plan_access: executeRequestPlanAccess,
  select_plan: executeSelectPlan,
  fetch_plan_items: executeFetchPlanItems,
  fetch_plan_costs: executeFetchPlanCosts,
  fetch_plan_collaborators: executeFetchPlanCollaborators
};

const ALLOWED_TYPES = Object.keys(HANDLERS);

// Read-only types within this domain
const READ_ONLY_TYPES = [
  'fetch_plan_items',
  'fetch_plan_costs',
  'fetch_plan_collaborators',
  // select_plan is auto-executed (no confirmation) per CLAUDE.md
  'select_plan'
];

// Tool-call types — fetchers usable in the LLM tool-use loop
const TOOL_CALL_TYPES = [
  'fetch_plan_items',
  'fetch_plan_costs',
  'fetch_plan_collaborators'
];

module.exports = {
  ALLOWED_TYPES,
  READ_ONLY_TYPES,
  TOOL_CALL_TYPES,
  HANDLERS
};
