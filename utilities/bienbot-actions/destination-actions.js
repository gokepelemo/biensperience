/**
 * BienBot destination-domain action handlers.
 *
 * Pure relocation from utilities/bienbot-action-executor.js — no behavior change.
 * Covers create/update destination, favorite toggling, destination
 * disambiguation, and the read-only fetch_destination_experiences fetcher.
 *
 * @module utilities/bienbot-actions/destination-actions
 */

const {
  loadControllers,
  loadModels,
  buildMockReq,
  buildMockRes
} = require('./_shared');

// ---------------------------------------------------------------------------
// create_destination
// ---------------------------------------------------------------------------

/**
 * create_destination
 * payload: { name, country, state?, overview?, location? }
 */
async function executeCreateDestination(payload, user) {
  const { destinationsController } = loadControllers();
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

// ---------------------------------------------------------------------------
// update_destination + toggle_favorite_destination
// ---------------------------------------------------------------------------

/**
 * update_destination
 * payload: { destination_id, name?, country?, state?, overview?, location?, map_location?, travel_tips? }
 */
async function executeUpdateDestination(payload, user) {
  const { destinationsController } = loadControllers();
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
  const { destinationsController } = loadControllers();
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
// fetch_destination_experiences (read-only)
// ---------------------------------------------------------------------------

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
  const Destination = require('../../models/destination');
  const Experience = require('../../models/experience');
  const Plan = require('../../models/plan');
  const User = require('../../models/user');
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

  const { mongoose, Plan, Experience, Destination, User, getEnforcer } = loadModels();

  if (!mongoose.Types.ObjectId.isValid(payload.destination_id)) {
    return { statusCode: 400, body: { success: false, error: 'Invalid destination_id format' } };
  }

  const destination = await Destination.findById(payload.destination_id).select('_id name country').lean();
  if (!destination) {
    return { statusCode: 404, body: { success: false, error: 'Destination not found' } };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
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

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

const HANDLERS = {
  create_destination: executeCreateDestination,
  update_destination: executeUpdateDestination,
  toggle_favorite_destination: executeToggleFavoriteDestination,
  select_destination: executeSelectDestination,
  fetch_destination_experiences: executeFetchDestinationExperiences
};

const ALLOWED_TYPES = Object.keys(HANDLERS);
const READ_ONLY_TYPES = [
  'fetch_destination_experiences',
  // select_destination is auto-executed (no confirmation)
  'select_destination'
];
const TOOL_CALL_TYPES = ['fetch_destination_experiences'];

module.exports = {
  ALLOWED_TYPES,
  READ_ONLY_TYPES,
  TOOL_CALL_TYPES,
  HANDLERS
};
