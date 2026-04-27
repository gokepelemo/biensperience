/**
 * Destination Service
 *
 * Stateless module for destination CRUD. Used by:
 *  - controllers/api/destinations.js (HTTP layer)
 *  - utilities/bienbot-action-executor.js (assistant action handlers)
 *
 * Service rules:
 *  - Depends on models + utilities only (NEVER on controllers).
 *  - Plain async functions — no Express types in signatures.
 *  - Returns mongoose documents (or { error, code } objects on validation failure).
 *
 * @module services/destination-service
 */

const mongoose = require('mongoose');
const Destination = require('../models/destination');
const Experience = require('../models/experience');
const User = require('../models/user');
const backendLogger = require('../utilities/backend-logger');
const enforcerModule = require('../utilities/permission-enforcer');
const { getEnforcer } = enforcerModule;
// Backward-compat alias: existing service code uses `permissions.<helper>`.
// Re-bound from the enforcer's re-exports so this is the only entry point (bd #9224).
const permissions = enforcerModule;
const { broadcastEvent } = require('../utilities/websocket-server');
const { createPlanItemLocation } = require('../utilities/address-utils');
const { findDuplicateFuzzy } = require('../utilities/fuzzy-match');

const ALLOWED_CREATE_FIELDS = ['name', 'country', 'state', 'overview', 'photos', 'travel_tips', 'tags', 'map_location', 'location'];

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a destination, with duplicate detection.
 *
 * @param {object} options
 * @param {object} options.data - Destination fields ({ name, country, ... }).
 * @param {object} options.actor - Authenticated user creating the destination.
 * @returns {Promise<{ destination?: object, error?: string, code?: number }>}
 */
async function createDestination({ data, actor }) {
  if (!actor || !actor._id) {
    return { error: 'Authentication required', code: 401 };
  }

  // Whitelist fields
  const destinationData = {};
  for (const field of ALLOWED_CREATE_FIELDS) {
    if (data[field] !== undefined) destinationData[field] = data[field];
  }

  // Geocoding
  if (data.location) {
    try {
      const geocoded = await createPlanItemLocation(data.location);
      if (geocoded) {
        destinationData.location = geocoded;
        if (!destinationData.map_location && geocoded.address) {
          destinationData.map_location = geocoded.address;
        }
      }
    } catch (geoErr) {
      backendLogger.warn('[destination-service.create] Geocoding failed, using raw location', { error: geoErr.message });
      if (typeof data.location === 'object' && data.location.address) {
        destinationData.location = data.location;
      }
    }
  } else if (data.map_location && !destinationData.location) {
    try {
      const geocoded = await createPlanItemLocation(data.map_location);
      if (geocoded) destinationData.location = geocoded;
    } catch (geoErr) {
      backendLogger.warn('[destination-service.create] map_location geocoding failed', { error: geoErr.message });
    }
  }

  destinationData.user = actor._id;
  destinationData.permissions = [
    { _id: actor._id, entity: permissions.ENTITY_TYPES.USER, type: permissions.ROLES.OWNER }
  ];

  // Duplicate detection
  const allDestinations = await Destination.find({}).select('name country').lean().exec();
  const exact = allDestinations.find(d =>
    d.name.toLowerCase() === destinationData.name.toLowerCase() &&
    d.country.toLowerCase() === destinationData.country.toLowerCase()
  );
  if (exact) {
    return { error: 'A destination with this name and country already exists. Please choose a different destination.', code: 409 };
  }

  const sameCountry = allDestinations.filter(d =>
    d.country.toLowerCase().trim() === destinationData.country.toLowerCase().trim()
  );
  const fuzzy = findDuplicateFuzzy(sameCountry, destinationData.name, 'name', 85);
  if (fuzzy) {
    return { error: 'A similar destination already exists. Did you mean to use that instead?', code: 409 };
  }

  const destination = await Destination.create(destinationData);
  return { destination };
}

/**
 * Fetch a destination by ID (returns Mongoose document; null if not found).
 *
 * @param {string|object} id
 * @param {object} [options]
 * @param {boolean} [options.populate=false] - Populate photos.photo when true.
 * @returns {Promise<object|null>}
 */
async function getDestinationById(id, { populate = false } = {}) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  let q = Destination.findById(id);
  if (populate) q = q.populate('photos.photo');
  return await q.exec();
}

/**
 * Update a destination (with permission check + duplicate detection).
 *
 * @param {object} options
 * @param {string} options.destinationId
 * @param {object} options.updates
 * @param {object} options.actor
 * @returns {Promise<{ destination?: object, error?: string, code?: number }>}
 */
async function updateDestination({ destinationId, updates, actor }) {
  if (!mongoose.Types.ObjectId.isValid(destinationId)) {
    return { error: 'Invalid destination ID format', code: 400 };
  }

  const destination = await Destination.findById(destinationId);
  if (!destination) {
    return { error: 'Destination not found', code: 404 };
  }

  const enforcer = getEnforcer({ Destination, Experience, User });
  const permCheck = await enforcer.canEdit({ userId: actor._id, resource: destination });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'You must be the owner or a collaborator to edit this destination.', code: 403 };
  }

  const updateData = { ...updates };
  delete updateData.activityParentId;

  // Duplicate detection on rename
  if ((updateData.name && updateData.name !== destination.name) ||
      (updateData.country && updateData.country !== destination.country)) {
    const checkName = updateData.name || destination.name;
    const checkCountry = updateData.country || destination.country;
    const exact = await Destination.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(checkName)}$`, 'i') },
      country: { $regex: new RegExp(`^${escapeRegex(checkCountry)}$`, 'i') },
      _id: { $ne: destinationId }
    });
    if (exact) {
      return { error: `A destination named "${checkName}, ${checkCountry}" already exists. Please choose a different destination.`, code: 409 };
    }

    const allDestinations = await Destination.find({ _id: { $ne: destinationId } });
    const sameCountry = allDestinations.filter(d =>
      d.country.toLowerCase().trim() === checkCountry.toLowerCase().trim()
    );
    const fuzzy = findDuplicateFuzzy(sameCountry, checkName, 'name', 85);
    if (fuzzy) {
      return { error: `A similar destination "${fuzzy.name}, ${fuzzy.country}" already exists. Did you mean to use that instead?`, code: 409 };
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
      backendLogger.warn('[destination-service.update] Geocoding failed, using raw location', { error: geoErr.message });
      if (typeof updateData.location === 'string') {
        updateData.location = { address: updateData.location };
      }
    }
  } else if (updateData.map_location && !destination.location?.address) {
    try {
      const geocoded = await createPlanItemLocation(updateData.map_location);
      if (geocoded) updateData.location = geocoded;
    } catch (geoErr) {
      backendLogger.warn('[destination-service.update] map_location geocoding failed', { error: geoErr.message });
    }
  }

  Object.assign(destination, updateData);
  await destination.save();
  await destination.populate('photos.photo');

  return { destination, updateData };
}

/**
 * Delete a destination (owner only, super admin override via enforcer).
 *
 * @param {object} options
 * @param {string} options.destinationId
 * @param {object} options.actor
 * @returns {Promise<{ ok?: boolean, error?: string, code?: number, destination?: object }>}
 */
async function deleteDestination({ destinationId, actor }) {
  if (!mongoose.Types.ObjectId.isValid(destinationId)) {
    return { error: 'Invalid destination ID format', code: 400 };
  }

  const destination = await Destination.findById(destinationId);
  if (!destination) {
    return { error: 'Destination not found', code: 404 };
  }

  const enforcer = getEnforcer({ Destination, Experience, User });
  const permCheck = await enforcer.canDelete({ userId: actor._id, resource: destination });
  if (!permCheck.allowed) {
    return { error: permCheck.reason || 'You must be the owner to delete this destination.', code: 403 };
  }

  await Destination.findByIdAndDelete(destinationId);

  try {
    broadcastEvent('destination', destinationId.toString(), {
      type: 'destination:deleted',
      payload: { destinationId: destinationId.toString(), userId: actor._id.toString() }
    }, actor._id.toString());
  } catch (wsErr) {
    backendLogger.warn('[destination-service.delete] WebSocket broadcast failed', { error: wsErr.message });
  }

  return { ok: true, destination };
}

module.exports = {
  createDestination,
  getDestinationById,
  updateDestination,
  deleteDestination,
  // Internal helpers
  escapeRegex,
  ALLOWED_CREATE_FIELDS
};
