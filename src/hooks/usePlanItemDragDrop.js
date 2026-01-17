import { useCallback, useMemo } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import debug from '../utilities/debug';

/**
 * Constants for drag-and-drop hierarchy operations.
 * Default values used if not provided via options.
 */
const DEFAULT_NESTING_THRESHOLD_PX = 40;
const DEFAULT_PROMOTION_THRESHOLD_PX = -40;
const DEFAULT_HIERARCHY_ANIMATION_DURATION_MS = 500;
const DEFAULT_DRAG_ACTIVATION_DISTANCE_PX = 8;
const DEFAULT_MAX_PLAN_ITEM_DEPTH = 50;

/**
 * Hook for plan item drag-and-drop reordering with hierarchy support.
 *
 * Encapsulates:
 * - DnD-kit sensor configuration (pointer and keyboard)
 * - Drag end handler with parent-child hierarchy management
 * - Nesting/promotion detection via horizontal drag offset
 * - Visual feedback animations for hierarchy changes
 *
 * @param {Object} options - Hook configuration
 * @param {Array} options.planItems - Array of plan items (with _id, plan_item_id, parent)
 * @param {Map} options.parentItemMap - Map of item IDs to item objects for lookup
 * @param {Function} options.flattenPlanItemsFn - Function to flatten hierarchical items
 * @param {Function} options.onReorderPlanItems - Callback(planId, reorderedItems, draggedItemId)
 * @param {string|number} options.selectedPlanId - ID of the current plan
 * @param {boolean} options.canEdit - Whether user has edit permissions
 * @param {number} [options.maxPlanItemNestingLevel=1] - Maximum nesting depth allowed
 * @param {Object} [options.thresholds] - Custom threshold values
 * @param {number} [options.thresholds.nesting] - Horizontal px to trigger nesting (default: 40)
 * @param {number} [options.thresholds.promotion] - Horizontal px to trigger promotion (default: -40)
 * @param {number} [options.thresholds.dragActivation] - Movement px before drag starts (default: 8)
 * @param {number} [options.thresholds.animationDuration] - Hierarchy animation duration ms (default: 500)
 * @returns {Object} - { sensors, handleDragEnd, isDragEnabled }
 */
export function usePlanItemDragDrop({
  planItems,
  parentItemMap,
  flattenPlanItemsFn,
  onReorderPlanItems,
  selectedPlanId,
  canEdit,
  maxPlanItemNestingLevel = 1,
  thresholds = {}
}) {
  // Merge default thresholds with provided overrides
  const {
    nesting: NESTING_THRESHOLD = DEFAULT_NESTING_THRESHOLD_PX,
    promotion: PROMOTION_THRESHOLD = DEFAULT_PROMOTION_THRESHOLD_PX,
    dragActivation: DRAG_ACTIVATION_DISTANCE = DEFAULT_DRAG_ACTIVATION_DISTANCE_PX,
    animationDuration: HIERARCHY_ANIMATION_DURATION = DEFAULT_HIERARCHY_ANIMATION_DURATION_MS
  } = thresholds;

  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Calculate depth of a plan item in the hierarchy.
   * Returns Infinity if item has circular references or exceeds max depth.
   */
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

  /**
   * Check if an item can be nested under a potential parent.
   * Validates against max nesting level.
   */
  const canNestUnder = useCallback((potentialParentId) => {
    if (maxPlanItemNestingLevel <= 0) return false;
    const potentialParent = parentItemMap.get(potentialParentId?.toString());
    if (!potentialParent) return false;
    const parentDepth = getPlanItemDepth(potentialParent);
    return Number.isFinite(parentDepth) && parentDepth < maxPlanItemNestingLevel;
  }, [maxPlanItemNestingLevel, parentItemMap, getPlanItemDepth]);

  /**
   * Handle drag end event with hierarchy support.
   * Manages reordering, nesting, and promotion of plan items.
   */
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;

    debug.log('[Drag] Full event structure', {
      hasActive: !!active,
      hasOver: !!over,
      delta: event.delta,
      deltaX: event.delta?.x,
      deltaY: event.delta?.y
    });

    if (!active || !over || active.id === over.id) {
      return;
    }

    if (!planItems || planItems.length === 0) {
      debug.warn('[Drag] Cannot reorder - no plan data');
      return;
    }

    // Find the dragged item and target item
    const draggedItem = planItems.find(
      (item) => (item.plan_item_id || item._id).toString() === active.id.toString()
    );
    const targetItem = planItems.find(
      (item) => (item.plan_item_id || item._id).toString() === over.id.toString()
    );

    if (!draggedItem || !targetItem) {
      debug.warn('[Drag] Could not find dragged or target item');
      return;
    }

    // Get IDs for comparison
    const draggedId = (draggedItem.plan_item_id || draggedItem._id).toString();
    const targetId = (targetItem.plan_item_id || targetItem._id).toString();
    const draggedParentId = draggedItem.parent?.toString() || null;
    const targetParentId = targetItem.parent?.toString() || null;
    const targetIsChild = !!targetItem.parent;
    const draggedIsChild = !!draggedItem.parent;

    // Detect horizontal offset to determine nesting/promotion intent
    const horizontalOffset = event.delta?.x || 0;
    const nestingIntent = horizontalOffset > NESTING_THRESHOLD;
    const promotionIntent = horizontalOffset < PROMOTION_THRESHOLD;

    debug.log('[Drag] Hierarchy detection', {
      horizontalOffset,
      nestingIntent,
      promotionIntent,
      thresholds: { nest: NESTING_THRESHOLD, promote: PROMOTION_THRESHOLD }
    });

    debug.log('[Drag] Hierarchy-aware reorder', {
      draggedId,
      targetId,
      draggedParentId,
      targetParentId,
      draggedIsChild,
      targetIsChild,
      nestingIntent,
      promotionIntent
    });

    // Create a deep copy of items for modification
    let reorderedItems = planItems.map(item => ({ ...item }));

    // Find the dragged item in our copy
    const draggedItemCopy = reorderedItems.find(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    // Check if dragged item has children (can't nest a parent under another item)
    const draggedHasChildren = planItems.some(
      item => item.parent?.toString() === draggedId
    );

    // Get the flattened visual order to find item above
    const flattenedItems = flattenPlanItemsFn(planItems);
    const draggedFlatIndex = flattenedItems.findIndex(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    let promotedToParentPosition = false;

    // Determine hierarchy change based on context
    if (promotionIntent && draggedIsChild) {
      // Explicit promotion: dragged left outside container alignment
      delete draggedItemCopy.parent;
      promotedToParentPosition = true;
      debug.log('[Drag] Promoting child to root (drag left intent), will position above parent');
    } else if (nestingIntent && !draggedHasChildren) {
      // Nesting intent detected (drag right)
      const itemAbove = draggedFlatIndex > 0 ? flattenedItems[draggedFlatIndex - 1] : null;
      const itemAboveId = itemAbove ? (itemAbove.plan_item_id || itemAbove._id).toString() : null;

      if (!targetIsChild && draggedId !== targetId) {
        // Dropping on a root item - nest under target
        if (canNestUnder(targetId)) {
          draggedItemCopy.parent = targetId;
          debug.log('[Drag] Making item a child of drop target', { newParent: targetId });
        } else {
          debug.log('[Drag] Nest blocked by max nesting level', { candidateParentId: targetId });
        }
      } else if (itemAbove && !itemAbove.isChild) {
        // Item above is a root item - can nest under it
        if (canNestUnder(itemAboveId)) {
          draggedItemCopy.parent = itemAboveId;
          debug.log('[Drag] Making item a child of item above', { newParent: itemAboveId, itemAboveText: itemAbove.text });
        } else {
          debug.log('[Drag] Nest blocked by max nesting level', { candidateParentId: itemAboveId });
        }
      } else if (itemAbove && itemAbove.isChild) {
        // Item above is a child - become sibling (same parent)
        const siblingParentId = itemAbove.parent?.toString();
        if (siblingParentId && canNestUnder(siblingParentId)) {
          draggedItemCopy.parent = itemAbove.parent;
          debug.log('[Drag] Becoming sibling of item above', { newParent: itemAbove.parent });
        } else {
          debug.log('[Drag] Sibling reparent blocked by max nesting level', { candidateParentId: siblingParentId });
        }
      } else {
        debug.log('[Drag] No valid item to nest under');
      }
    } else if (targetIsChild && draggedParentId !== targetParentId && !promotionIntent) {
      // Dragged item should adopt the same parent as target (become sibling)
      const siblingParentId = targetItem.parent?.toString();
      if (siblingParentId && canNestUnder(siblingParentId)) {
        draggedItemCopy.parent = targetItem.parent;
        debug.log('[Drag] Reparenting to same parent as target', { newParent: targetItem.parent });
      } else {
        debug.log('[Drag] Sibling reparent blocked by max nesting level', { candidateParentId: siblingParentId });
      }
    } else if (!targetIsChild && draggedParentId && !nestingIntent) {
      // Target is a root item and dragged item was a child -> promote to root
      delete draggedItemCopy.parent;
      debug.log('[Drag] Promoting child to root level');
    }

    // Find indices for arrayMove
    const oldIndex = reorderedItems.findIndex(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    // For promotion by drag-left, position above the former parent item
    let newIndex;
    if (promotedToParentPosition && draggedParentId) {
      newIndex = reorderedItems.findIndex(
        (item) => (item.plan_item_id || item._id).toString() === draggedParentId
      );
      debug.log('[Drag] Positioning promoted item above former parent', { parentId: draggedParentId, newIndex });
    } else {
      newIndex = reorderedItems.findIndex(
        (item) => (item.plan_item_id || item._id).toString() === targetId
      );
    }

    if (oldIndex === -1 || newIndex === -1) {
      debug.warn('[Drag] Could not find item indices', { oldIndex, newIndex });
      return;
    }

    // Apply position reorder
    reorderedItems = arrayMove(reorderedItems, oldIndex, newIndex);

    // Determine hierarchy change type for visual feedback
    const newParentId = draggedItemCopy.parent?.toString() || null;
    const hierarchyChanged = draggedParentId !== newParentId;
    let hierarchyChangeType = null;

    if (hierarchyChanged) {
      if (newParentId && !draggedParentId) {
        hierarchyChangeType = 'nested';
      } else if (!newParentId && draggedParentId) {
        hierarchyChangeType = 'promoted';
      } else if (newParentId && draggedParentId && newParentId !== draggedParentId) {
        hierarchyChangeType = 'nested';
      }
    }

    debug.log('[Drag] Reordered items', {
      activeId: active.id,
      overId: over.id,
      oldIndex,
      newIndex,
      hierarchyChanged,
      hierarchyChangeType
    });

    // Apply visual snap animation for hierarchy changes
    if (hierarchyChangeType) {
      const draggedItemElement = document.querySelector(`[data-plan-item-id="${draggedId}"]`);
      if (draggedItemElement) {
        draggedItemElement.classList.remove('hierarchy-nested', 'hierarchy-promoted');
        void draggedItemElement.offsetWidth; // Force reflow
        draggedItemElement.classList.add(`hierarchy-${hierarchyChangeType}`);
        setTimeout(() => {
          draggedItemElement.classList.remove(`hierarchy-${hierarchyChangeType}`);
        }, HIERARCHY_ANIMATION_DURATION);
      }
    }

    // Call parent handler to update backend
    if (onReorderPlanItems) {
      onReorderPlanItems(selectedPlanId, reorderedItems, active.id.toString());
    }
  }, [
    planItems,
    flattenPlanItemsFn,
    canNestUnder,
    onReorderPlanItems,
    selectedPlanId,
    NESTING_THRESHOLD,
    PROMOTION_THRESHOLD,
    HIERARCHY_ANIMATION_DURATION
  ]);

  return {
    sensors,
    handleDragEnd,
    isDragEnabled: canEdit
  };
}

export default usePlanItemDragDrop;
