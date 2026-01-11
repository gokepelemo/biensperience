/**
 * MyPlanTabContent Component
 * Displays user's plan with CRUD operations, metrics, and collaborative features
 * Updated to match The Plan tab design for cost and planning days display
 */

import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BsPlusCircle,
  BsPersonPlus,
  BsArrowRepeat,
  BsListUl,
  BsCardList,
  BsCalendarWeek,
  BsThreeDotsVertical,
  BsChatDots,
  BsPencilSquare,
  BsTrash3,
  BsCalendarEvent,
  BsEye,
  BsPinAngle,
  BsPinAngleFill,
} from 'react-icons/bs';
import {
  FaStickyNote,
  FaClipboardList,
  FaCalendarAlt,
  FaDollarSign,
  FaCheckCircle,
  FaClock,
  FaUser,
  FaThumbtack
} from 'react-icons/fa';
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
import Loading from '../../../components/Loading/Loading';
import Banner from '../../../components/Banner/Banner';
import { Text } from '../../../components/design-system';
import SkeletonLoader from '../../../components/SkeletonLoader/SkeletonLoader';
import DragHandle from '../../../components/DragHandle/DragHandle';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import MetricsBar from '../../../components/MetricsBar/MetricsBar';
import CostsList from '../../../components/CostsList';
import Checkbox from '../../../components/Checkbox/Checkbox';
import SearchableSelect from '../../../components/FormField/SearchableSelect';
import AddDateModal from '../../../components/AddDateModal';
import { useUIPreference } from '../../../hooks/useUIPreference';
import { updatePlanItem, pinPlanItem } from '../../../utilities/plans-api';
import { getOrCreatePlanChannel } from '../../../utilities/chat-api';
import { hasFeatureFlag, hasFeatureFlagInContext, FEATURE_FLAGS, FEATURE_FLAG_CONTEXT } from '../../../utilities/feature-flags';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatDateMetricCard, formatDateForInput } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { formatCostEstimate } from '../../../utilities/cost-utils';
import { lang } from '../../../lang.constants';
import { sanitizeUrl, sanitizeText } from '../../../utilities/sanitize';
import debug from '../../../utilities/debug';
import MessagesModal from '../../../components/ChatModal/MessagesModal';
import {
  getActivityType,
  getActivityTypeIcon,
  getActivityTypeLabel,
  getActivityTypeDisplay,
  ACTIVITY_CATEGORIES
} from '../../../constants/activity-types';

// View options for plan items display
const VIEW_OPTIONS = [
  { value: 'card', label: lang.current.label.cardView, icon: BsCardList },
  { value: 'compact', label: lang.current.label.compactView, icon: BsListUl },
  { value: 'activity', label: lang.current.label.activityView, icon: BsListUl },
  { value: 'timeline', label: lang.current.label.timelineView, icon: BsCalendarWeek }
];

/**
 * Group plan items by activity type
 * Child items are always grouped with their parent to maintain hierarchy
 * The group is determined by the parent's activity type
 * @param {Array} items - Plan items to group
 * @param {Array} allItems - All plan items (for parent lookup)
 * @returns {Object} { groups: Array<{type, label, icon, items}>, ungrouped: Array }
 */
function groupItemsByActivityType(items, allItems = []) {
  const groups = {};
  const ungrouped = [];

  // Build parent lookup from allItems (includes all plan items for reference)
  const parentMap = new Map();
  for (const item of allItems) {
    const id = item._id?.toString() || item.plan_item_id?.toString();
    if (id) parentMap.set(id, item);
  }

  // Build children lookup - find all children for each parent
  // Key by BOTH _id and plan_item_id to handle different reference formats
  const childrenByParent = new Map();
  for (const item of items) {
    if (item.parent) {
      const parentId = item.parent.toString();
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(item);
    }
  }

  // Helper to get children for a parent item (checks both _id and plan_item_id)
  const getChildren = (item) => {
    const children = [];
    if (item._id) {
      const byId = childrenByParent.get(item._id.toString()) || [];
      children.push(...byId);
    }
    if (item.plan_item_id) {
      const byPlanItemId = childrenByParent.get(item.plan_item_id.toString()) || [];
      // Avoid duplicates if _id and plan_item_id are the same
      for (const child of byPlanItemId) {
        if (!children.includes(child)) {
          children.push(child);
        }
      }
    }
    return children;
  };

  // Track which items have been added (to avoid duplicating children)
  const addedItems = new Set();

  for (const item of items) {
    // Skip child items - they'll be added after their parent
    if (item.isChild || item.parent) {
      continue;
    }

    const itemId = (item._id || item.plan_item_id)?.toString();
    addedItems.add(itemId);

    const activityType = item.activity_type;

    if (!activityType) {
      // Parent goes to ungrouped
      ungrouped.push(item);
      // Children follow their parent in ungrouped, maintaining hierarchy
      const children = getChildren(item);
      for (const child of children) {
        const childId = (child._id || child.plan_item_id)?.toString();
        addedItems.add(childId);
        ungrouped.push({ ...child, isChild: true });
      }
      continue;
    }

    if (!groups[activityType]) {
      const typeInfo = getActivityType(activityType);
      groups[activityType] = {
        type: activityType,
        label: typeInfo?.label || activityType,
        icon: typeInfo?.icon || '📌',
        category: typeInfo?.category || 'other',
        items: []
      };
    }

    // Add parent item
    groups[activityType].items.push(item);

    // Add children immediately after parent to maintain hierarchy
    // Children stay in the same group as their parent regardless of their own activity_type
    const children = getChildren(item);
    for (const child of children) {
      const childId = (child._id || child.plan_item_id)?.toString();
      addedItems.add(childId);
      groups[activityType].items.push({
        ...child,
        isChild: true,
        // Track if child has a different activity type than parent (for display purposes)
        inheritedActivityType: !child.activity_type || child.activity_type === activityType
      });
    }
  }

  // Second pass: add orphaned children (whose parent is not in this list)
  for (const item of items) {
    if (!item.parent) continue; // Skip parents

    const itemId = (item._id || item.plan_item_id)?.toString();
    if (addedItems.has(itemId)) continue; // Already added with parent

    // This is an orphaned child - add it to ungrouped so it's visible
    addedItems.add(itemId);
    ungrouped.push({ ...item, isChild: true, isOrphaned: true });
  }

  // Sort groups by category order, then alphabetically
  const categoryOrder = { essentials: 1, experiences: 2, services: 3, other: 4 };
  const sortedGroups = Object.values(groups).sort((a, b) => {
    const orderA = categoryOrder[a.category] || 4;
    const orderB = categoryOrder[b.category] || 4;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  });

  return { groups: sortedGroups, ungrouped };
}

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
  handleSyncPlan,
  chatEnabled,
  chatLoading,
  openPlanChat
}) {
  const actions = useMemo(() => {
    return [
      {
        id: 'chat',
        label: chatLoading ? 'Opening…' : 'Chat',
        icon: <BsChatDots />,
        onClick: () => openPlanChat(),
        disabled: chatLoading,
        hidden: !chatEnabled,
      },
      {
        id: 'add-plan-item',
        label: lang.current.button.addPlanItem,
        icon: <BsPlusCircle />,
        onClick: () => handleAddPlanInstanceItem(),
        hidden: !canEdit,
      },
      {
        id: 'collaborators',
        label: lang.current.button.addCollaborators,
        icon: <BsPersonPlus />,
        onClick: () => openCollaboratorModal('plan'),
        hidden: !isPlanOwner,
      },
      {
        id: 'sync',
        label: loading ? lang.current.button.syncing : lang.current.button.syncNow,
        icon: <BsArrowRepeat className={loading ? 'spin' : undefined} />,
        onClick: () => handleSyncPlan(),
        disabled: loading,
        hidden: !showSyncButton,
      },
    ];
  }, [
    canEdit,
    chatEnabled,
    chatLoading,
    handleAddPlanInstanceItem,
    handleSyncPlan,
    isPlanOwner,
    lang,
    loading,
    openCollaboratorModal,
    openPlanChat,
    showSyncButton,
  ]);

  const hasAnyActions = actions.some(action => !action.hidden);
  if (!hasAnyActions) return null;

  return (
    <div className="plan-actions-dropdown">
      <ActionsMenu
        trigger={<BsPlusCircle />}
        triggerVariant="primary"
        actions={actions}
        ariaLabel={lang.current.tooltip.planActions}
        size="md"
        position="bottom-right"
      />
    </div>
  );
}

function buildStandardPlanItemActions({
  planItem,
  parentItem,
  canAddChild,
  lang,
  isPinned,
  onPinItem,
  onEdit,
  onAddChild,
  onSchedule,
  onViewDetails,
  onDelete,
}) {
  const isChild = Boolean(planItem.isChild || planItem.parent);
  const isRoot = !planItem.parent && !planItem.isChild;

  const items = [
    {
      id: 'edit',
      label: lang.current.button?.update || 'Update',
      icon: <BsPencilSquare />,
      onClick: () => onEdit(planItem),
    },
  ];

  if (canAddChild) {
    items.splice(1, 0, {
      id: 'add-child',
      label: lang.current.button?.addChildItem || 'Add Child Item',
      icon: <BsPlusCircle />,
      onClick: () => onAddChild(planItem.plan_item_id || planItem._id),
    });
  }

  if (!isChild) {
    items.push({
      id: 'schedule',
      label: 'Schedule Date',
      icon: <BsCalendarEvent />,
      onClick: () => onSchedule(planItem, parentItem),
    });
  }

  if (planItem.url) {
    items.push({
      id: 'view-details',
      label: 'View Details',
      icon: <BsEye />,
      onClick: () => onViewDetails(planItem),
    });
  }

  if (isRoot && onPinItem) {
    items.push({
      id: 'pin',
      label: isPinned ? 'Unpin' : 'Pin to Top',
      icon: isPinned ? <BsPinAngleFill /> : <BsPinAngle />,
      variant: isPinned ? 'active' : 'default',
      onClick: () => onPinItem(planItem),
    });
  }

  items.push({
    id: 'delete',
    label: lang.current.tooltip.delete,
    icon: <BsTrash3 />,
    variant: 'danger',
    onClick: () => onDelete(planItem),
  });

  return items;
}

/**
 * SortablePlanItem - Individual plan item with drag-and-drop support
 * Memoized to prevent unnecessary re-renders when only one item's complete state changes
 */
const SortablePlanItem = memo(function SortablePlanItem({
  planItem,
  currentPlan,
  user,
  idEquals,
  canEdit,
  canAddChild = false,
  toggleExpanded,
  hasChildren = false,
  isExpanded = false,
  getExpansionKey,
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
  lang,
  onPinItem,
  isPinned = false
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

  // Card view: consolidate non-complete actions into a 3-dot menu to avoid wrapping.
  const cardActions = useMemo(() => {
    if (!canEdit) return [];

    const itemId = planItem.plan_item_id || planItem._id;
    const items = [];

    if (canAddChild) {
      items.push({
        id: 'add-child',
        label: lang.current.button?.addChildItem || lang.current.button?.addChild || 'Add Child Item',
        icon: <BsPlusCircle />,
        onClick: () => handleAddPlanInstanceItem(itemId),
      });
    }

    items.push({
      id: 'edit',
      label: lang.current.button?.update || lang.current.button?.edit || 'Update',
      icon: <BsPencilSquare />,
      onClick: () => handleEditPlanInstanceItem(planItem),
    });

    // Pin action - only for root items
    if (!planItem.parent && !planItem.isChild && onPinItem) {
      items.push({
        id: 'pin',
        label: isPinned ? 'Unpin' : 'Pin to Top',
        icon: isPinned ? <BsPinAngleFill /> : <BsPinAngle />,
        variant: isPinned ? 'active' : 'default',
        onClick: () => onPinItem(planItem),
      });
    }

    items.push({
      id: 'delete',
      label: lang.current.tooltip?.delete || lang.current.button?.delete || 'Delete',
      icon: <BsTrash3 />,
      variant: 'danger',
      onClick: () => {
        setPlanInstanceItemToDelete(planItem);
        setShowPlanInstanceDeleteModal(true);
      },
    });

    return items;
  }, [
    canEdit,
    canAddChild,
    lang,
    planItem,
    onPinItem,
    isPinned,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
  ]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plan-item-id={planItem._id}
      className={`plan-item-card mb-3 overflow-hidden ${
        planItem.isVisible ? "" : "collapsed"
      } ${isDragging ? 'dragging' : ''} ${planItem.isChild ? 'is-child-item' : ''} ${isPinned ? 'is-pinned' : ''}`}
    >
      <div className="plan-item-header p-3 p-md-4">
        <div className="plan-item-title-row">
          <div className="plan-item-tree">
            {!planItem.isChild ? (
              (() => {
                if (hasChildren) {
                  // For pinned items with children: show star with expand arrow
                  if (isPinned) {
                    return (
                      <span
                        className={`expand-toggle pinned-expand-toggle ${!isExpanded ? 'collapsed' : ''}`}
                        onClick={() => toggleExpanded(planItem)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(planItem); } }}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
                        title={lang.current.tooltip.pinnedToTopExpandCollapse}
                      >
                        <FaThumbtack className="text-warning pinned-pin-icon" />
                        <span className="expand-arrow-icon">{isExpanded ? '▼' : '▶'}</span>
                      </span>
                    );
                  }
                  return (
                    <span
                      className="expand-toggle"
                      onClick={() => toggleExpanded(planItem)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(planItem); } }}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  );
                } else {
                  // For items without children: show pin instead of bullet when pinned
                  return (
                    <span className={`no-child-arrow ${isPinned ? 'pinned-pin' : ''}`}>
                      {isPinned ? <FaThumbtack className="text-warning" aria-label={lang.current.aria.pinnedItem} title={lang.current.tooltip.pinnedToTop} /> : '•'}
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
        </div>

        {/* Drag handle - positioned between title and action buttons */}
        {/* Pinned items don't show drag handle since they're always at top */}
        {canEdit && !isPinned && (
          <div {...attributes} {...listeners} className="drag-handle-wrapper" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
            <DragHandle
              isDragging={isDragging}
              disabled={!canEdit}
            />
          </div>
        )}

        <div className="plan-item-actions plan-item-card-actions">
          <button
            className={`btn btn-sm btn-complete-toggle ${
              planItem.complete
                ? "btn-success"
                : "btn-outline-success"
            }`}
            type="button"
            disabled={!canEdit}
            onClick={(e) => {
              if (!canEdit) return;
              // Blur the button to prevent focus-based scroll restoration
              e.currentTarget.blur();
              handlePlanItemToggleComplete(planItem);
            }}
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
          <ActionsMenu
            actions={cardActions}
            ariaLabel={`Actions: ${planItem.text}`}
            size="md"
            position="bottom-right"
            disabled={!canEdit}
          />
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
              // Handle both populated object and ID-only cases
              const isPopulated = typeof planItem.assignedTo === 'object' && planItem.assignedTo.name;
              const assigneeId = planItem.assignedTo._id || planItem.assignedTo;

              // Use name from populated object first, then fallback to collaborators lookup
              let assigneeName = isPopulated ? planItem.assignedTo.name : null;

              if (!assigneeName) {
                const assignee = [planOwner, ...planCollaborators].find(c => {
                  const collabId = c?._id || c?.user?._id;
                  return collabId === assigneeId || collabId?.toString() === assigneeId?.toString();
                });
                assigneeName = assignee?.name || assignee?.user?.name || 'Assigned';
              }

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
                title={lang.current.tooltip.clickToViewNotes}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewPlanItemDetails(planItem, 'notes');
                }}
              >
                <FaStickyNote /> {planItem.details.notes.length}
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
            title={lang.current.tooltip.viewNotesAssignmentsDetails}
          >
            <FaClipboardList /> {lang.current.label.details}
          </button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these specific props change
  // This prevents re-render when sibling items' complete state changes
  return (
    prevProps.planItem._id === nextProps.planItem._id &&
    prevProps.planItem.complete === nextProps.planItem.complete &&
    prevProps.planItem.text === nextProps.planItem.text &&
    prevProps.planItem.isVisible === nextProps.planItem.isVisible &&
    prevProps.planItem.isChild === nextProps.planItem.isChild &&
    (prevProps.planItem.parent?.toString() || null) === (nextProps.planItem.parent?.toString() || null) &&
    prevProps.planItem.cost === nextProps.planItem.cost &&
    prevProps.planItem.planning_days === nextProps.planItem.planning_days &&
    prevProps.planItem.assignedTo === nextProps.planItem.assignedTo &&
    prevProps.planItem.details?.notes?.length === nextProps.planItem.details?.notes?.length &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.hoveredPlanItem === nextProps.hoveredPlanItem &&
    prevProps.canAddChild === nextProps.canAddChild &&
    prevProps.isPinned === nextProps.isPinned &&
    // Expand/collapse state - compare derived values so memoized items re-render reliably
    prevProps.hasChildren === nextProps.hasChildren &&
    prevProps.isExpanded === nextProps.isExpanded
  );
});

/**
 * SortableCompactPlanItem - One-line view with checkbox and drag-and-drop for plan items
 * Memoized to prevent unnecessary re-renders
 */
const SortableCompactPlanItem = memo(function SortableCompactPlanItem({
  planItem,
  canEdit,
  canAddChild = false,
  handlePlanItemToggleComplete,
  handleViewPlanItemDetails,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  onScheduleDate,
  onPinItem,
  isPinned = false,
  lang,
  parentItem = null,
  showActivityBadge = false,
  planOwner = null,
  planCollaborators = [],
  // Expand/collapse props
  hasChildren = false,
  isExpanded = true,
  onToggleExpand = null
}) {
  const itemId = planItem.plan_item_id || planItem._id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: (planItem.plan_item_id || planItem._id).toString(),
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 'auto',
  };

  // Build actions array for ActionsMenu
  const actions = useMemo(() => {
    return buildStandardPlanItemActions({
      planItem,
      parentItem,
      canAddChild,
      lang,
      isPinned,
      onPinItem,
      onEdit: (item) => handleEditPlanInstanceItem(item),
      onAddChild: (id) => handleAddPlanInstanceItem(id),
      onSchedule: (item, parent) => onScheduleDate(item, parent),
      onViewDetails: (item) => handleViewPlanItemDetails(item),
      onDelete: (item) => {
        setPlanInstanceItemToDelete(item);
        setShowPlanInstanceDeleteModal(true);
      },
    });
  }, [
    canAddChild,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    handleViewPlanItemDetails,
    isPinned,
    lang,
    onPinItem,
    onScheduleDate,
    parentItem,
    planItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
  ]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plan-item-id={planItem._id}
      className={`compact-plan-item ${planItem.complete ? 'completed' : ''} ${planItem.isChild ? 'is-child' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      {/* Drag handle - hidden for pinned items since they're always at top */}
      {canEdit && !isPinned && (
        <div {...attributes} {...listeners} className="compact-drag-handle" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
          <DragHandle
            isDragging={isDragging}
            disabled={!canEdit}
          />
        </div>
      )}

      {/* Hierarchy indicator - pin replaces bullet when pinned, expand/collapse for parents with children */}
      <span className={`compact-item-indent ${isPinned && !planItem.isChild ? 'pinned-pin' : ''}`}>
        {planItem.isChild ? (
          '↳'
        ) : hasChildren && onToggleExpand ? (
          isPinned ? (
            <button
              type="button"
              className={`expand-toggle pinned-expand-toggle ${!isExpanded ? 'collapsed' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleExpand(planItem); }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
              title={lang.current.tooltip.pinnedToTopExpandCollapse}
            >
              <FaThumbtack className="text-warning pinned-pin-icon" />
              <span className="expand-arrow-icon">{isExpanded ? '▼' : '▶'}</span>
            </button>
          ) : (
            <button
              type="button"
              className="expand-toggle compact-expand-toggle"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(planItem); }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )
        ) : isPinned ? (
          <FaThumbtack className="text-warning" aria-label={lang.current.aria.pinnedItem} title={lang.current.tooltip.pinnedToTop} />
        ) : (
          '•'
        )}
      </span>

      {/* Checkbox for completion */}
      <Checkbox
        id={`compact-item-${itemId}`}
        checked={!!planItem.complete}
        onChange={() => handlePlanItemToggleComplete(planItem)}
        disabled={!canEdit}
        size="sm"
        className="compact-item-checkbox"
      />

      {/* Item text */}
      <span
        className={`compact-item-text ${planItem.complete ? 'text-decoration-line-through text-muted' : ''} ${isPinned ? 'is-pinned' : ''}`}
      >
        {planItem.url ? (() => {
          const safeUrl = sanitizeUrl(planItem.url);

          // If the URL is valid, render a single interactive element (<a>)
          // to avoid nesting an <a> inside another interactive container.
          if (safeUrl) {
            return (
              <a
                className="compact-item-title-link"
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open link in new tab"
              >
                {sanitizeText(planItem.text)}
              </a>
            );
          }

          // Fallback: invalid URL should still allow viewing details.
          return (
            <button
              type="button"
              className="compact-item-title-button"
              onClick={() => handleViewPlanItemDetails(planItem)}
              title="View details"
            >
              {sanitizeText(planItem.text)}
            </button>
          );
        })() : (
          <button
            type="button"
            className="compact-item-title-button"
            onClick={() => handleViewPlanItemDetails(planItem)}
            title="View details"
          >
            {sanitizeText(planItem.text)}
          </button>
        )}
        {/* Activity type badge for child items with different type than parent */}
        {(() => {
          const { badge } = getActivityTypeDisplay(planItem, parentItem);
          if (badge) {
            return (
              <span className="compact-activity-badge" title={badge.label}>
                ({badge.icon} {badge.label})
              </span>
            );
          }
          // Show activity badge when explicitly requested (in grouped view)
          if (showActivityBadge && planItem.activity_type && !planItem.isChild) {
            const typeInfo = getActivityType(planItem.activity_type);
            if (typeInfo) {
              return (
                <span className="compact-activity-badge-inline" title={typeInfo.label}>
                  {typeInfo.icon}
                </span>
              );
            }
          }
          return null;
        })()}
      </span>

      {/* Meta info - cost and planning days */}
      <span className="compact-item-meta">
        {Number(planItem.cost) > 0 && (
          <span className="compact-meta-cost" title={`Cost estimate: $${planItem.cost}`}>
            <FaDollarSign />
          </span>
        )}
        {Number(planItem.planning_days) > 0 && (
          <span className="compact-meta-days" title={`${planItem.planning_days} ${planItem.planning_days === 1 ? 'day' : 'days'}`}>
            <FaClock />
          </span>
        )}
        {planItem.details?.notes?.length > 0 && (
          <span className="compact-meta-notes" title={`${planItem.details.notes.length} ${planItem.details.notes.length === 1 ? 'note' : 'notes'}`}>
            <FaStickyNote /> {planItem.details.notes.length}
          </span>
        )}
        {planItem.assignedTo && (() => {
          // Resolve assignee name for tooltip
          const isPopulated = typeof planItem.assignedTo === 'object' && planItem.assignedTo.name;
          const assigneeId = planItem.assignedTo._id || planItem.assignedTo;
          let assigneeName = isPopulated ? planItem.assignedTo.name : null;
          if (!assigneeName && (planOwner || planCollaborators.length > 0)) {
            const assignee = [planOwner, ...planCollaborators].find(c => {
              const collabId = c?._id || c?.user?._id;
              return collabId === assigneeId || collabId?.toString() === assigneeId?.toString();
            });
            assigneeName = assignee?.name || assignee?.user?.name || 'Assigned';
          }
          return (
            <span className="compact-meta-assigned" title={`Assigned to ${assigneeName || 'team member'}`}>
              <FaUser />
            </span>
          );
        })()}
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
    prevProps.planItem.complete === nextProps.planItem.complete &&
    prevProps.planItem.text === nextProps.planItem.text &&
    prevProps.planItem.isChild === nextProps.planItem.isChild &&
    prevProps.planItem.cost === nextProps.planItem.cost &&
    prevProps.planItem.planning_days === nextProps.planItem.planning_days &&
    prevProps.planItem.assignedTo === nextProps.planItem.assignedTo &&
    prevProps.planItem.activity_type === nextProps.planItem.activity_type &&
    prevProps.planItem.details?.notes?.length === nextProps.planItem.details?.notes?.length &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.parentItem?.activity_type === nextProps.parentItem?.activity_type &&
    prevProps.showActivityBadge === nextProps.showActivityBadge &&
    prevProps.planOwner?._id === nextProps.planOwner?._id &&
    prevProps.planCollaborators?.length === nextProps.planCollaborators?.length &&
    prevProps.isPinned === nextProps.isPinned &&
    // Expand/collapse state
    prevProps.hasChildren === nextProps.hasChildren &&
    prevProps.isExpanded === nextProps.isExpanded
  );
});

/**
 * Get time of day category based on hour
 */
function getTimeOfDay(timeString) {
  if (!timeString) return null;
  const match = timeString.match(/^(\d{1,2}):/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Format time for display (12-hour format)
 */
function formatTimeForDisplay(timeString) {
  if (!timeString) return null;
  const match = timeString.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeString;
  const hour = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

/**
 * Group items within a time section by activity type
 * Child items are always grouped with their parent to maintain hierarchy
 * Items within each group are sorted by scheduled_time, with children after their parent
 * @param {Array} items - Items in a time section
 * @returns {Array} Items grouped by activity type with ungrouped at the end
 */
function groupTimeItemsByActivityType(items) {
  if (!items || items.length === 0) return [];

  const groups = {};
  const ungrouped = [];

  // Build parent lookup from items in this section (map both _id and plan_item_id)
  const parentMap = new Map();
  for (const item of items) {
    if (!item.parent && !item.isChild) {
      if (item._id) parentMap.set(item._id.toString(), item);
      if (item.plan_item_id) parentMap.set(item.plan_item_id.toString(), item);
    }
  }

  // Build children lookup - find all children for each parent in this section
  const childrenByParent = new Map();
  for (const item of items) {
    if (item.parent || item.isChild) {
      const parentId = (item.parent || '').toString();
      if (parentId) {
        if (!childrenByParent.has(parentId)) {
          childrenByParent.set(parentId, []);
        }
        childrenByParent.get(parentId).push(item);
      }
    }
  }

  // Helper to get children for a parent item (checks both _id and plan_item_id)
  const getChildrenForParent = (item) => {
    const children = [];
    if (item._id) {
      const byId = childrenByParent.get(item._id.toString()) || [];
      children.push(...byId);
    }
    if (item.plan_item_id) {
      const byPlanItemId = childrenByParent.get(item.plan_item_id.toString()) || [];
      for (const child of byPlanItemId) {
        if (!children.includes(child)) {
          children.push(child);
        }
      }
    }
    return children;
  };

  // Track which items have been added (to avoid duplicating children)
  const addedItems = new Set();

  const addDescendants = (parent, rootActivityType, targetArray) => {
    const children = getChildrenForParent(parent);
    for (const child of children) {
      const childId = (child._id || child.plan_item_id)?.toString();
      if (!childId || addedItems.has(childId)) continue;
      addedItems.add(childId);
      targetArray.push({
        ...child,
        isChild: true,
        inheritedActivityType: rootActivityType
          ? (!child.activity_type || child.activity_type === rootActivityType)
          : true
      });
      addDescendants(child, rootActivityType, targetArray);
    }
  };

  // First pass: process root items and all descendants (depth-first)
  for (const item of items) {
    if (item.parent || item.isChild) continue;

    const itemId = (item._id || item.plan_item_id)?.toString();
    if (!itemId || addedItems.has(itemId)) continue;
    addedItems.add(itemId);

    const activityType = item.activity_type;
    if (!activityType) {
      ungrouped.push(item);
      addDescendants(item, null, ungrouped);
      continue;
    }

    if (!groups[activityType]) {
      const typeInfo = getActivityType(activityType);
      groups[activityType] = {
        type: activityType,
        label: typeInfo?.label || activityType,
        icon: typeInfo?.icon || '📌',
        category: typeInfo?.category || 'other',
        items: []
      };
    }

    groups[activityType].items.push(item);
    addDescendants(item, activityType, groups[activityType].items);
  }

  // Second pass: add orphaned children (whose parent is not in this section)
  for (const item of items) {
    if (!(item.parent || item.isChild)) continue; // Skip parents

    const itemId = (item._id || item.plan_item_id)?.toString();
    if (addedItems.has(itemId)) continue; // Already added with parent

    // This is an orphaned child - add it to ungrouped so it's visible
    addedItems.add(itemId);
    ungrouped.push({ ...item, isChild: true, isOrphaned: true });
  }

  // Sort groups by category order, then alphabetically
  const categoryOrder = { essentials: 1, experiences: 2, services: 3, other: 4 };
  const sortedGroups = Object.values(groups).sort((a, b) => {
    const orderA = categoryOrder[a.category] || 4;
    const orderB = categoryOrder[b.category] || 4;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label);
  });

  return { groups: sortedGroups, ungrouped };
}

/**
 * Group plan items by date and time of day for Timeline view
 * Child items inherit scheduled_date/time from their parent if not set
 * Within each time section, items are further grouped by activity type
 */
function groupPlanItemsByDate(items) {
  const groups = {};
  const unscheduled = [];

  // Create a map of items by BOTH _id and plan_item_id for parent lookups
  const itemsById = new Map();
  items.forEach(item => {
    if (item._id) {
      itemsById.set(item._id.toString(), item);
    }
    if (item.plan_item_id) {
      itemsById.set(item.plan_item_id.toString(), item);
    }
  });

  // Parent-only scheduling: a hierarchy's date/time is determined by its root item.
  // If the root has no scheduled_date, the entire hierarchy is considered unscheduled.
  const parentItems = items.filter(item => !item.parent);
  const childItems = items.filter(item => !!item.parent);

  const childrenByParent = new Map();
  childItems.forEach(child => {
    const parentId = child.parent.toString();
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(child);
  });

  // Helper to get children for a parent item (checks both _id and plan_item_id)
  const getChildrenForParent = (item) => {
    const children = [];
    if (item._id) {
      const byId = childrenByParent.get(item._id.toString()) || [];
      children.push(...byId);
    }
    if (item.plan_item_id) {
      const byPlanItemId = childrenByParent.get(item.plan_item_id.toString()) || [];
      for (const child of byPlanItemId) {
        if (!children.includes(child)) {
          children.push(child);
        }
      }
    }
    return children;
  };

  const addedIds = new Set();

  const addDescendantsToTarget = (parent, rootSchedule, pushFn) => {
    const children = getChildrenForParent(parent);
    for (const child of children) {
      const childId = (child._id || child.plan_item_id)?.toString();
      if (!childId || addedIds.has(childId)) continue;
      addedIds.add(childId);
      pushFn({
        ...child,
        isChild: true,
        inheritedSchedule: Boolean(rootSchedule?.scheduled_date),
        // Reflect root schedule on descendants for Timeline display/sorting.
        scheduled_date: rootSchedule?.scheduled_date ?? null,
        scheduled_time: rootSchedule?.scheduled_time ?? null
      });
      addDescendantsToTarget(child, rootSchedule, pushFn);
    }
  };

  const addHierarchyToUnscheduled = (root) => {
    const rootId = (root._id || root.plan_item_id)?.toString();
    if (rootId) addedIds.add(rootId);
    unscheduled.push({ ...root, inheritedSchedule: false });
    addDescendantsToTarget(root, { scheduled_date: null, scheduled_time: null }, (it) => {
      unscheduled.push({ ...it, inheritedSchedule: false });
    });
  };

  const addHierarchyToScheduled = (root) => {
    const rootId = (root._id || root.plan_item_id)?.toString();
    if (rootId) addedIds.add(rootId);

    const date = new Date(root.scheduled_date);
    if (isNaN(date.getTime())) {
      addHierarchyToUnscheduled(root);
      return;
    }

    const dateKey = date.toISOString().split('T')[0];
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date,
        dateKey,
        morning: [],
        afternoon: [],
        evening: [],
        unspecified: []
      };
    }

    const timeOfDay = getTimeOfDay(root.scheduled_time);
    const pushFn = (it) => {
      if (timeOfDay) groups[dateKey][timeOfDay].push(it);
      else groups[dateKey].unspecified.push(it);
    };

    pushFn({ ...root, inheritedSchedule: false });
    addDescendantsToTarget(
      root,
      { scheduled_date: root.scheduled_date, scheduled_time: root.scheduled_time },
      pushFn
    );
  };

  // Process each root item; it brings its entire hierarchy along
  parentItems.forEach((root) => {
    if (!root?.scheduled_date) {
      addHierarchyToUnscheduled(root);
      return;
    }
    addHierarchyToScheduled(root);
  });

  // Any remaining items are orphaned (missing root). Show them under unscheduled.
  items.forEach((item) => {
    const itemId = (item._id || item.plan_item_id)?.toString();
    if (!itemId || addedIds.has(itemId)) return;
    addedIds.add(itemId);
    unscheduled.push({
      ...item,
      isChild: Boolean(item.parent),
      isOrphaned: Boolean(item.parent),
      inheritedSchedule: false
    });
  });

  // Group items by activity type within each time section
  for (const dateKey of Object.keys(groups)) {
    groups[dateKey].morningByActivity = groupTimeItemsByActivityType(groups[dateKey].morning);
    groups[dateKey].afternoonByActivity = groupTimeItemsByActivityType(groups[dateKey].afternoon);
    groups[dateKey].eveningByActivity = groupTimeItemsByActivityType(groups[dateKey].evening);
    groups[dateKey].unspecifiedByActivity = groupTimeItemsByActivityType(groups[dateKey].unspecified);
  }

  // Sort groups by date
  const sortedGroups = Object.values(groups).sort((a, b) => a.date - b.date);

  // Group unscheduled items by activity type
  const unscheduledByActivity = groupTimeItemsByActivityType(unscheduled);

  return { groups: sortedGroups, unscheduled, unscheduledByActivity };
}

/**
 * TimelinePlanItem - Similar to compact item but with time display for Timeline view
 */
const TimelinePlanItem = memo(function TimelinePlanItem({
  planItem,
  canEdit,
  canAddChild = false,
  handlePlanItemToggleComplete,
  handleViewPlanItemDetails,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  onScheduleDate,
  lang,
  parentItem = null,
  planOwner = null,
  planCollaborators = [],
  onPinItem,
  isPinned = false,
  // Expand/collapse props
  hasChildren = false,
  isExpanded = true,
  onToggleExpand = null
}) {
  const itemId = planItem.plan_item_id || planItem._id;
  const formattedTime = formatTimeForDisplay(planItem.scheduled_time);

  // Build actions array for ActionsMenu (same pattern as SortableCompactPlanItem)
  const actions = useMemo(() => {
    return buildStandardPlanItemActions({
      planItem,
      parentItem,
      canAddChild,
      lang,
      isPinned,
      onPinItem,
      onEdit: (item) => handleEditPlanInstanceItem(item),
      onAddChild: (id) => handleAddPlanInstanceItem(id),
      onSchedule: (item, parent) => onScheduleDate(item, parent),
      onViewDetails: (item) => handleViewPlanItemDetails(item),
      onDelete: (item) => {
        setPlanInstanceItemToDelete(item);
        setShowPlanInstanceDeleteModal(true);
      },
    });
  }, [
    canAddChild,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    handleViewPlanItemDetails,
    isPinned,
    lang,
    onPinItem,
    onScheduleDate,
    parentItem,
    planItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
  ]);

  return (
    <div
      data-plan-item-id={planItem._id}
      className={`timeline-plan-item ${planItem.complete ? 'completed' : ''} ${planItem.isChild ? 'is-child' : ''}`}
    >
      {/* Hierarchy indicator - pin replaces bullet when pinned, expand/collapse for parents with children */}
      <span className={`timeline-item-indent ${isPinned && !planItem.isChild ? 'pinned-pin' : ''}`}>
        {planItem.isChild ? (
          '↳'
        ) : hasChildren && onToggleExpand ? (
          isPinned ? (
            <button
              type="button"
              className={`expand-toggle pinned-expand-toggle ${!isExpanded ? 'collapsed' : ''}`}
              onClick={(e) => { e.stopPropagation(); onToggleExpand(planItem); }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
              title={lang.current.tooltip.pinnedToTopExpandCollapse}
            >
              <FaThumbtack className="text-warning pinned-pin-icon" />
              <span className="expand-arrow-icon">{isExpanded ? "▼" : "▶"}</span>
            </button>
          ) : (
            <button
              type="button"
              className="expand-toggle compact-expand-toggle"
              onClick={(e) => { e.stopPropagation(); onToggleExpand(planItem); }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse child items" : "Expand child items"}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )
        ) : isPinned ? (
          <FaThumbtack className="text-warning" aria-label={lang.current.aria.pinnedItem} title={lang.current.tooltip.pinnedToTop} />
        ) : (
          '•'
        )}
      </span>

      {/* Checkbox for completion */}
      <Checkbox
        id={`timeline-item-${itemId}`}
        checked={!!planItem.complete}
        onChange={() => handlePlanItemToggleComplete(planItem)}
        disabled={!canEdit}
        size="sm"
        className="timeline-item-checkbox"
      />

      {/* Item text - clickable to view details */}
      <span
        className={`timeline-item-text ${planItem.complete ? 'text-decoration-line-through text-muted' : ''} ${isPinned ? 'is-pinned' : ''}`}
        onClick={() => handleViewPlanItemDetails(planItem)}
        title="Click to view details"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleViewPlanItemDetails(planItem);
          }
        }}
      >
        {planItem.url ? (() => {
          const safeUrl = sanitizeUrl(planItem.url);
          return safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {sanitizeText(planItem.text)}
            </a>
          ) : sanitizeText(planItem.text);
        })() : (
          sanitizeText(planItem.text)
        )}
        {/* Activity type badge for child items with different type than parent */}
        {(() => {
          const { badge } = getActivityTypeDisplay(planItem, parentItem);
          if (badge) {
            return (
              <span className="timeline-activity-badge" title={badge.label}>
                ({badge.icon} {badge.label})
              </span>
            );
          }
          return null;
        })()}
      </span>

      {/* Time display for timeline view */}
      {formattedTime && (
        <span
          className={`timeline-item-time ${planItem.inheritedSchedule ? 'inherited' : ''}`}
          title={planItem.inheritedSchedule
            ? `Inherited from parent - ${formattedTime}`
            : `Scheduled at ${formattedTime}`
          }
        >
          🕐 {formattedTime}
          {planItem.inheritedSchedule && <span className="inherited-indicator">*</span>}
        </span>
      )}

      {/* Meta info - cost and planning days */}
      <span className="timeline-item-meta">
        {Number(planItem.cost) > 0 && (
          <span className="timeline-meta-cost" title={`Cost estimate: $${planItem.cost}`}>
            <FaDollarSign />
          </span>
        )}
        {Number(planItem.planning_days) > 0 && (
          <span className="timeline-meta-days" title={`${planItem.planning_days} ${planItem.planning_days === 1 ? 'day' : 'days'}`}>
            <FaClock />
          </span>
        )}
        {planItem.details?.notes?.length > 0 && (
          <span className="timeline-meta-notes" title={`${planItem.details.notes.length} ${planItem.details.notes.length === 1 ? 'note' : 'notes'}`}>
            <FaStickyNote /> {planItem.details.notes.length}
          </span>
        )}
        {planItem.assignedTo && (() => {
          // Resolve assignee name for tooltip
          const isPopulated = typeof planItem.assignedTo === 'object' && planItem.assignedTo.name;
          const assigneeId = planItem.assignedTo._id || planItem.assignedTo;
          let assigneeName = isPopulated ? planItem.assignedTo.name : null;
          if (!assigneeName && (planOwner || planCollaborators.length > 0)) {
            const assignee = [planOwner, ...planCollaborators].find(c => {
              const collabId = c?._id || c?.user?._id;
              return collabId === assigneeId || collabId?.toString() === assigneeId?.toString();
            });
            assigneeName = assignee?.name || assignee?.user?.name || 'Assigned';
          }
          return (
            <span className="timeline-meta-assigned" title={`Assigned to ${assigneeName || 'team member'}`}>
              <FaUser />
            </span>
          );
        })()}
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
    prevProps.planItem.complete === nextProps.planItem.complete &&
    prevProps.planItem.text === nextProps.planItem.text &&
    prevProps.planItem.isChild === nextProps.planItem.isChild &&
    prevProps.planItem.cost === nextProps.planItem.cost &&
    prevProps.planItem.planning_days === nextProps.planItem.planning_days &&
    prevProps.planItem.assignedTo === nextProps.planItem.assignedTo &&
    prevProps.planItem.activity_type === nextProps.planItem.activity_type &&
    prevProps.planItem.scheduled_date === nextProps.planItem.scheduled_date &&
    prevProps.planItem.scheduled_time === nextProps.planItem.scheduled_time &&
    prevProps.planItem.details?.notes?.length === nextProps.planItem.details?.notes?.length &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.parentItem?.activity_type === nextProps.parentItem?.activity_type &&
    prevProps.planOwner?._id === nextProps.planOwner?._id &&
    prevProps.planCollaborators?.length === nextProps.planCollaborators?.length &&
    prevProps.isPinned === nextProps.isPinned &&
    // Expand/collapse state
    prevProps.hasChildren === nextProps.hasChildren &&
    prevProps.isExpanded === nextProps.isExpanded
  );
});

/**
 * TimelineDateGroup - Renders a group of plan items for a specific date
 * Items are grouped first by time of day, then by activity type within each time section
 */
const TimelineDateGroup = memo(function TimelineDateGroup({
  group,
  canEdit,
  handlePlanItemToggleComplete,
  handleViewPlanItemDetails,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  onScheduleDate,
  lang,
  parentItemMap,
  canAddChildFn,
  planOwner = null,
  planCollaborators = [],
  handlePinItem,
  pinnedItemId,
  // Expand/collapse props
  hasChildrenFn,
  expandedParents,
  toggleExpanded,
  isItemVisibleFn,
  isItemExpandedFn
}) {
  const formatDateHeader = (date) => {
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };

  const timeOfDayLabels = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    unspecified: ''
  };

  // Render activity type groups within a time section
  const renderActivityGroups = (activityData) => {
    if (!activityData || (activityData.groups?.length === 0 && activityData.ungrouped?.length === 0)) {
      return null;
    }

    // Filter function - use provided function or show all
    const checkVisible = isItemVisibleFn || (() => true);

    return (
      <>
        {/* Grouped items by activity type */}
        {activityData.groups?.map(activityGroup => {
          const visibleItems = activityGroup.items.filter(checkVisible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={activityGroup.type} className="timeline-activity-group">
              <div className="timeline-activity-header">
                <span className="timeline-activity-icon">{activityGroup.icon}</span>
                <span className="timeline-activity-label">{activityGroup.label}</span>
              </div>
              <div className="timeline-activity-items">
                {visibleItems.map(item => {
                  const parentItem = item.parent && parentItemMap
                    ? parentItemMap.get(item.parent.toString())
                    : null;
                  const itemHasChildren = hasChildrenFn ? hasChildrenFn(item) : false;
                  const itemIdStr = (item.plan_item_id || item._id)?.toString();
                  const itemExpanded = isItemExpandedFn ? isItemExpandedFn(item) : true;
                  return (
                    <TimelinePlanItem
                      key={item.plan_item_id || item._id}
                      planItem={item}
                      canEdit={canEdit}
                      canAddChild={typeof canAddChildFn === 'function' ? canAddChildFn(item) : false}
                      handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                      handleViewPlanItemDetails={handleViewPlanItemDetails}
                      handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                      handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                      setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                      setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                      onScheduleDate={onScheduleDate}
                      lang={lang}
                      parentItem={parentItem}
                      planOwner={planOwner}
                      planCollaborators={planCollaborators}
                      onPinItem={handlePinItem}
                      isPinned={itemIdStr === pinnedItemId}
                      hasChildren={itemHasChildren}
                      isExpanded={itemExpanded}
                      onToggleExpand={toggleExpanded}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Ungrouped items (no activity type) */}
        {(() => {
          const visibleUngrouped = (activityData.ungrouped || []).filter(checkVisible);
          if (visibleUngrouped.length === 0) return null;
          return (
            <div className="timeline-activity-group timeline-activity-ungrouped">
              {activityData.groups?.length > 0 && (
                <div className="timeline-activity-header">
                  <span className="timeline-activity-icon">📌</span>
                  <span className="timeline-activity-label">Other</span>
                </div>
              )}
              <div className="timeline-activity-items">
                {visibleUngrouped.map(item => {
                  const parentItem = item.parent && parentItemMap
                    ? parentItemMap.get(item.parent.toString())
                    : null;
                  const itemHasChildren = hasChildrenFn ? hasChildrenFn(item) : false;
                  const itemIdStr = (item.plan_item_id || item._id)?.toString();
                  const itemExpanded = isItemExpandedFn ? isItemExpandedFn(item) : true;
                  return (
                    <TimelinePlanItem
                      key={item.plan_item_id || item._id}
                      planItem={item}
                      canEdit={canEdit}
                      canAddChild={typeof canAddChildFn === 'function' ? canAddChildFn(item) : false}
                      handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                      handleViewPlanItemDetails={handleViewPlanItemDetails}
                      handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                      handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                      setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                      setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                      onScheduleDate={onScheduleDate}
                      lang={lang}
                      parentItem={parentItem}
                      planOwner={planOwner}
                      planCollaborators={planCollaborators}
                      onPinItem={handlePinItem}
                      isPinned={itemIdStr === pinnedItemId}
                      hasChildren={itemHasChildren}
                      isExpanded={itemExpanded}
                      onToggleExpand={toggleExpanded}
                    />
                  );
                })}
              </div>
            </div>
          );
        })()}
      </>
    );
  };

  const renderTimeSection = (activityData, timeOfDay) => {
    // Check if data is empty - handle both empty array and empty object with no items
    if (!activityData || 
        (Array.isArray(activityData) && activityData.length === 0) ||
        (activityData.groups?.length === 0 && activityData.ungrouped?.length === 0)) {
      return null;
    }

    return (
      <div className="timeline-time-section" key={timeOfDay}>
        {timeOfDay !== 'unspecified' && (
          <div className="timeline-time-header">
            {timeOfDayLabels[timeOfDay]}
          </div>
        )}
        <div className="timeline-time-items">
          {renderActivityGroups(activityData)}
        </div>
      </div>
    );
  };

  return (
    <div className="timeline-date-group">
      <div className="timeline-date-header">
        {formatDateHeader(group.date)}
      </div>
      <div className="timeline-date-content">
        {renderTimeSection(group.morningByActivity, 'morning')}
        {renderTimeSection(group.afternoonByActivity, 'afternoon')}
        {renderTimeSection(group.eveningByActivity, 'evening')}
        {renderTimeSection(group.unspecifiedByActivity, 'unspecified')}
      </div>
    </div>
  );
});

export default function MyPlanTabContent({
  // Plan selection & user
  selectedPlanId,
  user,
  idEquals,

  // User plan (canonical) + setter
  userPlan,
  setUserPlan,

  // Plan data
  sharedPlans,
  setSharedPlans,
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
  getExpansionKey,
  isItemExpanded,

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
  onDeleteCost,

  // Real-time presence
  presenceConnected = false,
  planMembers = [],
  setTyping
}) {
  const maxPlanItemNestingLevel = useMemo(() => {
    const raw = import.meta.env.VITE_PLAN_ITEM_MAX_NESTING_LEVEL || import.meta.env.PLAN_ITEM_MAX_NESTING_LEVEL;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
  }, []);
  // Check if chat is enabled:
  // 1. Chat API key must be configured (currently Stream Chat)
  // 2. Plan owner must have chat feature flag (or user is super admin)
  const chatConfigured = Boolean(import.meta.env.VITE_STREAM_CHAT_API_KEY);
  const chatEnabled = useMemo(() => {
    if (!chatConfigured) return false;
    // Check if plan owner has chat enabled, or if current user is super admin
    return hasFeatureFlagInContext({
      loggedInUser: user,
      entityCreatorUser: planOwner,
      flagKey: 'chat',
      context: FEATURE_FLAG_CONTEXT.ENTITY_CREATOR,
      options: { allowSuperAdmin: true }
    });
  }, [chatConfigured, user, planOwner]);

  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [messagesInitialChannelId, setMessagesInitialChannelId] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  // Tab loading state for smooth transitions
  const [planTabLoading, setPlanTabLoading] = useState(true);
  // View state for plan items display (card or compact) - persisted in user preferences
  // Uses shared key 'viewMode.planItems' so preference syncs between Experience and Plan views
  const [planItemsView, setPlanItemsView] = useUIPreference('viewMode.planItems', 'compact');

  // Get current plan with "stale until updated" pattern to prevent flash
  // Keep last valid plan when sharedPlans.find() temporarily returns undefined during updates
  // NOTE: Defined early because handleDragEnd and other functions need it
  const lastValidPlanRef = useRef(null);

  // sharedPlans intentionally excludes the user's own plan; userPlan is canonical.
  // For rendering/selection we need the full set of accessible plans.
  const allPlans = useMemo(() => {
    if (userPlan) return [userPlan, ...(sharedPlans || [])];
    return sharedPlans || [];
  }, [userPlan, sharedPlans]);

  const selectedIsUserPlan = useMemo(() => {
    if (!selectedPlanId || !userPlan?._id) return false;
    return idEquals(userPlan._id, selectedPlanId);
  }, [selectedPlanId, userPlan?._id, idEquals]);

  const updateSelectedPlanInState = useCallback((updater) => {
    if (!selectedPlanId) return;

    if (selectedIsUserPlan) {
      if (!setUserPlan) return;
      setUserPlan((prev) => {
        if (!prev || !idEquals(prev._id, selectedPlanId)) return prev;
        return updater(prev);
      });
      return;
    }

    if (!setSharedPlans) return;
    setSharedPlans((prevPlans) =>
      (prevPlans || []).map((p) =>
        idEquals(p._id, selectedPlanId) ? updater(p) : p
      )
    );
  }, [selectedPlanId, selectedIsUserPlan, setUserPlan, setSharedPlans, idEquals]);
  const currentPlan = useMemo(() => {
    const foundPlan = allPlans.find(
      (p) => idEquals(p._id, selectedPlanId)
    );
    // If we found a valid plan, update the ref and return it
    if (foundPlan) {
      lastValidPlanRef.current = foundPlan;
      return foundPlan;
    }
    // If selectedPlanId changed, we need to clear the stale ref
    if (lastValidPlanRef.current && !idEquals(lastValidPlanRef.current._id, selectedPlanId)) {
      lastValidPlanRef.current = null;
      return undefined;
    }
    // Return the last valid plan to prevent flash during optimistic updates
    return lastValidPlanRef.current;
  }, [allPlans, selectedPlanId, idEquals]);

  // Smooth loading transition for plan tab
  useEffect(() => {
    if (currentPlan && currentPlan.plan && currentPlan.plan.length > 0) {
      requestAnimationFrame(() => setPlanTabLoading(false));
    }
  }, [currentPlan]);

  // State for scheduling date modal (Timeline view)
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateModalPlanItem, setDateModalPlanItem] = useState(null);
  const [dateModalTimeOnly, setDateModalTimeOnly] = useState(false);
  const [dateModalParentDate, setDateModalParentDate] = useState(null);

  // Handle opening the schedule date modal
  const handleScheduleDate = useCallback((planItem, parentItem = null) => {
    // Scheduling is only allowed on parent items.
    const isChild = planItem?.isChild || planItem?.parent;
    if (isChild) {
      debug.info('[MyPlanTabContent] Ignoring schedule request for child item');
      return;
    }

    setDateModalPlanItem(planItem);

    setDateModalTimeOnly(false);
    setDateModalParentDate(null);

    setShowDateModal(true);
  }, []);

  // Handle saving the scheduled date
  const handleSaveDate = useCallback(async (dateData) => {
    if (!dateModalPlanItem || !selectedPlanId) return;

    const planItemId = (dateModalPlanItem._id || dateModalPlanItem.plan_item_id)?.toString();
    const existing = currentPlan?.plan?.find((it) => {
      const itId = (it._id || it.plan_item_id)?.toString();
      return Boolean(planItemId && itId && itId === planItemId);
    });

    const prevSchedule = {
      scheduled_date: existing?.scheduled_date ?? null,
      scheduled_time: existing?.scheduled_time ?? null
    };

    // Optimistic update so Timeline view updates instantly (regroup/reorder) when scheduling changes.
    updateSelectedPlanInState((p) => {
      if (!p?.plan || !planItemId) return p;
      return {
        ...p,
        plan: p.plan.map((it) => {
          const itId = (it._id || it.plan_item_id)?.toString();
          if (!itId || itId !== planItemId) return it;
          return {
            ...it,
            scheduled_date: dateData.scheduled_date,
            scheduled_time: dateData.scheduled_time
          };
        })
      };
    });

    try {
      await updatePlanItem(selectedPlanId, dateModalPlanItem._id || dateModalPlanItem.plan_item_id, {
        scheduled_date: dateData.scheduled_date,
        scheduled_time: dateData.scheduled_time
      });
      setShowDateModal(false);
      setDateModalPlanItem(null);
    } catch (error) {
      debug.error('[MyPlanTabContent] Failed to save date', error);

      // Roll back optimistic update if the API call fails.
      updateSelectedPlanInState((p) => {
        if (!p?.plan || !planItemId) return p;
        return {
          ...p,
          plan: p.plan.map((it) => {
            const itId = (it._id || it.plan_item_id)?.toString();
            if (!itId || itId !== planItemId) return it;
            return {
              ...it,
              scheduled_date: prevSchedule.scheduled_date,
              scheduled_time: prevSchedule.scheduled_time
            };
          })
        };
      });
      throw error;
    }
  }, [dateModalPlanItem, selectedPlanId, currentPlan?.plan, updateSelectedPlanInState]);

  // Handle pin/unpin plan item (toggle)
  const handlePinItem = useCallback(async (planItem) => {
    if (!selectedPlanId) return;

    try {
      const itemId = (planItem._id || planItem.plan_item_id)?.toString();

      // Optimistic update - toggle the pinnedItemId
      const planForPin = allPlans.find(p => idEquals(p._id, selectedPlanId));
      const currentPinnedId = planForPin?.pinnedItemId?.toString();
      const newPinnedItemId = currentPinnedId === itemId ? null : itemId;

      updateSelectedPlanInState((p) => ({ ...p, pinnedItemId: newPinnedItemId }));

      // Make API call
      const result = await pinPlanItem(selectedPlanId, itemId);

      debug.log('[MyPlanTabContent] Plan item pin toggled', {
        planId: selectedPlanId,
        itemId,
        action: result.action,
        pinnedItemId: result.pinnedItemId
      });

      // Update with server response (in case it differs)
      updateSelectedPlanInState((p) => ({ ...p, pinnedItemId: result.pinnedItemId }));
    } catch (error) {
      debug.error('[MyPlanTabContent] Failed to pin/unpin item', error);
      // Rollback on error - refetch the plan data
      // For now, just log the error - the optimistic update remains
    }
  }, [selectedPlanId, allPlans, updateSelectedPlanInState, idEquals]);

  // Compute online user IDs from presence data
  // Always include the current user when presence is connected (they're always online to themselves)
  const onlineUserIds = useMemo(() => {
    if (!presenceConnected) {
      return new Set();
    }
    const ids = new Set(planMembers?.map(member => member.userId?.toString()).filter(Boolean) || []);
    // Always include the current user - they should see themselves as online
    if (user?._id) {
      ids.add(user._id.toString());
    }
    return ids;
  }, [presenceConnected, planMembers, user?._id]);

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

    const canNestUnder = (potentialParentId) => {
      if (maxPlanItemNestingLevel <= 0) return false;
      const potentialParent = parentItemMap.get(potentialParentId?.toString());
      if (!potentialParent) return false;
      const parentDepth = getPlanItemDepth(potentialParent);
      return Number.isFinite(parentDepth) && parentDepth < maxPlanItemNestingLevel;
    };

    let promotedToParentPosition = false; // Track if we need special positioning
    if (promotionIntent && draggedIsChild) {
      // Explicit promotion: dragged left outside container alignment → become root item
      // Position above former parent for cognitive sense
      delete draggedItemCopy.parent;
      promotedToParentPosition = true;
      debug.log('[Drag] Promoting child to root (drag left intent), will position above parent');
    } else if (nestingIntent && !draggedHasChildren) {
      // Nesting intent detected (drag right) - can nest under item above OR target
      // Only works for items with no children of their own
      const itemAbove = draggedFlatIndex > 0 ? flattenedItems[draggedFlatIndex - 1] : null;
      const itemAboveId = itemAbove ? (itemAbove.plan_item_id || itemAbove._id).toString() : null;

      // Determine which item to nest under:
      // - If dropping ON a different root item, nest under that target
      // - Otherwise, nest under the item above
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

    // Map both _id and plan_item_id to a canonical expansion key.
    // This lets us normalize child->parent references regardless of whether the parent was stored
    // as a plan instance _id or an experience plan_item_id.
    const idToExpansionKey = useMemo(() => {
      const map = new Map();
      if (!currentPlan?.plan) return map;

      for (const item of currentPlan.plan) {
        const canonicalKey = getExpansionKey(item);
        const itemId = item?._id?.toString?.() || null;
        const refId = item?.plan_item_id?.toString?.() || null;

        if (itemId && canonicalKey) map.set(itemId, canonicalKey);
        if (refId && canonicalKey) map.set(refId, canonicalKey);
      }

      return map;
    }, [currentPlan?.plan, getExpansionKey]);

    const getCanonicalParentKey = useCallback((item) => {
      const rawParentId = item?.parent?.toString?.() || null;
      if (!rawParentId) return null;
      return idToExpansionKey.get(rawParentId) || rawParentId;
    }, [idToExpansionKey]);

  // Helper to flatten and mark children (same as Experience Plan Items)
  // Uses getExpansionKey for consistent canonical ID handling
  const flattenPlanItems = (items) => {
    const result = [];
    const addItem = (item, isChild = false) => {
      // Normalize child->parent references to a canonical key so expand/collapse works
      // regardless of whether parent is stored as plan_item_id or _id.
      const parentKey = getCanonicalParentKey(item);
      const isVisible =
        !isChild ||
        (expandedParents.has(parentKey) &&
          animatingCollapse !== parentKey);
      result.push({ ...item, isChild, isVisible, parentKey });

      // Find children - a child's parent field equals the parent's plan_item_id (canonical key)
      const itemKey = getExpansionKey(item);
      items
        .filter(
          (sub) =>
            sub.parent &&
            getCanonicalParentKey(sub) === itemKey
        )
        .forEach((sub) => addItem(sub, true));
    };
    items
      .filter((item) => !item.parent)
      .forEach((item) => addItem(item, false));
    return result;
  };

  // Permission checks
  const isSuperAdmin = user?.role === 'super_admin' || user?.isSuperAdmin === true;
  const isPlanOwner = planOwner && idEquals(planOwner._id, user._id);
  const isPlanCollaborator =
    currentPlan &&
    currentPlan.permissions?.some(
      (p) => idEquals(p._id, user._id) && ["owner", "collaborator"].includes(p.type)
    );
  const canEdit = isSuperAdmin || isPlanOwner || isPlanCollaborator;

  const openPlanChat = useCallback(async () => {
    if (!currentPlan?._id) return;

    setChatError('');
    setChatLoading(true);

    try {
      const result = await getOrCreatePlanChannel(currentPlan._id);
      setMessagesInitialChannelId(result?.id || '');
      setShowMessagesModal(true);
    } catch (err) {
      setChatError(err?.message || 'Failed to open plan chat');
    } finally {
      setChatLoading(false);
    }
  }, [currentPlan?._id]);

  // Compute earliest scheduled date from plan items as fallback
  // NOTE: ALL useMemo hooks must be called BEFORE any early returns to maintain hooks order
  const earliestScheduledDate = useMemo(() => {
    if (!currentPlan?.plan || currentPlan.plan.length === 0) return null;

    const scheduledDates = currentPlan.plan
      // Parent-only scheduling: ignore any legacy child schedules.
      .filter(item => !item.parent && item.scheduled_date)
      .map(item => new Date(item.scheduled_date))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a - b);

    return scheduledDates.length > 0 ? scheduledDates[0].toISOString() : null;
  }, [currentPlan?.plan]);

  // Compute rendering data BEFORE early returns to maintain hooks order
  // These useMemos handle null currentPlan gracefully
  const flattenedItems = useMemo(() => {
    if (!currentPlan?.plan || currentPlan.plan.length === 0) return [];
    return flattenPlanItems(currentPlan.plan);
  }, [currentPlan?.plan, expandedParents, animatingCollapse, getExpansionKey, getCanonicalParentKey]);

  const filteredItems = useMemo(() => {
    return flattenedItems.filter(
      (item) =>
        item.isVisible ||
        (item.isChild && animatingCollapse === item.parentKey)
    );
  }, [flattenedItems, animatingCollapse]);

  const pinnedItemId = currentPlan?.pinnedItemId?.toString() || null;

  // Helper to check if an item is pinned (either the pinned item itself or a child of it)
  // Need to find the pinned item and check both its _id and plan_item_id
  const pinnedItem = useMemo(() => {
    if (!pinnedItemId || !currentPlan?.plan) return null;
    return currentPlan.plan.find(item =>
      (item._id?.toString() === pinnedItemId) ||
      (item.plan_item_id?.toString() === pinnedItemId)
    );
  }, [pinnedItemId, currentPlan?.plan]);

  const isPinnedOrChild = useCallback((item) => {
    if (!pinnedItemId || !pinnedItem) return false;
    const itemId = (item._id || item.plan_item_id)?.toString();
    // Item is the pinned item itself
    if (itemId === pinnedItemId) return true;
    // Child inherits pinned status from parent - check against both _id and plan_item_id of pinned item
    const parentId = item.parent?.toString();
    if (!parentId) return false;
    if (parentId === pinnedItem._id?.toString()) return true;
    if (parentId === pinnedItem.plan_item_id?.toString()) return true;
    return false;
  }, [pinnedItemId, pinnedItem]);

  // Extract pinned item and its children for separate rendering in Timeline/Activity views
  // Children respect the expand/collapse state of the pinned parent
  const { pinnedItems, unpinnedItems } = useMemo(() => {
    if (!pinnedItemId || flattenedItems.length === 0) {
      return { pinnedItems: [], unpinnedItems: filteredItems };
    }

    const pinned = [];
    const unpinned = [];

    // Get pinned items from flattenedItems, respecting visibility for children
    // The pinned parent is always visible, but its children respect expand/collapse state
    for (const item of flattenedItems) {
      if (isPinnedOrChild(item)) {
        // Include if it's the pinned parent OR if it's a visible child
        if (item.isVisible || (!item.isChild && !item.parent)) {
          pinned.push(item);
        }
      }
    }

    // Get unpinned items from filteredItems (respects expand/collapse for non-pinned)
    for (const item of filteredItems) {
      if (!isPinnedOrChild(item)) {
        unpinned.push(item);
      }
    }

    return { pinnedItems: pinned, unpinnedItems: unpinned };
  }, [flattenedItems, filteredItems, pinnedItemId, isPinnedOrChild]);

  // For timeline/activity views, we need ALL items (including collapsed children)
  // to properly group them with their parents - not just visible items
  const allUnpinnedItems = useMemo(() => {
    if (!pinnedItemId || flattenedItems.length === 0) {
      return flattenedItems;
    }

    return flattenedItems.filter(item => !isPinnedOrChild(item));
  }, [flattenedItems, pinnedItemId, isPinnedOrChild]);

  const itemsToRender = useMemo(() => {
    if (!pinnedItemId || filteredItems.length === 0) return filteredItems;
    // Pinned item (and children) first, then others
    return [...pinnedItems, ...unpinnedItems];
  }, [filteredItems, pinnedItemId, pinnedItems, unpinnedItems]);

  // Memoize timeline grouping to avoid recalculation on every render
  // For timeline/activity views, we exclude pinned items (they render separately at top)
  // Use allUnpinnedItems (includes collapsed children) so hierarchy is preserved
  const timelineGroups = useMemo(() => {
    if (planItemsView !== 'timeline' || flattenedItems.length === 0) return null;
    // Use allUnpinnedItems so pinned item renders separately and children are included
    return groupPlanItemsByDate(allUnpinnedItems);
  }, [planItemsView, flattenedItems, allUnpinnedItems]);

  // Memoize activity type grouping for activity view
  // For timeline/activity views, we exclude pinned items (they render separately at top)
  // Use allUnpinnedItems (includes collapsed children) so hierarchy is preserved
  const activityGroups = useMemo(() => {
    if (planItemsView !== 'activity' || flattenedItems.length === 0) return null;
    // Use allUnpinnedItems so pinned item renders separately and children are included
    return groupItemsByActivityType(allUnpinnedItems, currentPlan?.plan || []);
  }, [planItemsView, flattenedItems, allUnpinnedItems, currentPlan?.plan]);

  const parentsWithChildren = useMemo(() => {
    const parents = new Set();
    if (!currentPlan?.plan) return parents;

    for (const item of currentPlan.plan) {
      if (item.parent) {
        // Normalize parent key so it matches getExpansionKey(parent)
        const canonicalParentKey = getCanonicalParentKey(item);
        if (canonicalParentKey) parents.add(canonicalParentKey);
      }
    }
    return parents;
  }, [currentPlan?.plan, getCanonicalParentKey]);

  // Helper to check if an item has children
  const hasChildren = useCallback((item) => {
    const itemKey = getExpansionKey(item);
    if (!itemKey) return false;
    return parentsWithChildren.has(itemKey);
  }, [parentsWithChildren, getExpansionKey]);

  // Helper to check if an item should be visible based on expand/collapse state
  // Parent items are always visible; child items are visible only if parent is expanded
  const isItemVisible = useCallback((item) => {
    // If not a child, always visible
    if (!item.parent && !item.isChild) return true;
    // Child items: check if parent is expanded
    const parentKey = getCanonicalParentKey(item);
    if (!parentKey) return true;
    return expandedParents.has(parentKey);
  }, [expandedParents, getCanonicalParentKey]);

  // Create parent item lookup for child activity badge display
  const parentItemMap = useMemo(() => {
    const map = new Map();
    if (currentPlan?.plan) {
      for (const item of currentPlan.plan) {
        map.set((item.plan_item_id || item._id)?.toString(), item);
      }
    }
    return map;
  }, [currentPlan?.plan]);

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
      if (depth > 50) return Infinity;
      cursor = parent;
    }

    return depth;
  }, [parentItemMap]);

  const canAddChildToItem = useCallback((item) => {
    if (maxPlanItemNestingLevel <= 0) return false;
    const depth = getPlanItemDepth(item);
    return Number.isFinite(depth) && depth < maxPlanItemNestingLevel;
  }, [maxPlanItemNestingLevel, getPlanItemDepth]);

  /**
   * Shared props for all plan item components (SortablePlanItem, SortableCompactPlanItem, TimelinePlanItem)
   * These are passed to all items regardless of view type
   */
  const sharedItemHandlers = useMemo(() => ({
    handlePlanItemToggleComplete,
    handleViewPlanItemDetails,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
    onScheduleDate: handleScheduleDate,
    onPinItem: handlePinItem,
    onToggleExpand: toggleExpanded,
    lang,
    planOwner,
    planCollaborators,
    canEdit
  }), [
    handlePlanItemToggleComplete,
    handleViewPlanItemDetails,
    handleAddPlanInstanceItem,
    handleEditPlanInstanceItem,
    setPlanInstanceItemToDelete,
    setShowPlanInstanceDeleteModal,
    handleScheduleDate,
    handlePinItem,
    toggleExpanded,
    lang,
    planOwner,
    planCollaborators,
    canEdit
  ]);

  /**
   * Generate per-item props based on the plan item
   * Returns dynamic props that vary per item
   */
  const getItemProps = useCallback((planItem) => {
    const parentItem = planItem.parent
      ? parentItemMap.get(planItem.parent.toString())
      : null;
    const itemId = (planItem._id || planItem.plan_item_id)?.toString();
    const itemHasChildren = hasChildren(planItem);
    const itemExpanded = isItemExpanded(planItem);
    const itemCanAddChild = canAddChildToItem(planItem);

    return {
      parentItem,
      isPinned: itemId === pinnedItemId,
      hasChildren: itemHasChildren,
      isExpanded: itemExpanded,
      canAddChild: itemCanAddChild
    };
  }, [parentItemMap, hasChildren, isItemExpanded, canAddChildToItem, pinnedItemId]);

  // Plan not found or still loading
  // Show skeleton loader when:
  // 1. plansLoading is true (explicit loading state)
  // 2. selectedPlanId exists but plan not in sharedPlans yet (race condition during plan creation)
  // 3. currentPlan is optimistic (placeholder created before canonical plan arrives)
  // Only show "Plan not found" after loading is complete and plan genuinely doesn't exist
  if (!currentPlan || currentPlan?._optimistic) {
    // If we have a selectedPlanId but no plan, it's likely being created/loaded
    const isPlanLoading =
      plansLoading ||
      !!currentPlan?._optimistic ||
      (selectedPlanId && !allPlans.some(p => idEquals(p._id, selectedPlanId)));

    if (isPlanLoading) {
      return (
        <div className="my-plan-view mt-4">
          {hashSelecting && (
            <div className="mb-3">
              <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
            </div>
          )}
          {/* Skeleton for plan metrics */}
          <div className="plan-metrics-container mb-4">
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
          </div>
          {/* Skeleton for plan items */}
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

    // Only show "Plan not found" when loading is complete and plan truly doesn't exist
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

  // Display date: use planned_date if set, otherwise fallback to earliest scheduled date
  const displayDate = currentPlan.planned_date || earliestScheduledDate;
  const isUsingFallbackDate = !currentPlan.planned_date && earliestScheduledDate;

  // Build metrics array for MetricsBar
  // Order: Completion → Cost Estimate → Planning Time → Planned Date
  const planMetrics = metricsLoading ? [] : [
    {
      id: 'completion',
      title: lang.current.label.completion,
      type: 'completion',
      value: currentPlan.completion_percentage || 0,
      icon: <FaCheckCircle />,
      color: (currentPlan.completion_percentage || 0) >= 100 ? 'success' :
             (currentPlan.completion_percentage || 0) >= 50 ? 'primary' : 'default'
    },
    {
      id: 'total-cost',
      title: lang?.current?.label?.costEstimate || 'Cost Estimate',
      type: 'cost',
      value: currentPlan.total_cost || 0,
      icon: <FaDollarSign />,
      className: 'smallMetricValueItem',
      // Tooltip shows per-person context with the actual cost estimate value
      tooltip: `${lang.current.label.costEstimatePerPersonTooltip || 'Estimated cost per person'}: ${formatCurrency(currentPlan.total_cost || 0)}`
    },
    {
      id: 'planning-time',
      title: lang.current.label.planningTime,
      type: 'days',
      value: currentPlan.max_planning_days > 0 ? currentPlan.max_planning_days : null,
      icon: <FaClock />,
      className: 'smallMetricValueItem',
      // Tooltip shows full planning time when truncated
      tooltip: currentPlan.max_planning_days > 0 ? formatPlanningTime(currentPlan.max_planning_days) : null
    },
    {
      id: 'planned-date',
      title: lang.current.label.plannedDate,
      type: 'date',
      value: displayDate,
      icon: <FaCalendarAlt />,
      className: 'plannedDateItem',
      // Tooltip shows full date when truncated, with note if using fallback
      tooltip: displayDate
        ? `${formatDateMetricCard(displayDate)}${isUsingFallbackDate ? ' (earliest)' : ''}`
        : null,
      onClick: !currentPlan.planned_date ? () => {
        setIsEditingDate(true);
        setPlannedDate(
          displayedPlannedDate
            ? formatDateForInput(displayedPlannedDate)
            : ""
        );
        setShowDatePicker(true);
      } : undefined
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
          <Banner
            type="info"
            size="sm"
            dismissible={true}
            onDismiss={dismissSyncAlert}
            message={lang.current.alert.planOutOfSyncMessage}
            button={{
              text: loading ? lang.current.button.syncing : lang.current.button.syncNow,
              onClick: handleSyncPlan,
              disabled: loading
            }}
            className="mb-4"
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
            showPresence={presenceConnected}
            onlineUserIds={onlineUserIds}
          />
          <PlanActionsDropdown
            canEdit={canEdit}
            isPlanOwner={isPlanOwner}
            showSyncButton={showSyncButton}
            loading={loading}
            handleAddPlanInstanceItem={handleAddPlanInstanceItem}
            openCollaboratorModal={openCollaboratorModal}
            handleSyncPlan={handleSyncPlan}
            chatEnabled={chatEnabled}
            chatLoading={chatLoading}
            openPlanChat={openPlanChat}
          />
        </div>
        {chatError && (
          <p style={{ color: 'var(--bs-danger)' }}>{chatError}</p>
        )}
        <MessagesModal
          show={showMessagesModal}
          onClose={() => setShowMessagesModal(false)}
          initialChannelId={messagesInitialChannelId}
          title="Messages"
        />
        {planMetadata}
        {planTabLoading ? (
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
        ) : (
          <p style={{ color: 'var(--bs-gray-600)', textAlign: 'center' }}>
            {lang.current.alert.noPlanItems}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="my-plan-view mt-4">
      {/* Show loading indicator when we detected a hash deep-link and plans are still loading */}
      {hashSelecting && (
        <div className="mb-3">
          <Loading size="md" message={lang.current.label.loadingPlan || 'Loading plan...'} showMessage={true} />
        </div>
      )}

      {/* Info Banner - Plan Items Out of Sync */}
      {showSyncButton && showSyncAlert && (
        <Banner
          type="info"
          size="sm"
          dismissible={true}
          onDismiss={dismissSyncAlert}
          message={lang.current.alert.planOutOfSyncMessage}
          button={{
            text: loading ? lang.current.button.syncing : lang.current.button.syncNow,
            onClick: handleSyncPlan,
            disabled: loading
          }}
          className="mb-4"
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
          showPresence={presenceConnected}
          onlineUserIds={onlineUserIds}
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
          chatEnabled={chatEnabled}
          chatLoading={chatLoading}
          openPlanChat={openPlanChat}
        />
      </div>

      {chatError && (
        <p style={{ color: 'var(--bs-danger)' }}>{chatError}</p>
      )}

      <MessagesModal
        show={showMessagesModal}
        onClose={() => setShowMessagesModal(false)}
        initialChannelId={messagesInitialChannelId}
        title="Messages"
      />

      {/* Plan Metrics Cards */}
      {planMetadata}

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

      {/* Plan Items List - Card View with Drag-and-Drop */}
      {planItemsView === 'card' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemsToRender.map(item => (item.plan_item_id || item._id).toString())}
            strategy={verticalListSortingStrategy}
          >
            {itemsToRender.map((planItem) => {
              const itemId = (planItem._id || planItem.plan_item_id)?.toString();
              const itemHasChildren = hasChildren(planItem);
              const itemExpanded = itemHasChildren ? isItemExpanded(planItem) : false;
              const itemCanAddChild = canAddChildToItem(planItem);
              return (
                <SortablePlanItem
                  key={planItem.plan_item_id || planItem._id}
                  planItem={planItem}
                  currentPlan={currentPlan}
                  user={user}
                  idEquals={idEquals}
                  canEdit={canEdit}
                  canAddChild={itemCanAddChild}
                  toggleExpanded={toggleExpanded}
                  hasChildren={itemHasChildren}
                  isExpanded={itemExpanded}
                  getExpansionKey={getExpansionKey}
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
                  onPinItem={handlePinItem}
                  isPinned={itemId === pinnedItemId}
                />
              );
            })}
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
            items={itemsToRender.map(item => (item.plan_item_id || item._id).toString())}
            strategy={verticalListSortingStrategy}
          >
            <div className="compact-plan-items-list">
              {itemsToRender.map((planItem) => {
                const itemProps = getItemProps(planItem);
                return (
                  <SortableCompactPlanItem
                    key={planItem.plan_item_id || planItem._id}
                    planItem={planItem}
                    {...sharedItemHandlers}
                    {...itemProps}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Plan Items List - Activity View (grouped by activity type with drag and drop) */}
      {planItemsView === 'activity' && activityGroups && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="activity-plan-items-list">
            {/* Pinned Section - shown outside activity groups */}
            {pinnedItems.length > 0 && (
              <div className="activity-type-group activity-type-pinned">
                <div className="activity-type-group-header activity-pinned-header">
                  <span className="activity-type-label">Pinned</span>
                </div>
                <SortableContext
                  items={pinnedItems.map(item => (item.plan_item_id || item._id).toString())}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="activity-type-group-items">
                    {pinnedItems.map((planItem) => {
                      const itemProps = getItemProps(planItem);
                      return (
                        <SortableCompactPlanItem
                          key={planItem.plan_item_id || planItem._id}
                          planItem={planItem}
                          {...sharedItemHandlers}
                          {...itemProps}
                          showActivityBadge={true}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </div>
            )}

            {/* Groups by activity type */}
            {activityGroups.groups.map((group) => {
              const visibleItems = group.items.filter(isItemVisible);
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.type} className="activity-type-group">
                  <div className="activity-type-group-header">
                    <span className="activity-type-icon">{group.icon}</span>
                    <span className="activity-type-label">{group.label}</span>
                    <span className="activity-type-count">({visibleItems.length})</span>
                  </div>
                  <SortableContext
                    items={visibleItems.map(item => (item.plan_item_id || item._id).toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="activity-type-group-items">
                      {visibleItems.map((planItem) => {
                        const itemProps = getItemProps(planItem);
                        return (
                          <SortableCompactPlanItem
                            key={planItem.plan_item_id || planItem._id}
                            planItem={planItem}
                            {...sharedItemHandlers}
                            {...itemProps}
                            showActivityBadge={true}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              );
            })}

            {/* Ungrouped items (no activity type) */}
            {(() => {
              const visibleUngrouped = activityGroups.ungrouped.filter(isItemVisible);
              if (visibleUngrouped.length === 0) return null;
              return (
                <div className="activity-type-group activity-type-ungrouped">
                  <div className="activity-type-group-header">
                    <span className="activity-type-icon">📌</span>
                    <span className="activity-type-label">Unspecified</span>
                    <span className="activity-type-count">({visibleUngrouped.length})</span>
                  </div>
                  <SortableContext
                    items={visibleUngrouped.map(item => (item.plan_item_id || item._id).toString())}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="activity-type-group-items">
                      {visibleUngrouped.map((planItem) => {
                        const parentItem = planItem.parent
                          ? parentItemMap.get(planItem.parent.toString())
                          : null;
                        const itemId = (planItem._id || planItem.plan_item_id)?.toString();
                        const itemHasChildren = hasChildren(planItem);
                        const itemExpanded = isItemExpanded(planItem);
                        const itemCanAddChild = canAddChildToItem(planItem);
                        return (
                          <SortableCompactPlanItem
                            key={planItem.plan_item_id || planItem._id}
                            planItem={planItem}
                            canEdit={canEdit}
                            canAddChild={itemCanAddChild}
                            handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                            handleViewPlanItemDetails={handleViewPlanItemDetails}
                            handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                            handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                            setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                            setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                            onScheduleDate={handleScheduleDate}
                            onPinItem={handlePinItem}
                            isPinned={itemId === pinnedItemId}
                            lang={lang}
                            parentItem={parentItem}
                            planOwner={planOwner}
                            planCollaborators={planCollaborators}
                            hasChildren={itemHasChildren}
                            isExpanded={itemExpanded}
                            onToggleExpand={toggleExpanded}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              );
            })()}

            {/* Empty state */}
            {activityGroups.groups.length === 0 && activityGroups.ungrouped.length === 0 && (
              <div className="activity-empty-state">
                <p>No plan items yet. Add items to see them grouped by activity type.</p>
              </div>
            )}
          </div>
        </DndContext>
      )}

      {/* Plan Items List - Timeline View (grouped by date, time of day, then activity type) */}
      {planItemsView === 'timeline' && timelineGroups && (
          <div className="timeline-plan-items-list">
            {/* Pinned Section - shown outside timeline groups */}
            {pinnedItems.length > 0 && (
              <div className="timeline-date-group timeline-pinned">
                <div className="timeline-date-header timeline-pinned-header">
                  Pinned
                </div>
                <div className="timeline-date-content">
                  <div className="timeline-time-items">
                    {pinnedItems.map((planItem) => {
                      const parentItem = planItem.parent
                        ? parentItemMap.get(planItem.parent.toString())
                        : null;
                      const itemId = (planItem._id || planItem.plan_item_id)?.toString();
                      const itemHasChildren = hasChildren(planItem);
                      const itemExpanded = isItemExpanded(planItem);
                      const itemCanAddChild = canAddChildToItem(planItem);
                      return (
                        <TimelinePlanItem
                          key={planItem.plan_item_id || planItem._id}
                          planItem={planItem}
                          canEdit={canEdit}
                          canAddChild={itemCanAddChild}
                          handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                          handleViewPlanItemDetails={handleViewPlanItemDetails}
                          handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                          handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                          setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                          setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                          onScheduleDate={handleScheduleDate}
                          lang={lang}
                          parentItem={parentItem}
                          planOwner={planOwner}
                          planCollaborators={planCollaborators}
                          onPinItem={handlePinItem}
                          isPinned={itemId === pinnedItemId}
                          hasChildren={itemHasChildren}
                          isExpanded={itemExpanded}
                          onToggleExpand={toggleExpanded}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Scheduled items grouped by date */}
            {timelineGroups.groups.map((group) => (
              <TimelineDateGroup
                key={group.dateKey}
                group={group}
                canEdit={canEdit}
                handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                handleViewPlanItemDetails={handleViewPlanItemDetails}
                handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                onScheduleDate={handleScheduleDate}
                lang={lang}
                parentItemMap={parentItemMap}
                canAddChildFn={canAddChildToItem}
                planOwner={planOwner}
                planCollaborators={planCollaborators}
                handlePinItem={handlePinItem}
                pinnedItemId={pinnedItemId}
                hasChildrenFn={hasChildren}
                expandedParents={expandedParents}
                toggleExpanded={toggleExpanded}
                isItemVisibleFn={isItemVisible}
                isItemExpandedFn={isItemExpanded}
              />
            ))}

            {/* Unscheduled items section - also grouped by activity type */}
            {timelineGroups.unscheduled.length > 0 && (
              <div className="timeline-date-group timeline-unscheduled">
                <div className="timeline-date-header">
                  Unscheduled
                </div>
                <div className="timeline-date-content">
                  <div className="timeline-time-items">
                    {/* Grouped by activity type */}
                    {timelineGroups.unscheduledByActivity?.groups?.map(activityGroup => {
                      const visibleItems = activityGroup.items.filter(isItemVisible);
                      if (visibleItems.length === 0) return null;
                      return (
                        <div key={activityGroup.type} className="timeline-activity-group">
                          <div className="timeline-activity-header">
                            <span className="timeline-activity-icon">{activityGroup.icon}</span>
                            <span className="timeline-activity-label">{activityGroup.label}</span>
                          </div>
                          <div className="timeline-activity-items">
                            {visibleItems.map(item => {
                              const parentItem = item.parent
                                ? parentItemMap.get(item.parent.toString())
                                : null;
                              const itemId = (item.plan_item_id || item._id)?.toString();
                              const itemCanAddChild = canAddChildToItem(item);
                              return (
                                <TimelinePlanItem
                                  key={item.plan_item_id || item._id}
                                  planItem={item}
                                  canEdit={canEdit}
                                  canAddChild={itemCanAddChild}
                                  handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                                  handleViewPlanItemDetails={handleViewPlanItemDetails}
                                  handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                                  handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                                  setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                                  setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                                  onScheduleDate={handleScheduleDate}
                                  lang={lang}
                                  parentItem={parentItem}
                                  planOwner={planOwner}
                                  planCollaborators={planCollaborators}
                                  onPinItem={handlePinItem}
                                  isPinned={itemId === pinnedItemId}
                                  hasChildren={hasChildren(item)}
                                  isExpanded={isItemExpanded(item)}
                                  onToggleExpand={toggleExpanded}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Ungrouped items (no activity type) */}
                    {(() => {
                      const visibleUngrouped = (timelineGroups.unscheduledByActivity?.ungrouped || []).filter(isItemVisible);
                      if (visibleUngrouped.length === 0) return null;
                      return (
                        <div className="timeline-activity-group timeline-activity-ungrouped">
                          {timelineGroups.unscheduledByActivity?.groups?.length > 0 && (
                            <div className="timeline-activity-header">
                              <span className="timeline-activity-icon">📌</span>
                              <span className="timeline-activity-label">Other</span>
                            </div>
                          )}
                          <div className="timeline-activity-items">
                            {visibleUngrouped.map(item => {
                              const parentItem = item.parent
                                ? parentItemMap.get(item.parent.toString())
                                : null;
                              const itemId = (item.plan_item_id || item._id)?.toString();
                              const itemCanAddChild = canAddChildToItem(item);
                              return (
                                <TimelinePlanItem
                                  key={item.plan_item_id || item._id}
                                  planItem={item}
                                  canEdit={canEdit}
                                  canAddChild={itemCanAddChild}
                                  handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                                  handleViewPlanItemDetails={handleViewPlanItemDetails}
                                  handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                                  handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                                  setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                                  setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                                  onScheduleDate={handleScheduleDate}
                                  lang={lang}
                                  parentItem={parentItem}
                                  planOwner={planOwner}
                                  planCollaborators={planCollaborators}
                                  onPinItem={handlePinItem}
                                  isPinned={itemId === pinnedItemId}
                                  hasChildren={hasChildren(item)}
                                  isExpanded={isItemExpanded(item)}
                                  onToggleExpand={toggleExpanded}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Empty state when no items */}
            {timelineGroups.groups.length === 0 && timelineGroups.unscheduled.length === 0 && (
              <div className="timeline-empty-state">
                <p>No plan items yet. Add items to see them in your timeline.</p>
              </div>
            )}
          </div>
      )}

      {/* Schedule Date Modal */}
      <AddDateModal
        show={showDateModal}
        onClose={() => {
          setShowDateModal(false);
          setDateModalPlanItem(null);
          setDateModalTimeOnly(false);
          setDateModalParentDate(null);
        }}
        onSave={handleSaveDate}
        initialDate={dateModalPlanItem?.scheduled_date || null}
        initialTime={dateModalPlanItem?.scheduled_time || null}
        planItemText={dateModalPlanItem?.text || 'Plan Item'}
        minDate={currentPlan?.planned_date || null}
        timeOnly={dateModalTimeOnly}
        fixedDate={dateModalParentDate}
      />

      {/* Costs Section */}
      <CostsList
        planId={selectedPlanId}
        costs={costs}
        costSummary={costSummary}
        collaborators={planOwner ? [planOwner, ...(planCollaborators || [])] : planCollaborators || []}
        planItems={currentPlan.plan || []}
        currency={currentPlan?.currency || 'USD'}
        displayCurrency={user?.preferences?.currency}
        canEdit={canEdit}
        onAddCost={onAddCost}
        onUpdateCost={onUpdateCost}
        onDeleteCost={onDeleteCost}
        loading={costsLoading}
        showSummary={true}
        compact={false}
        presenceConnected={presenceConnected}
        onlineUserIds={onlineUserIds}
      />
    </div>
  );
}
