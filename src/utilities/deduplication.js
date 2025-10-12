/**
 * Deduplication utility functions for removing duplicate items from arrays
 * @module deduplication
 */

import { normalizeString, calculateSimilarity } from './fuzzy-match.js';

/**
 * Remove duplicates from an array based on a unique ID field
 * @param {Array} array - The array to deduplicate
 * @param {string} idKey - The key to use for uniqueness (default: '_id')
 * @returns {Array} - Deduplicated array
 */
export function deduplicateById(array, idKey = '_id') {
  if (!Array.isArray(array) || array.length === 0) {
    return array;
  }

  const seen = new Set();
  return array.filter(item => {
    const id = item[idKey];
    if (id && !seen.has(id.toString())) {
      seen.add(id.toString());
      return true;
    }
    return false;
  });
}

/**
 * Remove duplicates from an array based on a name field (case-insensitive)
 * @param {Array} array - The array to deduplicate
 * @param {string} nameKey - The key to use for uniqueness (default: 'name')
 * @returns {Array} - Deduplicated array
 */
export function deduplicateByName(array, nameKey = 'name') {
  if (!Array.isArray(array) || array.length === 0) {
    return array;
  }

  const seen = new Set();
  return array.filter(item => {
    const name = item[nameKey];
    if (name) {
      const normalizedName = name.toLowerCase().trim();
      if (!seen.has(normalizedName)) {
        seen.add(normalizedName);
        return true;
      }
    }
    return false;
  });
}

/**
 * Remove duplicates from an array based on multiple fields
 * @param {Array} array - The array to deduplicate
 * @param {Array<string>} fields - Array of field names to use for uniqueness
 * @returns {Array} - Deduplicated array
 */
export function deduplicateByMultipleFields(array, fields = ['_id']) {
  if (!Array.isArray(array) || array.length === 0) {
    return array;
  }

  const seen = new Set();
  return array.filter(item => {
    const key = fields.map(field => {
      const value = item[field];
      if (value === null || value === undefined) return '';
      return typeof value === 'string' ? value.toLowerCase().trim() : value.toString();
    }).join('|');

    if (!seen.has(key)) {
      seen.add(key);
      return true;
    }
    return false;
  });
}

/**
 * Check if an item with the given name already exists in an array (case-insensitive)
 * @param {Array} array - The array to check
 * @param {string} name - The name to check for
 * @param {string} nameKey - The key to use for the name field (default: 'name')
 * @returns {boolean} - True if duplicate exists, false otherwise
 */
export function isDuplicateName(array, name, nameKey = 'name') {
  if (!Array.isArray(array) || !name) {
    return false;
  }

  const normalizedName = name.toLowerCase().trim();
  return array.some(item => {
    const itemName = item[nameKey];
    return itemName && itemName.toLowerCase().trim() === normalizedName;
  });
}

/**
 * Remove fuzzy duplicates from an array based on name similarity
 * @param {Array} array - The array to deduplicate
 * @param {string} nameKey - The key to use for the name field (default: 'name')
 * @param {number} threshold - Similarity threshold percentage (default: 90)
 * @returns {Array} - Deduplicated array with fuzzy duplicates removed
 */
export function deduplicateFuzzy(array, nameKey = 'name', threshold = 90) {
  if (!Array.isArray(array) || array.length === 0) {
    return array;
  }

  const result = [];
  const normalized = new Map();

  for (const item of array) {
    const name = item[nameKey];
    if (!name) {
      result.push(item);
      continue;
    }

    const normalizedName = normalizeString(name);
    let isDuplicate = false;

    // Check against all previously added items
    for (const existingNormalized of normalized.keys()) {
      const similarity = calculateSimilarity(normalizedName, existingNormalized);
      if (similarity >= threshold) {
        // This is a fuzzy duplicate, skip it
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(item);
      normalized.set(normalizedName, item);
    }
  }

  return result;
}
