/**
 * Shared per-document memoization helper for read-only Mongoose virtuals.
 *
 * Background
 * ----------
 * Several models (Experience, Plan, ...) declare toJSON virtuals that walk
 * a nested array of items (cost rollups, max-planning-days, completion
 * percentage, etc.). Naïve implementations are O(N^2) — recursive descent
 * with `.id()` lookups + nested forEach scans — which dominates serialize
 * cost for list views once N grows past ~50.
 *
 * This helper centralizes the WeakMap-based memoization pattern used by
 * those virtuals. The cache is keyed on the underlying array reference
 * (Mongoose keeps the same MongooseArray instance for the lifetime of a
 * document, so this is a stable identity), and invalidated by a cheap
 * fingerprint that the caller supplies.
 *
 * When to use
 * -----------
 * Use this helper ONLY for:
 *   1. Read-only virtuals (no mutation side effects).
 *   2. Computations whose inputs are an array reference that is stable
 *      across reads — Mongoose subdocument arrays satisfy this; plain
 *      objects from `.lean()` do NOT (each load creates a new array).
 *      Lean queries skip virtuals by default, so this is moot.
 *   3. Fingerprints that are O(N) and capture every relevant input field.
 *      A wrong fingerprint = stale cache, so be explicit and conservative.
 *
 * Do NOT use this helper for virtuals that depend on data outside the
 * keyed array (e.g. document-level fields), or for write-side hooks.
 *
 * Cache lifetime
 * --------------
 * The internal WeakMap auto-frees an entry when the keyed array is GC'd.
 * Since Mongoose subdocument arrays are owned by the parent document,
 * the cache entry dies when the document goes out of scope.
 *
 * @module models/_virtual-cache
 */

// Each virtual gets its own WeakMap so different virtuals don't fight over
// cache slots on the same array. We lazily create maps per `key` string.
const CACHES = new Map();

function getCache(key) {
  let c = CACHES.get(key);
  if (!c) {
    c = new WeakMap();
    CACHES.set(key, c);
  }
  return c;
}

/**
 * Return the cached value of `computeFn(arr)` if the fingerprint hasn't
 * changed since the last computation, else recompute and update the cache.
 *
 * @param {Array}    arr           The array reference used as the cache key.
 *                                 Must be a non-null object (typically a
 *                                 Mongoose subdocument array). Falsy / non-
 *                                 array inputs short-circuit to the default.
 * @param {string}   key           Stable identifier for this virtual, e.g.
 *                                 'experience:cost_estimate'. Different
 *                                 virtuals on the same array MUST use
 *                                 different keys.
 * @param {Function} fingerprintFn (arr) => string|number — cheap signature
 *                                 of the array's contents that changes iff
 *                                 the computed value would change.
 * @param {Function} computeFn     (arr) => any — the expensive computation,
 *                                 invoked only on cache miss.
 * @param {*}        emptyValue    Returned without invoking computeFn when
 *                                 arr is falsy or empty. Defaults to 0.
 * @returns {*} cached or freshly computed value.
 */
function getCachedVirtual(arr, key, fingerprintFn, computeFn, emptyValue = 0) {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return emptyValue;
  const cache = getCache(key);
  const fp = fingerprintFn(arr);
  const cached = cache.get(arr);
  if (cached && cached.fp === fp) return cached.value;
  const value = computeFn(arr);
  cache.set(arr, { fp, value });
  return value;
}

/**
 * Build a Map<parentIdString, indices[]> for an items array. Items with no
 * `parent` are bucketed under the symbol `__root__`. Used by hierarchical
 * fold-ups (cost rollup, max planning days). O(N).
 *
 * @param {Array}  items   The items array.
 * @param {Object} [opts]
 * @param {string} [opts.idField='_id']  Field name to use as the item's id.
 *                                       Plan items use `plan_item_id` for
 *                                       cross-referencing snapshots; this
 *                                       lets the helper resolve children
 *                                       against either id.
 * @returns {Map<string, number[]>}
 */
function buildChildIndex(items, opts = {}) {
  const idField = opts.idField || '_id';
  const childrenByParent = new Map();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const parentKey = it.parent ? String(it.parent) : '__root__';
    let bucket = childrenByParent.get(parentKey);
    if (!bucket) {
      bucket = [];
      childrenByParent.set(parentKey, bucket);
    }
    bucket.push(i);
  }
  return childrenByParent;
}

/**
 * Resolve the id of an item, preferring `plan_item_id` (Plan snapshot
 * model) and falling back to `_id`. Returned as a string for Map keys.
 *
 * @param {Object} item
 * @returns {string|null}
 */
function itemIdString(item) {
  if (!item) return null;
  if (item.plan_item_id) return String(item.plan_item_id);
  if (item._id) return String(item._id);
  return null;
}

module.exports = {
  getCachedVirtual,
  buildChildIndex,
  itemIdString,
  // Exposed for testing only — do not rely on this in production code.
  _CACHES: CACHES,
};
