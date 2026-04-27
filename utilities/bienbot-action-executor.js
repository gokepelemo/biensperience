/**
 * BienBot Action Executor
 *
 * Maps action.type to existing controller logic. Does NOT call Mongoose
 * models directly — reuses the same internal functions used by existing
 * controllers so permission checks, activity tracking, event emission,
 * and WebSocket broadcasts all fire correctly.
 *
 * @module utilities/bienbot-action-executor
 */

const crypto = require('crypto');
const logger = require('./backend-logger');
const { suggestPlanItems, fetchEntityPhotos, addEntityPhotos } = require('./bienbot-external-data');

// Service layer (depends on models + utilities only — never on controllers).
// These are the canonical CRUD operations the executor calls directly.
const planService = require('../services/plan-service');
const experienceService = require('../services/experience-service');
const destinationService = require('../services/destination-service');

// Top-level model + enforcer imports. The previous lazy `loadModels()` dance
// was defensive — there is no real circular dependency between these models
// and the executor. See bd #8f36.13.
const _mongoose = require('mongoose');
const _Plan = require('../models/plan');
const _Experience = require('../models/experience');
const _Destination = require('../models/destination');
const _User = require('../models/user');
const _getEnforcer = require('./permission-enforcer').getEnforcer;

// Top-level controller imports. The previous lazy `loadControllers()` dance
// was defensive — controllers do not import the executor (verified at the
// time of bd #8f36.13). Long-tail action handlers still delegate to controllers
// via the mock-req/res pattern below; canonical CRUD goes through the service
// layer above.
const destinationsController = require('../controllers/api/destinations');
const experiencesController = require('../controllers/api/experiences');
const plansController = require('../controllers/api/plans');
const followsController = require('../controllers/api/follows');
const usersController = require('../controllers/api/users');
const activitiesController = require('../controllers/api/activities');
const documentsController = require('../controllers/api/documents');

// Backwards-compat shims — handlers below historically called these helpers.
// They are now no-ops; kept so we do not need to surgically remove every call site.
function loadControllers() { /* no-op: controllers are top-level requires now */ }
function loadModels() { /* no-op: models are top-level requires now */ }

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const MAX_WORKFLOW_STEPS = 10;
const MAX_PLAN_ITEMS_PER_BATCH = 50;
const MAX_DATE_SHIFT_DAYS = 3650; // ±~10 years
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const INVITE_CODE_BYTES = 4;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;
const DEFAULT_LIST_LIMIT = 20;

/**
 * Strict allowlist of action types that can be executed.
 * Unknown types are dropped and logged — never executed.
 */
const ALLOWED_ACTION_TYPES = [
  'create_destination',
  'create_experience',
  'create_plan',
  'add_plan_items',
  'update_plan_item',
  'mark_plan_item_complete',
  'mark_plan_item_incomplete',
  'invite_collaborator',
  'sync_plan',
  'add_plan_item_note',
  'update_plan_item_note',
  'delete_plan_item_note',
  'add_plan_item_detail',
  'update_plan_item_detail',
  'delete_plan_item_detail',
  'assign_plan_item',
  'unassign_plan_item',
  // Experience-level
  'update_experience',
  'add_experience_plan_item',
  'update_experience_plan_item',
  'delete_experience_plan_item',
  // Destination-level
  'update_destination',
  'toggle_favorite_destination',
  // Plan-level
  'update_plan',
  'delete_plan',
  'delete_plan_item',
  'add_plan_cost',
  'update_plan_cost',
  'delete_plan_cost',
  'remove_collaborator',
  'set_member_location',
  'remove_member_location',
  // Client-only navigation
  'navigate_to_entity',
  // Workflow (multi-step composition)
  'workflow',
  // Photo management
  'add_entity_photos',
  // Read-only data fetching (execute immediately, no confirmation)
  'suggest_plan_items',
  'fetch_entity_photos',
  // 'fetch_destination_tips' — owned by the BienBot tool registry
  // (Wikivoyage provider). Allowed via executeAction's registry-aware dispatch.
  'fetch_plan_items',
  'fetch_plan_costs',
  'fetch_plan_collaborators',
  'fetch_experience_items',
  'fetch_destination_experiences',
  'fetch_user_plans',
  'discover_content',
  // Plan selection (disambiguation)
  'select_plan',
  // Destination selection (disambiguation)
  'select_destination',
  // Plan item date shifting
  'shift_plan_item_dates',
  // Read-only: list experiences owned by a user
  'list_user_experiences',
  // Social / follows
  'follow_user',
  'unfollow_user',
  'accept_follow_request',
  'list_user_followers',
  // User profile update
  'update_user_profile',
  // Activity feed
  'list_user_activities',
  // Plan item operations
  'pin_plan_item',
  'unpin_plan_item',
  'reorder_plan_items',
  // Documents
  'list_entity_documents',
  // Invites / access
  'create_invite',
  'request_plan_access'
];

// O(1) membership lookup; the array form is preserved as the public export.
const ALLOWED_ACTION_TYPES_SET = new Set(ALLOWED_ACTION_TYPES);

/**
 * `$step_N.<path>` reference allowlist.
 *
 * When a workflow step's payload references the result of an earlier step,
 * only the leading path segment is consulted. This prevents an LLM-supplied
 * workflow (potentially attacker-influenced via prompt injection) from
 * exfiltrating sensitive fields like `user.password`, `user.email`, or
 * `oauth.*` from a previous step's result.
 */
const STEP_REF_ALLOWED_FIELDS = new Set([
  '_id',
  'id',
  'destination',
  'destination_id',
  'experience',
  'experience_id',
  'plan',
  'plan_id',
  'plan_item_id',
  'name',
  'planned_date',
  'currency'
]);

/**
 * `navigate_to_entity` URL allowlist. Only same-origin relative paths are
 * acceptable — prevents `javascript:`/external-host XSS via attacker-influenced
 * action payloads.
 */
function isSafeNavigationUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return false;
  if (!url.startsWith('/')) return false;
  if (url.startsWith('//')) return false; // protocol-relative
  return true;
}

/**
 * Read-only action types that execute immediately without user confirmation.
 * These actions only fetch data — they never mutate state.
 */
const READ_ONLY_ACTION_TYPES = new Set([
  'suggest_plan_items',
  'fetch_entity_photos',
  // 'fetch_destination_tips' — owned by the BienBot tool registry; the chat
  // controller computes its read-only set as READ_ONLY_ACTION_TYPES ∪
  // registry.getReadToolNames(), so registry tools auto-execute too.
  'fetch_plan_items',
  'fetch_plan_costs',
  'fetch_plan_collaborators',
  'fetch_experience_items',
  'fetch_destination_experiences',
  'fetch_user_plans',
  'discover_content',
  'list_user_experiences',
  'list_user_followers',
  'list_user_activities',
  'list_entity_documents',
  // Disambiguation actions have no side effects — auto-execute to update session
  // context immediately so the follow-up LLM turn can proceed without an extra
  // user confirmation step.
  'select_plan',
  'select_destination'
]);

/**
 * Read-only fetchers usable as silent tool calls in the LLM tool-use loop.
 * Subset of READ_ONLY_ACTION_TYPES — only fetchers designed for LLM consumption
 * (typed, compact result shape) belong here. Card-producing actions like
 * fetch_entity_photos do NOT belong here; they remain user-facing only.
 */
const TOOL_CALL_ACTION_TYPES = new Set([
  'fetch_plan_items',
  'fetch_plan_costs',
  'fetch_plan_collaborators',
  'fetch_experience_items',
  'fetch_destination_experiences',
  'fetch_user_plans'
]);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Date normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise an ISO date-only string ("2026-04-24") to noon UTC so that
 * `new Date()` in any timezone still falls on the intended calendar day.
 * Full ISO timestamps (with T, Z, or offset) are returned as-is.
 *
 * @param {*} value - The value to normalise.
 * @returns {*} The original value, or the noon-UTC string if it was date-only.
 */
function normalizeDateOnly(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00Z`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Mock req/res for controller delegation
// ---------------------------------------------------------------------------

/**
 * Build a mock Express request object that controllers can read from.
 *
 * @param {object} user - Authenticated user (from session).
 * @param {object} [body={}] - Request body fields.
 * @param {object} [params={}] - Route params (e.g. :id, :experienceId).
 * @param {object} [query={}] - Query string parameters (e.g. { limit: 10 }).
 * @returns {object} Mock req compatible with controller expectations.
 */
function buildMockReq(user, body = {}, params = {}, query = {}) {
  return {
    user,
    body,
    params,
    query,
    ip: '127.0.0.1',
    method: 'POST',
    path: '/api/bienbot/action',
    get: (header) => {
      if (header === 'user-agent') return 'BienBot/1.0';
      return undefined;
    }
  };
}

/**
 * Build a mock Express response that captures the status + body sent by
 * the controller. Controllers use one of three patterns:
 *   1. successResponse(res, data, msg, status, meta) → res.status(code).send(json)
 *   2. errorResponse(res, err, msg, status) → res.status(code).send(json)
 *   3. res.status(code).json(data) / res.json(data)
 *
 * The mock captures whatever pattern is used.
 *
 * @returns {{ res: object, getResult: () => { statusCode, body } }}
 */
function buildMockRes() {
  let captured = { statusCode: 200, body: null, headers: {} };

  const res = {
    statusCode: 200,
    setHeader(name, value) {
      captured.headers[name] = value;
      return res;
    },
    status(code) {
      captured.statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(data) {
      captured.body = data;
      return res;
    },
    send(data) {
      // Controllers may send pre-serialised JSON strings
      if (typeof data === 'string') {
        try { captured.body = JSON.parse(data); } catch { captured.body = data; }
      } else {
        captured.body = data;
      }
      return res;
    }
  };

  return {
    res,
    getResult: () => ({
      statusCode: captured.statusCode,
      body: captured.body
    })
  };
}

// ---------------------------------------------------------------------------
// Per-action-type handlers
// ---------------------------------------------------------------------------

/**
 * Convert a service-layer result (`{ data, error, code }` shape) into the
 * `{ statusCode, body }` shape the executor returns to its callers.
 *
 * @param {object} result - Service-layer response.
 * @param {object} [options]
 * @param {string} [options.dataKey] - Key in `result` that holds the success entity.
 * @param {number} [options.successCode=200]
 * @param {object} [options.extraBody] - Extra fields to merge into the success body.
 * @returns {{ statusCode: number, body: object }}
 */
function toExecutorResult(result, { dataKey, successCode = 200, extraBody = {} } = {}) {
  if (!result || result.error) {
    return {
      statusCode: result?.code || 400,
      body: { success: false, error: result?.error || 'Unknown error' }
    };
  }
  const data = dataKey ? result[dataKey] : (result.data || result);
  return {
    statusCode: successCode,
    body: { success: true, data, ...extraBody }
  };
}

/**
 * create_destination
 * payload: { name, country, state?, overview?, location? }
 */
async function executeCreateDestination(payload, user) {
  const result = await destinationService.createDestination({
    data: {
      name: payload.name,
      country: payload.country,
      state: payload.state,
      overview: payload.overview,
      location: payload.location
    },
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'destination', successCode: 201 });
}

/**
 * create_experience
 * payload: { name, destination?, description?, plan_items?, experience_type?, visibility? }
 */
async function executeCreateExperience(payload, user) {
  const result = await experienceService.createExperience({
    data: {
      name: payload.name,
      destination: payload.destination_id || payload.destination,
      description: payload.description,
      overview: payload.overview,
      plan_items: payload.plan_items,
      experience_type: payload.experience_type,
      visibility: payload.visibility
    },
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'experience', successCode: 201 });
}

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
  if (updates.scheduled_date) updates.scheduled_date = normalizeDateOnly(updates.scheduled_date);

  const result = await planService.updatePlanItem({
    planId: payload.plan_id,
    itemId: payload.item_id,
    updates,
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'plan' });
}

/**
 * invite_collaborator
 * payload: { plan_id?, experience_id?, user_id, type? }
 *
 * Plan path goes through plan-service. Experience path still delegates to
 * the controller's permission endpoint (no service equivalent yet).
 */
async function executeInviteCollaborator(payload, user) {
  if (payload.plan_id) {
    const result = await planService.addCollaborator({
      planId: payload.plan_id,
      userId: payload.user_id,
      actor: user,
      metadata: { source: 'bienbot-action-executor' }
    });
    return toExecutorResult(result, { dataKey: 'plan' });
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
 * sync_plan
 * Re-snapshots plan items from the source experience into the user's plan.
 * Preserves completion state and user-added items.
 *
 * payload: { plan_id }
 */
async function executeSyncPlan(payload, user) {
  // sync_plan has no dedicated controller endpoint — implement directly
  // using models, but still respecting permission enforcer.
  loadModels();

  const planId = payload.plan_id;

  if (!_mongoose.Types.ObjectId.isValid(planId)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid plan ID' } };
  }

  const plan = await _Plan.findById(planId);
  if (!plan) {
    return { statusCode: 404, body: { success: false, error: 'Plan not found' } };
  }

  const enforcer = _getEnforcer({ Plan: _Plan, Experience: _Experience, Destination: _Destination, User: _User });
  const permCheck = await enforcer.canEdit({ userId: user._id, resource: plan });
  if (!permCheck.allowed) {
    return { statusCode: 403, body: { success: false, error: permCheck.reason || 'Insufficient permissions' } };
  }

  const experience = await _Experience.findById(plan.experience);
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
    const { broadcastEvent } = require('./websocket-server');
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
// Plan item sub-resource handlers
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
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
// Experience-level handlers
// ---------------------------------------------------------------------------

/**
 * update_experience
 * payload: { experience_id, name?, overview?, destination?, experience_type?, visibility?, map_location? }
 */
async function executeUpdateExperience(payload, user) {
  const updates = {};
  const updateFields = ['name', 'overview', 'destination', 'experience_type', 'visibility', 'location'];
  for (const field of updateFields) {
    if (payload[field] !== undefined) updates[field] = payload[field];
  }
  const result = await experienceService.updateExperience({
    experienceId: payload.experience_id,
    updates,
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'experience' });
}

/**
 * add_experience_plan_item
 * payload: { experience_id, text, url?, cost_estimate?, planning_days?, parent?, activity_type?, location? }
 */
async function executeAddExperiencePlanItem(payload, user) {
  loadControllers();
  const body = {
    text: payload.text,
    url: payload.url,
    cost_estimate: payload.cost_estimate,
    planning_days: payload.planning_days,
    parent: payload.parent,
    activity_type: payload.activity_type,
    location: payload.location
  };
  const req = buildMockReq(user, body, { experienceId: payload.experience_id });
  const { res, getResult } = buildMockRes();
  await experiencesController.createPlanItem(req, res);
  return getResult();
}

/**
 * update_experience_plan_item
 * payload: { experience_id, plan_item_id, text?, url?, cost_estimate?, planning_days?, parent?, activity_type?, location? }
 */
async function executeUpdateExperiencePlanItem(payload, user) {
  loadControllers();
  const body = {};
  const updateFields = ['text', 'url', 'cost_estimate', 'planning_days', 'parent', 'activity_type', 'location'];
  for (const field of updateFields) {
    if (payload[field] !== undefined) {
      body[field] = payload[field];
    }
  }
  const req = buildMockReq(user, body, { experienceId: payload.experience_id, planItemId: payload.plan_item_id });
  const { res, getResult } = buildMockRes();
  await experiencesController.updatePlanItem(req, res);
  return getResult();
}

/**
 * delete_experience_plan_item
 * payload: { experience_id, plan_item_id }
 */
async function executeDeleteExperiencePlanItem(payload, user) {
  loadControllers();
  const req = buildMockReq(user, {}, { experienceId: payload.experience_id, planItemId: payload.plan_item_id });
  const { res, getResult } = buildMockRes();
  await experiencesController.deletePlanItem(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// Destination-level handlers
// ---------------------------------------------------------------------------

/**
 * update_destination
 * payload: { destination_id, name?, country?, state?, overview?, location?, map_location?, travel_tips? }
 */
async function executeUpdateDestination(payload, user) {
  const updates = {};
  const updateFields = ['name', 'country', 'state', 'overview', 'location', 'map_location', 'travel_tips'];
  for (const field of updateFields) {
    if (payload[field] !== undefined) updates[field] = payload[field];
  }
  const result = await destinationService.updateDestination({
    destinationId: payload.destination_id,
    updates,
    actor: user
  });
  return toExecutorResult(result, { dataKey: 'destination' });
}

/**
 * toggle_favorite_destination
 * payload: { destination_id }
 *
 * Uses the logged-in user's ID exclusively — never accepts an external user_id.
 */
async function executeToggleFavoriteDestination(payload, user) {
  loadControllers();
  const req = buildMockReq(
    user,
    {},
    { destinationId: payload.destination_id, userId: user._id.toString() }
  );
  const { res, getResult } = buildMockRes();
  await destinationsController.toggleUserFavoriteDestination(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// Plan-level handlers
// ---------------------------------------------------------------------------

/**
 * update_plan
 * payload: { plan_id, planned_date?, currency?, notes? }
 *
 * NOTE: Continues to delegate to the controller because the controller adds
 * `_shift_meta` to the response (used to auto-propose shift_plan_item_dates).
 * Moving _shift_meta into the service layer would expand scope; tracked.
 */
async function executeUpdatePlan(payload, user, session) {
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
  loadControllers();
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
        const plan = await _Plan.findOne({ user: user._id, experience: experienceId })
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
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
  loadControllers();
  const req = buildMockReq(user, {}, { id: payload.plan_id, costId: payload.cost_id });
  const { res, getResult } = buildMockRes();
  await plansController.deleteCost(req, res);
  return getResult();
}

/**
 * remove_collaborator
 * payload: { plan_id?, experience_id?, user_id }
 */
async function executeRemoveCollaborator(payload, user) {
  if (payload.plan_id) {
    const result = await planService.removeCollaborator({
      planId: payload.plan_id,
      userId: payload.user_id,
      actor: user,
      metadata: { source: 'bienbot-action-executor' }
    });
    if (result.error) {
      return { statusCode: result.code || 400, body: { success: false, error: result.error } };
    }
    return { statusCode: 200, body: { success: true, message: 'Collaborator removed successfully' } };
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

/**
 * set_member_location
 * payload: { plan_id, location, travel_cost_estimate?, currency? }
 */
async function executeSetMemberLocation(payload, user) {
  loadControllers();
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
  loadControllers();
  const req = buildMockReq(user, {}, { id: payload.plan_id });
  // removeMemberLocation uses req.query for optional userId; we only allow self
  req.query = {};
  const { res, getResult } = buildMockRes();
  await plansController.removeMemberLocation(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// Read-only data handlers
// ---------------------------------------------------------------------------

/**
 * suggest_plan_items — read-only, no confirmation.
 * payload: { destination_id, experience_id?, exclude_items?, limit? }
 */
async function executeSuggestPlanItems(payload, user) {
  return suggestPlanItems(payload, user);
}

/**
 * fetch_entity_photos — read-only, no confirmation.
 * payload: { entity_type, entity_id, query?, limit? }
 */
async function executeFetchEntityPhotos(payload, user, session) {
  return fetchEntityPhotos(payload, user, session);
}

/**
 * fetch_plan_items — read-only, no confirmation.
 * Returns the plan's items with full scheduling/completion state for the LLM
 * to act on. See plan Task 2 for the full implementation.
 */
async function executeFetchPlanItems(payload, user) {
  const Plan = require('../models/plan');
  const { getEnforcer } = require('./permission-enforcer');
  const Destination = require('../models/destination');
  const Experience = require('../models/experience');
  const User = require('../models/user');
  const { buildInlineDetailSummary } = require('./bienbot-context-builders');
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
  const Plan = require('../models/plan');
  const Destination = require('../models/destination');
  const Experience = require('../models/experience');
  const User = require('../models/user');
  const { getEnforcer } = require('./permission-enforcer');
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
  const Plan = require('../models/plan');
  const User = require('../models/user');
  const Destination = require('../models/destination');
  const Experience = require('../models/experience');
  const { getEnforcer } = require('./permission-enforcer');
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

/**
 * fetch_experience_items — read-only, no confirmation.
 * Returns the experience template's plan items with cost_estimate and photos_count.
 * payload: { experience_id, limit? }
 */
async function executeFetchExperienceItems(payload, user) {
  const Experience = require('../models/experience');
  const Destination = require('../models/destination');
  const Plan = require('../models/plan');
  const User = require('../models/user');
  const { getEnforcer } = require('./permission-enforcer');
  const mongoose = require('mongoose');

  const expIdStr = String(payload?.experience_id || '');
  if (!mongoose.Types.ObjectId.isValid(expIdStr)) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_id' } };
  }

  // No .lean() — enforcer needs Mongoose class info
  const exp = await Experience.findById(expIdStr).select('plan_items permissions visibility destination user');
  if (!exp) return { statusCode: 404, body: { ok: false, error: 'not_found' } };

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const perm = await enforcer.canView({ userId: user._id, resource: exp });
  if (!perm.allowed) return { statusCode: 403, body: { ok: false, error: 'not_authorized' } };

  const FETCH_EXPERIENCE_ITEMS_MAX = 100;
  const requestedLimit = Number.isFinite(payload?.limit)
    ? Math.max(1, Math.floor(payload.limit))
    : FETCH_EXPERIENCE_ITEMS_MAX;
  const limit = Math.min(requestedLimit, FETCH_EXPERIENCE_ITEMS_MAX);

  const all = exp.plan_items || [];
  const sliced = all.slice(0, limit);

  // Schema deviation: Experience.plan_items uses `text` (not `content`) and a
  // single `photo` ObjectId (not `photos[]`). Map to the documented shape:
  // map text → content, and derive photos_count from the singular photo field
  // (also tolerate an array form if it ever appears).
  return {
    statusCode: 200,
    body: {
      items: sliced.map(it => {
        let photos_count = 0;
        if (Array.isArray(it.photos)) {
          photos_count = it.photos.length;
        } else if (it.photo) {
          photos_count = 1;
        }
        return {
          _id: it._id?.toString(),
          content: it.text || it.content || it.name || null,
          parent_id: it.parent ? it.parent.toString() : null,
          cost_estimate: it.cost_estimate || 0,
          photos_count
        };
      }),
      total: all.length,
      returned: sliced.length
    }
  };
}

/**
 * fetch_destination_experiences — read-only, no confirmation.
 * Lists experiences at a destination, sortable by popular/recent/name.
 * Returns { experiences: [{ _id, name, cost_estimate, plan_count, curator_name }], total, returned }.
 *
 * Schema deviation: Experience has no `curator` field and no top-level `user`
 * ref. The owner lives in `permissions[]` as `{ entity: 'user', type: 'owner' }`.
 * We resolve the owner User in a single batched lookup to populate
 * `curator_name`. If a proper curator field is added later, swap the lookup.
 *
 * payload: { destination_id: string, sort?: 'popular'|'recent'|'name', limit?: number }
 */
async function executeFetchDestinationExperiences(payload, user) {
  const Destination = require('../models/destination');
  const Experience = require('../models/experience');
  const Plan = require('../models/plan');
  const User = require('../models/user');
  const mongoose = require('mongoose');

  const destIdStr = String(payload?.destination_id || '');
  if (!mongoose.Types.ObjectId.isValid(destIdStr)) {
    return { statusCode: 400, body: { ok: false, error: 'invalid_id' } };
  }

  // Destinations are public by default — lean is OK here since we don't call canView.
  // TODO: route through enforcer.canView if Destination ever gains restricted
  // visibility. Currently `_getDefaultVisibility` in permission-enforcer.js
  // returns PUBLIC for Destination, so any authenticated user can read.
  const dest = await Destination.findById(destIdStr).select('_id').lean();
  if (!dest) return { statusCode: 404, body: { ok: false, error: 'not_found' } };

  const FETCH_DEST_EXP_MAX = 50;
  const requestedLimit = Number.isFinite(payload?.limit)
    ? Math.max(1, Math.floor(payload.limit))
    : FETCH_DEST_EXP_MAX;
  const limit = Math.min(requestedLimit, FETCH_DEST_EXP_MAX);
  const sort = payload?.sort || 'recent';

  const exps = await Experience.find({ destination: dest._id })
    .select('name cost_estimate permissions createdAt')
    .lean();

  // Resolve owner names in a single batched query keyed by the owner permission.
  // TODO: when Experience gains an explicit `curator` field (per CLAUDE.md
  // "Curated by {name}" feature), prefer that over the owner-permission
  // fallback. Owner != curator semantically — owner is whoever can edit;
  // curator is the user with the `curator` flag who authored the entry.
  const ownerByExp = new Map();
  const ownerIdSet = new Set();
  for (const e of exps) {
    const ownerPerm = (e.permissions || []).find(
      p => p.entity === 'user' && p.type === 'owner'
    );
    if (ownerPerm?._id) {
      ownerByExp.set(String(e._id), String(ownerPerm._id));
      ownerIdSet.add(String(ownerPerm._id));
    }
  }
  const owners = ownerIdSet.size
    ? await User.find({ _id: { $in: Array.from(ownerIdSet) } }).select('name').lean()
    : [];
  const ownerNameById = Object.fromEntries(owners.map(u => [String(u._id), u.name]));

  const expIds = exps.map(e => e._id);
  const planCounts = expIds.length
    ? await Plan.aggregate([
        { $match: { experience: { $in: expIds } } },
        { $group: { _id: '$experience', count: { $sum: 1 } } }
      ])
    : [];
  const planCountMap = Object.fromEntries(planCounts.map(pc => [String(pc._id), pc.count]));

  let withCounts = exps.map(e => {
    const ownerId = ownerByExp.get(String(e._id));
    return {
      _id: e._id.toString(),
      name: e.name,
      cost_estimate: e.cost_estimate || 0,
      plan_count: planCountMap[String(e._id)] || 0,
      curator_name: (ownerId && ownerNameById[ownerId]) || null,
      _createdAt: e.createdAt
    };
  });

  if (sort === 'popular')      withCounts.sort((a, b) => b.plan_count - a.plan_count);
  else if (sort === 'name')    withCounts.sort((a, b) => a.name.localeCompare(b.name));
  else /* recent */            withCounts.sort((a, b) => new Date(b._createdAt) - new Date(a._createdAt));

  const total = withCounts.length;
  const sliced = withCounts.slice(0, limit).map(({ _createdAt, ...rest }) => rest);
  return {
    statusCode: 200,
    body: { experiences: sliced, total, returned: sliced.length }
  };
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
  const Plan = require('../models/plan');
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

/**
 * discover_content — read-only, no confirmation.
 * Uses buildDiscoveryContext to find popular experiences matching filters.
 * payload: { activity_types?, destination_name?, destination_id?, min_plans?, max_cost? }
 */
async function executeDiscoverContent(payload, user) {
  const { buildDiscoveryContext } = require('./bienbot-context-builders');
  const discoveryResult = await buildDiscoveryContext(payload, user._id.toString());

  if (!discoveryResult) {
    return {
      statusCode: 200,
      body: {
        message: 'No matching experiences found for your search.',
        results: [],
        query_metadata: {
          filters_applied: payload,
          cache_hit: false,
          result_count: 0,
          cross_destination: !!(payload.cross_destination || (!payload.destination_id && !payload.destination_name))
        }
      }
    };
  }

  return {
    statusCode: 200,
    body: {
      message: discoveryResult.contextBlock,
      results: discoveryResult.results,
      query_metadata: discoveryResult.query_metadata
    }
  };
}

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

  const Experience = require('../models/experience');

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
 * add_entity_photos — mutating, requires confirmation.
 * payload: { entity_type, entity_id, photos: [{ url, photographer, photographer_url }] }
 */
async function executeAddEntityPhotos(payload, user, session) {
  return addEntityPhotos(payload, user, session);
}

// ---------------------------------------------------------------------------
// Handler dispatch map
// ---------------------------------------------------------------------------

/**
 * follow_user — mutating, requires confirmation.
 * payload: { user_id }
 */
async function executeFollowUser(payload, user) {
  const { user_id } = payload || {};
  if (!user_id) return { statusCode: 400, body: { success: false, error: 'user_id is required' } };

  loadControllers();
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

  loadControllers();
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

  loadControllers();
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

  loadControllers();
  const controllerFn = type === 'following' ? followsController.getFollowing : followsController.getFollowers;
  const req = buildMockReq(user, {}, { userId: user_id }, { limit });
  const { res, getResult } = buildMockRes();
  await controllerFn(req, res);
  return getResult();
}

/**
 * update_user_profile — mutating, requires confirmation.
 * payload: { name?, bio?, preferences?: { currency?, timezone?, theme? } }
 * Always scoped to the logged-in user — never accepts a target user_id.
 */
async function executeUpdateUserProfile(payload, user) {
  const { name, bio, preferences } = payload || {};
  loadControllers();
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
  loadControllers();
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

/**
 * pin_plan_item — mutating, requires confirmation.
 * payload: { plan_id, item_id }
 * Pins a plan item so it appears at the top of the plan timeline.
 */
async function executePinPlanItem(payload, user) {
  const { plan_id, item_id } = payload || {};
  if (!plan_id || !item_id) return { statusCode: 400, body: { success: false, error: 'plan_id and item_id are required' } };
  loadControllers();
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

  loadModels();

  if (!_mongoose.Types.ObjectId.isValid(plan_id)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid plan_id format' } };
  }
  // Cast to ObjectId to break the taint chain for CodeQL
  const safePlanId = new _mongoose.Types.ObjectId(plan_id);

  // The reorderPlanItems controller expects body.plan to be the full item objects
  // in the new order — not just IDs — so that plan.plan = reorderedItems does not
  // truncate subdocument fields. Fetch the current plan to sort the full objects.
  const currentPlan = await _Plan.findById(safePlanId).lean();
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

  loadControllers();
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
  loadControllers();
  const req = buildMockReq(user, {}, { id: plan_id, itemId: item_id });
  const { res, getResult } = buildMockRes();
  await plansController.unpinPlanItem(req, res);
  return getResult();
}

/**
 * list_entity_documents — read-only, no confirmation.
 * payload: { entity_type, entity_id, plan_id?, limit?: 10 }
 * Lists documents attached to an entity (plan, experience, destination, plan_item).
 */
async function executeListEntityDocuments(payload, user) {
  const { entity_type, entity_id, plan_id, limit = 10 } = payload || {};
  if (!entity_type || !entity_id) return { statusCode: 400, body: { success: false, error: 'entity_type and entity_id are required' } };
  loadControllers();
  const req = buildMockReq(
    user,
    {},
    { entityType: entity_type, entityId: entity_id },
    { planId: plan_id, limit }
  );
  const { res, getResult } = buildMockRes();
  await documentsController.getByEntity(req, res);
  return getResult();
}

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
  const InviteCode = require('../models/inviteCode');
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
      const { sendInviteEmail } = require('./email-service');
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

/**
 * request_plan_access — mutating, requires confirmation.
 * payload: { plan_id, message? }
 * Requests access to a plan the user does not have permission to view.
 */
async function executeRequestPlanAccess(payload, user) {
  const { plan_id, message = '' } = payload || {};
  if (!plan_id) return { statusCode: 400, body: { success: false, error: 'plan_id is required' } };
  loadControllers();
  const req = buildMockReq(
    user,
    { message },
    { id: plan_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.requestPlanAccess(req, res);
  return getResult();
}

/**
 * navigate_to_entity — no-op on the backend, executes without confirmation.
 * The frontend handles navigation; the backend just marks it as successful.
 * payload: { entity, entityId, url }
 *
 * The URL is validated against `isSafeNavigationUrl` to refuse `javascript:`,
 * external hosts, and protocol-relative URLs that an LLM-supplied payload
 * could otherwise route a user to.
 */
async function executeNavigateToEntity(payload) {
  const { entity, entityId, url } = payload || {};
  if (!isSafeNavigationUrl(url)) {
    return {
      statusCode: 400,
      body: { success: false, error: 'navigate_to_entity: url must be a same-origin path starting with "/"' }
    };
  }
  return { statusCode: 200, body: { data: { url, entity, entityId } } };
}

// ---------------------------------------------------------------------------
// Workflow (multi-step composition with dependency resolution)
// ---------------------------------------------------------------------------

/**
 * Resolve `$ref` placeholders in a payload using outputs from earlier steps.
 *
 * A `$ref` placeholder has the form `$step_<N>.<path>`, where N is the 1-based
 * step index and path is a dot-delimited property path into that step's result.
 * For example, `$step_1._id` resolves to the `_id` of step 1's result.
 *
 * Security: the leading path segment must appear in `STEP_REF_ALLOWED_FIELDS`.
 * This prevents LLM-influenced workflow payloads from reading sensitive fields
 * (e.g. `user.email`, `user.password`, `oauth.*`) from a previous step.
 * Unknown leading segments throw `WorkflowRefError` so the failure surfaces
 * clearly rather than producing a confusing downstream CastError.
 *
 * Unresolvable refs (missing step, missing field, denied field) throw — the
 * surrounding workflow loop catches and turns them into a structured error.
 *
 * @param {*} value - Payload value to resolve (may be string, array, or nested object).
 * @param {Map<number, object>} stepResults - Map of step index → result data.
 * @returns {*} Resolved value.
 */
function resolveRefs(value, stepResults) {
  if (typeof value === 'string') {
    const refMatch = value.match(/^\$step_(\d+)\.(.+)$/);
    if (refMatch) {
      const stepIdx = parseInt(refMatch[1], 10);
      const path = refMatch[2];
      const segments = path.split('.');
      const leading = segments[0];

      if (!STEP_REF_ALLOWED_FIELDS.has(leading)) {
        throw new WorkflowRefError(`Workflow ref "$step_${stepIdx}.${path}" denied: field "${leading}" is not in the step-result allowlist`);
      }

      const stepResult = stepResults.get(stepIdx);
      if (stepResult === undefined) {
        throw new WorkflowRefError(`Workflow ref "$step_${stepIdx}.${path}" unresolvable: no result recorded for step ${stepIdx}`);
      }

      const resolved = segments.reduce((obj, key) => (obj == null ? obj : obj[key]), stepResult);
      if (resolved === undefined || resolved === null) {
        throw new WorkflowRefError(`Workflow ref "$step_${stepIdx}.${path}" unresolvable: field is null/undefined on step ${stepIdx} result`);
      }
      return resolved;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v => resolveRefs(v, stepResults));
  }
  if (value && typeof value === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(value)) {
      resolved[k] = resolveRefs(v, stepResults);
    }
    return resolved;
  }
  return value;
}

class WorkflowRefError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WorkflowRefError';
  }
}

/**
 * Execute a workflow — a sequence of steps with dependency resolution.
 *
 * payload: {
 *   steps: [{
 *     step: 1,                       // 1-based step number
 *     type: "<action_type>",
 *     payload: { ... may contain $step_N.field refs ... },
 *     description: "Human-readable step description"
 *   }, ...]
 * }
 *
 * Steps are executed sequentially in `step` order.  Each step's result is
 * stored so that later steps can reference earlier outputs via `$ref` syntax
 * in their payloads (e.g. `"destination_id": "$step_1._id"` references step 1's result).
 *
 * If any step fails, execution halts and partial results are returned.
 */
async function executeWorkflow(payload, user, session = null) {
  const steps = Array.isArray(payload.steps) ? payload.steps : [];

  if (steps.length === 0) {
    return { statusCode: 400, body: { success: false, error: 'Workflow has no steps' } };
  }

  if (steps.length > MAX_WORKFLOW_STEPS) {
    return {
      statusCode: 400,
      body: { success: false, error: `Workflow exceeds maximum of ${MAX_WORKFLOW_STEPS} steps` }
    };
  }

  // Reject duplicate step numbers — last-write-wins on stepResults would
  // silently break $step_N refs from the duplicated index.
  const seenSteps = new Set();
  for (const step of steps) {
    if (!Number.isInteger(step.step) || step.step < 1) {
      return { statusCode: 400, body: { success: false, error: 'Each workflow step must have an integer "step" >= 1' } };
    }
    if (seenSteps.has(step.step)) {
      return { statusCode: 400, body: { success: false, error: `Duplicate workflow step number: ${step.step}` } };
    }
    seenSteps.add(step.step);
  }

  // Sort by step number (ascending)
  const sorted = [...steps].sort((a, b) => a.step - b.step);

  const stepResults = new Map(); // step index → result data
  const results = [];

  for (const step of sorted) {
    const stepType = step.type;
    if (!stepType || stepType === 'workflow') {
      // Prevent nested workflows and invalid types
      results.push({ step: step.step, type: stepType, success: false, errors: ['Invalid step type'] });
      break;
    }

    if (!ALLOWED_ACTION_TYPES_SET.has(stepType)) {
      results.push({ step: step.step, type: stepType, success: false, errors: [`Unknown action type: ${stepType}`] });
      break;
    }

    // Resolve $ref placeholders in the step's payload
    let resolvedPayload;
    try {
      resolvedPayload = resolveRefs(step.payload || {}, stepResults);
    } catch (refErr) {
      logger.warn('[bienbot-action-executor] Workflow ref resolution failed', {
        step: step.step,
        type: stepType,
        error: refErr.message
      });
      results.push({ step: step.step, type: stepType, success: false, errors: [refErr.message] });
      break;
    }

    const handler = ACTION_HANDLERS[stepType];
    if (!handler) {
      results.push({ step: step.step, type: stepType, success: false, errors: [`No handler for: ${stepType}`] });
      break;
    }

    try {
      logger.info('[bienbot-action-executor] Workflow step executing', {
        step: step.step,
        type: stepType,
        payload_keys: Object.keys(resolvedPayload || {}),
        userId: user._id.toString()
      });

      const response = await handler(resolvedPayload, user, session);
      const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
      const resultData = response.body?.data || response.body || null;

      results.push({
        step: step.step,
        type: stepType,
        success: isSuccess,
        result: resultData,
        errors: isSuccess ? [] : [response.body?.error || `Step failed with status ${response.statusCode}`]
      });

      if (isSuccess && resultData) {
        stepResults.set(step.step, resultData);
      } else {
        // Stop on failure. Side-effects from earlier steps remain in place;
        // include `partial_state_warning` so callers can surface this to
        // the user / consider compensating actions.
        logger.warn('[bienbot-action-executor] Workflow step failed, halting', {
          step: step.step,
          type: stepType,
          statusCode: response.statusCode
        });
        break;
      }
    } catch (err) {
      logger.error('[bienbot-action-executor] Workflow step threw exception', {
        step: step.step,
        type: stepType,
        error: err.message
      }, err);
      results.push({ step: step.step, type: stepType, success: false, errors: [err.message] });
      break;
    }
  }

  const allSucceeded = results.length === sorted.length && results.every(r => r.success);
  const partialStateWarning = !allSucceeded && results.some(r => r.success);

  return {
    statusCode: allSucceeded ? 200 : 207,
    body: {
      success: allSucceeded,
      data: {
        steps_completed: results.filter(r => r.success).length,
        steps_total: sorted.length,
        partial_state_warning: partialStateWarning,
        results
      }
    }
  };
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
  const Plan = require('../models/plan');
  const mongoose = require('mongoose');
  const { getEnforcer } = require('./permission-enforcer');
  const Destination = require('../models/destination');
  const Experience = require('../models/experience');
  const User = require('../models/user');

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
// select_destination — Destination disambiguation handler
// ---------------------------------------------------------------------------

/**
 * select_destination — disambiguation action.
 * Returns destination_id for the controller to inject into session context.
 * No DB mutation.
 *
 * @param {object} payload - { destination_id, destination_name? }
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function executeSelectDestination(payload, user) {
  if (!payload.destination_id) {
    return { statusCode: 400, body: { success: false, error: 'select_destination requires destination_id' } };
  }

  loadModels();

  if (!_mongoose.Types.ObjectId.isValid(payload.destination_id)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid destination_id format' } };
  }

  const destination = await _Destination.findById(payload.destination_id).select('_id name country').lean();
  if (!destination) {
    return { statusCode: 404, body: { success: false, error: 'Destination not found' } };
  }

  const enforcer = _getEnforcer({ Plan: _Plan, Experience: _Experience, Destination: _Destination, User: _User });
  const perm = await enforcer.canView({ userId: user._id, resource: destination });
  if (!perm.allowed) {
    return { statusCode: 403, body: { success: false, error: 'Not authorized to view this destination' } };
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      data: {
        destination_id: destination._id.toString(),
        destination_name: destination.name || payload.destination_name || null
      }
    }
  };
}

const ACTION_HANDLERS = {
  create_destination: executeCreateDestination,
  create_experience: executeCreateExperience,
  create_plan: executeCreatePlan,
  add_plan_items: executeAddPlanItems,
  update_plan_item: executeUpdatePlanItem,
  mark_plan_item_complete: executeMarkPlanItemComplete,
  mark_plan_item_incomplete: executeMarkPlanItemIncomplete,
  invite_collaborator: executeInviteCollaborator,
  sync_plan: executeSyncPlan,
  add_plan_item_note: executeAddPlanItemNote,
  update_plan_item_note: executeUpdatePlanItemNote,
  delete_plan_item_note: executeDeletePlanItemNote,
  add_plan_item_detail: executeAddPlanItemDetail,
  update_plan_item_detail: executeUpdatePlanItemDetail,
  delete_plan_item_detail: executeDeletePlanItemDetail,
  assign_plan_item: executeAssignPlanItem,
  unassign_plan_item: executeUnassignPlanItem,
  // Experience-level
  update_experience: executeUpdateExperience,
  add_experience_plan_item: executeAddExperiencePlanItem,
  update_experience_plan_item: executeUpdateExperiencePlanItem,
  delete_experience_plan_item: executeDeleteExperiencePlanItem,
  // Destination-level
  update_destination: executeUpdateDestination,
  toggle_favorite_destination: executeToggleFavoriteDestination,
  // Plan-level
  update_plan: executeUpdatePlan,
  delete_plan: executeDeletePlan,
  delete_plan_item: executeDeletePlanItem,
  add_plan_cost: executeAddPlanCost,
  update_plan_cost: executeUpdatePlanCost,
  delete_plan_cost: executeDeletePlanCost,
  remove_collaborator: executeRemoveCollaborator,
  set_member_location: executeSetMemberLocation,
  remove_member_location: executeRemoveMemberLocation,
  // Client-only: handled by frontend, no-op on backend
  navigate_to_entity: executeNavigateToEntity,
  // Workflow (multi-step composition)
  workflow: executeWorkflow,
  // Photo management
  add_entity_photos: executeAddEntityPhotos,
  // Read-only data fetching
  suggest_plan_items: executeSuggestPlanItems,
  fetch_entity_photos: executeFetchEntityPhotos,
  // fetch_destination_tips: now owned by the BienBot tool registry
  // (Wikivoyage provider). Dispatched via executeAction's registry-aware
  // dispatch path; not present in this internal handler map.
  fetch_plan_items: executeFetchPlanItems,
  fetch_plan_costs: executeFetchPlanCosts,
  fetch_plan_collaborators: executeFetchPlanCollaborators,
  fetch_experience_items: executeFetchExperienceItems,
  fetch_destination_experiences: executeFetchDestinationExperiences,
  fetch_user_plans: executeFetchUserPlans,
  discover_content: executeDiscoverContent,
  // Plan disambiguation
  select_plan: executeSelectPlan,
  // Destination disambiguation
  select_destination: executeSelectDestination,
  // Plan item date shifting
  shift_plan_item_dates: executeShiftPlanItemDates,
  list_user_experiences: executeListUserExperiences,
  // Social / follows
  follow_user: executeFollowUser,
  unfollow_user: executeUnfollowUser,
  accept_follow_request: executeAcceptFollowRequest,
  list_user_followers: executeListUserFollowers,
  // User profile
  update_user_profile: executeUpdateUserProfile,
  // Activity feed
  list_user_activities: executeListUserActivities,
  // Plan item pin/unpin
  pin_plan_item: executePinPlanItem,
  unpin_plan_item: executeUnpinPlanItem,
  reorder_plan_items: executeReorderPlanItems,
  // Documents
  list_entity_documents: executeListEntityDocuments,
  // Invites / access
  create_invite: executeCreateInvite,
  request_plan_access: executeRequestPlanAccess
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a single pending action.
 *
 * @param {object} action - { id, type, payload, description }
 * @param {object} user - Authenticated user object (must include _id, name, email).
 * @param {object|null} [session] - Active BienBotSession document; forwarded to handlers that use it.
 * @returns {Promise<{ success: boolean, result: object|null, errors: string[] }>}
 */
async function executeAction(action, user, session = null) {
  if (!action || !action.type) {
    return { success: false, result: null, errors: ['Missing action or action type'] };
  }

  if (!user || !user._id) {
    return { success: false, result: null, errors: ['Missing user'] };
  }

  // Registry-aware dispatch: tools owned by the BienBot tool registry
  // (Wikivoyage, Google Maps, …) are not in ALLOWED_ACTION_TYPES — the
  // registry is their source of truth. Check it before the legacy allowlist
  // so registry-owned action types pass through.
  let registryEntry = null;
  try {
    const registry = require('./bienbot-tool-registry');
    const { bootstrap } = require('./bienbot-tool-registry/bootstrap');
    bootstrap();
    registryEntry = registry.getTool(action.type);
  } catch {
    // Registry not available (test environments mock the executor and may not
    // bootstrap the registry); fall through to legacy allowlist below.
  }

  if (!registryEntry && !ALLOWED_ACTION_TYPES_SET.has(action.type)) {
    logger.warn('[bienbot-action-executor] Unknown action type rejected', {
      type: action.type,
      actionId: action.id,
      userId: user._id.toString()
    });
    return { success: false, result: null, errors: [`Unknown action type: ${action.type}`] };
  }

  // Idempotency: a pending_action carrying `executed: true` has already been
  // run. Re-executing would re-create entities or re-send invites — refuse.
  // The atomic guard against parallel double-clicks lives in the controller
  // (BienBotSession.markActionExecuted is the single source of truth).
  if (action.executed === true) {
    logger.warn('[bienbot-action-executor] Refusing to re-execute already-executed action', {
      type: action.type,
      actionId: action.id,
      userId: user._id.toString()
    });
    return { success: false, result: null, errors: ['Action already executed'] };
  }

  // Registry tools dispatch through executeRegisteredTool (handles payload
  // validation, providerCtx, retry policy). Internal action types use the
  // ACTION_HANDLERS map below.
  if (registryEntry) {
    try {
      logger.info('[bienbot-action-executor] Executing registry tool', {
        type: action.type,
        actionId: action.id,
        userId: user._id.toString()
      });
      const registry = require('./bienbot-tool-registry');
      const out = await registry.executeRegisteredTool(action.type, action.payload || {}, user, { session });
      return {
        success: out.success,
        result: out.body || null,
        errors: out.errors || [],
        statusCode: out.statusCode,
        body: out.body
      };
    } catch (err) {
      logger.error('[bienbot-action-executor] Registry tool threw exception', {
        type: action.type,
        actionId: action.id
      }, err);
      return { success: false, result: null, errors: [err.message] };
    }
  }

  const handler = ACTION_HANDLERS[action.type];

  try {
    logger.info('[bienbot-action-executor] Executing action', {
      type: action.type,
      actionId: action.id,
      userId: user._id.toString()
    });

    const response = await handler(action.payload || {}, user, session);
    const isSuccess = response.statusCode >= 200 && response.statusCode < 300;

    if (isSuccess) {
      logger.info('[bienbot-action-executor] Action succeeded', {
        type: action.type,
        actionId: action.id,
        statusCode: response.statusCode
      });
    } else {
      logger.warn('[bienbot-action-executor] Action failed', {
        type: action.type,
        actionId: action.id,
        statusCode: response.statusCode,
        error: response.body?.error,
        details: response.body?.details
      });
    }

    return {
      success: isSuccess,
      result: response.body?.data || response.body || null,
      errors: isSuccess ? [] : [response.body?.error || `Action failed with status ${response.statusCode}`],
      statusCode: response.statusCode,
      body: response.body
    };
  } catch (err) {
    logger.error('[bienbot-action-executor] Action threw exception', {
      type: action.type,
      actionId: action.id
    }, err);
    return { success: false, result: null, errors: [err.message] };
  }
}

/**
 * Execute multiple pending actions in sequence, updating session context
 * with results (e.g. newly created IDs for subsequent turns).
 *
 * @param {object[]} actions - Array of pending action objects.
 * @param {object} user - Authenticated user object.
 * @param {object} session - BienBotSession document (will be mutated).
 * @returns {Promise<{ results: object[], contextUpdates: object }>}
 */
async function executeActions(actions, user, session) {
  const results = [];
  const contextUpdates = {};

  for (const action of actions) {
    const outcome = await executeAction(action, user, session);
    results.push({ actionId: action.id, type: action.type, payload: action.payload || {}, ...outcome });

    // Mark action as executed on the session
    if (session && typeof session.markActionExecuted === 'function') {
      await session.markActionExecuted(action.id, {
        success: outcome.success,
        errors: outcome.errors
      });
    }

    // Extract context updates from successful results
    if (outcome.success && outcome.result) {
      const data = outcome.result;

      switch (action.type) {
        case 'create_destination':
          if (data._id) contextUpdates.destination_id = data._id;
          break;
        case 'create_experience':
          if (data._id) contextUpdates.experience_id = data._id;
          if (data.destination) contextUpdates.destination_id = data.destination;
          break;
        case 'create_plan':
          if (data._id) contextUpdates.plan_id = data._id;
          if (data.experience?._id) contextUpdates.experience_id = data.experience._id;
          break;
        case 'select_plan':
          if (data.plan_id) contextUpdates.plan_id = data.plan_id;
          if (data.experience_id) contextUpdates.experience_id = data.experience_id;
          if (data.destination_id) contextUpdates.destination_id = data.destination_id;
          break;
        case 'select_destination':
          if (data.destination_id) contextUpdates.destination_id = data.destination_id;
          break;
        case 'add_plan_items':
        case 'update_plan_item':
        case 'sync_plan':
          // Plan context already set; no new IDs to extract
          break;
        case 'invite_collaborator':
          // No context change needed
          break;
        case 'workflow':
          // Extract context from workflow step results
          if (data.results && Array.isArray(data.results)) {
            for (const stepResult of data.results) {
              if (!stepResult.success || !stepResult.result) continue;
              const sData = stepResult.result;
              switch (stepResult.type) {
                case 'create_destination':
                  if (sData._id) contextUpdates.destination_id = sData._id;
                  break;
                case 'create_experience':
                  if (sData._id) contextUpdates.experience_id = sData._id;
                  if (sData.destination) contextUpdates.destination_id = sData.destination;
                  break;
                case 'create_plan':
                  if (sData._id) contextUpdates.plan_id = sData._id;
                  if (sData.experience?._id) contextUpdates.experience_id = sData.experience._id;
                  break;
              }
            }
          }
          break;
      }
    }
  }

  // Apply accumulated context updates to session
  if (session && Object.keys(contextUpdates).length > 0) {
    if (typeof session.updateContext === 'function') {
      await session.updateContext(contextUpdates);
    }
  }

  return { results, contextUpdates };
}

/**
 * Execute a single workflow step, resolving $step_N refs from the results of
 * already-completed sibling actions.
 *
 * If the step depends on a skipped step, it auto-fails with a clear message.
 *
 * @param {object} action - The pending action to execute (must have workflow_id).
 * @param {object[]} workflowActions - All pending_actions sharing the same workflow_id.
 * @param {object} user - Authenticated user object.
 * @returns {Promise<{ success: boolean, result: object|null, errors: string[] }>}
 */
async function executeSingleWorkflowStep(action, workflowActions, user) {
  if (!action || !action.type) {
    return { success: false, result: null, errors: ['Missing action or action type'] };
  }

  // Check if any depends_on actions were skipped or failed
  if (Array.isArray(action.depends_on) && action.depends_on.length > 0) {
    for (const depId of action.depends_on) {
      const depAction = workflowActions.find(a => a.id === depId);
      if (depAction && (depAction.status === 'skipped' || depAction.status === 'failed')) {
        const reason = depAction.status === 'skipped'
          ? `Depends on skipped step "${depAction.description || depAction.id}"`
          : `Depends on failed step "${depAction.description || depAction.id}"`;
        return { success: false, result: null, errors: [reason] };
      }
      // If dependency hasn't been completed yet, it's an ordering error
      if (depAction && depAction.status !== 'completed') {
        return {
          success: false,
          result: null,
          errors: [`Dependency "${depAction.description || depAction.id}" has not been completed yet`]
        };
      }
    }
  }

  // Build step results from completed sibling actions for $ref resolution
  const stepResults = new Map();
  for (const sibling of workflowActions) {
    if (sibling.status === 'completed' && sibling.result && sibling.workflow_step != null) {
      // Extract the data from the result (may be wrapped)
      const data = sibling.result?.data || sibling.result;
      stepResults.set(sibling.workflow_step, data);
    }
  }

  // Resolve $step_N references in the payload
  let resolvedPayload;
  try {
    resolvedPayload = resolveRefs(action.payload || {}, stepResults);
  } catch (refErr) {
    logger.warn('[bienbot-action-executor] Workflow step ref resolution failed', {
      type: action.type,
      actionId: action.id,
      workflowId: action.workflow_id,
      error: refErr.message
    });
    return { success: false, result: null, errors: [refErr.message] };
  }

  // Execute using the standard handler
  const handler = ACTION_HANDLERS[action.type];
  if (!handler) {
    return { success: false, result: null, errors: [`No handler for: ${action.type}`] };
  }

  try {
    logger.info('[bienbot-action-executor] Executing workflow step', {
      type: action.type,
      actionId: action.id,
      workflowId: action.workflow_id,
      step: action.workflow_step,
      payload_keys: Object.keys(resolvedPayload || {}),
      userId: user._id.toString()
    });

    const response = await handler(resolvedPayload, user);
    const isSuccess = response.statusCode >= 200 && response.statusCode < 300;

    return {
      success: isSuccess,
      result: response.body?.data || response.body || null,
      errors: isSuccess ? [] : [response.body?.error || `Step failed with status ${response.statusCode}`]
    };
  } catch (err) {
    logger.error('[bienbot-action-executor] Workflow step threw exception', {
      type: action.type,
      actionId: action.id
    }, err);
    return { success: false, result: null, errors: [err.message] };
  }
}

/**
 * Valid structured_content block types for BienBot session messages.
 * Single source of truth — imported by the BienBotSession model schema
 * so the Mongoose enum stays in sync with the controller/mapper code.
 *
 * When adding a new structured content type:
 *   1. Add it here
 *   2. Add a case in mapReadOnlyResultToStructuredContent() (controllers/api/bienbot.js)
 *   3. Add a renderer in BienBotPanel.jsx
 */
const STRUCTURED_CONTENT_TYPES = [
  'photo_gallery',
  'suggestion_list',
  'discovery_result_list',
  'tip_suggestion_list',
  'entity_ref_list',
  'experience_list',
  'follower_list',
  'document_list',
  'activity_feed'
];

module.exports = {
  executeAction,
  executeActions,
  executeSingleWorkflowStep,
  resolveRefs,
  ACTION_HANDLERS,
  ALLOWED_ACTION_TYPES,
  READ_ONLY_ACTION_TYPES,
  TOOL_CALL_ACTION_TYPES,
  STRUCTURED_CONTENT_TYPES
};
