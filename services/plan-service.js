/**
 * Plan Service
 *
 * Stateless module for plan + plan-item CRUD and collaborator operations.
 * Used by:
 *  - controllers/api/plans.js (HTTP layer)
 *  - utilities/bienbot-action-executor.js (assistant action handlers)
 *
 * Service rules:
 *  - Depends on models + utilities only (NEVER on controllers).
 *  - Plain async functions — no Express types in signatures.
 *  - Returns mongoose documents or `{ error, code }` objects.
 *
 *  These services intentionally do NOT trigger group-chat membership sync,
 *  email notifications, or activity tracking — those concerns remain in the
 *  controller layer where request/response context is available.
 *
 * @module services/plan-service
 */

const mongoose = require('mongoose');
const Plan = require('../models/plan');
const Experience = require('../models/experience');
const Destination = require('../models/destination');
const User = require('../models/user');
const backendLogger = require('../utilities/backend-logger');
const { getEnforcer } = require('../utilities/permission-enforcer');
const { broadcastEvent } = require('../utilities/websocket-server');

const VALID_ACTIVITY_TYPES = [
  'accommodation', 'transport', 'food', 'drinks', 'coffee',
  'sightseeing', 'museum', 'nature', 'adventure', 'sports', 'entertainment',
  'wellness', 'tour', 'class', 'nightlife', 'religious', 'local',
  'shopping', 'market', 'health', 'banking', 'communication', 'admin', 'laundry', 'rental',
  'photography', 'meeting', 'work', 'rest', 'packing', 'checkpoint', 'custom',
  null
];

function sanitizeLocation(location) {
  if (!location) return null;
  const hasAddress = location.address && typeof location.address === 'string' && location.address.trim();
  const hasGeo = location.geo && location.geo.coordinates && Array.isArray(location.geo.coordinates) && location.geo.coordinates.length === 2;
  if (!hasAddress && !hasGeo) return null;

  const sanitized = {
    address: hasAddress ? location.address.trim() : null,
    geo: null,
    city: (location.city && typeof location.city === 'string') ? location.city : null,
    state: (location.state && typeof location.state === 'string') ? location.state : null,
    country: (location.country && typeof location.country === 'string') ? location.country : null,
    postalCode: (location.postalCode && typeof location.postalCode === 'string') ? location.postalCode : null,
    placeId: (location.placeId && typeof location.placeId === 'string') ? location.placeId : null
  };

  if (hasGeo) {
    const [lng, lat] = location.geo.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number' &&
        lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      sanitized.geo = { type: 'Point', coordinates: [lng, lat] };
    }
  }
  return sanitized;
}

function normalizePlannedDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Create a plan for the given experience.
 *
 * @param {object} options
 * @param {string} options.experienceId
 * @param {object} options.actor
 * @param {Date|string|null} [options.plannedDate]
 * @param {string} [options.currency]
 * @returns {Promise<{ plan?: object, experience?: object, error?: string, code?: number }>}
 */
async function createPlan({ experienceId, actor, plannedDate = null, currency }) {
  if (!actor || !actor._id) {
    return { error: 'Authentication required', code: 401 };
  }
  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return { error: 'Invalid experience ID', code: 400 };
  }
  if (!mongoose.Types.ObjectId.isValid(actor._id)) {
    return { error: 'Invalid user ID', code: 400 };
  }

  const experience = await Experience.findById(experienceId);
  if (!experience) {
    return { error: 'Experience not found', code: 404 };
  }

  const existingPlan = await Plan.findOne({
    experience: experienceId,
    user: actor._id
  });
  if (existingPlan) {
    return { error: 'Plan already exists for this experience. Use the checkmark button to view it.', code: 409 };
  }

  const planSnapshot = experience.plan_items.map(item => ({
    plan_item_id: item._id,
    complete: false,
    cost: item.cost_estimate || 0,
    planning_days: item.planning_days || 0,
    text: item.text,
    url: item.url,
    photo: item.photo,
    parent: item.parent,
    activity_type: item.activity_type || null,
    location: item.location || null
  }));

  const normalizedDate = normalizePlannedDate(plannedDate);
  const normalizedCurrency = (typeof currency === 'string' && currency.trim().length === 3)
    ? currency.trim().toUpperCase()
    : 'USD';

  const plan = await Plan.create({
    experience: experienceId,
    user: actor._id,
    planned_date: normalizedDate,
    currency: normalizedCurrency,
    plan: planSnapshot,
    permissions: [
      { _id: actor._id, entity: 'user', type: 'owner', granted_by: actor._id },
      { _id: experienceId, entity: 'experience', type: 'collaborator', granted_by: actor._id }
    ]
  });

  return { plan, experience };
}

/**
 * Fetch a plan by ID.
 *
 * @param {string|object} id
 * @returns {Promise<object|null>}
 */
async function getPlanById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Plan.findById(id);
}

/**
 * Update top-level plan fields (planned_date, plan, notes, currency).
 *
 * @param {object} options
 * @param {string} options.planId
 * @param {object} options.updates
 * @param {object} options.actor
 * @returns {Promise<{ plan?: object, fieldsUpdated?: string[], error?: string, code?: number }>}
 */
async function updatePlan({ planId, updates, actor }) {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    return { error: 'Invalid plan ID', code: 400 };
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    return { error: 'Plan not found', code: 404 };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({ userId: actor._id, resource: plan });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'Insufficient permissions to edit this plan', code: 403 };
  }

  const allowedUpdates = ['planned_date', 'plan', 'notes', 'currency'];
  const fieldsUpdated = [];

  for (const field of allowedUpdates) {
    if (updates[field] === undefined) continue;
    if (field === 'planned_date') {
      plan[field] = normalizePlannedDate(updates[field]);
    } else if (field === 'currency') {
      if (typeof updates[field] !== 'string' || updates[field].trim().length !== 3) {
        return { error: `Invalid value for field: ${field}`, code: 400 };
      }
      plan[field] = updates[field].trim().toUpperCase();
    } else if (field === 'plan') {
      if (!Array.isArray(updates[field])) {
        return { error: `Invalid value for field: ${field}`, code: 400 };
      }
      plan[field] = updates[field];
    } else if (field === 'notes') {
      if (typeof updates[field] !== 'string' && updates[field] !== null) {
        return { error: `Invalid value for field: ${field}`, code: 400 };
      }
      plan[field] = updates[field];
    }
    fieldsUpdated.push(field);
  }

  await plan.save();
  return { plan, fieldsUpdated };
}

/**
 * Delete a plan (owner only, or super admin).
 * Does NOT trigger experience signal recomputation — caller (controller) does
 * that via setImmediate.
 *
 * @param {object} options
 * @param {string} options.planId
 * @param {object} options.actor
 * @returns {Promise<{ ok?: boolean, plan?: object, error?: string, code?: number }>}
 */
async function deletePlan({ planId, actor }) {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    return { error: 'Invalid plan ID', code: 400 };
  }

  const plan = await Plan.findById(planId)
    .select('user permissions experience')
    .populate('experience', 'name');

  if (!plan) {
    return { error: 'Plan not found', code: 404 };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canDelete({ userId: actor._id, resource: plan });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'Only the plan owner can delete it', code: 403 };
  }

  // Parallel: delete plan + maybe pull contributor permission from experience
  const deletePromise = Plan.findByIdAndDelete(planId);

  let updateExperiencePromise = Promise.resolve();
  if (plan.experience) {
    updateExperiencePromise = (async () => {
      const experienceId = plan.experience?._id || plan.experience;
      const experience = await Experience.findById(experienceId).select('permissions user').lean();
      if (experience) {
        const userRole = await enforcer.getUserRole(actor._id, experience);
        const isOwnerOrCollaborator = userRole === 'owner' || userRole === 'collaborator';
        if (!isOwnerOrCollaborator) {
          await Experience.updateOne(
            { _id: experienceId },
            {
              $pull: {
                permissions: { entity: 'user', _id: actor._id, type: 'contributor' }
              }
            }
          );
        }
      }
    })();
  }

  await Promise.all([deletePromise, updateExperiencePromise]);

  try {
    broadcastEvent('plan', planId.toString(), {
      type: 'plan:deleted',
      payload: { planId: planId.toString(), userId: actor._id.toString() }
    }, actor._id.toString());
    const experienceId = plan.experience?._id || plan.experience;
    if (experienceId) {
      broadcastEvent('experience', experienceId.toString(), {
        type: 'plan:deleted',
        payload: {
          planId: planId.toString(),
          experienceId: experienceId.toString(),
          userId: actor._id.toString()
        }
      }, actor._id.toString());
    }
  } catch (wsErr) {
    backendLogger.warn('[plan-service.delete] WebSocket broadcast failed', { error: wsErr.message });
  }

  return { ok: true, plan };
}

/**
 * Add a single plan item to a plan.
 *
 * @param {object} options
 * @param {string} options.planId
 * @param {object} options.itemData - text, url, cost, planning_days, parent, photo, activity_type, location, plan_item_id
 * @param {object} options.actor
 * @returns {Promise<{ plan?: object, error?: string, code?: number }>}
 */
async function addPlanItem({ planId, itemData, actor }) {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    return { error: 'Invalid plan ID', code: 400 };
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    return { error: 'Plan not found', code: 404 };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({ userId: actor._id, resource: plan });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'Insufficient permissions to edit this plan', code: 403 };
  }

  const maxNestingLevelRaw = process.env.PLAN_ITEM_MAX_NESTING_LEVEL || process.env.VITE_PLAN_ITEM_MAX_NESTING_LEVEL;
  const parsed = parseInt(maxNestingLevelRaw, 10);
  const maxNestingLevel = Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;

  const { text, url, cost, planning_days, parent, photo, activity_type, location, lat, lng, address, plan_item_id } = itemData;

  if (parent) {
    if (maxNestingLevel === 0) {
      return { error: 'Plan item nesting is disabled (max nesting level is 0)', code: 400 };
    }
    if (!mongoose.Types.ObjectId.isValid(parent.toString())) {
      return { error: 'Invalid parent plan item ID', code: 400 };
    }

    const findPlanItemByAnyId = (idStr) => (plan.plan || []).find(item => {
      const primaryId = item?.plan_item_id || item?._id;
      if (primaryId && primaryId.toString() === idStr) return true;
      return item?._id && item._id.toString() === idStr;
    }) || null;

    const parentItem = findPlanItemByAnyId(parent.toString());
    if (!parentItem) {
      return { error: 'Parent plan item not found in this plan', code: 400 };
    }

    const visited = new Set();
    let parentDepth = 0;
    let cursor = parentItem;
    while (cursor?.parent) {
      const cursorId = (cursor.plan_item_id || cursor._id)?.toString() || null;
      if (cursorId) {
        if (visited.has(cursorId)) {
          return { error: 'Invalid plan item hierarchy (cycle detected)', code: 400 };
        }
        visited.add(cursorId);
      }
      parentDepth += 1;
      if (parentDepth > 50) {
        return { error: 'Invalid plan item hierarchy (excessive nesting)', code: 400 };
      }
      const nextParent = findPlanItemByAnyId(cursor.parent.toString());
      if (!nextParent) {
        return { error: 'Invalid plan item hierarchy (missing parent)', code: 400 };
      }
      cursor = nextParent;
    }
    if (parentDepth >= maxNestingLevel) {
      return { error: `Cannot add a child item deeper than max nesting level ${maxNestingLevel}`, code: 400 };
    }
  }

  let locationData = null;
  if (location) {
    locationData = sanitizeLocation(location);
    if (!locationData && typeof location.lat === 'number' && typeof location.lng === 'number') {
      locationData = sanitizeLocation({
        address: location.address,
        geo: { type: 'Point', coordinates: [location.lng, location.lat] },
        city: location.city,
        state: location.state,
        country: location.country,
        postalCode: location.postalCode,
        placeId: location.placeId
      });
    }
  } else if (address || (typeof lat === 'number' && typeof lng === 'number')) {
    const geoCoords = (typeof lat === 'number' && typeof lng === 'number')
      ? { type: 'Point', coordinates: [lng, lat] }
      : null;
    locationData = sanitizeLocation({ address: address || null, geo: geoCoords });
  }

  const resolvedActivityType = activity_type && VALID_ACTIVITY_TYPES.includes(activity_type) ? activity_type : null;

  const newPlanItem = {
    plan_item_id: plan_item_id || new mongoose.Types.ObjectId(),
    text,
    url,
    cost: cost || 0,
    planning_days: planning_days || 0,
    complete: false,
    parent: parent || null,
    photo: photo || null,
    activity_type: resolvedActivityType,
    location: locationData
  };

  plan.plan.push(newPlanItem);
  await plan.save();

  return { plan };
}

/**
 * Update fields of a single plan item.
 *
 * @param {object} options
 * @param {string} options.planId
 * @param {string} options.itemId  - Either subdoc _id OR plan_item_id (BienBot uses experience IDs).
 * @param {object} options.updates - { complete, cost, planning_days, text, url, activity_type, scheduled_date, scheduled_time, visibility, location, lat, lng, address, photos }
 * @param {object} options.actor
 * @returns {Promise<{ plan?: object, planItem?: object, error?: string, code?: number }>}
 */
async function updatePlanItem({ planId, itemId, updates, actor }) {
  if (!mongoose.Types.ObjectId.isValid(planId) || !mongoose.Types.ObjectId.isValid(itemId)) {
    return { error: 'Invalid ID', code: 400 };
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    return { error: 'Plan not found', code: 404 };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({ userId: actor._id, resource: plan });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'Insufficient permissions to edit this plan', code: 403 };
  }

  let planItem = plan.plan.id(itemId);
  if (!planItem) {
    planItem = plan.plan.find(i => i.plan_item_id?.toString() === itemId?.toString());
  }
  if (!planItem) {
    return { error: 'Plan item not found', code: 404 };
  }

  const isChildItem = Boolean(planItem.parent);
  const isSettingScheduleOnChild = isChildItem && (
    (updates.scheduled_date !== undefined && updates.scheduled_date !== null) ||
    (updates.scheduled_time !== undefined && updates.scheduled_time !== null)
  );
  if (isSettingScheduleOnChild) {
    return { error: 'Child plan items cannot be scheduled. Schedule the parent item instead.', code: 400 };
  }

  // Apply allowed scalar updates
  const fieldsAllowed = ['complete', 'cost', 'planning_days', 'text', 'url', 'scheduled_date', 'scheduled_time'];
  for (const field of fieldsAllowed) {
    if (updates[field] !== undefined) planItem[field] = updates[field];
  }

  if (updates.visibility !== undefined) {
    const validVisibilities = ['public', 'plan_only'];
    planItem.visibility = validVisibilities.includes(updates.visibility) ? updates.visibility : 'plan_only';
  }
  if (updates.activity_type !== undefined) {
    planItem.activity_type = VALID_ACTIVITY_TYPES.includes(updates.activity_type) ? updates.activity_type : null;
  }

  // Location
  const { location, lat, lng, address } = updates;
  const hasLocationInput = location !== undefined || address !== undefined ||
    (typeof lat === 'number' && typeof lng === 'number');
  if (hasLocationInput) {
    let locationData = null;
    if (location) {
      locationData = sanitizeLocation(location);
      if (!locationData && typeof location.lat === 'number' && typeof location.lng === 'number') {
        locationData = sanitizeLocation({
          address: location.address,
          geo: { type: 'Point', coordinates: [location.lng, location.lat] },
          city: location.city,
          state: location.state,
          country: location.country,
          postalCode: location.postalCode,
          placeId: location.placeId
        });
      }
    } else if (address || (typeof lat === 'number' && typeof lng === 'number')) {
      const geoCoords = (typeof lat === 'number' && typeof lng === 'number')
        ? { type: 'Point', coordinates: [lng, lat] }
        : null;
      locationData = sanitizeLocation({ address: address || null, geo: geoCoords });
    }
    planItem.location = locationData;
  }

  if (updates.photos !== undefined) {
    if (Array.isArray(updates.photos)) {
      const validPhotoIds = updates.photos.filter(id => mongoose.Types.ObjectId.isValid(id));
      planItem.photos = validPhotoIds.map(id => new mongoose.Types.ObjectId(id));
    } else if (updates.photos === null) {
      planItem.photos = [];
    }
  }

  await plan.save();
  return { plan, planItem };
}

/**
 * Mark a plan item complete or incomplete.
 *
 * @param {object} options
 * @param {string} options.planId
 * @param {string} options.itemId
 * @param {boolean} options.complete
 * @param {object} options.actor
 * @returns {Promise<{ plan?: object, planItem?: object, error?: string, code?: number }>}
 */
async function markItemComplete({ planId, itemId, complete, actor }) {
  return await updatePlanItem({ planId, itemId, updates: { complete: Boolean(complete) }, actor });
}

/**
 * Add a collaborator to a plan via the permission enforcer.
 *
 * @param {object} options
 * @param {string} options.planId
 * @param {string} options.userId - User to add
 * @param {object} options.actor
 * @param {object} [options.metadata] - Request metadata for audit (ip, userAgent, etc.)
 * @returns {Promise<{ ok?: boolean, plan?: object, result?: object, error?: string, code?: number }>}
 */
async function addCollaborator({ planId, userId, actor, metadata = {} }) {
  if (!mongoose.Types.ObjectId.isValid(planId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return { error: 'Invalid ID', code: 400 };
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    return { error: 'Plan not found', code: 404 };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });

  // Owner short-circuit
  if (!(plan.user && plan.user.toString() === actor._id.toString())) {
    const permCheck = await enforcer.canManagePermissions({ userId: actor._id, resource: plan });
    if (!permCheck.allowed) {
      return { error: permCheck.reason || 'Only the plan owner can add collaborators', code: 403 };
    }
  }

  const existingPerm = plan.permissions.find(
    p => p.entity === 'user' && p._id.toString() === userId
  );
  if (existingPerm) {
    return { error: 'User already has permissions on this plan', code: 400 };
  }

  const result = await enforcer.addPermission({
    resource: plan,
    permission: { _id: userId, entity: 'user', type: 'collaborator' },
    actorId: actor._id,
    reason: 'Collaborator added to plan',
    metadata
  });

  if (!result.success) {
    return { error: result.error, code: 400 };
  }

  return { ok: true, plan, result };
}

/**
 * Remove a collaborator from a plan via the permission enforcer.
 *
 * @param {object} options
 * @param {string} options.planId
 * @param {string} options.userId
 * @param {object} options.actor
 * @param {object} [options.metadata]
 * @returns {Promise<{ ok?: boolean, plan?: object, result?: object, error?: string, code?: number }>}
 */
async function removeCollaborator({ planId, userId, actor, metadata = {} }) {
  if (!mongoose.Types.ObjectId.isValid(planId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return { error: 'Invalid ID', code: 400 };
  }

  const plan = await Plan.findById(planId);
  if (!plan) {
    return { error: 'Plan not found', code: 404 };
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });

  if (!(plan.user && plan.user.toString() === actor._id.toString())) {
    const permCheck = await enforcer.canManagePermissions({ userId: actor._id, resource: plan });
    if (!permCheck.allowed) {
      return { error: permCheck.reason || 'Only the plan owner can remove collaborators', code: 403 };
    }
  }

  const result = await enforcer.removePermission({
    resource: plan,
    permissionId: userId,
    entityType: 'user',
    actorId: actor._id,
    reason: 'Collaborator removed from plan',
    metadata
  });

  if (!result.success) {
    return { error: result.error, code: 400 };
  }

  return { ok: true, plan, result };
}

module.exports = {
  createPlan,
  getPlanById,
  updatePlan,
  deletePlan,
  addPlanItem,
  addPlanItems: async ({ planId, items, actor }) => {
    // Convenience helper: add items sequentially, stop on first failure.
    if (!Array.isArray(items) || items.length === 0) {
      return { error: 'items must be a non-empty array', code: 400 };
    }
    const results = [];
    let lastPlan = null;
    for (const item of items) {
      const r = await addPlanItem({ planId, itemData: item, actor });
      results.push(r);
      if (r.error) {
        return { error: r.error, code: r.code, partialResults: results };
      }
      lastPlan = r.plan;
    }
    return { plan: lastPlan, results, itemsAdded: items.length };
  },
  updatePlanItem,
  markItemComplete,
  addCollaborator,
  removeCollaborator,
  // Helpers
  sanitizeLocation,
  normalizePlannedDate,
  VALID_ACTIVITY_TYPES
};
