import { logger } from './logger';

/**
 * Returns true when a photos array item is a populated entry wrapper {photo, default}
 * as produced by .populate('photos.photo'). Returns false for flat Photo documents
 * produced by aggregation $lookup pipelines.
 */
function isEntryWrapped(item) {
  if (!item || typeof item !== 'object') return false;
  // Entry wrapper has a `photo` sub-document (object) or an ObjectId string
  return 'photo' in item && 'default' in item;
}

/**
 * Resolve a single photos array item to a Photo document regardless of shape:
 *   - New schema entry wrapper: { photo: PhotoDoc, default: bool } → PhotoDoc
 *   - Flat Photo doc from aggregation: { _id, url, ... } → itself
 *   - Bare ObjectId string (unpopulated): → null
 */
function resolvePhotoDoc(item) {
  if (!item || typeof item !== 'object') return null;
  if (isEntryWrapped(item)) {
    // populated entry: item.photo is a Photo document
    if (item.photo && typeof item.photo === 'object' && item.photo.url) return item.photo;
    return null; // unpopulated entry
  }
  // Flat Photo document (from aggregation lookup)
  if (item.url) return item;
  return null;
}

/**
 * Get the default photo object from a resource.
 * Returns the Photo document (with .url), not the entry wrapper.
 * Handles both populate ({photo, default}) and aggregation (flat PhotoDoc) shapes.
 * @param {Object} resource - The resource with photos array
 * @returns {Object|null} The Photo document or null if none can be resolved
 */
export function getDefaultPhoto(resource) {
  if (!resource || !resource.photos || resource.photos.length === 0) {
    return null;
  }
  const photos = resource.photos;

  if (isEntryWrapped(photos[0])) {
    // New schema: [{photo: PhotoDoc, default: bool}]
    const defaultEntry = photos.find(p => p.default);
    return resolvePhotoDoc(defaultEntry) || resolvePhotoDoc(photos[0]);
  }

  // Flat Photo documents from aggregation
  const first = resolvePhotoDoc(photos[0]);
  return first;
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
  if (isEntryWrapped(resource.photos[0])) {
    const index = resource.photos.findIndex(p => p.default);
    return index !== -1 ? index : 0;
  }
  return 0;
}

/**
 * Get an array of Photo documents from a resource, regardless of which shape
 * the photos array is in (entry wrappers or flat Photo docs).
 * @param {Object} resource - The resource with photos
 * @returns {Array} Array of Photo documents
 */
export function getPhotoObjects(resource) {
  return (resource?.photos || []).map(resolvePhotoDoc).filter(Boolean);
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
