/**
 * Fuzzy matching utility functions for detecting similar strings
 * @module fuzzy-match
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - The Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  const matrix = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null)
  );

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity percentage between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity percentage (0-100)
 */
export function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 100;

  return ((maxLength - distance) / maxLength) * 100;
}

/**
 * Check if two strings are similar based on a threshold
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {number} threshold - Similarity threshold percentage (default: 85)
 * @returns {boolean} - True if strings are similar
 */
export function isSimilar(str1, str2, threshold = 85) {
  return calculateSimilarity(str1, str2) >= threshold;
}

/**
 * Normalize string for comparison (remove special characters, extra spaces)
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
export function normalizeString(str) {
  if (!str) return '';

  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Find similar items in an array based on a field
 * @param {Array} array - Array to search
 * @param {string} value - Value to compare
 * @param {string} fieldName - Field name to compare (default: 'name')
 * @param {number} threshold - Similarity threshold (default: 85)
 * @returns {Array} - Array of similar items
 */
export function findSimilarItems(array, value, fieldName = 'name', threshold = 85) {
  if (!Array.isArray(array) || !value) return [];

  const normalizedValue = normalizeString(value);

  return array.filter(item => {
    const itemValue = item[fieldName];
    if (!itemValue) return false;

    const normalizedItem = normalizeString(itemValue);
    return isSimilar(normalizedValue, normalizedItem, threshold);
  });
}

/**
 * Check if a value is a duplicate (exact or fuzzy match)
 * @param {Array} array - Array to check against
 * @param {string} value - Value to check
 * @param {string} fieldName - Field name to compare (default: 'name')
 * @param {number} threshold - Similarity threshold (default: 85)
 * @returns {boolean} - True if duplicate exists
 */
export function isDuplicateFuzzy(array, value, fieldName = 'name', threshold = 85) {
  const similar = findSimilarItems(array, value, fieldName, threshold);
  return similar.length > 0;
}
