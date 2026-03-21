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

const logger = require('./backend-logger');

// Lazy-loaded controllers (resolved on first use to avoid circular deps)
let destinationsController, experiencesController, plansController;

function loadControllers() {
  if (!destinationsController) {
    destinationsController = require('../controllers/api/destinations');
    experiencesController = require('../controllers/api/experiences');
    plansController = require('../controllers/api/plans');
  }
}

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
  'invite_collaborator',
  'sync_plan',
  'add_plan_item_note',
  'add_plan_item_detail',
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
  'remove_member_location'
];

// ---------------------------------------------------------------------------
// Mock req/res for controller delegation
// ---------------------------------------------------------------------------

/**
 * Build a mock Express request object that controllers can read from.
 *
 * @param {object} user - Authenticated user (from session).
 * @param {object} [body={}] - Request body fields.
 * @param {object} [params={}] - Route params (e.g. :id, :experienceId).
 * @returns {object} Mock req compatible with controller expectations.
 */
function buildMockReq(user, body = {}, params = {}) {
  return {
    user,
    body,
    params,
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
 * create_destination
 * payload: { name, country, state?, overview?, location? }
 */
async function executeCreateDestination(payload, user) {
  loadControllers();
  const req = buildMockReq(user, {
    name: payload.name,
    country: payload.country,
    state: payload.state,
    overview: payload.overview,
    location: payload.location
  });
  const { res, getResult } = buildMockRes();
  await destinationsController.create(req, res);
  return getResult();
}

/**
 * create_experience
 * payload: { name, destination?, description?, plan_items?, experience_type?, visibility? }
 */
async function executeCreateExperience(payload, user) {
  loadControllers();
  const req = buildMockReq(user, {
    name: payload.name,
    destination: payload.destination_id || payload.destination,
    description: payload.description,
    plan_items: payload.plan_items,
    experience_type: payload.experience_type,
    visibility: payload.visibility
  });
  const { res, getResult } = buildMockRes();
  await experiencesController.create(req, res);
  return getResult();
}

/**
 * create_plan
 * payload: { experience_id, planned_date?, currency? }
 */
async function executeCreatePlan(payload, user) {
  loadControllers();
  const req = buildMockReq(
    user,
    {
      planned_date: payload.planned_date,
      currency: payload.currency
    },
    { experienceId: payload.experience_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.createPlan(req, res);
  return getResult();
}

/**
 * add_plan_items (batch)
 * payload: { plan_id, items: [{ text, url?, cost?, planning_days?, parent?, activity_type? }] }
 */
async function executeAddPlanItems(payload, user) {
  loadControllers();
  const items = Array.isArray(payload.items) ? payload.items : [payload.items].filter(Boolean);
  const results = [];

  for (const item of items) {
    const req = buildMockReq(
      user,
      {
        text: item.text,
        url: item.url,
        cost: item.cost,
        planning_days: item.planning_days,
        parent: item.parent,
        activity_type: item.activity_type,
        location: item.location
      },
      { id: payload.plan_id }
    );
    const { res, getResult } = buildMockRes();
    await plansController.addPlanItem(req, res);
    const result = getResult();
    results.push(result);

    // If any item fails, stop the batch and report
    if (result.statusCode >= 400) {
      return {
        statusCode: result.statusCode,
        body: {
          success: false,
          error: `Failed to add item "${item.text}": ${result.body?.error || 'Unknown error'}`,
          partial_results: results
        }
      };
    }
  }

  // Return the final plan state (from the last successful add)
  const lastResult = results[results.length - 1];
  return {
    statusCode: lastResult.statusCode,
    body: {
      success: true,
      data: lastResult.body?.data || lastResult.body,
      items_added: items.length
    }
  };
}

/**
 * update_plan_item
 * payload: { plan_id, item_id, complete?, text?, cost?, planning_days?,
 *            activity_type?, scheduled_date?, scheduled_time?, visibility? }
 */
async function executeUpdatePlanItem(payload, user) {
  loadControllers();
  const body = {};
  const updateFields = [
    'complete', 'text', 'cost', 'planning_days', 'url',
    'activity_type', 'scheduled_date', 'scheduled_time',
    'visibility', 'location'
  ];
  for (const field of updateFields) {
    if (payload[field] !== undefined) {
      body[field] = payload[field];
    }
  }
  const req = buildMockReq(
    user,
    body,
    { id: payload.plan_id, itemId: payload.item_id }
  );
  const { res, getResult } = buildMockRes();
  await plansController.updatePlanItem(req, res);
  return getResult();
}

/**
 * invite_collaborator
 * payload: { plan_id?, experience_id?, user_id, type? }
 *
 * Delegates to either plans.addCollaborator or experiences.addExperiencePermission
 * depending on which entity ID is provided.
 */
async function executeInviteCollaborator(payload, user) {
  loadControllers();

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
 * sync_plan
 * Re-snapshots plan items from the source experience into the user's plan.
 * Preserves completion state and user-added items.
 *
 * payload: { plan_id }
 */
async function executeSyncPlan(payload, user) {
  // sync_plan has no dedicated controller endpoint — implement directly
  // using models, but still respecting permission enforcer.
  const mongoose = require('mongoose');
  const { getEnforcer } = require('./permission-enforcer');
  const Plan = require('../models/plan');
  const Experience = require('../models/experience');
  const Destination = require('../models/destination');
  const User = require('../models/user');

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
  loadControllers();
  const body = {};
  const updateFields = ['name', 'overview', 'destination', 'experience_type', 'visibility', 'map_location'];
  for (const field of updateFields) {
    if (payload[field] !== undefined) {
      body[field] = payload[field];
    }
  }
  const req = buildMockReq(user, body, { id: payload.experience_id });
  const { res, getResult } = buildMockRes();
  await experiencesController.update(req, res);
  return getResult();
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
  loadControllers();
  const body = {};
  const updateFields = ['name', 'country', 'state', 'overview', 'location', 'map_location', 'travel_tips'];
  for (const field of updateFields) {
    if (payload[field] !== undefined) {
      body[field] = payload[field];
    }
  }
  const req = buildMockReq(user, body, { id: payload.destination_id });
  const { res, getResult } = buildMockRes();
  await destinationsController.update(req, res);
  return getResult();
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
 */
async function executeUpdatePlan(payload, user) {
  loadControllers();
  const body = {};
  if (payload.planned_date !== undefined) body.planned_date = payload.planned_date;
  if (payload.currency !== undefined) body.currency = payload.currency;
  if (payload.notes !== undefined) body.notes = payload.notes;
  const req = buildMockReq(user, body, { id: payload.plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.updatePlan(req, res);
  return getResult();
}

/**
 * delete_plan
 * payload: { plan_id }
 */
async function executeDeletePlan(payload, user) {
  loadControllers();
  const req = buildMockReq(user, {}, { id: payload.plan_id });
  const { res, getResult } = buildMockRes();
  await plansController.deletePlan(req, res);
  return getResult();
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
  loadControllers();

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
// Handler dispatch map
// ---------------------------------------------------------------------------

const ACTION_HANDLERS = {
  create_destination: executeCreateDestination,
  create_experience: executeCreateExperience,
  create_plan: executeCreatePlan,
  add_plan_items: executeAddPlanItems,
  update_plan_item: executeUpdatePlanItem,
  invite_collaborator: executeInviteCollaborator,
  sync_plan: executeSyncPlan,
  add_plan_item_note: executeAddPlanItemNote,
  add_plan_item_detail: executeAddPlanItemDetail,
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
  remove_member_location: executeRemoveMemberLocation
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a single pending action.
 *
 * @param {object} action - { id, type, payload, description }
 * @param {object} user - Authenticated user object (must include _id, name, email).
 * @returns {Promise<{ success: boolean, result: object|null, errors: string[] }>}
 */
async function executeAction(action, user) {
  if (!action || !action.type) {
    return { success: false, result: null, errors: ['Missing action or action type'] };
  }

  if (!ALLOWED_ACTION_TYPES.includes(action.type)) {
    logger.warn('[bienbot-action-executor] Unknown action type rejected', {
      type: action.type,
      actionId: action.id,
      userId: user?._id?.toString()
    });
    return { success: false, result: null, errors: [`Unknown action type: ${action.type}`] };
  }

  const handler = ACTION_HANDLERS[action.type];

  try {
    logger.info('[bienbot-action-executor] Executing action', {
      type: action.type,
      actionId: action.id,
      userId: user._id.toString()
    });

    const response = await handler(action.payload || {}, user);
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
        error: response.body?.error
      });
    }

    return {
      success: isSuccess,
      result: response.body?.data || response.body || null,
      errors: isSuccess ? [] : [response.body?.error || `Action failed with status ${response.statusCode}`]
    };
  } catch (err) {
    logger.error('[bienbot-action-executor] Action threw exception', {
      type: action.type,
      actionId: action.id,
      error: err.message
    });
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
    const outcome = await executeAction(action, user);
    results.push({ actionId: action.id, type: action.type, ...outcome });

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
        case 'add_plan_items':
        case 'update_plan_item':
        case 'sync_plan':
          // Plan context already set; no new IDs to extract
          break;
        case 'invite_collaborator':
          // No context change needed
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

module.exports = {
  executeAction,
  executeActions,
  ALLOWED_ACTION_TYPES
};
