/**
 * Experience Service
 *
 * Stateless module for experience CRUD + plan-item operations on the
 * experience template. Used by:
 *  - controllers/api/experiences.js (HTTP layer)
 *  - utilities/bienbot-action-executor.js (assistant action handlers)
 *
 * Service rules:
 *  - Depends on models + utilities only (NEVER on controllers).
 *  - Plain async functions — no Express types in signatures.
 *  - Returns mongoose documents or `{ error, code }` objects.
 *
 * @module services/experience-service
 */

const mongoose = require('mongoose');
const Experience = require('../models/experience');
const Destination = require('../models/destination');
const User = require('../models/user');
const Plan = require('../models/plan');
const backendLogger = require('../utilities/backend-logger');
const permissions = require('../utilities/permissions');
const { getEnforcer } = require('../utilities/permission-enforcer');
const { broadcastEvent } = require('../utilities/websocket-server');
const { createPlanItemLocation } = require('../utilities/address-utils');
const { findDuplicateFuzzy } = require('../utilities/fuzzy-match');

const ALLOWED_UPDATE_FIELDS = [
  'name', 'overview', 'destination', 'map_location', 'location', 'experience_type',
  'plan_items', 'photos', 'visibility', 'permissions'
];

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

/**
 * Create an experience with duplicate detection.
 *
 * @param {object} options
 * @param {object} options.data
 * @param {object} options.actor
 * @returns {Promise<{ experience?: object, error?: string, code?: number }>}
 */
async function createExperience({ data, actor }) {
  if (!actor || !actor._id) {
    return { error: 'Authentication required', code: 401 };
  }

  const body = { ...data };
  body.permissions = [
    { _id: actor._id, entity: permissions.ENTITY_TYPES.USER, type: permissions.ROLES.OWNER }
  ];

  // Duplicate detection
  const userExperiences = await Experience.find({
    permissions: {
      $elemMatch: {
        entity: permissions.ENTITY_TYPES.USER,
        type: permissions.ROLES.OWNER,
        _id: actor._id
      }
    }
  }).select('name').lean().exec();

  const exact = userExperiences.find(e => e.name.toLowerCase() === (body.name || '').toLowerCase());
  if (exact) {
    return { error: `An experience named "${body.name}" already exists. Please choose a different name.`, code: 409 };
  }

  const fuzzy = findDuplicateFuzzy(userExperiences, body.name, 'name', 85);
  if (fuzzy) {
    return { error: `A similar experience "${fuzzy.name}" already exists. Did you mean to use that instead?`, code: 409 };
  }

  // Geocoding
  if (body.location || body.map_location) {
    try {
      const locationInput = body.location || body.map_location;
      const geocoded = await createPlanItemLocation(locationInput);
      if (geocoded) {
        body.location = geocoded;
        body.map_location = geocoded.address || body.map_location;
      }
    } catch (geoErr) {
      backendLogger.warn('[experience-service.create] Geocoding failed, using raw value', { error: geoErr.message });
      if (body.location && typeof body.location === 'string') {
        body.location = { address: body.location };
      }
    }
  }

  const experience = await Experience.create(body);
  return { experience };
}

/**
 * Fetch an experience by ID.
 *
 * @param {string|object} id
 * @returns {Promise<object|null>}
 */
async function getExperienceById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return await Experience.findById(id);
}

/**
 * Update an experience (with permission + duplicate checks).
 *
 * @param {object} options
 * @param {string} options.experienceId
 * @param {object} options.updates
 * @param {object} options.actor
 * @returns {Promise<{ experience?: object, updateData?: object, error?: string, code?: number }>}
 */
async function updateExperience({ experienceId, updates, actor }) {
  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return { error: 'Invalid experience ID format', code: 400 };
  }

  let experience = await Experience.findById(experienceId);
  if (!experience) {
    return { error: 'Experience not found', code: 404 };
  }

  const enforcer = getEnforcer({ Destination, Experience, User });
  const permCheck = await enforcer.canEdit({ userId: actor._id, resource: experience });
  if (!permCheck.allowed) {
    return { error: 'Not authorized to update this experience', code: 403 };
  }

  // Duplicate name check
  if (updates.name && updates.name !== experience.name) {
    const exact = await Experience.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(updates.name)}$`, 'i') },
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: actor._id
        }
      },
      _id: { $ne: experienceId }
    });
    if (exact) {
      return { error: `An experience named "${updates.name}" already exists. Please choose a different name.`, code: 409 };
    }

    const userExperiences = await Experience.find({
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: actor._id
        }
      },
      _id: { $ne: experienceId }
    });
    const fuzzy = findDuplicateFuzzy(userExperiences, updates.name, 'name', 85);
    if (fuzzy) {
      return { error: `A similar experience "${fuzzy.name}" already exists. Did you mean to use that instead?`, code: 409 };
    }
  }

  // Whitelist
  const updateData = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      updateData[field] = updates[field];
    }
  }

  // Geocoding on update
  if (updateData.location !== undefined) {
    try {
      const geocoded = await createPlanItemLocation(updateData.location);
      if (geocoded) {
        updateData.location = geocoded;
        if (!updateData.map_location && geocoded.address) {
          updateData.map_location = geocoded.address;
        }
      }
    } catch (geoErr) {
      backendLogger.warn('[experience-service.update] Geocoding failed, using raw value', { error: geoErr.message });
      if (typeof updateData.location === 'string') {
        updateData.location = { address: updateData.location };
      }
    }
  } else if (updateData.map_location && !experience.location?.address) {
    try {
      const geocoded = await createPlanItemLocation(updateData.map_location);
      if (geocoded) updateData.location = geocoded;
    } catch (geoErr) {
      backendLogger.warn('[experience-service.update] map_location geocoding failed', { error: geoErr.message });
    }
  }

  // Permission validation
  if (updateData.permissions) {
    for (const perm of updateData.permissions) {
      if (!perm._id) {
        return { error: 'Invalid permissions data: missing _id', code: 400 };
      }
      if (!perm.entity || !['user', 'destination', 'experience'].includes(perm.entity)) {
        return { error: 'Invalid permissions data: invalid entity', code: 400 };
      }
    }
  }

  experience = Object.assign(experience, updateData);
  await experience.save();

  return { experience, updateData };
}

/**
 * Delete an experience (cascades to plans).
 *
 * @param {object} options
 * @param {string} options.experienceId
 * @param {object} options.actor
 * @returns {Promise<{ ok?: boolean, deletedPlans?: { count: number, plans: array }, experience?: object, error?: string, code?: number }>}
 */
async function deleteExperience({ experienceId, actor }) {
  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return { error: 'Invalid experience ID format', code: 400 };
  }

  const experience = await Experience.findById(experienceId);
  if (!experience) {
    return { error: 'Experience not found', code: 404 };
  }

  const enforcer = getEnforcer({ Destination, Experience, User });
  const permCheck = await enforcer.canDelete({ userId: actor._id, resource: experience });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'Only the experience owner can delete it.', code: 403 };
  }

  // Get plan IDs for response
  const plansToDelete = await Plan.find({ experience: experienceId }).select('_id user').lean();
  const deletedPlanIds = plansToDelete.map(p => ({
    planId: p._id.toString(),
    userId: p.user ? p.user.toString() : null
  }));

  let deletedPlansCount = 0;
  try {
    const deleteResult = await Plan.deleteMany({ experience: experienceId });
    deletedPlansCount = deleteResult.deletedCount;
    backendLogger.info('Deleted associated plans', {
      experienceId,
      plansDeleted: deletedPlansCount,
      planIds: deletedPlanIds.map(p => p.planId)
    });
  } catch (planDeleteErr) {
    backendLogger.error('Error deleting associated plans', {
      error: planDeleteErr.message,
      experienceId
    });
  }

  await experience.deleteOne();

  try {
    broadcastEvent('experience', experienceId.toString(), {
      type: 'experience:deleted',
      payload: {
        experienceId: experienceId.toString(),
        deletedPlans: deletedPlanIds,
        userId: actor._id.toString()
      }
    }, actor._id.toString());
  } catch (wsErr) {
    backendLogger.warn('[experience-service.delete] WebSocket broadcast failed', { error: wsErr.message });
  }

  return {
    ok: true,
    deletedPlans: { count: deletedPlansCount, plans: deletedPlanIds },
    experience
  };
}

/**
 * Add a plan item to an experience template.
 *
 * @param {object} options
 * @param {string} options.experienceId
 * @param {object} options.itemData - text, url, cost_estimate, planning_days, parent, activity_type, location
 * @param {object} options.actor
 * @returns {Promise<{ planItem?: object, experience?: object, error?: string, code?: number }>}
 */
async function addPlanItemToExperience({ experienceId, itemData, actor }) {
  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return { error: 'Invalid experience ID format', code: 400 };
  }

  let experience = await Experience.findById(experienceId);
  if (!experience) {
    return { error: 'Experience not found', code: 404 };
  }

  const enforcer = getEnforcer({ Destination, Experience, User });
  const permCheck = await enforcer.canEdit({ userId: actor._id, resource: experience });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'You must be the owner or a collaborator to add plan items.', code: 403 };
  }

  // Nesting check
  const maxNestingLevelRaw = process.env.PLAN_ITEM_MAX_NESTING_LEVEL || process.env.VITE_PLAN_ITEM_MAX_NESTING_LEVEL;
  const parsed = parseInt(maxNestingLevelRaw, 10);
  const maxNestingLevel = Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;

  if (itemData.parent) {
    if (maxNestingLevel === 0) {
      return { error: 'Plan item nesting is disabled (max nesting level is 0)', code: 400 };
    }
    if (!mongoose.Types.ObjectId.isValid(itemData.parent)) {
      return { error: 'Invalid parent plan item ID format', code: 400 };
    }
    const parentItem = experience.plan_items.id(itemData.parent);
    if (!parentItem) {
      return { error: 'Parent plan item not found in this experience', code: 400 };
    }

    const visited = new Set();
    let parentDepth = 0;
    let cursor = parentItem;
    while (cursor?.parent) {
      const cursorId = cursor?._id?.toString();
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
      const nextParentId = cursor.parent.toString();
      const nextParent = experience.plan_items.id(nextParentId);
      if (!nextParent) {
        return { error: 'Invalid plan item hierarchy (missing parent)', code: 400 };
      }
      cursor = nextParent;
    }
    if (parentDepth >= maxNestingLevel) {
      return { error: `Cannot add a child item deeper than max nesting level ${maxNestingLevel}`, code: 400 };
    }
  }

  const planItemData = {
    text: itemData.text,
    url: itemData.url || null,
    cost_estimate: itemData.cost_estimate || 0,
    planning_days: itemData.planning_days || 0,
    parent: itemData.parent || null,
    activity_type: itemData.activity_type || null,
    location: sanitizeLocation(itemData.location)
  };

  experience.plan_items.push(planItemData);
  await experience.save();

  const newPlanItem = experience.plan_items[experience.plan_items.length - 1];

  try {
    broadcastEvent('experience', experienceId.toString(), {
      type: 'experience:item:added',
      payload: {
        experienceId: experienceId.toString(),
        planItem: newPlanItem,
        userId: actor._id.toString()
      }
    }, actor._id.toString());
  } catch (wsErr) {
    backendLogger.warn('[experience-service.addPlanItem] WebSocket broadcast failed', { error: wsErr.message });
  }

  return { planItem: newPlanItem, experience };
}

module.exports = {
  createExperience,
  getExperienceById,
  updateExperience,
  deleteExperience,
  addPlanItemToExperience,
  // Internal helpers exposed for controllers reusing the same logic
  sanitizeLocation,
  escapeRegex,
  ALLOWED_UPDATE_FIELDS
};
