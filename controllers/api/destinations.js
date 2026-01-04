const mongoose = require('mongoose');
const Destination = require("../../models/destination");
const User = require("../../models/user");
const Experience = require("../../models/experience");
const Photo = require("../../models/photo");
const { findDuplicateFuzzy } = require("../../utilities/fuzzy-match");
const permissions = require("../../utilities/permissions");
const { getEnforcer } = require('../../utilities/permission-enforcer');
const backendLogger = require("../../utilities/backend-logger");
const { trackCreate, trackUpdate, trackDelete } = require('../../utilities/activity-tracker');
const { broadcastEvent } = require('../../utilities/websocket-server');
const { createPlanItemLocation } = require('../../utilities/address-utils');
const { successResponse, errorResponse, paginatedResponse } = require('../../utilities/controller-helpers');

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function index(req, res) {
  try {
    // Pagination support: default to page=1, limit=30
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const p = Number.isNaN(page) || page < 1 ? 1 : page;
    const l = Number.isNaN(limit) || limit < 1 ? 30 : limit;

    const skip = (p - 1) * l;

    // Sorting support
    const sortBy = req.query.sort_by || req.query.sort || 'name';
    const sortOrder = req.query.sort_order || req.query.order || 'asc';
    const sortMap = {
      'name': { name: sortOrder === 'asc' ? 1 : -1 },
      'alphabetical': { name: 1 },
      'alphabetical-desc': { name: -1 },
      'created-newest': { createdAt: -1 },
      'created-oldest': { createdAt: 1 }
    };
    const sortObj = sortMap[sortBy] || sortMap['name'];

    // If ?favorited_by=<userId> requested, return only destinations favorited by that user
    if (req.query.favorited_by) {
      const userId = req.query.favorited_by;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return errorResponse(res, null, 'Invalid user id for favorited_by', 400);
      }

      const favDestinations = await Destination.find({ users_favorite: userId })
        .populate("photos", "url caption photo_credit photo_credit_url width height")
        .lean()
        .exec();

      return successResponse(res, favDestinations);
    }

    // If ?all=true requested, return full array for compatibility
    if (req.query.all === 'true' || req.query.all === true) {
      const allDestinations = await Destination.find({})
        .populate("photos", "url caption photo_credit photo_credit_url width height")
        .lean()
        .exec();
      return successResponse(res, allDestinations);
    }

    // Build optional search filter (q=search term)
    const searchFilter = {};
    if (req.query.q && typeof req.query.q === 'string' && req.query.q.trim().length > 0) {
      const q = escapeRegex(req.query.q.trim());
      searchFilter.$or = [
        { name: { $regex: new RegExp(q, 'i') } },
        { country: { $regex: new RegExp(q, 'i') } }
      ];
    }

    // Count total documents (apply searchFilter if present)
    const total = await Destination.countDocuments(searchFilter);
    const destinations = await Destination.find(searchFilter)
      .populate("photos", "url caption photo_credit photo_credit_url width height")
      .sort(sortObj)
      .skip(skip)
      .limit(l)
      .lean()
      .exec();

    const totalPages = Math.ceil(total / l);
    return paginatedResponse(res, destinations, {
      page: p,
      limit: l,
      total,
      totalPages,
      hasMore: p < totalPages
    });
  } catch (err) {
    backendLogger.error('Error fetching destinations', { error: err.message });
    return errorResponse(res, err, 'Failed to fetch destinations', 400);
  }
}

async function createDestination(req, res) {
  try {
    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = ['name', 'country', 'state', 'overview', 'photos', 'default_photo_id', 'travel_tips', 'tags', 'map_location', 'location'];
    const destinationData = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        destinationData[field] = req.body[field];
      }
    });

    // Handle location geocoding
    // If location is provided as a string or object, geocode it
    if (req.body.location) {
      try {
        const geocodedLocation = await createPlanItemLocation(req.body.location);
        if (geocodedLocation) {
          destinationData.location = geocodedLocation;
          // Also set map_location for backward compatibility if not already set
          if (!destinationData.map_location && geocodedLocation.address) {
            destinationData.map_location = geocodedLocation.address;
          }
        }
      } catch (geoErr) {
        backendLogger.warn('[createDestination] Geocoding failed, using raw location', { error: geoErr.message });
        // If geocoding fails but location has address, store it anyway
        if (typeof req.body.location === 'object' && req.body.location.address) {
          destinationData.location = req.body.location;
        }
      }
    }
    // If only map_location string is provided, try to geocode it
    else if (req.body.map_location && !destinationData.location) {
      try {
        const geocodedLocation = await createPlanItemLocation(req.body.map_location);
        if (geocodedLocation) {
          destinationData.location = geocodedLocation;
        }
      } catch (geoErr) {
        backendLogger.warn('[createDestination] map_location geocoding failed', { error: geoErr.message });
      }
    }

    // Add required fields
    destinationData.user = req.user._id;
    destinationData.permissions = [
      {
        _id: req.user._id,
        entity: permissions.ENTITY_TYPES.USER,
        type: permissions.ROLES.OWNER
      }
    ];

    // OPTIMIZATION: Single query with .lean() and .select() to fetch all destinations
    // Only fetch name and country fields (3-8x memory reduction)
    const allDestinations = await Destination.find({})
      .select('name country')
      .lean()
      .exec();

    // In-memory exact duplicate check (case-insensitive)
    const exactDuplicate = allDestinations.find(dest =>
      dest.name.toLowerCase() === destinationData.name.toLowerCase() &&
      dest.country.toLowerCase() === destinationData.country.toLowerCase()
    );

    if (exactDuplicate) {
      return errorResponse(res, null, 'A destination with this name and country already exists. Please choose a different destination.', 409);
    }

    // Check for fuzzy duplicate on name with same country
    const sameCountryDestinations = allDestinations.filter(dest =>
      dest.country.toLowerCase().trim() === destinationData.country.toLowerCase().trim()
    );

    const fuzzyDuplicate = findDuplicateFuzzy(
      sameCountryDestinations,
      destinationData.name,
      'name',
      85
    );

    if (fuzzyDuplicate) {
      return errorResponse(res, null, 'A similar destination already exists. Did you mean to use that instead?', 409);
    }

    const destination = await Destination.create(destinationData);

    // Track creation (non-blocking)
    const createdActivity = await trackCreate({
      resource: destination,
      resourceType: 'Destination',
      actor: req.user,
      req,
      reason: `Destination "${destination.name}" created`,
      returnActivity: true
    });

    // Broadcast destination creation via WebSocket (async, non-blocking)
    try {
      broadcastEvent('destination', destination._id.toString(), {
        type: 'destination:created',
        payload: { destination, userId: req.user._id.toString() }
      });
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast destination creation', { error: wsErr.message });
    }

    return successResponse(
      res,
      destination,
      'Destination created successfully',
      201,
      createdActivity?._id ? { activityId: createdActivity._id } : null
    );
  } catch (err) {
    backendLogger.error('Error creating destination', { error: err.message, userId: req.user._id, name: req.body.name, country: req.body.country });
    return errorResponse(res, err, 'Failed to create destination', 400);
  }
}

async function showDestination(req, res) {
  try {
    const destination = await Destination.findById(req.params.id).populate(
      "photos"
    );
    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }
    return successResponse(res, destination);
  } catch (err) {
    backendLogger.error('Error fetching destination', { error: err.message, destinationId: req.params.id });
    return errorResponse(res, err, 'Failed to fetch destination', 400);
  }
}

async function updateDestination(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid destination ID format', 400);
    }

    let destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Check if user has permission to edit using PermissionEnforcer (handles super admin correctly)
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'You must be the owner or a collaborator to edit this destination.', 403);
    }

    // Extract activity parent reference (used by multi-step wizards) and prevent persistence
    const updateData = { ...req.body };
    const activityParentId = updateData.activityParentId;
    delete updateData.activityParentId;

    // Check for duplicate destination if name or country is being updated
    if ((updateData.name && updateData.name !== destination.name) ||
        (updateData.country && updateData.country !== destination.country)) {
      const checkName = updateData.name || destination.name;
      const checkCountry = updateData.country || destination.country;

      // Check for exact duplicate
      const exactDuplicate = await Destination.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(checkName)}$`, 'i') },
        country: { $regex: new RegExp(`^${escapeRegex(checkCountry)}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (exactDuplicate) {
        return errorResponse(res, null, `A destination named "${checkName}, ${checkCountry}" already exists. Please choose a different destination.`, 409);
      }

      // Check for fuzzy duplicate
      const allDestinations = await Destination.find({ _id: { $ne: req.params.id } });
      const sameCountryDestinations = allDestinations.filter(dest =>
        dest.country.toLowerCase().trim() === checkCountry.toLowerCase().trim()
      );

      const fuzzyDuplicate = findDuplicateFuzzy(
        sameCountryDestinations,
        checkName,
        'name',
        85
      );

      if (fuzzyDuplicate) {
        return errorResponse(res, null, `A similar destination "${fuzzyDuplicate.name}, ${fuzzyDuplicate.country}" already exists. Did you mean to use that instead?`, 409);
      }
    }

    // Handle location geocoding on update
    if (updateData.location !== undefined) {
      try {
        const geocodedLocation = await createPlanItemLocation(updateData.location);
        if (geocodedLocation) {
          updateData.location = geocodedLocation;
          // Also update map_location for backward compatibility
          if (!updateData.map_location && geocodedLocation.address) {
            updateData.map_location = geocodedLocation.address;
          }
        }
      } catch (geoErr) {
        backendLogger.warn('[updateDestination] Geocoding failed, using raw location', { error: geoErr.message });
        // If geocoding fails but location has address, use it anyway
        if (typeof updateData.location === 'object' && updateData.location.address) {
          // Keep the provided location object
        } else if (typeof updateData.location === 'string') {
          // Convert string to location object without geocoding
          updateData.location = { address: updateData.location };
        }
      }
    }
    // If only map_location is being updated, try to geocode it to update location too
    else if (updateData.map_location && !destination.location?.address) {
      try {
        const geocodedLocation = await createPlanItemLocation(updateData.map_location);
        if (geocodedLocation) {
          updateData.location = geocodedLocation;
        }
      } catch (geoErr) {
        backendLogger.warn('[updateDestination] map_location geocoding failed', { error: geoErr.message });
      }
    }

    // Capture previous state for activity tracking
    const previousState = destination.toObject();

    destination = Object.assign(destination, updateData);
    await destination.save();
    
    // Track update (non-blocking)
    trackUpdate({
      resource: destination,
      previousState,
      resourceType: 'Destination',
      actor: req.user,
      req,
      fieldsToTrack: Object.keys(updateData),
      reason: `Destination "${destination.name}" updated`,
      parentActivityId: activityParentId
    });

    // Populate photos field for response (consistent with showDestination)
    await destination.populate('photos');

    // Broadcast destination update via WebSocket
    try {
      broadcastEvent('destination', req.params.id.toString(), {
        type: 'destination:updated',
        payload: {
          destination,
          destinationId: req.params.id.toString(),
          updatedFields: Object.keys(updateData),
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast destination update', { error: wsErr.message });
    }

    return successResponse(res, destination, 'Destination updated successfully');
  } catch (err) {
    backendLogger.error('Error updating destination', { error: err.message, userId: req.user._id, destinationId: req.params.id });
    return errorResponse(res, err, 'Failed to update destination', 400);
  }
}

async function deleteDestination(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid destination ID format', 400);
    }

    let destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Check if user can delete using PermissionEnforcer (handles super admin correctly)
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canDelete({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'You must be the owner to delete this destination.', 403);
    }
    
    // Track deletion (non-blocking) - must happen before deleteOne()
    trackDelete({
      resource: destination,
      resourceType: 'Destination',
      actor: req.user,
      req,
      reason: `Destination "${destination.name}" deleted`
    });

    await destination.deleteOne();

    // Broadcast destination deletion via WebSocket
    try {
      broadcastEvent('destination', req.params.id.toString(), {
        type: 'destination:deleted',
        payload: {
          destinationId: req.params.id.toString(),
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast destination deletion', { error: wsErr.message });
    }

    return successResponse(res, { destinationId: req.params.id }, 'Destination deleted successfully');
  } catch (err) {
    backendLogger.error('Error deleting destination', { error: err.message, userId: req.user._id, destinationId: req.params.id });
    return errorResponse(res, err, 'Failed to delete destination', 400);
  }
}

async function toggleUserFavoriteDestination(req, res) {
  try {
    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(req.params.destinationId)) {
      return errorResponse(res, null, 'Invalid destination ID format', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    let destination = await Destination.findById(req.params.destinationId);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return errorResponse(res, null, 'User not found', 404);
    }
    
    const idx = destination.users_favorite.findIndex(id => id.toString() === user._id.toString());
    const isOwner = permissions.isOwner(user._id, destination);
    
    // Check if user is already a collaborator (includes super admin check)
    const isCollaborator = await permissions.isCollaborator(user._id, destination, { Destination, Experience });

    // Get enforcer for secure permission mutations
    const enforcer = getEnforcer({ Destination, Experience, User });
    
    if (idx === -1) {
      // Adding to favorites
      destination.users_favorite.push(user._id);
      
      // Add as contributor if not already owner or collaborator
      if (!isOwner && !isCollaborator) {
        const existingContributor = destination.permissions.find(
          p => p.entity === 'user' && p._id.toString() === user._id.toString() && p.type === 'contributor'
        );
        
        if (!existingContributor) {
          await enforcer.addPermission({
            resource: destination,
            permission: {
              _id: user._id,
              entity: 'user',
              type: 'contributor'
            },
            actorId: user._id,
            reason: 'User favorited destination',
            metadata: {
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              requestPath: req.path,
              requestMethod: req.method
            },
            allowSelfContributor: true  // Allow user to add themselves as contributor
          });
        }
      }
      
      await destination.save();
      // Populate photos before returning to ensure frontend has complete data
      await destination.populate("photos", "url caption photo_credit photo_credit_url width height");
      return successResponse(res, destination, 'Destination added to favorites', 201);
    } else {
      // Removing from favorites
      destination.users_favorite.splice(idx, 1);

      // Remove contributor permission if not owner or collaborator
      if (!isOwner && !isCollaborator) {
        await enforcer.removePermission({
          resource: destination,
          permissionId: user._id,
          entityType: 'user',
          actorId: user._id,
          reason: 'User un-favorited destination',
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestPath: req.path,
            requestMethod: req.method
          }
        });
      }

      await destination.save();
      // Populate photos before returning to ensure frontend has complete data
      await destination.populate("photos", "url caption photo_credit photo_credit_url width height");
      return successResponse(res, destination, 'Destination removed from favorites');
    }
  } catch (err) {
    backendLogger.error('Error toggling favorite destination', { error: err.message, userId: req.user._id, destinationId: req.params.destinationId });
    return errorResponse(res, err, 'Failed to toggle favorite destination', 400);
  }
}

async function addPhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'Not authorized to modify this destination', 403);
    }

    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return errorResponse(res, null, 'Photo URL is required', 400);
    }

    // Add photo to photos array
    destination.photos.push({
      url,
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url
    });

    await destination.save();

    // Broadcast destination:updated event for photo addition
    try {
      broadcastEvent('destination', destination._id.toString(), {
        type: 'destination:updated',
        payload: {
          destination: destination.toObject(),
          destinationId: destination._id.toString(),
          updatedFields: ['photos'],
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (err) {
      backendLogger.error('Failed to broadcast destination:updated for photo addition', { error: err.message, destinationId: destination._id });
    }

    return successResponse(res, destination, 'Photo added successfully', 201);
  } catch (err) {
    backendLogger.error('Error adding photo to destination', { error: err.message, userId: req.user._id, destinationId: req.params.id, url: req.body.url });
    return errorResponse(res, err, 'Failed to add photo', 400);
  }
}

async function removePhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'Not authorized to modify this destination', 403);
    }

    const photoIndex = parseInt(req.params.photoIndex);

    if (photoIndex < 0 || photoIndex >= destination.photos.length) {
      return errorResponse(res, null, 'Invalid photo index', 400);
    }

    // Remove photo from array
    const removedPhoto = destination.photos[photoIndex];
    destination.photos.splice(photoIndex, 1);

    // Clear default_photo_id if the removed photo was the default
    if (destination.default_photo_id && removedPhoto && destination.default_photo_id.toString() === removedPhoto._id.toString()) {
      destination.default_photo_id = null;
    }

    await destination.save();

    // Broadcast destination:updated event for photo removal
    try {
      broadcastEvent('destination', destination._id.toString(), {
        type: 'destination:updated',
        payload: {
          destination: destination.toObject(),
          destinationId: destination._id.toString(),
          updatedFields: ['photos'],
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (err) {
      backendLogger.error('Failed to broadcast destination:updated for photo removal', { error: err.message, destinationId: destination._id });
    }

    return successResponse(res, destination, 'Photo removed successfully');
  } catch (err) {
    backendLogger.error('Error removing photo from destination', { error: err.message, userId: req.user._id, destinationId: req.params.id, photoIndex: req.params.photoIndex });
    return errorResponse(res, err, 'Failed to remove photo', 400);
  }
}

async function setDefaultPhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'Not authorized to modify this destination', 403);
    }

    const photoIndex = parseInt(req.body.photoIndex);

    if (photoIndex < 0 || photoIndex >= destination.photos.length) {
      return errorResponse(res, null, 'Invalid photo index', 400);
    }

    destination.default_photo_id = destination.photos[photoIndex]._id;
    await destination.save();

    // Broadcast destination:updated event for default photo change
    try {
      broadcastEvent('destination', destination._id.toString(), {
        type: 'destination:updated',
        payload: {
          destination: destination.toObject(),
          destinationId: destination._id.toString(),
          updatedFields: ['default_photo_id'],
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (err) {
      backendLogger.error('Failed to broadcast destination:updated for default photo', { error: err.message, destinationId: destination._id });
    }

    return successResponse(res, destination, 'Default photo set successfully');
  } catch (err) {
    backendLogger.error('Error setting default photo', { error: err.message, userId: req.user._id, destinationId: req.params.id, photoIndex: req.params.photoIndex });
    return errorResponse(res, err, 'Failed to set default photo', 400);
  }
}

// ============================================
// PERMISSION MANAGEMENT FUNCTIONS
// ============================================

/**
 * Add a permission (collaborator/contributor or inherited entity) to a destination
 * POST /api/destinations/:id/permissions
 */
async function addDestinationPermission(req, res) {
  try {
    // Validate destination ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid destination ID format', 400);
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, destination)) {
      return errorResponse(res, null, 'Only the destination owner can manage permissions', 403);
    }

    const { _id, entity, type } = req.body;

    // Validate required fields
    if (!_id || !entity) {
      return errorResponse(res, null, 'Permission must have _id and entity fields', 400);
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return errorResponse(res, null, 'Invalid permission _id format', 400);
    }

    // Validate entity exists
    if (entity === permissions.ENTITY_TYPES.USER) {
      const user = await User.findById(_id);
      if (!user) {
        return errorResponse(res, null, 'User not found', 404);
      }

      // Prevent owner from being added as permission (already has owner role)
      const ownerPermission = destination.permissions.find(p =>
        p.entity === 'user' && p.type === 'owner'
      );
      if (ownerPermission && _id === ownerPermission._id.toString()) {
        return errorResponse(res, null, 'Owner already has full permissions', 400);
      }

      if (!type) {
        return errorResponse(res, null, 'User permissions must have a type field', 400);
      }
    } else if (entity === permissions.ENTITY_TYPES.DESTINATION) {
      const targetDest = await Destination.findById(_id);
      if (!targetDest) {
        return errorResponse(res, null, 'Target destination not found', 404);
      }

      // Check for circular dependency
      const models = { Destination, Experience };
      const wouldBeCircular = await permissions.wouldCreateCircularDependency(
        destination,
        _id,
        entity,
        models
      );

      if (wouldBeCircular) {
        return errorResponse(res, null, 'Cannot add permission: would create circular dependency', 400);
      }
    } else if (entity === permissions.ENTITY_TYPES.EXPERIENCE) {
      const experience = await Experience.findById(_id);
      if (!experience) {
        return errorResponse(res, null, 'Target experience not found', 404);
      }

      // Check for circular dependency
      const models = { Destination, Experience };
      const wouldBeCircular = await permissions.wouldCreateCircularDependency(
        destination,
        _id,
        entity,
        models
      );

      if (wouldBeCircular) {
        return errorResponse(res, null, 'Cannot add permission: would create circular dependency', 400);
      }
    }

    // Add permission using enforcer (SECURE)
    const enforcer = getEnforcer({ Destination, Experience, User });

    const permission = { _id, entity };
    if (type) {
      permission.type = type;
    }

    const result = await enforcer.addPermission({
      resource: destination,
      permission,
      actorId: req.user._id,
      reason: 'Owner added permission via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return errorResponse(res, null, result.error, 400);
    }

    // Permission saved by enforcer, no need to save again

    return successResponse(res, destination, 'Permission added successfully', 201);

  } catch (err) {
    backendLogger.error('Error adding destination permission', { error: err.message, userId: req.user._id, destinationId: req.params.id, entityId: req.body.entityId, entityType: req.body.entityType, type: req.body.type });
    return errorResponse(res, err, 'Failed to add permission', 400);
  }
}

/**
 * Remove a permission from a destination
 * DELETE /api/destinations/:id/permissions/:entityId/:entityType
 */
async function removeDestinationPermission(req, res) {
  try {
    // Validate destination ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid destination ID format', 400);
    }

    // Validate entity ID
    if (!mongoose.Types.ObjectId.isValid(req.params.entityId)) {
      return errorResponse(res, null, 'Invalid entity ID format', 400);
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, destination)) {
      return errorResponse(res, null, 'Only the destination owner can manage permissions', 403);
    }

    const { entityId, entityType } = req.params;

    // Validate entity type
    if (!Object.values(permissions.ENTITY_TYPES).includes(entityType)) {
      return errorResponse(res, null, `Invalid entity type. Must be one of: ${Object.values(permissions.ENTITY_TYPES).join(', ')}`, 400);
    }

    // Remove permission using enforcer (SECURE)
    const enforcer = getEnforcer({ Destination, Experience, User });

    const result = await enforcer.removePermission({
      resource: destination,
      permissionId: entityId,
      entityType,
      actorId: req.user._id,
      reason: 'Owner removed permission via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return errorResponse(res, null, result.error, 400);
    }

    await destination.save();

    return successResponse(res, { removed: result.removed, destination }, 'Permission removed successfully');

  } catch (err) {
    backendLogger.error('Error removing destination permission', { error: err.message, userId: req.user._id, destinationId: req.params.id, entityId: req.params.entityId, entityType: req.params.entityType });
    return errorResponse(res, err, 'Failed to remove permission', 400);
  }
}

/**
 * Update a user permission type (collaborator <-> contributor)
 * PATCH /api/destinations/:id/permissions/:userId
 */
async function updateDestinationPermission(req, res) {
  try {
    // Validate destination ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid destination ID format', 400);
    }

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, destination)) {
      return errorResponse(res, null, 'Only the destination owner can manage permissions', 403);
    }

    const { type } = req.body;

    if (!type) {
      return errorResponse(res, null, 'Permission type is required', 400);
    }

    // Update permission using enforcer (SECURE)
    const enforcer = getEnforcer({ Destination, Experience, User });

    const result = await enforcer.updatePermission({
      resource: destination,
      permissionId: req.params.userId,
      entityType: 'user',
      newType: type,
      actorId: req.user._id,
      reason: 'Owner updated permission type via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return errorResponse(res, null, result.error, 400);
    }

    await destination.save();

    return successResponse(res, destination, 'Permission updated successfully');

  } catch (err) {
    backendLogger.error('Error updating destination permission', { error: err.message, userId: req.user._id, destinationId: req.params.id, userIdParam: req.params.userId, type: req.body.type });
    return errorResponse(res, err, 'Failed to update permission', 400);
  }
}

/**
 * Get all permissions for a destination (with inheritance resolved)
 * GET /api/destinations/:id/permissions
 */
async function getDestinationPermissions(req, res) {
  try {
    // Validate destination ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid destination ID format', 400);
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return errorResponse(res, null, 'Destination not found', 404);
    }

    const models = { Destination, Experience };
    const allPermissions = await permissions.getAllPermissions(destination, models);

    // Get owner information from permissions
    const ownerPermission = destination.permissions.find(p =>
      p.entity === 'user' && p.type === 'owner'
    );

    let ownerInfo = null;
    if (ownerPermission) {
      const ownerUser = await User.findById(ownerPermission._id).select('name');
      if (ownerUser) {
        ownerInfo = {
          userId: ownerPermission._id,
          name: ownerUser.name,
          role: permissions.ROLES.OWNER
        };
      }
    }

    return successResponse(res, {
      owner: ownerInfo,
      permissions: allPermissions,
      directPermissions: destination.permissions || []
    });

  } catch (err) {
    backendLogger.error('Error getting destination permissions', { error: err.message, destinationId: req.params.id });
    return errorResponse(res, err, 'Failed to get permissions', 400);
  }
}

module.exports = {
  create: createDestination,
  show: showDestination,
  update: updateDestination,
  delete: deleteDestination,
  toggleUserFavoriteDestination,
  index,
  addPhoto,
  removePhoto,
  setDefaultPhoto,
  addDestinationPermission,
  removeDestinationPermission,
  updateDestinationPermission,
  getDestinationPermissions,
};
