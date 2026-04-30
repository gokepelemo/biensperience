/**
 * Photo utility functions for handling photo entry arrays: [{ photo, default }]
 * @module photo-utils
 */

const backendLogger = require('./backend-logger');

/**
 * Get the default photo object from a resource.
 * Returns the populated photo object (entry.photo), not the entry wrapper.
 * @param {Object} resource - The resource with photos: [{photo, default}]
 * @returns {Object|null} The default photo object or null if none
 */
function getDefaultPhoto(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }
  // Walk ALL entries in default-first order so an orphaned default entry
  // (photo: null because the underlying Photo doc was deleted) doesn't shadow
  // a perfectly valid non-default entry. This matches frontend's
  // resolveUrlFromUser walk so the two never disagree on resolution.
  const sorted = resource.photos.slice().sort(
    (a, b) => (b?.default ? 1 : 0) - (a?.default ? 1 : 0)
  );
  for (const entry of sorted) {
    if (entry?.photo && typeof entry.photo === 'object' && entry.photo.url) {
      return entry.photo;
    }
  }
  return null;
}

/**
 * Get the index of the default photo entry.
 * @param {Object} resource - The resource with photos
 * @returns {number} The index of the default entry (0 if not found)
 */
function getDefaultPhotoIndex(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return 0;
  }
  const index = resource.photos.findIndex(p => p.default);
  return index !== -1 ? index : 0;
}

/**
 * Get the raw photo entries array for components that need both photo and flag.
 * @param {Object} resource - The resource with photos
 * @returns {Array} The [{photo, default}] array, or empty array
 */
function getPhotoEntries(resource) {
  if (!resource || !resource.photos) return [];
  return resource.photos;
}

/**
 * Set the default photo by photo ID (mutates resource.photos in place).
 * @param {Object} resource - The resource to update
 * @param {string} photoId - The ID of the photo to mark as default
 * @returns {boolean} True if successful, false if photo not found
 */
function setDefaultPhotoById(resource, photoId) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return false;
  }
  const photoIdStr = photoId ? photoId.toString() : null;
  const index = resource.photos.findIndex(p => {
    const entryId = p.photo && p.photo._id ? p.photo._id.toString() : (p.photo ? p.photo.toString() : null);
    return entryId === photoIdStr;
  });
  if (index === -1) {
    backendLogger.warn('Photo ID not found when setting default photo', {
      resourceId: resource._id,
      photoId
    });
    return false;
  }
  resource.photos.forEach((p, i) => { p.default = (i === index); });
  return true;
}

/**
 * Set the default photo by array index (mutates resource.photos in place).
 * @param {Object} resource - The resource to update
 * @param {number} index - The index of the photo entry to mark as default
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
  resource.photos.forEach((p, i) => { p.default = (i === index); });
  return true;
}

/**
 * Ensure exactly one entry has default: true.
 * Call after modifying the photos array.
 * @param {Object} resource - The resource to normalise
 */
function ensureDefaultPhotoConsistency(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return;
  }
  const defaultCount = resource.photos.filter(p => p.default).length;
  if (defaultCount === 0) {
    resource.photos[0].default = true;
  } else if (defaultCount > 1) {
    let found = false;
    for (let i = resource.photos.length - 1; i >= 0; i--) {
      if (resource.photos[i].default && !found) {
        found = true;
      } else {
        resource.photos[i].default = false;
      }
    }
  }
}

/**
 * Remove a photo entry by photo ID and maintain the default invariant.
 * @param {Object} resource - The resource to update
 * @param {string} photoId - The ID of the photo to remove
 * @returns {boolean} True if photo was removed
 */
function removePhoto(resource, photoId) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return false;
  }
  const photoIdStr = photoId ? photoId.toString() : null;
  const index = resource.photos.findIndex(p => {
    const entryId = p.photo && p.photo._id ? p.photo._id.toString() : (p.photo ? p.photo.toString() : null);
    return entryId === photoIdStr;
  });
  if (index === -1) {
    return false;
  }
  resource.photos.splice(index, 1);
  if (resource.photos.length > 0) {
    ensureDefaultPhotoConsistency(resource);
  }
  return true;
}

module.exports = {
  getDefaultPhoto,
  getDefaultPhotoIndex,
  getPhotoEntries,
  setDefaultPhotoById,
  setDefaultPhotoByIndex,
  ensureDefaultPhotoConsistency,
  removePhoto
};
