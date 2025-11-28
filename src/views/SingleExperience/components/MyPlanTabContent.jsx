/**
 * MyPlanTabContent Component
 * Displays user's plan with CRUD operations, metrics, and collaborative features
 * Updated to match The Plan tab design for cost and planning days display
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BsPlusCircle, BsPersonPlus, BsArrowRepeat, BsThreeDotsVertical } from 'react-icons/bs';
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
import Loading from '../../../components/Loading/Loading';
import Alert from '../../../components/Alert/Alert';
import { Text } from '../../../components/design-system';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import DragHandle from '../../../components/DragHandle/DragHandle';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import MetricsBar from '../../../components/MetricsBar/MetricsBar';
import CostsList from '../../../components/CostsList';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatDateMetricCard, formatDateForInput } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { formatCostEstimate } from '../../../utilities/cost-utils';
import { lang } from '../../../lang.constants';
import debug from '../../../utilities/debug';

/**
 * PlanActionsDropdown - Unified dropdown for Add, Manage Collaborators, and Sync actions
 */
function PlanActionsDropdown({
  canEdit,
  isPlanOwner,
  showSyncButton,
  loading,
  handleAddPlanInstanceItem,
  openCollaboratorModal,
  handleSyncPlan
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

  // Don't render if no actions are available
  if (!canEdit && !isPlanOwner && !showSyncButton) {
    return null;
  }

  return (
    <div className="plan-actions-dropdown" ref={dropdownRef}>
      <button
        className="btn btn-primary dropdown-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Plan actions"
      >
        <BsPlusCircle />
      </button>
      {isOpen && (
        <div className="plan-actions-menu">
          {canEdit && (
            <button
              className="plan-actions-item"
              onClick={() => {
                handleAddPlanInstanceItem();
                setIsOpen(false);
              }}
            >
              <BsPlusCircle className="me-2" />
              {lang.current.button.addPlanItem}
            </button>
          )}
          {isPlanOwner && (
            <button
              className="plan-actions-item"
              onClick={() => {
                openCollaboratorModal("plan");
                setIsOpen(false);
              }}
            >
              <BsPersonPlus className="me-2" />
              {lang.current.button.addCollaborators}
            </button>
          )}
          {showSyncButton && (
            <button
              className="plan-actions-item"
              onClick={() => {
                handleSyncPlan();
                setIsOpen(false);
              }}
              disabled={loading}
            >
              <BsArrowRepeat className={`me-2 ${loading ? 'spin' : ''}`} />
              {loading ? lang.current.button.syncing : lang.current.button.syncNow}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SortablePlanItem - Individual plan item with drag-and-drop support
 */
function SortablePlanItem({
  planItem,
  currentPlan,
  user,
  idEquals,
  expandedParents,
  canEdit,
  toggleExpanded,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  handlePlanItemToggleComplete,
  hoveredPlanItem,
  setHoveredPlanItem,
  handleViewPlanItemDetails,
  planOwner,
  planCollaborators,
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
    id: (planItem.plan_item_id || planItem._id).toString(),
    disabled: !canEdit, // Only allow dragging if user can edit
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plan-item-id={planItem.plan_item_id || planItem._id}
      className={`plan-item-card mb-3 overflow-hidden ${
        planItem.isVisible ? "" : "collapsed"
      } ${isDragging ? 'dragging' : ''} ${planItem.isChild ? 'is-child-item' : ''}`}
    >
      <div className="plan-item-header p-3 p-md-4">
        <div className="plan-item-tree">
          {!planItem.isChild ? (
            (() => {
              const hasChildren = currentPlan.plan.some(
                (sub) =>
                  sub.parent &&
                  sub.parent.toString() ===
                    (
                      planItem.plan_item_id ||
                      planItem._id
                    ).toString()
              );
              if (hasChildren) {
                const itemId = planItem.plan_item_id || planItem._id;
                const isExpanded = expandedParents.has(itemId);
                return (
                  <button
                    type="button"
                    className="expand-toggle"
                    onClick={() => toggleExpanded(itemId)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                );
              } else {
                return (
                  <span className="no-child-arrow">
                    •
                  </span>
                );
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

        {/* Drag handle - positioned between title and action buttons */}
        {canEdit && (
          <div {...attributes} {...listeners} className="drag-handle-wrapper" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <DragHandle
              isDragging={isDragging}
              disabled={!canEdit}
            />
          </div>
        )}

        <div className="plan-item-actions">
          {(() => {
            // Get plan owner for permission checks
            let planOwner = currentPlan?.user;
            if (!planOwner) {
              const ownerPermission =
                currentPlan?.permissions?.find(
                  (p) => p.type === "owner"
                );
              if (ownerPermission?.user) {
                planOwner = ownerPermission.user;
              }
            }

            // Check if user can edit this plan (owner or collaborator)
            const canEditPlan =
              currentPlan &&
              ((planOwner && idEquals(planOwner._id, user._id)) ||
                currentPlan.permissions?.some((p) =>
                  idEquals(p._id, user._id) && ["owner", "collaborator"].includes(p.type)
                ));

            return (
              <div className="d-flex gap-1">
                {canEditPlan && !planItem.parent && (
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() =>
                      handleAddPlanInstanceItem(
                        planItem.plan_item_id ||
                          planItem._id
                      )
                    }
                    aria-label={`${lang.current.button.addChild} to ${planItem.text}`}
                    title={lang.current.button.addChild}
                  >
                    ✚
                  </button>
                )}
                {canEditPlan && (
                  <>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() =>
                        handleEditPlanInstanceItem(
                          planItem
                        )
                      }
                      aria-label={`${lang.current.button.edit} ${planItem.text}`}
                      title={lang.current.tooltip.edit}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => {
                        setPlanInstanceItemToDelete(
                          planItem
                        );
                        setShowPlanInstanceDeleteModal(
                          true
                        );
                      }}
                      aria-label={`${lang.current.button.delete} ${planItem.text}`}
                      title={lang.current.tooltip.delete}
                    >
                      🗑️
                    </button>
                  </>
                )}
                <button
                  className={`btn btn-sm ${
                    planItem.complete
                      ? "btn-success"
                      : "btn-outline-success"
                  }`}
                  type="button"
                  onClick={() => handlePlanItemToggleComplete(planItem)}
                  onMouseEnter={() =>
                    setHoveredPlanItem(
                      planItem._id ||
                        planItem.plan_item_id
                    )
                  }
                  onMouseLeave={() =>
                    setHoveredPlanItem(null)
                  }
                  aria-label={
                    planItem.complete
                      ? `${lang.current.button.undoComplete} ${planItem.text}`
                      : `${lang.current.button.markComplete} ${planItem.text}`
                  }
                  aria-pressed={!!planItem.complete}
                  title={
                    planItem.complete
                      ? lang.current.button.undoComplete
                      : lang.current.button.markComplete
                  }
                >
                  {planItem.complete
                    ? hoveredPlanItem ===
                      (planItem._id ||
                        planItem.plan_item_id)
                      ? lang.current.button.undoComplete
                      : lang.current.button.done
                    : lang.current.button.markComplete}
                </button>
              </div>
            );
          })()}
        </div>
      </div>
      {/* Always show details section for View Details button */}
      <div className="plan-item-details p-2 p-md-3">
          <div className="plan-item-meta">
            {Number(planItem.cost) > 0 && (
              <span className="plan-item-cost">
                <CostEstimate
                  cost={planItem.cost}
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

            {/* Assignment indicator */}
            {planItem.assignedTo && (() => {
              const assigneeId = planItem.assignedTo._id || planItem.assignedTo;
              const assignee = [planOwner, ...planCollaborators].find(c => {
                const collabId = c?._id || c?.user?._id;
                return collabId === assigneeId;
              });
              const assigneeName = assignee?.name || assignee?.user?.name || 'Assigned';

              return (
                <Link
                  to={`/profile/${assigneeId}`}
                  className="plan-item-assigned"
                  title={`Assigned to ${assigneeName} - Click to view profile`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  👤 {assigneeName}
                </Link>
              );
            })()}

            {/* Notes count indicator - clickable to open details modal with notes tab */}
            {planItem.details?.notes?.length > 0 && (
              <span
                className="plan-item-notes-count"
                title="Click to view notes"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewPlanItemDetails(planItem, 'notes');
                }}
              >
                📝 {planItem.details.notes.length}
              </span>
            )}

            {/* View Details button - always visible */}
            <button
              className="btn-view-details"
              onClick={(e) => {
                e.stopPropagation();
                handleViewPlanItemDetails(planItem);
              }}
            type="button"
            title="View notes, assignments, and other details"
          >
            📋 Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyPlanTabContent({
  // Plan selection & user
  selectedPlanId,
  user,
  idEquals,

  // Plan data
  collaborativePlans,
  planOwner,
  planCollaborators,
  planOwnerLoading,
  planCollaboratorsLoading,

  // UI state
  hashSelecting,
  showSyncButton,
  showSyncAlert,
  dismissSyncAlert,
  loading,
  plansLoading,
  expandedParents,
  animatingCollapse,

  // Date picker state
  displayedPlannedDate,
  setIsEditingDate,
  setPlannedDate,
  setShowDatePicker,
  plannedDateRef,

  // Handlers
  handleSyncPlan,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  openCollaboratorModal,
  toggleExpanded,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  handlePlanItemToggleComplete,
  handleViewPlanItemDetails,

  // Hover state
  hoveredPlanItem,
  setHoveredPlanItem,

  // Language strings
  lang,

  // Reorder handler
  onReorderPlanItems,

  // Cost tracking
  costs = [],
  costSummary = null,
  costsLoading = false,
  onAddCost,
  onUpdateCost,
  onDeleteCost
}) {
  // Setup sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event with hierarchy support
  const handleDragEnd = (event) => {
    const { active, over } = event;

    // Debug: Log full event structure to verify delta is available
    debug.log('[Drag] Full event structure', {
      hasActive: !!active,
      hasOver: !!over,
      delta: event.delta,
      deltaX: event.delta?.x,
      deltaY: event.delta?.y
    });

    if (!active || !over || active.id === over.id) {
      return; // No change needed
    }

    if (!currentPlan || !currentPlan.plan) {
      debug.warn('[Drag] Cannot reorder - no plan data');
      return;
    }

    // Find the dragged item and target item
    const draggedItem = currentPlan.plan.find(
      (item) => (item.plan_item_id || item._id).toString() === active.id.toString()
    );
    const targetItem = currentPlan.plan.find(
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
    // Drag right (40px+) = nest under target, Drag left (40px+) = promote to root
    // Use event.delta.x which dnd-kit provides directly (more reliable than rect coordinates)
    const NESTING_THRESHOLD = 40; // pixels
    const PROMOTION_THRESHOLD = -40; // pixels - drag 40px left to indicate promotion
    const horizontalOffset = event.delta?.x || 0;
    const nestingIntent = horizontalOffset > NESTING_THRESHOLD;
    const promotionIntent = horizontalOffset < PROMOTION_THRESHOLD;
    debug.log('[Drag] Hierarchy detection', { horizontalOffset, nestingIntent, promotionIntent, thresholds: { nest: NESTING_THRESHOLD, promote: PROMOTION_THRESHOLD } });

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
    let reorderedItems = currentPlan.plan.map(item => ({ ...item }));

    // Find the dragged item in our copy
    const draggedItemCopy = reorderedItems.find(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    // Check if dragged item has children (can't nest a parent under another item)
    const draggedHasChildren = currentPlan.plan.some(
      item => item.parent?.toString() === draggedId
    );

    // Determine hierarchy change based on context:
    // 1. If promotion intent AND dragged is a child → promote to root (drag left), position above parent
    // 2. If nesting intent AND dragged has no children → make child of item above (drag right)
    // 3. If target is a child item, dragged item becomes sibling (same parent)
    // 4. If target is a parent item and dragged is child (no nesting intent) → promote to root
    // 5. If both are at same level → simple reorder

    // Get the flattened visual order to find item above
    const flattenedItems = flattenPlanItems(currentPlan.plan);
    const draggedFlatIndex = flattenedItems.findIndex(
      (item) => (item.plan_item_id || item._id).toString() === draggedId
    );

    let promotedToParentPosition = false; // Track if we need special positioning
    if (promotionIntent && draggedIsChild) {
      // Explicit promotion: dragged left outside container alignment → become root item
      // Position above former parent for cognitive sense
      delete draggedItemCopy.parent;
      promotedToParentPosition = true;
      debug.log('[Drag] Promoting child to root (drag left intent), will position above parent');
    } else if (nestingIntent && !draggedHasChildren && !draggedIsChild) {
      // Nesting intent detected (drag right) - can nest under item above OR target
      // Only works for root items (not already a child) with no children of their own
      const itemAbove = draggedFlatIndex > 0 ? flattenedItems[draggedFlatIndex - 1] : null;
      const itemAboveId = itemAbove ? (itemAbove.plan_item_id || itemAbove._id).toString() : null;

      // Determine which item to nest under:
      // - If dropping ON a different root item, nest under that target
      // - Otherwise, nest under the item above
      if (!targetIsChild && draggedId !== targetId) {
        // Dropping on a root item - nest under target
        draggedItemCopy.parent = targetId;
        debug.log('[Drag] Making item a child of drop target', { newParent: targetId });
      } else if (itemAbove && !itemAbove.isChild) {
        // Item above is a root item - can nest under it
        draggedItemCopy.parent = itemAboveId;
        debug.log('[Drag] Making item a child of item above', { newParent: itemAboveId, itemAboveText: itemAbove.text });
      } else if (itemAbove && itemAbove.isChild) {
        // Item above is a child - become sibling (same parent)
        draggedItemCopy.parent = itemAbove.parent;
        debug.log('[Drag] Becoming sibling of item above', { newParent: itemAbove.parent });
      } else {
        debug.log('[Drag] No valid item to nest under');
      }
    } else if (targetIsChild && draggedParentId !== targetParentId && !promotionIntent) {
      // Dragged item should adopt the same parent as target (become sibling)
      draggedItemCopy.parent = targetItem.parent;
      debug.log('[Drag] Reparenting to same parent as target', { newParent: targetItem.parent });
    } else if (!targetIsChild && draggedParentId && !nestingIntent) {
      // Target is a root item and dragged item was a child → promote to root
      delete draggedItemCopy.parent;
      debug.log('[Drag] Promoting child to root level');
    }
    // If both have same parent or both are root → just reorder (no parent change)

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

    // Call parent handler to update backend (pass draggedItemId for highlighting)
    if (onReorderPlanItems) {
      onReorderPlanItems(selectedPlanId, reorderedItems, active.id.toString());
    }
  };

  // Helper to flatten and mark children (same as Experience Plan Items)
  const flattenPlanItems = (items) => {
    const result = [];
    const addItem = (item, isChild = false) => {
      const isVisible =
        !isChild ||
        (expandedParents.has(item.parent) &&
          animatingCollapse !== item.parent);
      result.push({ ...item, isChild, isVisible });

      // Debug logging
      if (item.parent) {
        debug.log(
          `Item with parent: "${item.text}", parent: ${item.parent}, plan_item_id: ${item.plan_item_id}, _id: ${item._id}`
        );
      }

      items
        .filter(
          (sub) =>
            sub.parent &&
            sub.parent.toString() ===
              (item.plan_item_id || item._id).toString()
        )
        .forEach((sub) => addItem(sub, true));
    };
    items
      .filter((item) => !item.parent)
      .forEach((item) => addItem(item, false));
    return result;
  };

  // Get current plan
  const currentPlan = collaborativePlans.find(
    (p) => idEquals(p._id, selectedPlanId)
  );

  // Permission checks
  const isSuperAdmin = user?.role === 'super_admin' || user?.isSuperAdmin === true;
  const isPlanOwner = planOwner && idEquals(planOwner._id, user._id);
  const isPlanCollaborator =
    currentPlan &&
    currentPlan.permissions?.some(
      (p) => idEquals(p._id, user._id) && ["owner", "collaborator"].includes(p.type)
    );
  const canEdit = isSuperAdmin || isPlanOwner || isPlanCollaborator;

  // Plan not found
  if (!currentPlan) {
    return (
      <div className="my-plan-view mt-4">
        <p style={{ color: 'var(--bs-gray-600)', textAlign: 'center' }}>
          {lang.current.alert.planNotFound}
        </p>
      </div>
    );
  }

  // Check if metrics data is still loading
  // Plan exists but metrics might not be fully computed yet
  const metricsLoading = plansLoading || loading;

  // Build metrics array for MetricsBar
  const planMetrics = metricsLoading ? [] : [
    {
      id: 'planned-date',
      title: lang.current.label.plannedDate,
      type: 'date',
      value: currentPlan.planned_date,
      icon: '📅',
      // Tooltip shows full date when truncated
      tooltip: currentPlan.planned_date ? formatDateMetricCard(currentPlan.planned_date) : null,
      onClick: !currentPlan.planned_date ? () => {
        setIsEditingDate(true);
        setPlannedDate(
          displayedPlannedDate
            ? formatDateForInput(displayedPlannedDate)
            : ""
        );
        setShowDatePicker(true);
      } : undefined
    },
    {
      id: 'total-cost',
      title: (lang?.current?.label?.estimatedCost || 'Estimated Cost').replace(':', ''),
      type: 'cost',
      value: currentPlan.total_cost || 0,
      icon: '💰',
      // Tooltip always shows the actual cost estimate value with prefix
      tooltip: `${lang.current.label.actualCostEstimate} $${(currentPlan.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    {
      id: 'completion',
      title: lang.current.label.completion,
      type: 'completion',
      value: currentPlan.completion_percentage || 0,
      icon: '✅',
      color: (currentPlan.completion_percentage || 0) >= 100 ? 'success' :
             (currentPlan.completion_percentage || 0) >= 50 ? 'primary' : 'default'
    },
    {
      id: 'planning-time',
      title: lang.current.label.planningTime,
      type: 'days',
      value: currentPlan.max_days > 0 ? currentPlan.max_days : null,
      icon: '⏱️',
      // Tooltip shows full planning time when truncated
      tooltip: currentPlan.max_days > 0 ? formatPlanningTime(currentPlan.max_days) : null
    }
  ];

  // Plan metadata using MetricsBar component
  const planMetadata = (
    <div className="plan-metrics-container mb-4" ref={plannedDateRef}>
      {metricsLoading ? (
        <div className="row g-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-md-3 col-sm-6">
              <div className="metric-card">
                <SkeletonLoader variant="text" width="60px" height="14px" className="mb-2" />
                <SkeletonLoader variant="text" width="80px" height="24px" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <MetricsBar metrics={planMetrics} compact />
      )}
    </div>
  );

  // Show skeleton loaders while plans are loading
  if (!currentPlan.plan || currentPlan.plan.length === 0) {
    if (plansLoading) {
      return (
        <div className="my-plan-view mt-4">
          {hashSelecting && (
            <div className="mb-3">
              <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
            </div>
          )}
          {planMetadata}
          <div className="plan-items-skeleton mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="plan-item-card mb-3 p-3 p-md-4">
                <div className="d-flex gap-3 mb-3">
                  <SkeletonLoader variant="circle" width={24} height={24} />
                  <SkeletonLoader variant="text" width="70%" height={20} />
                </div>
                <SkeletonLoader variant="text" lines={2} height={16} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Show "No Plan Items" message when plans loaded but empty
    return (
      <div className="my-plan-view mt-4">
        {hashSelecting && (
          <div className="mb-3">
            <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
          </div>
        )}
        {showSyncButton && showSyncAlert && (
          <Alert
            type="warning"
            dismissible={true}
            onDismiss={dismissSyncAlert}
            title={lang.current.alert.planOutOfSync}
            message={lang.current.alert.planOutOfSyncMessage}
            className="mb-4"
            actions={
              <button
                className="btn btn-warning btn-sm"
                onClick={handleSyncPlan}
                disabled={loading}
              >
                <BsArrowRepeat className={`me-1 ${loading ? 'spin' : ''}`} />
                {loading ? lang.current.button.syncing : lang.current.button.syncNow}
              </button>
            }
          />
        )}
        <div className="plan-header-row mb-4">
          <UsersListDisplay
            owner={planOwner}
            users={planCollaborators}
            messageKey="PlanningExperience"
            loading={
              planOwnerLoading || planCollaboratorsLoading
            }
            reserveSpace={true}
          />
          <PlanActionsDropdown
            canEdit={canEdit}
            isPlanOwner={isPlanOwner}
            showSyncButton={showSyncButton}
            loading={loading}
            handleAddPlanInstanceItem={handleAddPlanInstanceItem}
            openCollaboratorModal={openCollaboratorModal}
            handleSyncPlan={handleSyncPlan}
          />
        </div>
        {planMetadata}
        <p style={{ color: 'var(--bs-gray-600)', textAlign: 'center' }}>
          {lang.current.alert.noPlanItems}
        </p>
      </div>
    );
  }

  // Render plan items
  const flattenedItems = flattenPlanItems(currentPlan.plan);
  const itemsToRender = flattenedItems.filter(
    (item) =>
      item.isVisible ||
      (item.isChild && animatingCollapse === item.parent)
  );

  return (
    <div className="my-plan-view mt-4">
      {/* Show loading indicator when we detected a hash deep-link and plans are still loading */}
      {hashSelecting && (
        <div className="mb-3">
          <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
        </div>
      )}

      {/* Alert Area - For all plan-related alerts */}
      {showSyncButton && showSyncAlert && (
        <Alert
          type="warning"
          dismissible={true}
          onDismiss={dismissSyncAlert}
          title={lang.current.alert.planOutOfSync}
          message={lang.current.alert.planOutOfSyncMessage}
          className="mb-4"
          actions={
            <button
              className="btn btn-warning btn-sm"
              onClick={handleSyncPlan}
              disabled={loading}
            >
              <BsArrowRepeat className={`me-1 ${loading ? 'spin' : ''}`} />
              {loading ? lang.current.button.syncing : lang.current.button.syncNow}
            </button>
          }
        />
      )}

      {/* Collaborators and Action Buttons Row */}
      <div className="plan-header-row mb-4">
        {/* Collaborators Display - Left Side */}
        <UsersListDisplay
          owner={planOwner}
          users={planCollaborators}
          messageKey="PlanningExperience"
          loading={
            planOwnerLoading || planCollaboratorsLoading
          }
          reserveSpace={true}
        />

        {/* Action Buttons - Right Side */}
        <PlanActionsDropdown
          canEdit={canEdit}
          isPlanOwner={isPlanOwner}
          showSyncButton={showSyncButton}
          loading={loading}
          handleAddPlanInstanceItem={handleAddPlanInstanceItem}
          openCollaboratorModal={openCollaboratorModal}
          handleSyncPlan={handleSyncPlan}
        />
      </div>

      {/* Plan Metrics Cards */}
      {planMetadata}

      {/* Plan Items List with Drag-and-Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={itemsToRender.map(item => (item.plan_item_id || item._id).toString())}
          strategy={verticalListSortingStrategy}
        >
          {itemsToRender.map((planItem) => (
            <SortablePlanItem
              key={planItem.plan_item_id || planItem._id}
              planItem={planItem}
              currentPlan={currentPlan}
              user={user}
              idEquals={idEquals}
              expandedParents={expandedParents}
              canEdit={canEdit}
              toggleExpanded={toggleExpanded}
              handleAddPlanInstanceItem={handleAddPlanInstanceItem}
              handleEditPlanInstanceItem={handleEditPlanInstanceItem}
              setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
              setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
              handlePlanItemToggleComplete={handlePlanItemToggleComplete}
              hoveredPlanItem={hoveredPlanItem}
              setHoveredPlanItem={setHoveredPlanItem}
              handleViewPlanItemDetails={handleViewPlanItemDetails}
              planOwner={planOwner}
              planCollaborators={planCollaborators}
              lang={lang}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Costs Section */}
      <CostsList
        planId={selectedPlanId}
        costs={costs}
        collaborators={planOwner ? [planOwner, ...(planCollaborators || [])] : planCollaborators || []}
        planItems={currentPlan.plan || []}
        canEdit={canEdit}
        onAddCost={onAddCost}
        onUpdateCost={onUpdateCost}
        onDeleteCost={onDeleteCost}
        loading={costsLoading}
        showSummary={true}
        compact={false}
      />
    </div>
  );
}
