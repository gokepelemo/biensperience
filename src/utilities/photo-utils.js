/**
 * Photo utility functions for handling photo entry arrays: [{ photo, default }]
 * @module photo-utils
 */

import { logger } from './logger';

/**
 * Get the default photo object from a resource.
 * Returns the populated photo object (entry.photo), not the entry wrapper.
 * @param {Object} resource - The resource with photos: [{photo, default}]
 * @returns {Object|null} The default photo object or null if none
 */
export function getDefaultPhoto(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }
  const entry = resource.photos.find(p => p.default);
  return entry ? entry.photo : resource.photos[0].photo;
}

/**
 * Get the index of the default photo entry.
 * @param {Object} resource - The resource with photos
 * @returns {number} The index of the default entry (0 if not found)
 */
export function getDefaultPhotoIndex(resource) {
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
export function getPhotoObjects(resource) {
  return (resource?.photos || []).map(entry => entry?.photo).filter(Boolean);
}

export function getPhotoEntries(resource) {
  if (!resource || !resource.photos) return [];
  return resource.photos;
}

/**
 * Set the default photo by photo ID. Returns updated resource (immutable).
 * @param {Object} resource - The resource to update
 * @param {string} photoId - The ID of the photo to mark as default
 * @returns {Object|null} Updated resource or null if not found
 */
export function setDefaultPhotoById(resource, photoId) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }
  const photoIdStr = photoId ? photoId.toString() : null;
  const index = resource.photos.findIndex(p => {
    const entryId = p.photo && p.photo._id ? p.photo._id.toString() : (p.photo ? p.photo.toString() : null);
    return entryId === photoIdStr;
  });
  if (index === -1) {
    logger.warn('Photo ID not found when setting default photo', {
      resourceId: resource._id,
      photoId
    });
    return null;
  }
  return {
    ...resource,
    photos: resource.photos.map((p, i) => ({ ...p, default: i === index }))
  };
}

/**
 * Set the default photo by array index. Returns updated resource (immutable).
 * @param {Object} resource - The resource to update
 * @param {number} index - The index of the photo entry to mark as default
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
  return {
    ...resource,
    photos: resource.photos.map((p, i) => ({ ...p, default: i === index }))
  };
}

/**
 * Ensure exactly one entry has default: true. Returns updated resource (immutable).
 * @param {Object} resource - The resource to normalise
 * @returns {Object} Updated resource
 */
export function ensureDefaultPhotoConsistency(resource) {
  if (!resource) return resource;
  if (!resource.photos || resource.photos.length === 0) {
    return resource;
  }
  const defaultCount = resource.photos.filter(p => p.default).length;
  if (defaultCount === 1) return resource;
  if (defaultCount === 0) {
    return {
      ...resource,
      photos: resource.photos.map((p, i) => ({ ...p, default: i === 0 }))
    };
  }
  // Multiple defaults — keep last one
  let found = false;
  const photos = [...resource.photos].reverse().map(p => {
    if (p.default && !found) { found = true; return p; }
    return { ...p, default: false };
  }).reverse();
  return { ...resource, photos };
}
