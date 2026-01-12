import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  BsPlusCircle,
  BsPencilSquare,
  BsPinAngle,
  BsPinAngleFill,
  BsTrash3,
} from 'react-icons/bs';
import { FaClipboardList, FaThumbtack } from 'react-icons/fa';

import ActionsMenu from '../../../../components/ActionsMenu';
import DragHandle from '../../../../components/DragHandle/DragHandle';
import CostEstimate from '../../../../components/CostEstimate/CostEstimate';
import PlanningTime from '../../../../components/PlanningTime/PlanningTime';

import { sanitizeUrl, sanitizeText } from '../../../../utilities/sanitize';

import styles from '../MyPlanTabContent.module.scss';
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
              ) : (
                <span>{sanitizeText(planItem.text)}</span>
              );
            })() : (
              <span>{sanitizeText(planItem.text)}</span>
            )}
          </div>
        </div>

        {/* Drag handle - positioned between title and action buttons */}
        {/* Pinned items don't show drag handle since they're always at top */}
        {canEdit && !isPinned && (
          <div
            {...attributes}
            {...listeners}
            className={`drag-handle-wrapper ${isDragging ? styles.grabbing : styles.grab}`}
          >
            <DragHandle
              isDragging={isDragging}
              disabled={!canEdit}
            />
          </div>
        )}

        <div className="plan-item-actions plan-item-card-actions">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={(e) => {
              e.stopPropagation();
              handleViewPlanItemDetails(planItem);
            }}
            aria-label={lang.current.tooltip.viewNotesAssignmentsDetails}
            title={lang.current.tooltip.viewNotesAssignmentsDetails}
          >
            <FaClipboardList />
          </button>
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
      {(Number(planItem.cost) > 0 || Number(planItem.planning_days) > 0) && (
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
          </div>
        </div>
      )}
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

export default SortablePlanItem;
