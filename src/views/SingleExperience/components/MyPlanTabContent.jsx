/**
 * MyPlanTabContent Component
 * Displays user's plan with CRUD operations, metrics, and collaborative features
 * Updated to match The Plan tab design for cost and planning days display
 */

import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BsPlusCircle, BsPersonPlus, BsArrowRepeat, BsThreeDotsVertical, BsListUl, BsCardList, BsCalendarWeek } from 'react-icons/bs';
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaStickyNote,
  FaClipboardList,
  FaCalendarAlt,
  FaDollarSign,
  FaCheckCircle,
  FaClock,
  FaUser
} from 'react-icons/fa';
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
import { updatePlanItem } from '../../../utilities/plans-api';
import { formatCurrency } from '../../../utilities/currency-utils';
import { formatDateMetricCard, formatDateForInput } from '../../../utilities/date-utils';
import { formatPlanningTime } from '../../../utilities/planning-time-utils';
import { formatCostEstimate } from '../../../utilities/cost-utils';
import { lang } from '../../../lang.constants';
import debug from '../../../utilities/debug';
import {
  getActivityType,
  getActivityTypeIcon,
  getActivityTypeLabel,
  getActivityTypeDisplay,
  ACTIVITY_CATEGORIES
} from '../../../constants/activity-types';

// View options for plan items display
const VIEW_OPTIONS = [
  { value: 'card', label: 'Card View', icon: BsCardList },
  { value: 'compact', label: 'Compact View', icon: BsListUl },
  { value: 'activity', label: 'Activity View', icon: BsListUl },
  { value: 'timeline', label: 'Timeline View', icon: BsCalendarWeek }
];

/**
 * Group plan items by activity type
 * @param {Array} items - Plan items to group
 * @param {Array} allItems - All plan items (for parent lookup)
 * @returns {Object} { groups: Array<{type, label, icon, items}>, ungrouped: Array }
 */
function groupItemsByActivityType(items, allItems = []) {
  const groups = {};
  const ungrouped = [];

  // Build parent lookup
  const parentMap = new Map();
  for (const item of allItems) {
    parentMap.set(item._id?.toString() || item.plan_item_id?.toString(), item);
  }

  for (const item of items) {
    // Skip child items - they'll be grouped with their parent
    if (item.isChild || item.parent) {
      continue;
    }

    const activityType = item.activity_type;

    if (!activityType) {
      ungrouped.push(item);
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

    // Add children under the same group
    const children = items.filter(child =>
      child.parent?.toString() === (item._id?.toString() || item.plan_item_id?.toString())
    );
    for (const child of children) {
      groups[activityType].items.push(child);
    }
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
 * Memoized to prevent unnecessary re-renders when only one item's complete state changes
 */
const SortablePlanItem = memo(function SortablePlanItem({
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
      data-plan-item-id={planItem._id}
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
                      <FaEdit />
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
                      <FaTrash />
                    </button>
                  </>
                )}
                <button
                  className={`btn btn-sm btn-complete-toggle ${
                    planItem.complete
                      ? "btn-success"
                      : "btn-outline-success"
                  }`}
                  type="button"
                  onClick={(e) => {
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
                title="Click to view notes"
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
            title="View notes, assignments, and other details"
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
    prevProps.planItem.cost === nextProps.planItem.cost &&
    prevProps.planItem.planning_days === nextProps.planItem.planning_days &&
    prevProps.planItem.assignedTo === nextProps.planItem.assignedTo &&
    prevProps.planItem.details?.notes?.length === nextProps.planItem.details?.notes?.length &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.hoveredPlanItem === nextProps.hoveredPlanItem
  );
});

/**
 * SortableCompactPlanItem - One-line view with checkbox and drag-and-drop for plan items
 * Memoized to prevent unnecessary re-renders
 */
const SortableCompactPlanItem = memo(function SortableCompactPlanItem({
  planItem,
  canEdit,
  handlePlanItemToggleComplete,
  handleViewPlanItemDetails,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  onScheduleDate,
  lang,
  parentItem = null,
  showActivityBadge = false
}) {
  const itemId = planItem.plan_item_id || planItem._id;
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);

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

  // Close menu when clicking outside
  useEffect(() => {
    if (!showActionsMenu) return;

    function handleClickOutside(event) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsMenu]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-plan-item-id={planItem._id}
      className={`compact-plan-item ${planItem.complete ? 'completed' : ''} ${planItem.isChild ? 'is-child' : ''} ${isDragging ? 'dragging' : ''}`}
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
        {planItem.isChild ? '↳' : '•'}
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

      {/* Item text - clickable to view details */}
      <span
        className={`compact-item-text ${planItem.complete ? 'text-decoration-line-through text-muted' : ''}`}
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
        {planItem.url ? (
          <a
            href={planItem.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {planItem.text}
          </a>
        ) : (
          planItem.text
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
        {planItem.assignedTo && (
          <span className="compact-meta-assigned" title="Assigned">
            <FaUser />
          </span>
        )}
      </span>

      {/* Actions menu (overflow button with dropdown) */}
      {canEdit && (
        <div className="compact-item-actions-wrapper" ref={actionsMenuRef}>
          <button
            className="compact-actions-toggle"
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            aria-expanded={showActionsMenu}
            aria-haspopup="true"
            aria-label="Item actions"
            title="Actions"
          >
            <BsThreeDotsVertical />
          </button>
          {showActionsMenu && (
            <div className="compact-actions-menu">
              <button
                className="compact-actions-item"
                onClick={() => {
                  handleEditPlanInstanceItem(planItem);
                  setShowActionsMenu(false);
                }}
              >
                <FaEdit /> {lang.current.tooltip.edit}
              </button>
              <button
                className="compact-actions-item"
                onClick={() => {
                  handleAddPlanInstanceItem(planItem.plan_item_id || planItem._id);
                  setShowActionsMenu(false);
                }}
              >
                <FaPlus /> {lang.current.button?.addChildItem || 'Add Child Item'}
              </button>
              <button
                className="compact-actions-item"
                onClick={() => {
                  onScheduleDate(planItem);
                  setShowActionsMenu(false);
                }}
              >
                <FaCalendarAlt /> Schedule Date
              </button>
              <button
                className="compact-actions-item compact-actions-item-danger"
                onClick={() => {
                  setPlanInstanceItemToDelete(planItem);
                  setShowPlanInstanceDeleteModal(true);
                  setShowActionsMenu(false);
                }}
              >
                <FaTrash /> {lang.current.tooltip.delete}
              </button>
            </div>
          )}
        </div>
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
    prevProps.showActivityBadge === nextProps.showActivityBadge
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
 * @param {Array} items - Items in a time section
 * @returns {Array} Items grouped by activity type with ungrouped at the end
 */
function groupTimeItemsByActivityType(items) {
  if (!items || items.length === 0) return [];

  const groups = {};
  const ungrouped = [];

  for (const item of items) {
    const activityType = item.activity_type;

    if (!activityType) {
      ungrouped.push(item);
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

  // Create a map of items by ID for parent lookups
  const itemsById = new Map();
  items.forEach(item => {
    const itemId = (item.plan_item_id || item._id)?.toString();
    if (itemId) {
      itemsById.set(itemId, item);
    }
  });

  // Helper to get effective scheduled date/time (inherit from parent if needed)
  const getEffectiveSchedule = (item) => {
    // If item has its own scheduled_date, use it
    if (item.scheduled_date) {
      return {
        scheduled_date: item.scheduled_date,
        scheduled_time: item.scheduled_time,
        inherited: false
      };
    }

    // If item is a child, try to inherit from parent
    if (item.parent) {
      const parentId = item.parent.toString();
      const parent = itemsById.get(parentId);
      if (parent?.scheduled_date) {
        return {
          scheduled_date: parent.scheduled_date,
          scheduled_time: parent.scheduled_time,
          inherited: true
        };
      }
    }

    // No scheduled date
    return { scheduled_date: null, scheduled_time: null, inherited: false };
  };

  // Process items - parents first, then children grouped with parents
  const parentItems = items.filter(item => !item.parent);
  const childItems = items.filter(item => !!item.parent);

  // Group children by parent ID
  const childrenByParent = new Map();
  childItems.forEach(child => {
    const parentId = child.parent.toString();
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId).push(child);
  });

  // Helper to add item and its children to appropriate group
  const addItemToGroup = (item, effectiveSchedule) => {
    const { scheduled_date, scheduled_time, inherited } = effectiveSchedule;

    if (!scheduled_date) {
      unscheduled.push({ ...item, inheritedSchedule: false });
      // Also add children to unscheduled
      const itemId = (item.plan_item_id || item._id)?.toString();
      const children = childrenByParent.get(itemId) || [];
      children.forEach(child => {
        const childSchedule = getEffectiveSchedule(child);
        if (!childSchedule.scheduled_date) {
          unscheduled.push({ ...child, isChild: true, inheritedSchedule: false });
        }
        // Note: Children with their own schedule are handled separately
      });
      return;
    }

    const date = new Date(scheduled_date);
    if (isNaN(date.getTime())) {
      unscheduled.push({ ...item, inheritedSchedule: false });
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

    const timeOfDay = getTimeOfDay(scheduled_time);
    const itemWithMeta = { ...item, inheritedSchedule: inherited };

    if (timeOfDay) {
      groups[dateKey][timeOfDay].push(itemWithMeta);
    } else {
      groups[dateKey].unspecified.push(itemWithMeta);
    }

    // Add children that inherit from this parent
    const itemId = (item.plan_item_id || item._id)?.toString();
    const children = childrenByParent.get(itemId) || [];
    children.forEach(child => {
      const childSchedule = getEffectiveSchedule(child);
      // Only add children that inherit (don't have their own schedule)
      // Children with their own schedule will be added when processing all items
      if (childSchedule.inherited) {
        const childWithMeta = { ...child, isChild: true, inheritedSchedule: true };
        if (timeOfDay) {
          groups[dateKey][timeOfDay].push(childWithMeta);
        } else {
          groups[dateKey].unspecified.push(childWithMeta);
        }
      }
    });
  };

  // Process parent items first (they bring their children along)
  parentItems.forEach(item => {
    const effectiveSchedule = getEffectiveSchedule(item);
    addItemToGroup(item, effectiveSchedule);
  });

  // Process children that have their own scheduled_date (not inherited)
  childItems.forEach(child => {
    if (child.scheduled_date) {
      const date = new Date(child.scheduled_date);
      if (isNaN(date.getTime())) {
        unscheduled.push({ ...child, isChild: true, inheritedSchedule: false });
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

      const timeOfDay = getTimeOfDay(child.scheduled_time);
      const childWithMeta = { ...child, isChild: true, inheritedSchedule: false };

      if (timeOfDay) {
        groups[dateKey][timeOfDay].push(childWithMeta);
      } else {
        groups[dateKey].unspecified.push(childWithMeta);
      }
    }
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
  handlePlanItemToggleComplete,
  handleViewPlanItemDetails,
  handleAddPlanInstanceItem,
  handleEditPlanInstanceItem,
  setPlanInstanceItemToDelete,
  setShowPlanInstanceDeleteModal,
  onScheduleDate,
  lang,
  parentItem = null
}) {
  const itemId = planItem.plan_item_id || planItem._id;
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);
  const formattedTime = formatTimeForDisplay(planItem.scheduled_time);

  // Close menu when clicking outside
  useEffect(() => {
    if (!showActionsMenu) return;

    function handleClickOutside(event) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsMenu]);

  return (
    <div
      data-plan-item-id={planItem._id}
      className={`timeline-plan-item ${planItem.complete ? 'completed' : ''} ${planItem.isChild ? 'is-child' : ''}`}
    >
      {/* Hierarchy indicator */}
      <span className="timeline-item-indent">
        {planItem.isChild ? '↳' : '•'}
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
        className={`timeline-item-text ${planItem.complete ? 'text-decoration-line-through text-muted' : ''}`}
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
        {planItem.url ? (
          <a
            href={planItem.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {planItem.text}
          </a>
        ) : (
          planItem.text
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
        {planItem.assignedTo && (
          <span className="timeline-meta-assigned" title="Assigned">
            <FaUser />
          </span>
        )}
      </span>

      {/* Actions menu (overflow button with dropdown) */}
      {canEdit && (
        <div className="timeline-item-actions-wrapper" ref={actionsMenuRef}>
          <button
            className="timeline-actions-toggle"
            onClick={() => setShowActionsMenu(!showActionsMenu)}
            aria-expanded={showActionsMenu}
            aria-haspopup="true"
            aria-label="Item actions"
            title="Actions"
          >
            <BsThreeDotsVertical />
          </button>
          {showActionsMenu && (
            <div className="timeline-actions-menu">
              <button
                className="timeline-actions-item"
                onClick={() => {
                  handleEditPlanInstanceItem(planItem);
                  setShowActionsMenu(false);
                }}
              >
                <FaEdit /> {lang.current.tooltip.edit}
              </button>
              <button
                className="timeline-actions-item"
                onClick={() => {
                  handleAddPlanInstanceItem(planItem.plan_item_id || planItem._id);
                  setShowActionsMenu(false);
                }}
              >
                <FaPlus /> {lang.current.button?.addChildItem || 'Add Child Item'}
              </button>
              <button
                className="timeline-actions-item"
                onClick={() => {
                  onScheduleDate(planItem);
                  setShowActionsMenu(false);
                }}
              >
                <FaCalendarAlt /> Schedule Date
              </button>
              <button
                className="timeline-actions-item timeline-actions-item-danger"
                onClick={() => {
                  setPlanInstanceItemToDelete(planItem);
                  setShowPlanInstanceDeleteModal(true);
                  setShowActionsMenu(false);
                }}
              >
                <FaTrash /> {lang.current.tooltip.delete}
              </button>
            </div>
          )}
        </div>
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
    prevProps.parentItem?.activity_type === nextProps.parentItem?.activity_type
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
  parentItemMap
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

    return (
      <>
        {/* Grouped items by activity type */}
        {activityData.groups?.map(activityGroup => (
          <div key={activityGroup.type} className="timeline-activity-group">
            <div className="timeline-activity-header">
              <span className="timeline-activity-icon">{activityGroup.icon}</span>
              <span className="timeline-activity-label">{activityGroup.label}</span>
            </div>
            <div className="timeline-activity-items">
              {activityGroup.items.map(item => {
                const parentItem = item.parent && parentItemMap
                  ? parentItemMap.get(item.parent.toString())
                  : null;
                return (
                  <TimelinePlanItem
                    key={item.plan_item_id || item._id}
                    planItem={item}
                    canEdit={canEdit}
                    handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                    handleViewPlanItemDetails={handleViewPlanItemDetails}
                    handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                    handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                    setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                    setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                    onScheduleDate={onScheduleDate}
                    lang={lang}
                    parentItem={parentItem}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Ungrouped items (no activity type) */}
        {activityData.ungrouped?.length > 0 && (
          <div className="timeline-activity-group timeline-activity-ungrouped">
            {activityData.groups?.length > 0 && (
              <div className="timeline-activity-header">
                <span className="timeline-activity-icon">📌</span>
                <span className="timeline-activity-label">Other</span>
              </div>
            )}
            <div className="timeline-activity-items">
              {activityData.ungrouped.map(item => {
                const parentItem = item.parent && parentItemMap
                  ? parentItemMap.get(item.parent.toString())
                  : null;
                return (
                  <TimelinePlanItem
                    key={item.plan_item_id || item._id}
                    planItem={item}
                    canEdit={canEdit}
                    handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                    handleViewPlanItemDetails={handleViewPlanItemDetails}
                    handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                    handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                    setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                    setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                    onScheduleDate={onScheduleDate}
                    lang={lang}
                    parentItem={parentItem}
                  />
                );
              })}
            </div>
          </div>
        )}
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

  // Plan data
  sharedPlans,
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
  onDeleteCost,

  // Real-time presence
  presenceConnected = false,
  planMembers = [],
  setTyping
}) {
  // View state for plan items display (card or compact) - persisted in user preferences
  // Uses shared key 'viewMode.planItems' so preference syncs between Experience and Plan views
  const [planItemsView, setPlanItemsView] = useUIPreference('viewMode.planItems', 'compact');

  // State for scheduling date modal (Timeline view)
  const [showDateModal, setShowDateModal] = useState(false);
  const [dateModalPlanItem, setDateModalPlanItem] = useState(null);

  // Handle opening the schedule date modal
  const handleScheduleDate = useCallback((planItem) => {
    setDateModalPlanItem(planItem);
    setShowDateModal(true);
  }, []);

  // Handle saving the scheduled date
  const handleSaveDate = useCallback(async (dateData) => {
    if (!dateModalPlanItem || !selectedPlanId) return;

    try {
      await updatePlanItem(selectedPlanId, dateModalPlanItem._id || dateModalPlanItem.plan_item_id, {
        scheduled_date: dateData.scheduled_date,
        scheduled_time: dateData.scheduled_time
      });
      setShowDateModal(false);
      setDateModalPlanItem(null);
    } catch (error) {
      debug.error('[MyPlanTabContent] Failed to save date', error);
      throw error;
    }
  }, [dateModalPlanItem, selectedPlanId]);

  // Compute online user IDs from presence data
  const onlineUserIds = useMemo(() => {
    if (!presenceConnected || !planMembers || planMembers.length === 0) {
      return new Set();
    }
    return new Set(planMembers.map(member => member.userId?.toString()).filter(Boolean));
  }, [presenceConnected, planMembers]);

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
  const currentPlan = sharedPlans.find(
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

  // Compute earliest scheduled date from plan items as fallback
  const earliestScheduledDate = useMemo(() => {
    if (!currentPlan?.plan || currentPlan.plan.length === 0) return null;

    const scheduledDates = currentPlan.plan
      .filter(item => item.scheduled_date)
      .map(item => new Date(item.scheduled_date))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a - b);

    return scheduledDates.length > 0 ? scheduledDates[0].toISOString() : null;
  }, [currentPlan?.plan]);

  // Display date: use planned_date if set, otherwise fallback to earliest scheduled date
  const displayDate = currentPlan.planned_date || earliestScheduledDate;
  const isUsingFallbackDate = !currentPlan.planned_date && earliestScheduledDate;

  // Build metrics array for MetricsBar
  const planMetrics = metricsLoading ? [] : [
    {
      id: 'planned-date',
      title: lang.current.label.plannedDate,
      type: 'date',
      value: displayDate,
      icon: <FaCalendarAlt />,
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
    },
    {
      id: 'total-cost',
      title: (lang?.current?.label?.costEstimate || 'Estimated Cost').replace(':', '').replace(' ($)', ''),
      type: 'cost',
      value: currentPlan.total_cost || 0,
      icon: <FaDollarSign />,
      // Tooltip always shows the actual cost estimate value with prefix
      tooltip: `${(lang.current.label.costEstimate || 'Cost Estimate').replace(' ($)', '')}: ${formatCurrency(currentPlan.total_cost || 0)}`
    },
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
      id: 'planning-time',
      title: lang.current.label.planningTime,
      type: 'days',
      value: currentPlan.max_planning_days > 0 ? currentPlan.max_planning_days : null,
      icon: <FaClock />,
      // Tooltip shows full planning time when truncated
      tooltip: currentPlan.max_planning_days > 0 ? formatPlanningTime(currentPlan.max_planning_days) : null
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

  // Memoize timeline grouping to avoid recalculation on every render
  const timelineGroups = useMemo(() => {
    if (planItemsView !== 'timeline') return null;
    return groupPlanItemsByDate(itemsToRender);
  }, [planItemsView, itemsToRender]);

  // Memoize activity type grouping for activity view
  const activityGroups = useMemo(() => {
    if (planItemsView !== 'activity') return null;
    return groupItemsByActivityType(itemsToRender, currentPlan?.plan || []);
  }, [planItemsView, itemsToRender, currentPlan?.plan]);

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
        />
      </div>

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
                const parentItem = planItem.parent
                  ? parentItemMap.get(planItem.parent.toString())
                  : null;
                return (
                  <SortableCompactPlanItem
                    key={planItem.plan_item_id || planItem._id}
                    planItem={planItem}
                    canEdit={canEdit}
                    handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                    handleViewPlanItemDetails={handleViewPlanItemDetails}
                    handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                    handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                    setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                    setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                    onScheduleDate={handleScheduleDate}
                    lang={lang}
                    parentItem={parentItem}
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
            {/* Groups by activity type */}
            {activityGroups.groups.map((group) => (
              <div key={group.type} className="activity-type-group">
                <div className="activity-type-group-header">
                  <span className="activity-type-icon">{group.icon}</span>
                  <span className="activity-type-label">{group.label}</span>
                  <span className="activity-type-count">({group.items.length})</span>
                </div>
                <SortableContext
                  items={group.items.map(item => (item.plan_item_id || item._id).toString())}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="activity-type-group-items">
                    {group.items.map((planItem) => {
                      const parentItem = planItem.parent
                        ? parentItemMap.get(planItem.parent.toString())
                        : null;
                      return (
                        <SortableCompactPlanItem
                          key={planItem.plan_item_id || planItem._id}
                          planItem={planItem}
                          canEdit={canEdit}
                          handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                          handleViewPlanItemDetails={handleViewPlanItemDetails}
                          handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                          handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                          setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                          setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                          onScheduleDate={handleScheduleDate}
                          lang={lang}
                          parentItem={parentItem}
                          showActivityBadge={true}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </div>
            ))}

            {/* Ungrouped items (no activity type) */}
            {activityGroups.ungrouped.length > 0 && (
              <div className="activity-type-group activity-type-ungrouped">
                <div className="activity-type-group-header">
                  <span className="activity-type-icon">📌</span>
                  <span className="activity-type-label">Unspecified</span>
                  <span className="activity-type-count">({activityGroups.ungrouped.length})</span>
                </div>
                <SortableContext
                  items={activityGroups.ungrouped.map(item => (item.plan_item_id || item._id).toString())}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="activity-type-group-items">
                    {activityGroups.ungrouped.map((planItem) => {
                      const parentItem = planItem.parent
                        ? parentItemMap.get(planItem.parent.toString())
                        : null;
                      return (
                        <SortableCompactPlanItem
                          key={planItem.plan_item_id || planItem._id}
                          planItem={planItem}
                          canEdit={canEdit}
                          handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                          handleViewPlanItemDetails={handleViewPlanItemDetails}
                          handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                          handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                          setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                          setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                          onScheduleDate={handleScheduleDate}
                          lang={lang}
                          parentItem={parentItem}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </div>
            )}

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
                    {timelineGroups.unscheduledByActivity?.groups?.map(activityGroup => (
                      <div key={activityGroup.type} className="timeline-activity-group">
                        <div className="timeline-activity-header">
                          <span className="timeline-activity-icon">{activityGroup.icon}</span>
                          <span className="timeline-activity-label">{activityGroup.label}</span>
                        </div>
                        <div className="timeline-activity-items">
                          {activityGroup.items.map(item => {
                            const parentItem = item.parent
                              ? parentItemMap.get(item.parent.toString())
                              : null;
                            return (
                              <TimelinePlanItem
                                key={item.plan_item_id || item._id}
                                planItem={item}
                                canEdit={canEdit}
                                handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                                handleViewPlanItemDetails={handleViewPlanItemDetails}
                                handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                                handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                                setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                                setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                                onScheduleDate={handleScheduleDate}
                                lang={lang}
                                parentItem={parentItem}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Ungrouped items (no activity type) */}
                    {timelineGroups.unscheduledByActivity?.ungrouped?.length > 0 && (
                      <div className="timeline-activity-group timeline-activity-ungrouped">
                        {timelineGroups.unscheduledByActivity?.groups?.length > 0 && (
                          <div className="timeline-activity-header">
                            <span className="timeline-activity-icon">📌</span>
                            <span className="timeline-activity-label">Other</span>
                          </div>
                        )}
                        <div className="timeline-activity-items">
                          {timelineGroups.unscheduledByActivity.ungrouped.map(item => {
                            const parentItem = item.parent
                              ? parentItemMap.get(item.parent.toString())
                              : null;
                            return (
                              <TimelinePlanItem
                                key={item.plan_item_id || item._id}
                                planItem={item}
                                canEdit={canEdit}
                                handlePlanItemToggleComplete={handlePlanItemToggleComplete}
                                handleViewPlanItemDetails={handleViewPlanItemDetails}
                                handleAddPlanInstanceItem={handleAddPlanInstanceItem}
                                handleEditPlanInstanceItem={handleEditPlanInstanceItem}
                                setPlanInstanceItemToDelete={setPlanInstanceItemToDelete}
                                setShowPlanInstanceDeleteModal={setShowPlanInstanceDeleteModal}
                                onScheduleDate={handleScheduleDate}
                                lang={lang}
                                parentItem={parentItem}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
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
        }}
        onSave={handleSaveDate}
        initialDate={dateModalPlanItem?.scheduled_date || null}
        initialTime={dateModalPlanItem?.scheduled_time || null}
        planItemText={dateModalPlanItem?.text || 'Plan Item'}
        minDate={currentPlan?.planned_date || null}
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
