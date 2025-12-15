/**
 * ID Utilities
 *
 * Helper functions for comparing and normalizing IDs across the application.
 * These utilities handle ObjectId vs string comparisons uniformly.
 *
 * @module utilities/id-utils
 */

/**
 * Compare two IDs safely, handling both ObjectId and string types.
 * Returns false if either value is null/undefined.
 *
 * @param {string|ObjectId|Object} a - First ID (can be ObjectId, string, or object with _id)
 * @param {string|ObjectId|Object} b - Second ID (can be ObjectId, string, or object with _id)
 * @returns {boolean} True if IDs are equal
 *
 * @example
 * idEquals('123', '123')                    // true
 * idEquals(ObjectId('123'), '123')          // true
 * idEquals({ _id: '123' }, '123')           // true
 * idEquals(null, '123')                     // false
 */
export function idEquals(a, b) {
  if (!a || !b) return false;

  try {
    // Extract _id if passed an object
    const aId = a._id !== undefined ? a._id : a;
    const bId = b._id !== undefined ? b._id : b;

    if (!aId || !bId) return false;

    return aId.toString() === bId.toString();
  } catch (e) {
    return false;
  }
}

/**
 * Normalize an ID to a string.
 * Handles ObjectId, strings, and objects with _id property.
 *
 * @param {string|ObjectId|Object} id - ID to normalize
 * @returns {string|null} Normalized string ID or null if invalid
 *
 * @example
 * normalizeId('123')                        // '123'
 * normalizeId(ObjectId('123'))              // '123'
 * normalizeId({ _id: '123' })               // '123'
 * normalizeId(null)                         // null
 */
export function normalizeId(id) {
  if (!id) return null;

  try {
    // Extract _id if passed an object
    const actualId = id._id !== undefined ? id._id : id;
    if (!actualId) return null;

    return actualId.toString ? actualId.toString() : String(actualId);
  } catch (e) {
    return null;
  }
}

/**
 * Check if an ID matches any ID in an array.
 *
 * @param {string|ObjectId} id - ID to search for
 * @param {Array<string|ObjectId|Object>} ids - Array of IDs to search in
 * @returns {boolean} True if ID is found in array
 *
 * @example
 * idInArray('123', ['123', '456'])          // true
 * idInArray('789', ['123', '456'])          // false
 */
export function idInArray(id, ids) {
  if (!id || !Array.isArray(ids)) return false;

  return ids.some(item => idEquals(id, item));
}

/**
 * Find an item in an array by its ID.
 *
 * @param {Array<Object>} items - Array of items with _id property
 * @param {string|ObjectId} id - ID to search for
 * @param {string} [idField='_id'] - Field name to use for ID comparison
 * @returns {Object|undefined} Found item or undefined
 *
 * @example
 * const items = [{ _id: '123', name: 'A' }, { _id: '456', name: 'B' }];
 * findById(items, '123')                    // { _id: '123', name: 'A' }
 */
export function findById(items, id, idField = '_id') {
  if (!Array.isArray(items) || !id) return undefined;

  return items.find(item => idEquals(item[idField], id));
}

/**
 * Find the index of an item in an array by its ID.
 *
 * @param {Array<Object>} items - Array of items with _id property
 * @param {string|ObjectId} id - ID to search for
 * @param {string} [idField='_id'] - Field name to use for ID comparison
 * @returns {number} Index of the item or -1 if not found
 *
 * @example
 * const items = [{ _id: '123', name: 'A' }, { _id: '456', name: 'B' }];
 * findIndexById(items, '456')               // 1
 */
export function findIndexById(items, id, idField = '_id') {
  if (!Array.isArray(items) || !id) return -1;

  return items.findIndex(item => idEquals(item[idField], id));
}

/**
 * Filter an array to exclude items matching a specific ID.
 *
 * @param {Array<Object>} items - Array of items with _id property
 * @param {string|ObjectId} id - ID to filter out
 * @param {string} [idField='_id'] - Field name to use for ID comparison
 * @returns {Array<Object>} Filtered array
 *
 * @example
 * const items = [{ _id: '123' }, { _id: '456' }];
 * filterOutById(items, '123')               // [{ _id: '456' }]
 */
export function filterOutById(items, id, idField = '_id') {
  if (!Array.isArray(items) || !id) return items || [];

  return items.filter(item => !idEquals(item[idField], id));
}
