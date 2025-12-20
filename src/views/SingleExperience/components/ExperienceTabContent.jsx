/**
 * ExperienceTabContent Component
 * Displays the experience's plan items with collaborators and action buttons
 * This is the "The Plan" tab showing the master plan items defined by the experience owner
 */

import { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BsPlusCircle, BsPersonPlus, BsListUl, BsCardList } from 'react-icons/bs';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { lang } from '../../../lang.constants';
import ActionsMenu from '../../../components/ActionsMenu';
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
import SearchableSelect from '../../../components/FormField/SearchableSelect';
import { Text } from '../../../components/design-system';
import { useUIPreference } from '../../../hooks/useUIPreference';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { isOwner } from '../../../utilities/permissions';
import { sanitizeUrl, sanitizeText } from '../../../utilities/sanitize';
import debug from '../../../utilities/debug';

// View options for experience plan items display
const VIEW_OPTIONS = [
  { value: 'card', label: lang.current.label.cardView, icon: BsCardList },
  { value: 'compact', label: lang.current.label.compactView, icon: BsListUl }
];

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
          <div {...attributes} {...listeners} className="drag-handle-wrapper" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <DragHandle
              isDragging={isDragging}
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
                  aria-label={`${lang.current.button.addChild} to ${planItem.text}`}
                  title={lang.current.button.addChild}
                >
                  ✚
                </button>
              )}
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() =>
                  handleEditExperiencePlanItem(planItem)
                }
                aria-label={`${lang.current.button.edit} ${planItem.text}`}
                title={lang.current.tooltip.edit}
              >
                ✏️
              </button>
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => {
                  setPlanItemToDelete(planItem._id);
                  setShowPlanDeleteModal(true);
                }}
                aria-label={`${lang.current.button.delete} ${planItem.text}`}
                title={lang.current.tooltip.delete}
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

/**
 * ExperiencePlanActionsDropdown - Unified dropdown for Add Plan Item and Collaborators actions
 */
function ExperiencePlanActionsDropdown({
  handleAddExperiencePlanItem,
  openCollaboratorModal,
  lang
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="plan-actions-dropdown" ref={dropdownRef}>
      <button
        className="btn btn-primary dropdown-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={lang.current.aria.planActionsMenu}
      >
        <BsPlusCircle />
      </button>
      {isOpen && (
        <div className="plan-actions-menu">
          <button
            className="plan-actions-item"
            onClick={() => {
              handleAddExperiencePlanItem();
              setIsOpen(false);
            }}
          >
            <BsPlusCircle className="me-2" />
            {lang.current.button.addPlanItem}
          </button>
          <button
            className="plan-actions-item"
            onClick={() => {
              openCollaboratorModal("experience");
              setIsOpen(false);
            }}
          >
            <BsPersonPlus className="me-2" />
            {lang.current.button.addCollaborators}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * SortableCompactExperiencePlanItem - Compact one-line view with drag-and-drop for experience plan items
 * Memoized to prevent unnecessary re-renders
 */
const SortableCompactExperiencePlanItem = memo(function SortableCompactExperiencePlanItem({
  planItem,
  canEdit,
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

  const isChild = !!planItem.parent;

  // Build actions array for ActionsMenu
  const actions = useMemo(() => [
    {
      id: 'edit',
      label: lang.current.tooltip.edit,
      icon: <FaEdit />,
      onClick: () => handleEditExperiencePlanItem(planItem),
    },
    {
      id: 'delete',
      label: lang.current.tooltip.delete,
      icon: <FaTrash />,
      variant: 'danger',
      onClick: () => {
        setPlanItemToDelete(planItem._id);
        setShowPlanDeleteModal(true);
      },
    },
  ], [lang, planItem, handleEditExperiencePlanItem, setPlanItemToDelete, setShowPlanDeleteModal]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plan-item-id={planItem._id}
      className={`compact-plan-item ${isChild ? 'is-child' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      {/* Drag handle */}
      {canEdit && (
        <div {...attributes} {...listeners} className="compact-drag-handle" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
          <DragHandle
            isDragging={isDragging}
            disabled={!canEdit}
          />
        </div>
      )}

      {/* Hierarchy indicator */}
      <span className="compact-item-indent">
        {isChild ? '↳' : '•'}
      </span>

      {/* Item text */}
      <span className="compact-item-text">
        {planItem.url ? (() => {
          const safeUrl = sanitizeUrl(planItem.url);
          return safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {sanitizeText(planItem.text)}
            </a>
          ) : sanitizeText(planItem.text);
        })() : (
          sanitizeText(planItem.text)
        )}
      </span>

      {/* Meta info - cost and planning days */}
      <span className="compact-item-meta">
        {Number(planItem.cost_estimate) > 0 && (
          <span className="compact-meta-cost" title={`Cost estimate: $${planItem.cost_estimate}`}>
            💰
          </span>
        )}
        {Number(planItem.planning_days) > 0 && (
          <span className="compact-meta-days" title={`${planItem.planning_days} ${planItem.planning_days === 1 ? 'day' : 'days'}`}>
            ⏱️
          </span>
        )}
      </span>

      {/* Actions menu */}
      {canEdit && (
        <ActionsMenu
          actions={actions}
          size="sm"
          ariaLabel={lang.current.aria.itemActions}
        />
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.planItem._id === nextProps.planItem._id &&
    prevProps.planItem.text === nextProps.planItem.text &&
    prevProps.planItem.parent === nextProps.planItem.parent &&
    prevProps.planItem.cost_estimate === nextProps.planItem.cost_estimate &&
    prevProps.planItem.planning_days === nextProps.planItem.planning_days &&
    prevProps.canEdit === nextProps.canEdit
  );
});

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
  lang,

  // Real-time presence
  presenceConnected = false,
  experienceMembers = []
}) {
  // View state for plan items display (card or compact) - persisted in user preferences
  // Uses shared key 'viewMode.planItems' so preference syncs between Experience and Plan views
  const [rawPlanItemsView, setPlanItemsView] = useUIPreference('viewMode.planItems', 'compact');

  // ExperienceTabContent only supports 'card' and 'compact' views
  // Fallback 'timeline' and 'activity' to 'compact' since they're only available in MyPlanTabContent
  const planItemsView = useMemo(() => {
    return (rawPlanItemsView === 'timeline' || rawPlanItemsView === 'activity') 
      ? 'compact' 
      : rawPlanItemsView;
  }, [rawPlanItemsView]);

  // Compute online user IDs from presence data
  // Always include the current user when presence is connected (they're always online to themselves)
  const onlineUserIds = useMemo(() => {
    if (!presenceConnected) {
      return new Set();
    }
    const ids = new Set(experienceMembers?.map(member => member.userId?.toString()).filter(Boolean) || []);
    // Always include the current user - they should see themselves as online
    if (user?._id) {
      ids.add(user._id.toString());
    }
    return ids;
  }, [presenceConnected, experienceMembers, user?._id]);

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

    // Debug: Log full event structure to verify delta is available
    debug.log('[ExperienceDrag] Full event structure', {
      hasActive: !!active,
      hasOver: !!over,
      delta: event.delta,
      deltaX: event.delta?.x,
      deltaY: event.delta?.y
    });

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

    // Determine hierarchy change type for visual feedback
    const newParentId = draggedItemCopy.parent?.toString() || null;
    const hierarchyChanged = draggedParentId !== newParentId;
    let hierarchyChangeType = null;
    if (hierarchyChanged) {
      if (newParentId && !draggedParentId) {
        // Was root, now has parent → nested
        hierarchyChangeType = 'nested';
      } else if (!newParentId && draggedParentId) {
        // Was child, now root → promoted
        hierarchyChangeType = 'promoted';
      } else if (newParentId && draggedParentId && newParentId !== draggedParentId) {
        // Changed parents → nested (reparented)
        hierarchyChangeType = 'nested';
      }
    }

    debug.log('[ExperienceDrag] Reordered items', {
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
        // Remove any existing hierarchy classes
        draggedItemElement.classList.remove('hierarchy-nested', 'hierarchy-promoted');
        // Force reflow to restart animation
        void draggedItemElement.offsetWidth;
        // Add the appropriate class
        draggedItemElement.classList.add(`hierarchy-${hierarchyChangeType}`);
        // Remove class after animation completes
        setTimeout(() => {
          draggedItemElement.classList.remove(`hierarchy-${hierarchyChangeType}`);
        }, 500);
      }
    }

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
          showPresence={presenceConnected}
          onlineUserIds={onlineUserIds}
        />

        {/* Action Dropdown - Right Side */}
        {isOwner(user, experience) && (
          <ExperiencePlanActionsDropdown
            handleAddExperiencePlanItem={handleAddExperiencePlanItem}
            openCollaboratorModal={openCollaboratorModal}
            lang={lang}
          />
        )}
      </div>

      {/* View Toggle - Right aligned */}
      <div className="plan-view-toggle mb-3 d-flex justify-content-end">
        <SearchableSelect
          options={VIEW_OPTIONS}
          value={planItemsView}
          onChange={setPlanItemsView}
          placeholder="View"
          searchable={false}
          size="sm"
          className="plan-view-select"
        />
      </div>

      {/* Plan Items List - Card View with Drag and Drop */}
      {planItemsView === 'card' && (
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
      )}

      {/* Plan Items List - Compact View with Drag and Drop */}
      {planItemsView === 'compact' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={allItemIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="compact-plan-items-list">
              {itemsToRender.map((planItem) => (
                <SortableCompactExperiencePlanItem
                  key={planItem._id}
                  planItem={planItem}
                  canEdit={canEdit}
                  handleEditExperiencePlanItem={handleEditExperiencePlanItem}
                  setPlanItemToDelete={setPlanItemToDelete}
                  setShowPlanDeleteModal={setShowPlanDeleteModal}
                  lang={lang}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
