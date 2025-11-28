/**
 * ExperienceTabContent Component
 * Displays the experience's plan items with collaborators and action buttons
 * This is the "The Plan" tab showing the master plan items defined by the experience owner
 */

import { Link } from 'react-router-dom';
import { BsPlusCircle } from 'react-icons/bs';
import { FaUserPlus } from 'react-icons/fa';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import UsersListDisplay from '../../../components/UsersListDisplay/UsersListDisplay';
import DragHandle from '../../../components/DragHandle/DragHandle';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import { Text } from '../../../components/design-system';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { isOwner } from '../../../utilities/permissions';
import debug from '../../../utilities/debug';

// Sortable plan item component for drag and drop
function SortableExperiencePlanItem({
  planItem,
  experience,
  user,
  expandedParents,
  canEdit,
  toggleExpanded,
  handleAddExperiencePlanItem,
  handleEditExperiencePlanItem,
  setPlanItemToDelete,
  setShowPlanDeleteModal,
  lang
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: planItem._id.toString(),
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const hasChildren = experience.plan_items.some(
    (sub) =>
      sub.parent &&
      sub.parent.toString() === planItem._id.toString()
  );

  const isChild = !!planItem.parent;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plan-item-id={planItem._id}
      className={`plan-item-card mb-3 overflow-hidden ${isDragging ? 'dragging' : ''} ${isChild ? 'is-child-item' : ''}`}
    >
      <div className="plan-item-header p-3 p-md-4">
        <div className="plan-item-tree">
          {!isChild ? (
            (() => {
              if (hasChildren) {
                const isExpanded = expandedParents.has(planItem._id);
                return (
                  <button
                    type="button"
                    className="expand-toggle"
                    onClick={() => toggleExpanded(planItem._id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                );
              } else {
                return <span className="no-child-arrow">•</span>;
              }
            })()
          ) : (
            <span className="child-arrow">↳</span>
          )}
        </div>
        <div className="plan-item-title flex-grow-1 fw-semibold">
          {planItem.url ? (
            <Link
              to={planItem.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {planItem.text}
            </Link>
          ) : (
            <span>{planItem.text}</span>
          )}
        </div>

        {/* Drag handle - for all items when user can edit */}
        {canEdit && (
          <div className="drag-handle-wrapper">
            <DragHandle
              id={planItem._id.toString()}
              disabled={!canEdit}
            />
          </div>
        )}

        <div className="plan-item-actions">
          {isOwner(user, experience) && (
            <div className="d-flex gap-1">
              {!planItem.parent && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() =>
                    handleAddExperiencePlanItem(planItem._id)
                  }
                  aria-label={`${lang.en.button.addChild} to ${planItem.text}`}
                  title={lang.en.button.addChild}
                >
                  ✚
                </button>
              )}
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() =>
                  handleEditExperiencePlanItem(planItem)
                }
                aria-label={`${lang.en.button.edit} ${planItem.text}`}
                title={lang.en.tooltip.edit}
              >
                ✏️
              </button>
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => {
                  setPlanItemToDelete(planItem._id);
                  setShowPlanDeleteModal(true);
                }}
                aria-label={`${lang.en.button.delete} ${planItem.text}`}
                title={lang.en.tooltip.delete}
              >
                ✖️
              </button>
            </div>
          )}
        </div>
      </div>
      {(Number(planItem.cost_estimate) > 0 ||
        Number(planItem.planning_days) > 0) && (
        <div className="plan-item-details p-2 p-md-3">
          <div className="plan-item-meta">
            {Number(planItem.cost_estimate) > 0 && (
              <span className="plan-item-cost">
                <CostEstimate
                  cost={planItem.cost_estimate}
                  showTooltip={true}
                  compact={true}
                />
              </span>
            )}
            {Number(planItem.planning_days) > 0 && (
              <span className="plan-item-days">
                <PlanningTime
                  days={planItem.planning_days}
                  showTooltip={true}
                />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExperienceTabContent({
  // User data
  user,
  experience,

  // Collaborators data
  experienceOwner,
  experienceCollaborators,
  experienceOwnerLoading,
  experienceCollaboratorsLoading,

  // Plan items state
  expandedParents,
  animatingCollapse,

  // Handlers
  handleAddExperiencePlanItem,
  handleEditExperiencePlanItem,
  openCollaboratorModal,
  toggleExpanded,
  setPlanItemToDelete,
  setShowPlanDeleteModal,
  onReorderExperiencePlanItems,

  // Language strings
  lang
}) {
  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Check if user can edit experience plan
  const canEdit = isOwner(user, experience);

  // Handle drag end event with hierarchy support
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) {
      return;
    }

    if (!experience || !experience.plan_items) {
      debug.warn('[ExperienceDrag] Cannot reorder - no plan items data');
      return;
    }

    // Find the dragged item and target item
    const draggedItem = experience.plan_items.find(
      (item) => item._id.toString() === active.id.toString()
    );
    const targetItem = experience.plan_items.find(
      (item) => item._id.toString() === over.id.toString()
    );

    if (!draggedItem || !targetItem) {
      debug.warn('[ExperienceDrag] Could not find dragged or target item');
      return;
    }

    // Get IDs for comparison
    const draggedId = draggedItem._id.toString();
    const targetId = targetItem._id.toString();
    const draggedParentId = draggedItem.parent?.toString() || null;
    const targetParentId = targetItem.parent?.toString() || null;
    const targetIsChild = !!targetItem.parent;
    const draggedIsChild = !!draggedItem.parent;

    // Detect horizontal offset to determine nesting/promotion intent
    // Drag right (40px+) = nest under target, Drag left (40px+) = promote to root
    // Use event.delta.x which dnd-kit provides directly (more reliable than rect coordinates)
    const NESTING_THRESHOLD = 40; // pixels
    const PROMOTION_THRESHOLD = -40; // pixels - drag 40px left to indicate promotion
    const horizontalOffset = event.delta?.x || 0;
    const nestingIntent = horizontalOffset > NESTING_THRESHOLD;
    const promotionIntent = horizontalOffset < PROMOTION_THRESHOLD;
    debug.log('[ExperienceDrag] Hierarchy detection', { horizontalOffset, nestingIntent, promotionIntent, thresholds: { nest: NESTING_THRESHOLD, promote: PROMOTION_THRESHOLD } });

    debug.log('[ExperienceDrag] Hierarchy-aware reorder', {
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
    let reorderedItems = experience.plan_items.map(item => ({ ...item }));

    // Find the dragged item in our copy
    const draggedItemCopy = reorderedItems.find(
      (item) => item._id.toString() === draggedId
    );

    // Check if dragged item has children (can't nest a parent under another item)
    const draggedHasChildren = experience.plan_items.some(
      item => item.parent?.toString() === draggedId
    );

    // Determine hierarchy change based on context:
    // 1. If promotion intent AND dragged is a child → promote to root (drag left), position above parent
    // 2. If nesting intent AND dragged has no children → make child of item above (drag right)
    // 3. If target is a child item, dragged item becomes sibling (same parent)
    // 4. If target is a parent item and dragged is child (no nesting intent) → promote to root
    // 5. If both are at same level → simple reorder

    // Get the flattened visual order to find item above
    const flattenedItemsForDrag = flattenPlanItems(experience.plan_items);
    const draggedFlatIndex = flattenedItemsForDrag.findIndex(
      (item) => item._id.toString() === draggedId
    );

    let promotedToParentPosition = false; // Track if we need special positioning
    if (promotionIntent && draggedIsChild) {
      // Explicit promotion: dragged left outside container alignment → become root item
      // Position above former parent for cognitive sense
      delete draggedItemCopy.parent;
      promotedToParentPosition = true;
      debug.log('[ExperienceDrag] Promoting child to root (drag left intent), will position above parent');
    } else if (nestingIntent && !draggedHasChildren && !draggedIsChild) {
      // Nesting intent detected (drag right) - can nest under item above OR target
      // Only works for root items (not already a child) with no children of their own
      const itemAbove = draggedFlatIndex > 0 ? flattenedItemsForDrag[draggedFlatIndex - 1] : null;
      const itemAboveId = itemAbove ? itemAbove._id.toString() : null;

      // Determine which item to nest under:
      // - If dropping ON a different root item, nest under that target
      // - Otherwise, nest under the item above
      if (!targetIsChild && draggedId !== targetId) {
        // Dropping on a root item - nest under target
        draggedItemCopy.parent = targetId;
        debug.log('[ExperienceDrag] Making item a child of drop target', { newParent: targetId });
      } else if (itemAbove && !itemAbove.isChild) {
        // Item above is a root item - can nest under it
        draggedItemCopy.parent = itemAboveId;
        debug.log('[ExperienceDrag] Making item a child of item above', { newParent: itemAboveId, itemAboveText: itemAbove.text });
      } else if (itemAbove && itemAbove.isChild) {
        // Item above is a child - become sibling (same parent)
        draggedItemCopy.parent = itemAbove.parent;
        debug.log('[ExperienceDrag] Becoming sibling of item above', { newParent: itemAbove.parent });
      } else {
        debug.log('[ExperienceDrag] No valid item to nest under');
      }
    } else if (targetIsChild && draggedParentId !== targetParentId && !promotionIntent) {
      // Dragged item should adopt the same parent as target (become sibling)
      draggedItemCopy.parent = targetItem.parent;
      debug.log('[ExperienceDrag] Reparenting to same parent as target', { newParent: targetItem.parent });
    } else if (!targetIsChild && draggedParentId && !nestingIntent) {
      // Target is a root item and dragged item was a child → promote to root
      delete draggedItemCopy.parent;
      debug.log('[ExperienceDrag] Promoting child to root level');
    }
    // If both have same parent or both are root → just reorder (no parent change)

    // Find indices for arrayMove
    const oldIndex = reorderedItems.findIndex(
      (item) => item._id.toString() === draggedId
    );

    // For promotion by drag-left, position above the former parent item
    let newIndex;
    if (promotedToParentPosition && draggedParentId) {
      newIndex = reorderedItems.findIndex(
        (item) => item._id.toString() === draggedParentId
      );
      debug.log('[ExperienceDrag] Positioning promoted item above former parent', { parentId: draggedParentId, newIndex });
    } else {
      newIndex = reorderedItems.findIndex(
        (item) => item._id.toString() === targetId
      );
    }

    if (oldIndex === -1 || newIndex === -1) {
      debug.warn('[ExperienceDrag] Could not find item indices', { oldIndex, newIndex });
      return;
    }

    // Apply position reorder
    reorderedItems = arrayMove(reorderedItems, oldIndex, newIndex);

    // Validate before calling API
    if (reorderedItems.length === 0) {
      debug.warn('[ExperienceDrag] Cannot reorder - empty reorderedItems array');
      return;
    }

    if (reorderedItems.length !== experience.plan_items.length) {
      debug.error('[ExperienceDrag] Item count mismatch', {
        reorderedCount: reorderedItems.length,
        originalCount: experience.plan_items.length
      });
      return;
    }

    // Validate all items have _id
    const missingIds = reorderedItems.filter(item => !item._id);
    if (missingIds.length > 0) {
      debug.error('[ExperienceDrag] Items missing _id', {
        missingCount: missingIds.length,
        sample: missingIds[0]
      });
      return;
    }

    debug.log('[ExperienceDrag] Reordered items', {
      activeId: active.id,
      overId: over.id,
      oldIndex,
      newIndex,
      hierarchyChanged: draggedParentId !== (draggedItemCopy.parent?.toString() || null)
    });

    if (onReorderExperiencePlanItems) {
      onReorderExperiencePlanItems(experience._id, reorderedItems, active.id.toString());
    }
  };

  // Helper to flatten and mark children
  const flattenPlanItems = (items) => {
    const result = [];
    const addItem = (item, isChild = false) => {
      const isVisible =
        !isChild ||
        (expandedParents.has(item.parent) &&
          animatingCollapse !== item.parent);
      result.push({ ...item, isChild, isVisible });
      items
        .filter(
          (sub) =>
            sub.parent &&
            sub.parent.toString() === item._id.toString()
        )
        .forEach((sub) => addItem(sub, true));
    };
    items
      .filter((item) => !item.parent)
      .forEach((item) => addItem(item, false));
    return result;
  };

  const flattenedItems = flattenPlanItems(experience.plan_items);
  const itemsToRender = flattenedItems.filter(
    (item) =>
      item.isVisible ||
      (item.isChild && animatingCollapse === item.parent)
  );

  // Get all item IDs for sortable context (parents and children)
  const allItemIds = itemsToRender.map((item) => item._id.toString());

  return (
    <div className="experience-plan-view mt-4">
      {/* Collaborators and Action Buttons Row */}
      <div className="plan-header-row mb-4">
        {/* Collaborators Display - Left Side */}
        <UsersListDisplay
          owner={experienceOwner}
          users={experienceCollaborators}
          messageKey="CreatingPlan"
          loading={
            experienceOwnerLoading ||
            experienceCollaboratorsLoading
          }
          reserveSpace={true}
        />

        {/* Action Buttons - Right Side */}
        {isOwner(user, experience) && (
          <div className="plan-action-buttons">
            <button
              className="btn btn-primary"
              onClick={() => handleAddExperiencePlanItem()}
            >
              <BsPlusCircle className="me-2" />
              {lang.en.button.addPlanItem}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => openCollaboratorModal("experience")}
            >
              <FaUserPlus className="me-2" />
              {lang.en.button.addCollaborators}
            </button>
          </div>
        )}
      </div>

      {/* Plan Items List with Drag and Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allItemIds}
          strategy={verticalListSortingStrategy}
        >
          {itemsToRender.map((planItem) => (
            <SortableExperiencePlanItem
              key={planItem._id}
              planItem={planItem}
              experience={experience}
              user={user}
              expandedParents={expandedParents}
              canEdit={canEdit}
              toggleExpanded={toggleExpanded}
              handleAddExperiencePlanItem={handleAddExperiencePlanItem}
              handleEditExperiencePlanItem={handleEditExperiencePlanItem}
              setPlanItemToDelete={setPlanItemToDelete}
              setShowPlanDeleteModal={setShowPlanDeleteModal}
              lang={lang}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
