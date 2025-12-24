const mongoose = require('mongoose');
const Photo = require("../../models/photo");
const User = require("../../models/user");
const { s3Upload, s3Delete } = require("../../uploads/aws-s3");
const { getEnforcer } = require("../../utilities/permission-enforcer");
const { isOwner } = require("../../utilities/permissions");
const { successResponse, errorResponse, validateObjectId } = require("../../utilities/controller-helpers");
const { broadcastEvent } = require('../../utilities/websocket-server');
const backendLogger = require("../../utilities/backend-logger");
const fs = require("fs");
const path = require("path");

async function createPhoto(req, res) {
  let rand = Math.ceil(Math.random() * 500);
  try {
    // Set owner
    req.body.user = req.user._id;
    req.body.permissions = [{
      _id: req.user._id,
      entity: 'user',
      type: 'owner',
      granted_by: req.user._id
    }];
    req.body.photo_credit = req.body.photo_credit
      ? req.body.photo_credit
      : "Biensperience";

    // Check if file exists
    if (!req.file) {
      return errorResponse(res, null, 'No file uploaded', 400);
    }

    // S3 prefix: photos/ for photos uploaded to entities
    const photoName = req.body.name ? req.body.name : "Biensperience";
    s3Upload(
      req.file.path,
      req.file.originalname,
      `photos/${rand}-${photoName}`
    )
      .then((response) => {
        // S3 upload successful
        const photoData = {
          photo_credit: req.body.photo_credit,
          photo_credit_url: req.body.photo_credit_url,
          url: response.Location,
          permissions: [{
            _id: req.user._id,
            entity: 'user',
            type: 'owner',
            granted_by: req.user._id
          }]
        };

        // Add dimensions if provided (for layout shift prevention)
        if (req.body.width && parseInt(req.body.width) > 0) {
          photoData.width = parseInt(req.body.width);
        }
        if (req.body.height && parseInt(req.body.height) > 0) {
          photoData.height = parseInt(req.body.height);
        }

        return Photo.create(photoData);
      })
      .then((upload) => {
        // Broadcast photo:created event
        try {
          broadcastEvent('photo', upload._id.toString(), {
            type: 'photo:created',
            payload: { photo: upload.toObject() }
          });
        } catch (err) {
          backendLogger.error('Failed to broadcast photo:created event', { error: err.message, photoId: upload._id });
        }
        return successResponse(res, upload.toObject(), 'Photo uploaded successfully', 201);
      })
      .catch((error) => {
        backendLogger.error("Photo upload error", { error: error.message, userId: req.user._id });
        return errorResponse(res, error, 'Failed to upload photo', 500);
      });
  } catch (err) {
    backendLogger.error("Photo creation error", { error: err.message, userId: req.user._id });
    return errorResponse(res, err, 'Failed to create photo', 400);
  }
}

async function updatePhoto(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    let photo = await Photo.findById(req.params.id);
    if (!photo) {
      return errorResponse(res, null, 'Photo not found', 404);
    }
    
    // Check if user can edit using PermissionEnforcer
    const enforcer = getEnforcer({ Photo, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: photo
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, 'Not authorized to update this photo', 403);
    }

    // Update only allowed fields (prevent modification of permissions via this endpoint)
    const allowedFields = ['caption', 'photo_credit', 'photo_credit_url'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        photo[field] = req.body[field];
      }
    });

    await photo.save();
    
    // Broadcast photo:updated event
    try {
      broadcastEvent('photo', photo._id.toString(), {
        type: 'photo:updated',
        payload: { photo: photo.toObject() }
      });
    } catch (err) {
      backendLogger.error('Failed to broadcast photo:updated event', { error: err.message, photoId: photo._id });
    }
    
    return successResponse(res, photo, 'Photo updated successfully');
  } catch (err) {
    backendLogger.error('Update photo error', {
      error: err.message,
      stack: err.stack,
      userId: req.user._id,
      photoId: req.params.id,
      validationErrors: err.errors
    });
    return errorResponse(res, err, 'Failed to update photo', 400);
  }
}

async function deletePhoto(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Check if user can delete using PermissionEnforcer
    const enforcer = getEnforcer({ Photo, User });
    const permCheck = await enforcer.canDelete({
      userId: req.user._id,
      resource: photo
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, 'Not authorized to delete this photo', 403);
    }

    // Delete from S3 if the photo URL is an S3 URL
    // Use proper URL parsing to check hostname (prevents URL injection attacks)
    if (photo.url) {
      try {
        const urlObj = new URL(photo.url);
        // Check if hostname ends with amazonaws.com (handles subdomains like s3.amazonaws.com)
        if (urlObj.hostname.endsWith('.amazonaws.com') || urlObj.hostname === 'amazonaws.com') {
          try {
            await s3Delete(photo.url);
            // Photo deleted from S3 successfully
          } catch (s3Error) {
            backendLogger.error('Failed to delete from S3', { error: s3Error.message, userId: req.user._id, photoId: req.params.id, photoUrl: photo.url });
            // Continue with database deletion even if S3 deletion fails
          }
        }
      } catch (urlError) {
        // Invalid URL format - skip S3 deletion, continue with database deletion
        backendLogger.error('Invalid URL format', { error: urlError.message, userId: req.user._id, photoId: req.params.id, photoUrl: photo.url });
      }
    }

    // Delete local file if it exists (for photos that were uploaded but not yet moved to S3)
    // Extract filename from URL or use s3_key if available
    if (photo.s3_key || photo.url) {
      try {
        // Try to find local file in uploads/images directory
        const filename = photo.s3_key || path.basename(new URL(photo.url).pathname);
        const localPath = path.join(__dirname, '../../uploads/images', filename);
        
        // Check if file exists before attempting deletion
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          // Local file deleted successfully
        }
      } catch (fsError) {
        backendLogger.error('Failed to delete local file', { error: fsError.message, userId: req.user._id, photoId: req.params.id, filename: photo.s3_key || path.basename(new URL(photo.url).pathname) });
        // Continue with database deletion even if file deletion fails
      }
    }

    // Delete from database
    const photoId = photo._id.toString();
    await photo.deleteOne();
    // Photo deleted from database successfully
    
    // Broadcast photo:deleted event
    try {
      broadcastEvent('photo', photoId, {
        type: 'photo:deleted',
        payload: { photoId }
      });
    } catch (err) {
      backendLogger.error('Failed to broadcast photo:deleted event', { error: err.message, photoId });
    }
    
    return successResponse(res, null, 'Photo deleted successfully');
  } catch (err) {
    backendLogger.error('Delete photo error', { error: err.message, userId: req.user._id, photoId: req.params.id });
    return errorResponse(res, err, 'Failed to delete photo', 400);
  }
}

async function createPhotoFromUrl(req, res) {
  try {
    const { url, photo_credit, photo_credit_url, width, height } = req.body;

    if (!url) {
      return errorResponse(res, null, 'Photo URL is required', 400);
    }

    const photoData = {
      photo_credit: photo_credit || 'Biensperience',
      photo_credit_url: photo_credit_url || url,
      url: url,
      permissions: [{
        _id: req.user._id,
        entity: 'user',
        type: 'owner',
        granted_by: req.user._id
      }]
    };

    // Add dimensions if provided (for layout shift prevention)
    if (width && typeof width === 'number' && width > 0) {
      photoData.width = width;
    }
    if (height && typeof height === 'number' && height > 0) {
      photoData.height = height;
    }

    const photo = await Photo.create(photoData);

    return successResponse(res, photo.toObject(), 'Photo created from URL successfully', 201);
  } catch (err) {
    backendLogger.error("Photo URL creation error", { error: err.message, userId: req.user._id, url: req.body.url });
    return errorResponse(res, err, 'Failed to create photo from URL', 400);
  }
}

async function createPhotoBatch(req, res) {
  try {
    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, null, 'No files uploaded', 400);
    }

    // Parse dimensions array if provided (sent as JSON string from frontend)
    let dimensionsArray = [];
    if (req.body.dimensions) {
      try {
        dimensionsArray = JSON.parse(req.body.dimensions);
      } catch (parseErr) {
        backendLogger.warn("Failed to parse dimensions JSON", { error: parseErr.message });
      }
    }

    const uploadPromises = req.files.map((file, index) => {
      const rand = Math.ceil(Math.random() * 500);
      const name = req.body.name || "Biensperience";
      const fileDimensions = dimensionsArray[index] || {};

      // S3 prefix: photos/ for photos uploaded to entities
      return s3Upload(
        file.path,
        file.originalname,
        `photos/${rand}-${name}-${index}`
      )
        .then((response) => {
          const photoData = {
            photo_credit: req.body.photo_credit || 'Biensperience',
            photo_credit_url: req.body.photo_credit_url || '',
            url: response.Location,
            permissions: [{
              _id: req.user._id,
              entity: 'user',
              type: 'owner',
              granted_by: req.user._id
            }]
          };

          // Add dimensions if available (for layout shift prevention)
          if (fileDimensions.width && fileDimensions.width > 0) {
            photoData.width = fileDimensions.width;
          }
          if (fileDimensions.height && fileDimensions.height > 0) {
            photoData.height = fileDimensions.height;
          }

          return Photo.create(photoData);
        });
    });

    const photos = await Promise.all(uploadPromises);
    const photoObjects = photos.map(photo => photo.toObject());

    return successResponse(res, photoObjects, 'Batch photo upload successful', 201);
  } catch (err) {
    backendLogger.error("Batch photo upload error", { error: err.message, userId: req.user._id, fileCount: req.files?.length });
    return errorResponse(res, err, 'Failed to upload photos', 500);
  }
}

/**
 * Get photos by array of IDs
 * POST /api/photos/batch-get
 * Body: { ids: ['id1', 'id2', ...] }
 */
async function getPhotosByIds(req, res) {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, null, 'Photo IDs array is required', 400);
    }

    // Validate all IDs
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return successResponse(res, [], 'No valid photo IDs provided');
    }

    // Limit to prevent abuse
    if (validIds.length > 50) {
      return errorResponse(res, null, 'Maximum 50 photos can be fetched at once', 400);
    }

    // Fetch photos
    const photos = await Photo.find({
      _id: { $in: validIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    // Maintain original order
    const photoMap = new Map(photos.map(p => [p._id.toString(), p]));
    const orderedPhotos = validIds
      .map(id => photoMap.get(id))
      .filter(Boolean);

    return successResponse(res, orderedPhotos, 'Photos fetched successfully');
  } catch (err) {
    backendLogger.error('Get photos by IDs error', { error: err.message, userId: req.user?._id, idsCount: req.body.ids?.length });
    return errorResponse(res, err, 'Failed to fetch photos', 500);
  }
}

/**
 * Add a collaborator to a photo
 */
async function addCollaborator(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid photo ID format', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return errorResponse(res, null, 'Photo not found', 404);
    }

    // Only owners can manage permissions
    const enforcer = getEnforcer({ Photo, User });
    const permCheck = await enforcer.canManagePermissions({
      userId: req.user._id,
      resource: photo
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, 'Only owners can add collaborators', 403);
    }

    // Check if user already has a permission
    const existingPermission = photo.permissions?.find(p =>
      p.entity === 'user' && p._id.toString() === req.body.userId
    );

    if (existingPermission) {
      return errorResponse(res, null, 'User already has permission on this photo', 400);
    }

    // Add collaborator permission using enforcer (SECURE)
    if (!photo.permissions) {
      photo.permissions = [];
    }

    const result = await enforcer.addPermission({
      resource: photo,
      permission: {
        _id: req.body.userId,
        entity: 'user',
        type: 'collaborator'
      },
      actorId: req.user._id,
      reason: 'Collaborator added by photo owner',
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
    return successResponse(res, photo, 'Collaborator added successfully');
  } catch (err) {
    backendLogger.error('Add collaborator error', { error: err.message, userId: req.user._id, photoId: req.params.id, collaboratorId: req.body.userId });
    return errorResponse(res, err, 'Failed to add collaborator', 500);
  }
}

/**
 * Remove a collaborator from a photo
 */
async function removeCollaborator(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid photo ID format', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return errorResponse(res, null, 'Photo not found', 404);
    }

    // Only owners can remove collaborators
    if (!isOwner(req.user._id, photo)) {
      return errorResponse(res, null, 'Only owners can remove collaborators', 403);
    }

    // Find the permission
    const permissionIndex = photo.permissions?.findIndex(p =>
      p.entity === 'user' &&
      p._id.toString() === req.params.userId &&
      p.type === 'collaborator'
    );

    if (permissionIndex === -1 || permissionIndex === undefined) {
      return errorResponse(res, null, 'Collaborator not found', 404);
    }

    // Remove permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Photo, User });

    const result = await enforcer.removePermission({
      resource: photo,
      permissionId: req.params.userId,
      entityType: 'user',
      actorId: req.user._id,
      reason: 'Collaborator removed by photo owner',
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

    await photo.save();

    return successResponse(res, photo, 'Collaborator removed successfully');
  } catch (err) {
    backendLogger.error('Remove collaborator error', { error: err.message, userId: req.user._id, photoId: req.params.id, collaboratorId: req.params.userId });
    return errorResponse(res, err, 'Failed to remove collaborator', 500);
  }
}

/**
 * Add a contributor to a photo
 */
async function addContributor(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid photo ID format', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return errorResponse(res, null, 'Photo not found', 404);
    }

    // Only owners can add contributors
    if (!isOwner(req.user._id, photo)) {
      return errorResponse(res, null, 'Only owners can add contributors', 403);
    }

    // Check if user already has a permission
    const existingPermission = photo.permissions?.find(p =>
      p.entity === 'user' && p._id.toString() === req.body.userId
    );

    if (existingPermission) {
      return errorResponse(res, null, 'User already has permission on this photo', 400);
    }

    // Add contributor permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Photo, User });

    if (!photo.permissions) {
      photo.permissions = [];
    }

    const result = await enforcer.addPermission({
      resource: photo,
      permission: {
        _id: req.body.userId,
        entity: 'user',
        type: 'contributor'
      },
      actorId: req.user._id,
      reason: 'Contributor added by photo owner',
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
    return successResponse(res, photo, 'Contributor added successfully');
  } catch (err) {
    backendLogger.error('Add contributor error', { error: err.message, userId: req.user._id, photoId: req.params.id, contributorId: req.params.userId });
    return errorResponse(res, err, 'Failed to add contributor', 500);
  }
}

/**
 * Remove a contributor from a photo
 */
async function removeContributor(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid photo ID format', 400);
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return errorResponse(res, null, 'Photo not found', 404);
    }

    // Only owners can remove contributors
    if (!isOwner(req.user._id, photo)) {
      return errorResponse(res, null, 'Only owners can remove contributors', 403);
    }

    // Find the permission
    const permissionIndex = photo.permissions?.findIndex(p =>
      p.entity === 'user' &&
      p._id.toString() === req.params.userId &&
      p.type === 'contributor'
    );

    if (permissionIndex === -1 || permissionIndex === undefined) {
      return errorResponse(res, null, 'Contributor not found', 404);
    }

    // Remove permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Photo, User });

    const result = await enforcer.removePermission({
      resource: photo,
      permissionId: req.params.userId,
      entityType: 'user',
      actorId: req.user._id,
      reason: 'Contributor removed by photo owner',
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

    await photo.save();

    return successResponse(res, photo, 'Contributor removed successfully');
  } catch (err) {
    backendLogger.error('Remove contributor error', { error: err.message, userId: req.user._id, photoId: req.params.id, contributorId: req.params.userId });
    return errorResponse(res, err, 'Failed to remove contributor', 500);
  }
}

module.exports = {
  create: createPhoto,
  createBatch: createPhotoBatch,
  createFromUrl: createPhotoFromUrl,
  delete: deletePhoto,
  update: updatePhoto,
  getByIds: getPhotosByIds,
  addCollaborator,
  removeCollaborator,
  addContributor,
  removeContributor
};
