import { memo, useMemo } from 'react';
import { FaDollarSign, FaClock, FaStickyNote, FaUser, FaThumbtack } from 'react-icons/fa';
import Checkbox from '../../../../components/Checkbox/Checkbox';
import ActionsMenu from '../../../../components/ActionsMenu';
import { sanitizeUrl, sanitizeText } from '../../../../utilities/sanitize';
import { getActivityTypeDisplay } from '../../../../constants/activity-types';
import { formatTimeForDisplay } from './utils/time';
import { buildStandardPlanItemActions } from './utils/actions';

/**
 * TimelinePlanItem - Similar to compact item but with time display for Timeline view.
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
              aria-label={isExpanded ? 'Collapse child items' : 'Expand child items'}
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
              aria-label={isExpanded ? 'Collapse child items' : 'Expand child items'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )
        ) : isPinned ? (
          <FaThumbtack
            className="text-warning"
            aria-label={lang.current.aria.pinnedItem}
            title={lang.current.tooltip.pinnedToTop}
          />
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
          <span
            className="timeline-meta-notes"
            title={`${planItem.details.notes.length} ${planItem.details.notes.length === 1 ? 'note' : 'notes'}`}
          >
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

export default TimelinePlanItem;
