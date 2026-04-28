/**
 * BienBot experience-domain action handlers.
 *
 * Pure relocation from utilities/bienbot-action-executor.js — no behavior change.
 * Covers create/update experience, experience plan-item CRUD, and the
 * read-only fetch_experience_items fetcher.
 *
 * @module utilities/bienbot-actions/experience-actions
 */

const {
  loadControllers,
  buildMockReq,
  buildMockRes,
  toExecutorResult
} = require('./_shared');

// Service layer (depends on models + utilities only — never on controllers).
// Per bd #8f36.13 + bd #8667 — canonical CRUD handlers below call the
// experience service directly. Long-tail handlers (experience plan-item
// CRUD) continue to delegate to controllers via loadControllers().
const experienceService = require('../../services/experience-service');

// ---------------------------------------------------------------------------
// create_experience
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Experience-level update + plan-item handlers
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
  const { experiencesController } = loadControllers();
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
  const { experiencesController } = loadControllers();
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
  const { experiencesController } = loadControllers();
  const req = buildMockReq(user, {}, { experienceId: payload.experience_id, planItemId: payload.plan_item_id });
  const { res, getResult } = buildMockRes();
  await experiencesController.deletePlanItem(req, res);
  return getResult();
}

// ---------------------------------------------------------------------------
// Read-only fetcher
// ---------------------------------------------------------------------------

/**
 * fetch_experience_items — read-only, no confirmation.
 * Returns the experience template's plan items with cost_estimate and photos_count.
 * payload: { experience_id, limit? }
 */
async function executeFetchExperienceItems(payload, user) {
  const Experience = require('../../models/experience');
  const Destination = require('../../models/destination');
  const Plan = require('../../models/plan');
  const User = require('../../models/user');
  const { getEnforcer } = require('../permission-enforcer');
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

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

const HANDLERS = {
  create_experience: executeCreateExperience,
  update_experience: executeUpdateExperience,
  add_experience_plan_item: executeAddExperiencePlanItem,
  update_experience_plan_item: executeUpdateExperiencePlanItem,
  delete_experience_plan_item: executeDeleteExperiencePlanItem,
  fetch_experience_items: executeFetchExperienceItems
};

const ALLOWED_TYPES = Object.keys(HANDLERS);
const READ_ONLY_TYPES = ['fetch_experience_items'];
const TOOL_CALL_TYPES = ['fetch_experience_items'];

module.exports = {
  ALLOWED_TYPES,
  READ_ONLY_TYPES,
  TOOL_CALL_TYPES,
  HANDLERS
};
