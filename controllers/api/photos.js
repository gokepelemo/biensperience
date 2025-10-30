const mongoose = require('mongoose');
const Photo = require("../../models/photo");
const User = require("../../models/user");
const { s3Upload, s3Delete } = require("../../uploads/aws-s3-upload");
const { getEnforcer } = require("../../utilities/permission-enforcer");
const backendLogger = require("../../utilities/backend-logger");
const fs = require("fs");
const path = require("path");

async function createPhoto(req, res) {
  let rand = Math.ceil(Math.random() * 500);
  try {
    // Populate both user field (legacy) and permissions array (new)
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
      return res.status(400).json({ error: 'No file uploaded' });
    }

    s3Upload(
      req.file.path,
      req.file.originalname,
      `${rand}-${req.body.name ? req.body.name : "Biensperience"}`
    )
      .then((response) => {
        // S3 upload successful
        return Photo.create({
          photo_credit: req.body.photo_credit,
          photo_credit_url: req.body.photo_credit_url,
          url: response.Location,
          permissions: [{
            _id: req.user._id,
            entity: 'user',
            type: 'owner',
            granted_by: req.user._id
          }]
        });
      })
      .then((upload) => {
        res.status(201).json({ upload: upload.toObject() });
      })
      .catch((error) => {
        backendLogger.error("Photo upload error", { error: error.message, userId: req.user._id });
        res.status(500).json({ error: 'Failed to upload photo' });
      });
  } catch (err) {
    backendLogger.error("Photo creation error", { error: err.message, userId: req.user._id });
    res.status(400).json({ error: 'Failed to create photo' });
  }
}

async function updatePhoto(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    let photo = await Photo.findById(req.params.id).populate("user");
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    
    // Check if user can edit using PermissionEnforcer
    const enforcer = getEnforcer({ Photo, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: photo
    });

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Not authorized to update this photo',
        message: permCheck.reason
      });
    }
    photo = Object.assign(photo, req.body);
    await photo.save();
    return res.status(200).json(photo);
  } catch (err) {
    backendLogger.error('Update photo error', { error: err.message, userId: req.user._id, photoId: req.params.id });
    res.status(400).json({ error: 'Failed to update photo' });
  }
}

async function deletePhoto(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    const photo = await Photo.findById(req.params.id).populate("user");
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
      return res.status(403).json({
        error: 'Not authorized to delete this photo',
        message: permCheck.reason
      });
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
    await photo.deleteOne();
    // Photo deleted from database successfully
    
    return res.status(200).json({ message: 'Photo deleted successfully' });
  } catch (err) {
    backendLogger.error('Delete photo error', { error: err.message, userId: req.user._id, photoId: req.params.id });
    res.status(400).json({ error: 'Failed to delete photo' });
  }
}

async function createPhotoFromUrl(req, res) {
  try {
    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Photo URL is required' });
    }

    const photo = await Photo.create({
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url,
      url: url,
      permissions: [{
        _id: req.user._id,
        entity: 'user',
        type: 'owner',
        granted_by: req.user._id
      }]
    });

    res.status(201).json({ upload: photo.toObject() });
  } catch (err) {
    backendLogger.error("Photo URL creation error", { error: err.message, userId: req.user._id, url: req.body.url });
    res.status(400).json({ error: 'Failed to create photo from URL' });
  }
}

async function createPhotoBatch(req, res) {
  try {
    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadPromises = req.files.map((file, index) => {
      const rand = Math.ceil(Math.random() * 500);
      const name = req.body.name || "Biensperience";
      
      return s3Upload(
        file.path,
        file.originalname,
        `${rand}-${name}-${index}`
      )
        .then((response) => {
          return Photo.create({
            photo_credit: req.body.photo_credit || 'Biensperience',
            photo_credit_url: req.body.photo_credit_url || '',
            url: response.Location,
            permissions: [{
              _id: req.user._id,
              entity: 'user',
              type: 'owner',
              granted_by: req.user._id
            }]
          });
        });
    });

    const photos = await Promise.all(uploadPromises);
    const photoObjects = photos.map(photo => photo.toObject());
    
    res.status(201).json({ uploads: photoObjects });
  } catch (err) {
    backendLogger.error("Batch photo upload error", { error: err.message, userId: req.user._id, fileCount: req.files?.length });
    res.status(500).json({ error: 'Failed to upload photos' });
  }
}

/**
 * Add a collaborator to a photo
 */
async function addCollaborator(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Only owners can manage permissions
    const enforcer = getEnforcer({ Photo, User });
    const permCheck = await enforcer.canManagePermissions({
      userId: req.user._id,
      resource: photo
    });

    if (!permCheck.allowed) {
      return res.status(403).json({
        error: 'Only owners can add collaborators',
        message: permCheck.reason
      });
    }

    // Check if user already has a permission
    const existingPermission = photo.permissions?.find(p =>
      p.entity === 'user' && p._id.toString() === req.body.userId
    );

    if (existingPermission) {
      return res.status(400).json({ error: 'User already has permission on this photo' });
    }

    // Add collaborator permission
    if (!photo.permissions) {
      photo.permissions = [];
    }

    photo.permissions.push({
      _id: req.body.userId,
      entity: 'user',
      type: 'collaborator',
      granted_by: req.user._id
    });

    await photo.save();
    res.json({ message: 'Collaborator added successfully', photo });
  } catch (err) {
    backendLogger.error('Add collaborator error', { error: err.message, userId: req.user._id, photoId: req.params.id, collaboratorId: req.body.userId });
    res.status(500).json({ error: 'Failed to add collaborator' });
  }
}

/**
 * Remove a collaborator from a photo
 */
async function removeCollaborator(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Only owners can remove collaborators
    if (!isOwner(req.user._id, photo)) {
      return res.status(403).json({ error: 'Only owners can remove collaborators' });
    }

    // Find and remove the permission
    const permissionIndex = photo.permissions?.findIndex(p =>
      p.entity === 'user' &&
      p._id.toString() === req.params.userId &&
      p.type === 'collaborator'
    );

    if (permissionIndex === -1 || permissionIndex === undefined) {
      return res.status(404).json({ error: 'Collaborator not found' });
    }

    photo.permissions.splice(permissionIndex, 1);
    await photo.save();

    res.json({ message: 'Collaborator removed successfully', photo });
  } catch (err) {
    backendLogger.error('Remove collaborator error', { error: err.message, userId: req.user._id, photoId: req.params.id, collaboratorId: req.params.userId });
    res.status(500).json({ error: 'Failed to remove collaborator' });
  }
}

/**
 * Add a contributor to a photo
 */
async function addContributor(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Only owners can add contributors
    if (!isOwner(req.user._id, photo)) {
      return res.status(403).json({ error: 'Only owners can add contributors' });
    }

    // Check if user already has a permission
    const existingPermission = photo.permissions?.find(p =>
      p.entity === 'user' && p._id.toString() === req.body.userId
    );

    if (existingPermission) {
      return res.status(400).json({ error: 'User already has permission on this photo' });
    }

    // Add contributor permission
    if (!photo.permissions) {
      photo.permissions = [];
    }

    photo.permissions.push({
      _id: req.body.userId,
      entity: 'user',
      type: 'contributor',
      granted_by: req.user._id
    });

    await photo.save();
    res.json({ message: 'Contributor added successfully', photo });
  } catch (err) {
    backendLogger.error('Add contributor error', { error: err.message, userId: req.user._id, photoId: req.params.id, contributorId: req.params.userId });
    res.status(500).json({ error: 'Failed to add contributor' });
  }
}

/**
 * Remove a contributor from a photo
 */
async function removeContributor(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid photo ID format' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const photo = await Photo.findById(req.params.id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Only owners can remove contributors
    if (!isOwner(req.user._id, photo)) {
      return res.status(403).json({ error: 'Only owners can remove contributors' });
    }

    // Find and remove the permission
    const permissionIndex = photo.permissions?.findIndex(p =>
      p.entity === 'user' &&
      p._id.toString() === req.params.userId &&
      p.type === 'contributor'
    );

    if (permissionIndex === -1 || permissionIndex === undefined) {
      return res.status(404).json({ error: 'Contributor not found' });
    }

    photo.permissions.splice(permissionIndex, 1);
    await photo.save();

    res.json({ message: 'Contributor removed successfully', photo });
  } catch (err) {
    backendLogger.error('Remove contributor error', { error: err.message, userId: req.user._id, photoId: req.params.id, contributorId: req.params.userId });
    res.status(500).json({ error: 'Failed to remove contributor' });
  }
}

module.exports = {
  create: createPhoto,
  createBatch: createPhotoBatch,
  createFromUrl: createPhotoFromUrl,
  delete: deletePhoto,
  update: updatePhoto,
  addCollaborator,
  removeCollaborator,
  addContributor,
  removeContributor
};
