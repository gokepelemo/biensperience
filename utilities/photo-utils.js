/**
 * Photo utility functions for handling photo arrays with ID-based operations
 * @module photo-utils
 */

const backendLogger = require('./backend-logger');

/**
 * Get the default photo from a resource
 * Supports both new ID-based and legacy index-based selection
 * @param {Object} resource - The resource (destination, experience, or user) with photos
 * @returns {Object|null} The default photo object or null if none found
 */
function getDefaultPhoto(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }

  // Use ID-based selection
  if (resource.default_photo_id) {
    const photo = resource.photos.find(p => p._id && p._id.toString() === resource.default_photo_id.toString());
    if (photo) {
      return photo;
    }
    backendLogger.warn('Default photo ID not found in photos array', {
      resourceId: resource._id,
      default_photo_id: resource.default_photo_id
    });
  }

  // Return first photo as fallback
  return resource.photos[0];
}

/**
 * Get the index of the default photo
 * @param {Object} resource - The resource with photos
 * @returns {number} The index of the default photo (0 if not found)
 */
function getDefaultPhotoIndex(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return 0;
  }

  // Use ID-based lookup
  if (resource.default_photo_id) {
    const index = resource.photos.findIndex(p => p._id && p._id.toString() === resource.default_photo_id.toString());
    if (index !== -1) {
      return index;
    }
  }

  // Return 0 as fallback
  return 0;
}

/**
 * Set the default photo by ID
 * @param {Object} resource - The resource to update
 * @param {string} photoId - The ID of the photo to set as default
 * @returns {boolean} True if successful, false if photo not found
 */
function setDefaultPhotoById(resource, photoId) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return false;
  }

  const index = resource.photos.findIndex(p => p._id && p._id.toString() === photoId.toString());

  if (index === -1) {
    backendLogger.warn('Photo ID not found when setting default photo', {
      resourceId: resource._id,
      photoId
    });
    return false;
  }

  resource.default_photo_id = photoId;

  return true;
}

/**
 * Set the default photo by index
 * @param {Object} resource - The resource to update
 * @param {number} index - The index of the photo to set as default
 * @returns {boolean} True if successful, false if index out of bounds
 */
function setDefaultPhotoByIndex(resource, index) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return false;
  }

  if (index < 0 || index >= resource.photos.length) {
    backendLogger.warn('Photo index out of bounds when setting default photo', {
      resourceId: resource._id,
      index,
      photosLength: resource.photos.length
    });
    return false;
  }

  const photo = resource.photos[index];
  resource.default_photo_id = photo._id;

  return true;
}

/**
 * Ensure default photo ID is set correctly
 * Call this after modifying photos array to maintain consistency
 * @param {Object} resource - The resource to check and fix
 */
function ensureDefaultPhotoConsistency(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    resource.default_photo_id = null;
    return;
  }

  // If default_photo_id exists and is valid, keep it
  if (resource.default_photo_id) {
    const index = resource.photos.findIndex(p => p._id && p._id.toString() === resource.default_photo_id.toString());
    if (index !== -1) {
      return;
    }
    // ID not found, clear it
    resource.default_photo_id = null;
  }

  // Set to first photo's ID
  resource.default_photo_id = resource.photos[0]._id;
}

/**
 * Remove a photo and update default photo if necessary
 * @param {Object} resource - The resource to update
 * @param {string} photoId - The ID of the photo to remove
 * @returns {boolean} True if photo was removed
 */
function removePhoto(resource, photoId) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return false;
  }

  const index = resource.photos.findIndex(p => p._id && p._id.toString() === photoId.toString());

  if (index === -1) {
    return false;
  }

  // Remove the photo
  resource.photos.splice(index, 1);

  // If we removed the default photo or it's now invalid, set a new default
  if (resource.photos.length > 0) {
    ensureDefaultPhotoConsistency(resource);
  } else {
    resource.default_photo_id = null;
  }

  return true;
}

module.exports = {
  getDefaultPhoto,
  getDefaultPhotoIndex,
  setDefaultPhotoById,
  setDefaultPhotoByIndex,
  ensureDefaultPhotoConsistency,
  removePhoto
};
