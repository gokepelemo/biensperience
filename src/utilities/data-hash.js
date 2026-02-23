/**
 * Fast data hashing utility for detecting actual data changes.
 *
 * Uses djb2 hash (32-bit integer) on a stable JSON.stringify output
 * with sorted keys, so property insertion order doesn't affect the hash.
 *
 * @module data-hash
 */

/**
 * Default keys to ignore when hashing — internal tracking fields
 * that change on every merge but don't represent meaningful data changes.
 */
const DEFAULT_IGNORE_KEYS = ['__ctx_merged_at', '_optimistic'];

/**
 * djb2 hash — fast string-to-32-bit-integer hash.
 * @param {string} str
 * @returns {number}
 */
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Produce a stable hash for a data object, ignoring internal tracking fields.
 *
 * @param {*} data - Any serializable data
 * @param {Object} [options]
 * @param {string[]} [options.ignoreKeys] - Keys to exclude from hashing
 * @returns {number} 32-bit integer hash
 */
export function hashData(data, options = {}) {
  const { ignoreKeys = DEFAULT_IGNORE_KEYS } = options;

  if (data === null || data === undefined) return 0;
  if (typeof data !== 'object') return djb2(String(data));

  const ignoreSet = new Set(ignoreKeys);

  const sortedStr = JSON.stringify(data, (key, value) => {
    if (key && ignoreSet.has(key)) return undefined;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, k) => {
        if (!ignoreSet.has(k)) sorted[k] = value[k];
        return sorted;
      }, {});
    }
    return value;
  });

  return djb2(sortedStr);
}
