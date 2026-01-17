import { useMemo, useCallback } from 'react';
import { createFlattenPlanItems } from '../utilities/plan-item-utils';

/**
 * Default maximum plan item nesting depth for circular reference protection.
 */
const DEFAULT_MAX_PLAN_ITEM_DEPTH = 50;

/**
 * Hook for managing plan item visibility, expansion, and pinning display logic.
 *
 * Encapsulates:
 * - ID to expansion key mapping
 * - Canonical parent key resolution
 * - Item flattening with expansion state
 * - Visibility filtering (collapsed children)
 * - Pinned item separation
 * - Parent lookup map
 * - Parent/child relationship tracking
 * - Depth calculation and nesting validation
 *
 * @param {Object} options - Hook configuration
 * @param {Array} options.planItems - Array of plan items
 * @param {Set} options.expandedParents - Set of expanded parent keys
 * @param {string|null} options.animatingCollapse - Key of parent currently animating collapse
 * @param {Function} options.getExpansionKey - Function to get canonical expansion key for an item
 * @param {string|null} options.pinnedItemId - ID of the currently pinned item (from plan.pinnedItemId)
 * @param {Function} options.isItemExpanded - Function to check if an item is expanded
 * @param {number} [options.maxNestingLevel=1] - Maximum nesting depth allowed
 * @returns {Object} - Visibility state and helpers
 */
export function usePlanItemVisibility({
  planItems,
  expandedParents,
  animatingCollapse,
  getExpansionKey,
  pinnedItemId,
  isItemExpanded,
  maxNestingLevel = 1
}) {
  // Map both _id and plan_item_id to a canonical expansion key.
  // This lets us normalize child->parent references regardless of whether
  // the parent was stored as a plan instance _id or an experience plan_item_id.
  const idToExpansionKey = useMemo(() => {
    const map = new Map();
    if (!planItems || planItems.length === 0) return map;

    for (const item of planItems) {
      const canonicalKey = getExpansionKey(item);
      const itemId = item?._id?.toString?.() || null;
      const refId = item?.plan_item_id?.toString?.() || null;

      if (itemId && canonicalKey) map.set(itemId, canonicalKey);
      if (refId && canonicalKey) map.set(refId, canonicalKey);
    }

    return map;
  }, [planItems, getExpansionKey]);

  // Get canonical parent key for an item
  const getCanonicalParentKey = useCallback((item) => {
    const rawParentId = item?.parent?.toString?.() || null;
    if (!rawParentId) return null;
    return idToExpansionKey.get(rawParentId) || rawParentId;
  }, [idToExpansionKey]);

  // Memoized flattenPlanItems function with injected dependencies
  const flattenPlanItemsFn = useMemo(
    () => createFlattenPlanItems({
      expandedParents,
      animatingCollapse,
      getExpansionKey,
      getCanonicalParentKey
    }),
    [expandedParents, animatingCollapse, getExpansionKey, getCanonicalParentKey]
  );

  // Flatten items respecting expansion state
  const flattenedItems = useMemo(() => {
    if (!planItems || planItems.length === 0) return [];
    return flattenPlanItemsFn(planItems);
  }, [planItems, flattenPlanItemsFn]);

  // Filter to only visible items (respects collapse state, keeps animating items)
  const filteredItems = useMemo(() => {
    return flattenedItems.filter(
      (item) =>
        item.isVisible ||
        (item.isChild && animatingCollapse === item.parentKey)
    );
  }, [flattenedItems, animatingCollapse]);

  // Find the actual pinned item object
  const pinnedItem = useMemo(() => {
    if (!pinnedItemId || !planItems || planItems.length === 0) return null;
    return planItems.find(item =>
      (item._id?.toString() === pinnedItemId) ||
      (item.plan_item_id?.toString() === pinnedItemId)
    );
  }, [pinnedItemId, planItems]);

  // Check if an item is the pinned item or a child of it
  const isPinnedOrChild = useCallback((item) => {
    if (!pinnedItemId || !pinnedItem) return false;
    const itemId = (item._id || item.plan_item_id)?.toString();
    // Item is the pinned item itself
    if (itemId === pinnedItemId) return true;
    // Child inherits pinned status from parent
    const parentId = item.parent?.toString();
    if (!parentId) return false;
    if (parentId === pinnedItem._id?.toString()) return true;
    if (parentId === pinnedItem.plan_item_id?.toString()) return true;
    return false;
  }, [pinnedItemId, pinnedItem]);

  // Extract pinned items and unpinned items for separate rendering
  const { pinnedItems, unpinnedItems } = useMemo(() => {
    if (!pinnedItemId || flattenedItems.length === 0) {
      return { pinnedItems: [], unpinnedItems: filteredItems };
    }

    const pinned = [];
    const unpinned = [];

    // Get pinned items from flattenedItems, respecting visibility for children
    for (const item of flattenedItems) {
      if (isPinnedOrChild(item)) {
        // Include if it's the pinned parent OR if it's a visible child
        if (item.isVisible || (!item.isChild && !item.parent)) {
          pinned.push(item);
        }
      }
    }

    // Get unpinned items from filteredItems (respects expand/collapse)
    for (const item of filteredItems) {
      if (!isPinnedOrChild(item)) {
        unpinned.push(item);
      }
    }

    return { pinnedItems: pinned, unpinnedItems: unpinned };
  }, [flattenedItems, filteredItems, pinnedItemId, isPinnedOrChild]);

  // For timeline/activity views, we need ALL unpinned items (including collapsed children)
  // to properly group them with their parents
  const allUnpinnedItems = useMemo(() => {
    if (!pinnedItemId || flattenedItems.length === 0) {
      return flattenedItems;
    }
    return flattenedItems.filter(item => !isPinnedOrChild(item));
  }, [flattenedItems, pinnedItemId, isPinnedOrChild]);

  // Combined items to render: pinned first, then unpinned
  const itemsToRender = useMemo(() => {
    if (!pinnedItemId || filteredItems.length === 0) return filteredItems;
    return [...pinnedItems, ...unpinnedItems];
  }, [filteredItems, pinnedItemId, pinnedItems, unpinnedItems]);

  // Track which items have children
  const parentsWithChildren = useMemo(() => {
    const parents = new Set();
    if (!planItems || planItems.length === 0) return parents;

    for (const item of planItems) {
      if (item.parent) {
        const canonicalParentKey = getCanonicalParentKey(item);
        if (canonicalParentKey) parents.add(canonicalParentKey);
      }
    }
    return parents;
  }, [planItems, getCanonicalParentKey]);

  // Check if an item has children
  const hasChildren = useCallback((item) => {
    const itemKey = getExpansionKey(item);
    if (!itemKey) return false;
    return parentsWithChildren.has(itemKey);
  }, [parentsWithChildren, getExpansionKey]);

  // Check if an item should be visible based on expand/collapse state
  const isItemVisible = useCallback((item) => {
    // If not a child, always visible
    if (!item.parent && !item.isChild) return true;
    // Child items: check if parent is expanded
    const parentKey = getCanonicalParentKey(item);
    if (!parentKey) return true;
    return expandedParents.has(parentKey);
  }, [expandedParents, getCanonicalParentKey]);

  // Parent item lookup map for child activity badge display
  const parentItemMap = useMemo(() => {
    const map = new Map();
    if (planItems && planItems.length > 0) {
      for (const item of planItems) {
        map.set((item.plan_item_id || item._id)?.toString(), item);
      }
    }
    return map;
  }, [planItems]);

  // Calculate depth of a plan item in the hierarchy
  const getPlanItemDepth = useCallback((item) => {
    if (!item) return Infinity;

    const visited = new Set();
    let depth = 0;
    let cursor = item;

    while (cursor?.parent) {
      const parentId = cursor.parent?.toString();
      if (!parentId) return Infinity;
      if (visited.has(parentId)) return Infinity;
      visited.add(parentId);

      const parent = parentItemMap.get(parentId);
      if (!parent) return Infinity;

      depth += 1;
      if (depth > DEFAULT_MAX_PLAN_ITEM_DEPTH) return Infinity;
      cursor = parent;
    }

    return depth;
  }, [parentItemMap]);

  // Check if a child can be added to an item (respects max nesting level)
  const canAddChildToItem = useCallback((item) => {
    if (maxNestingLevel <= 0) return false;
    const depth = getPlanItemDepth(item);
    return Number.isFinite(depth) && depth < maxNestingLevel;
  }, [maxNestingLevel, getPlanItemDepth]);

  return {
    // Mapping helpers
    idToExpansionKey,
    getCanonicalParentKey,
    flattenPlanItemsFn,

    // Computed item lists
    flattenedItems,
    filteredItems,
    pinnedItems,
    unpinnedItems,
    allUnpinnedItems,
    itemsToRender,

    // Lookup maps
    parentItemMap,
    parentsWithChildren,

    // Helper functions
    isPinnedOrChild,
    hasChildren,
    isItemVisible,
    getPlanItemDepth,
    canAddChildToItem
  };
}

export default usePlanItemVisibility;
