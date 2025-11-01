/**
 * Photo utility functions for handling photo arrays with ID-based operations
 * @module photo-utils
 */

import { logger } from './logger';

/**
 * Get the default photo from a resource
 * @param {Object} resource - The resource (destination, experience, or user) with photos
 * @returns {Object|null} The default photo object or null if none found
 */
export function getDefaultPhoto(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }

  // Try ID-based selection first
  if (resource.default_photo_id) {
    const photo = resource.photos.find(p => p._id && p._id.toString() === resource.default_photo_id.toString());
    if (photo) {
      return photo;
    }
    logger.warn('Default photo ID not found in photos array, falling back to index', {
      resourceId: resource._id,
      default_photo_id: resource.default_photo_id
    });
  }

  // Fall back to index-based selection
  const index = resource.default_photo_index || 0;
  if (index >= 0 && index < resource.photos.length) {
    return resource.photos[index];
  }

  // If index is out of bounds, return first photo
  return resource.photos[0];
}

/**
 * Get the index of the default photo
 * @param {Object} resource - The resource with photos
 * @returns {number} The index of the default photo (0 if not found)
 */
export function getDefaultPhotoIndex(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return 0;
  }

  // Try ID-based lookup first
  if (resource.default_photo_id) {
    const index = resource.photos.findIndex(p => p._id && p._id.toString() === resource.default_photo_id.toString());
    if (index !== -1) {
      return index;
    }
  }

  // Fall back to stored index
  const index = resource.default_photo_index || 0;
  return Math.min(Math.max(0, index), resource.photos.length - 1);
}

/**
 * Get the photo ID from a photo object
 * @param {Object} photo - The photo object
 * @returns {string|null} The photo ID or null
 */
export function getPhotoId(photo) {
  if (!photo) return null;
  return photo._id ? photo._id.toString() : null;
}

/**
 * Find photo by ID in photos array
 * @param {Array} photos - Array of photo objects
 * @param {string} photoId - The ID to find
 * @returns {Object|null} The photo object or null
 */
export function findPhotoById(photos, photoId) {
  if (!photos || !Array.isArray(photos) || !photoId) {
    return null;
  }
  return photos.find(p => p._id && p._id.toString() === photoId.toString()) || null;
}

/**
 * Get the index of a photo by ID
 * @param {Array} photos - Array of photo objects
 * @param {string} photoId - The ID to find
 * @returns {number} The index or -1 if not found
 */
export function getPhotoIndexById(photos, photoId) {
  if (!photos || !Array.isArray(photos) || !photoId) {
    return -1;
  }
  return photos.findIndex(p => p._id && p._id.toString() === photoId.toString());
}

/**
 * Set the default photo by ID
 * Returns updated resource object (immutable)
 * @param {Object} resource - The resource to update
 * @param {string} photoId - The ID of the photo to set as default
 * @returns {Object|null} Updated resource or null if photo not found
 */
export function setDefaultPhotoById(resource, photoId) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }

  const index = getPhotoIndexById(resource.photos, photoId);

  if (index === -1) {
    logger.warn('Photo ID not found when setting default photo', {
      resourceId: resource._id,
      photoId
    });
    return null;
  }

  return {
    ...resource,
    default_photo_id: photoId,
    default_photo_index: index
  };
}

/**
 * Set the default photo by index
 * Returns updated resource object (immutable)
 * @param {Object} resource - The resource to update
 * @param {number} index - The index of the photo to set as default
 * @returns {Object|null} Updated resource or null if index out of bounds
 */
export function setDefaultPhotoByIndex(resource, index) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }

  if (index < 0 || index >= resource.photos.length) {
    logger.warn('Photo index out of bounds when setting default photo', {
      resourceId: resource._id,
      index,
      photosLength: resource.photos.length
    });
    return null;
  }

  const photo = resource.photos[index];
  return {
    ...resource,
    default_photo_id: photo._id,
    default_photo_index: index
  };
}

/**
 * Ensure default photo ID and index are consistent
 * Returns updated resource object (immutable)
 * @param {Object} resource - The resource to check and fix
 * @returns {Object} Updated resource
 */
export function ensureDefaultPhotoConsistency(resource) {
  if (!resource) {
    return resource;
  }

  if (!resource.photos || resource.photos.length === 0) {
    return {
      ...resource,
      default_photo_id: null,
      default_photo_index: 0
    };
  }

  // If default_photo_id exists and is valid, ensure index matches
  if (resource.default_photo_id) {
    const index = getPhotoIndexById(resource.photos, resource.default_photo_id);
    if (index !== -1) {
      return {
        ...resource,
        default_photo_index: index
      };
    }
    // ID not found, clear it and fall through to index-based
  }

  // Use index to set ID
  const index = Math.min(Math.max(0, resource.default_photo_index || 0), resource.photos.length - 1);
  const photoId = resource.photos[index]?._id || null;

  return {
    ...resource,
    default_photo_index: index,
    default_photo_id: photoId
  };
}
