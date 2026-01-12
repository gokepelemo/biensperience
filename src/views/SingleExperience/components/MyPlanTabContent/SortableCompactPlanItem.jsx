import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaDollarSign, FaClock, FaThumbtack } from 'react-icons/fa';

import ActionsMenu from '../../../../components/ActionsMenu';
import DragHandle from '../../../../components/DragHandle/DragHandle';
import Checkbox from '../../../../components/Checkbox/Checkbox';

import { sanitizeUrl, sanitizeText } from '../../../../utilities/sanitize';
import { getActivityType, getActivityTypeDisplay } from '../../../../constants/activity-types';


import { buildStandardPlanItemActions } from './utils/actions';
import styles from '../MyPlanTabContent.module.scss';

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
        <div
          {...attributes}
          {...listeners}
          className={`compact-drag-handle ${isDragging ? styles.grabbing : styles.grab}`}
        >
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

export default SortableCompactPlanItem;
