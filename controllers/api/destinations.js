const mongoose = require('mongoose');
const Destination = require("../../models/destination");
const User = require("../../models/user");
const Experience = require("../../models/experience");
const { findDuplicateFuzzy } = require("../../utilities/fuzzy-match");
const permissions = require("../../utilities/permissions");
const { getEnforcer } = require('../../utilities/permission-enforcer');
const backendLogger = require("../../utilities/backend-logger");

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function index(req, res) {
  try {
    const destinations = await Destination.find({}).populate("photo");
    res.status(200).json(destinations);
  } catch (err) {
    backendLogger.error('Error fetching destinations', { error: err.message });
    res.status(400).json({ error: 'Failed to fetch destinations' });
  }
}

async function createDestination(req, res) {
  try {
    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = ['name', 'country', 'state', 'description', 'photo', 'travel_tips', 'tags'];
    const destinationData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        destinationData[field] = req.body[field];
      }
    });

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
      return res.status(409).json({
        error: 'Duplicate destination',
        message: `A destination with this name and country already exists. Please choose a different destination.`
      });
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
      return res.status(409).json({
        error: 'Similar destination exists',
        message: `A similar destination already exists. Did you mean to use that instead?`
      });
    }

    const destination = await Destination.create(destinationData);
    res.json(destination);
  } catch (err) {
    backendLogger.error('Error creating destination', { error: err.message, userId: req.user._id, name: req.body.name, country: req.body.country });
    res.status(400).json({ error: 'Failed to create destination' });
  }
}

async function showDestination(req, res) {
  try {
    const destination = await Destination.findById(req.params.id).populate(
      "photo"
    );
    res.status(200).json(destination);
  } catch (err) {
    backendLogger.error('Error fetching destination', { error: err.message, destinationId: req.params.id });
    res.status(400).json({ error: 'Failed to fetch destination' });
  }
}

async function updateDestination(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    let destination = await Destination.findById(req.params.id);
    
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    // Check if user has permission to edit using PermissionEnforcer (handles super admin correctly)
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Not authorized to update this destination',
        message: permCheck.reason || 'You must be the owner or a collaborator to edit this destination.'
      });
    }

    // Check for duplicate destination if name or country is being updated
    if ((req.body.name && req.body.name !== destination.name) ||
        (req.body.country && req.body.country !== destination.country)) {
      const checkName = req.body.name || destination.name;
      const checkCountry = req.body.country || destination.country;

      // Check for exact duplicate
      const exactDuplicate = await Destination.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(checkName)}$`, 'i') },
        country: { $regex: new RegExp(`^${escapeRegex(checkCountry)}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (exactDuplicate) {
        return res.status(409).json({
          error: 'Duplicate destination',
          message: `A destination named "${checkName}, ${checkCountry}" already exists. Please choose a different destination.`
        });
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
        return res.status(409).json({
          error: 'Similar destination exists',
          message: `A similar destination "${fuzzyDuplicate.name}, ${fuzzyDuplicate.country}" already exists. Did you mean to use that instead?`
        });
      }
    }

    destination = Object.assign(destination, req.body);
    await destination.save();
    res.status(200).json(destination);
  } catch (err) {
    backendLogger.error('Error updating destination', { error: err.message, userId: req.user._id, destinationId: req.params.id });
    res.status(400).json({ error: 'Failed to update destination' });
  }
}

async function deleteDestination(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    let destination = await Destination.findById(req.params.id);
    
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    // Check if user can delete using PermissionEnforcer (handles super admin correctly)
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canDelete({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Not authorized to delete this destination',
        message: permCheck.reason || 'You must be the owner to delete this destination.'
      });
    }
    
    await destination.deleteOne();
    res.status(200).json({ message: 'Destination deleted successfully', destination });
  } catch (err) {
    backendLogger.error('Error deleting destination', { error: err.message, userId: req.user._id, destinationId: req.params.id });
    res.status(400).json({ error: 'Failed to delete destination' });
  }
}

async function toggleUserFavoriteDestination(req, res) {
  try {
    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(req.params.destinationId)) {
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    let destination = await Destination.findById(req.params.destinationId);
    
    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }
    
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const idx = destination.users_favorite.findIndex(id => id.toString() === user._id.toString());
    const isOwner = permissions.isOwner(user._id, destination);
    
    // Check if user is already a collaborator (includes super admin check)
    const isCollaborator = await permissions.isCollaborator(user._id, destination, { Destination, Experience });
    
    // Get enforcer for secure permission mutations
    const { getEnforcer } = require('../../utilities/permission-enforcer');
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
      res.status(201).json(destination);
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
      res.status(200).json(destination);
    }
  } catch (err) {
    backendLogger.error('Error toggling favorite destination', { error: err.message, userId: req.user._id, destinationId: req.params.destinationId });
    res.status(400).json({ error: 'Failed to toggle favorite destination' });
  }
}

async function addPhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return res.status(401).json({
        error: 'Not authorized to modify this destination',
        message: permCheck.reason
      });
    }

    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    // Add photo to photos array
    destination.photos.push({
      url,
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url
    });

    await destination.save();

    res.status(201).json(destination);
  } catch (err) {
    backendLogger.error('Error adding photo to destination', { error: err.message, userId: req.user._id, destinationId: req.params.id, url: req.body.url });
    res.status(400).json({ error: 'Failed to add photo' });
  }
}

async function removePhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return res.status(401).json({
        error: 'Not authorized to modify this destination',
        message: permCheck.reason
      });
    }

    const photoIndex = parseInt(req.params.photoIndex);

    if (photoIndex < 0 || photoIndex >= destination.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    // Remove photo from array
    destination.photos.splice(photoIndex, 1);

    // Adjust default_photo_index if necessary
    if (destination.default_photo_index >= destination.photos.length) {
      destination.default_photo_index = Math.max(0, destination.photos.length - 1);
    }

    await destination.save();

    res.status(200).json(destination);
  } catch (err) {
    backendLogger.error('Error removing photo from destination', { error: err.message, userId: req.user._id, destinationId: req.params.id, photoIndex: req.params.photoIndex });
    res.status(400).json({ error: 'Failed to remove photo' });
  }
}

async function setDefaultPhoto(req, res) {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: destination
    });

    if (!permCheck.allowed) {
      return res.status(401).json({
        error: 'Not authorized to modify this destination',
        message: permCheck.reason
      });
    }

    const photoIndex = parseInt(req.body.photoIndex);

    if (photoIndex < 0 || photoIndex >= destination.photos.length) {
      return res.status(400).json({ error: 'Invalid photo index' });
    }

    destination.default_photo_index = photoIndex;
    await destination.save();

    res.status(200).json(destination);
  } catch (err) {
    backendLogger.error('Error setting default photo', { error: err.message, userId: req.user._id, destinationId: req.params.id, photoIndex: req.params.photoIndex });
    res.status(400).json({ error: 'Failed to set default photo' });
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
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, destination)) {
      return res.status(401).json({ error: 'Only the destination owner can manage permissions' });
    }

    const { _id, entity, type } = req.body;

    // Validate required fields
    if (!_id || !entity) {
      return res.status(400).json({ error: 'Permission must have _id and entity fields' });
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ error: 'Invalid permission _id format' });
    }

    // Validate entity exists
    if (entity === permissions.ENTITY_TYPES.USER) {
      const user = await User.findById(_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent owner from being added as permission (already has owner role)
      const ownerPermission = destination.permissions.find(p =>
        p.entity === 'user' && p.type === 'owner'
      );
      if (ownerPermission && _id === ownerPermission._id.toString()) {
        return res.status(400).json({ error: 'Owner already has full permissions' });
      }

      if (!type) {
        return res.status(400).json({ error: 'User permissions must have a type field' });
      }
    } else if (entity === permissions.ENTITY_TYPES.DESTINATION) {
      const targetDest = await Destination.findById(_id);
      if (!targetDest) {
        return res.status(404).json({ error: 'Target destination not found' });
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
        return res.status(400).json({ 
          error: 'Cannot add permission: would create circular dependency' 
        });
      }
    } else if (entity === permissions.ENTITY_TYPES.EXPERIENCE) {
      const experience = await Experience.findById(_id);
      if (!experience) {
        return res.status(404).json({ error: 'Target experience not found' });
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
        return res.status(400).json({ 
          error: 'Cannot add permission: would create circular dependency' 
        });
      }
    }

    // Add permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
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
      return res.status(400).json({ error: result.error });
    }

    // Permission saved by enforcer, no need to save again

    res.status(201).json({
      message: 'Permission added successfully',
      destination
    });

  } catch (err) {
    backendLogger.error('Error adding destination permission', { error: err.message, userId: req.user._id, destinationId: req.params.id, entityId: req.body.entityId, entityType: req.body.entityType, type: req.body.type });
    res.status(400).json({ error: 'Failed to add permission' });
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
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    // Validate entity ID
    if (!mongoose.Types.ObjectId.isValid(req.params.entityId)) {
      return res.status(400).json({ error: 'Invalid entity ID format' });
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, destination)) {
      return res.status(401).json({ error: 'Only the destination owner can manage permissions' });
    }

    const { entityId, entityType } = req.params;

    // Validate entity type
    if (!Object.values(permissions.ENTITY_TYPES).includes(entityType)) {
      return res.status(400).json({ 
        error: `Invalid entity type. Must be one of: ${Object.values(permissions.ENTITY_TYPES).join(', ')}` 
      });
    }

    // Remove permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
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
      return res.status(400).json({ error: result.error });
    }

    await destination.save();

    res.status(200).json({
      message: 'Permission removed successfully',
      removed: result.removed,
      destination
    });

  } catch (err) {
    backendLogger.error('Error removing destination permission', { error: err.message, userId: req.user._id, destinationId: req.params.id, entityId: req.params.entityId, entityType: req.params.entityType });
    res.status(400).json({ error: 'Failed to remove permission' });
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
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, destination)) {
      return res.status(401).json({ error: 'Only the destination owner can manage permissions' });
    }

    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Permission type is required' });
    }

    // Update permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
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
      return res.status(400).json({ error: result.error });
    }

    await destination.save();

    res.status(200).json({
      message: 'Permission updated successfully',
      destination
    });

  } catch (err) {
    backendLogger.error('Error updating destination permission', { error: err.message, userId: req.user._id, destinationId: req.params.id, userIdParam: req.params.userId, type: req.body.type });
    res.status(400).json({ error: 'Failed to update permission' });
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
      return res.status(400).json({ error: 'Invalid destination ID format' });
    }

    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
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

    res.status(200).json({
      owner: ownerInfo,
      permissions: allPermissions,
      directPermissions: destination.permissions || []
    });

  } catch (err) {
    backendLogger.error('Error getting destination permissions', { error: err.message, destinationId: req.params.id });
    res.status(400).json({ error: 'Failed to get permissions' });
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
