import React from 'react';
import PropTypes from 'prop-types';
import {
  DndContext,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortablePlanItem from './SortablePlanItem';
import SortableCompactPlanItem from './SortableCompactPlanItem';
import TimelinePlanItem from './TimelinePlanItem';
import TimelineDateGroup from './TimelineDateGroup';

/**
 * Unified renderer for plan items across all view types.
 * Handles DndContext/SortableContext setup and view-specific rendering.
 *
 * @param {Object} props
 * @param {'card'|'compact'|'activity'|'timeline'} props.viewType - Current view type
 * @param {Array} props.itemsToRender - Items to render (combined pinned + unpinned for card/compact)
 * @param {Array} props.pinnedItems - Pinned items (for activity/timeline views)
 * @param {Object|null} props.activityGroups - Grouped data for activity view
 * @param {Object|null} props.timelineGroups - Grouped data for timeline view
 * @param {Array} props.sensors - DnD sensors from usePlanItemDragDrop
 * @param {Function} props.onDragEnd - Drag end handler
 * @param {Object} props.sharedItemHandlers - Shared handlers for all item types
 * @param {Object} props.sharedSortablePlanItemProps - Card view specific props
 * @param {Function} props.getItemProps - Function to get per-item props
 * @param {Function} props.isItemVisible - Visibility filter function
 * @param {string|null} props.pinnedItemId - Currently pinned item ID
 */
function PlanItemsRenderer({
  viewType,
  itemsToRender,
  pinnedItems,
  activityGroups,
  timelineGroups,
  sensors,
  onDragEnd,
  sharedItemHandlers,
  sharedSortablePlanItemProps,
  getItemProps,
  isItemVisible,
  pinnedItemId
}) {
  /**
   * Render Card View with drag-and-drop
   */
  const renderCardView = () => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={itemsToRender.map(item => (item.plan_item_id || item._id).toString())}
        strategy={verticalListSortingStrategy}
      >
        {itemsToRender.map((planItem) => {
          const itemId = (planItem._id || planItem.plan_item_id)?.toString();
          const itemProps = getItemProps(planItem);
          return (
            <SortablePlanItem
              key={planItem.plan_item_id || planItem._id}
              planItem={planItem}
              canAddChild={itemProps.canAddChild}
              hasChildren={itemProps.hasChildren}
              isExpanded={itemProps.isExpanded}
              {...sharedSortablePlanItemProps}
              isPinned={itemId === pinnedItemId}
            />
          );
        })}
      </SortableContext>
    </DndContext>
  );

  /**
   * Render Compact View with drag-and-drop
   */
  const renderCompactView = () => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
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
  );

  /**
   * Render Activity View (grouped by activity type with drag-and-drop)
   */
  const renderActivityView = () => {
    if (!activityGroups) return null;

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <div className="activity-plan-items-list">
          {/* Pinned Section */}
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
    );
  };

  /**
   * Render Timeline View (grouped by date, not drag-and-drop)
   */
  const renderTimelineView = () => {
    if (!timelineGroups) return null;

    return (
      <div className="timeline-plan-items-list">
        {/* Pinned Section */}
        {pinnedItems.length > 0 && (
          <div className="timeline-date-group timeline-pinned">
            <div className="timeline-date-header timeline-pinned-header">
              Pinned
            </div>
            <div className="timeline-date-content">
              <div className="timeline-time-items">
                {pinnedItems.map((planItem) => {
                  const itemProps = getItemProps(planItem);
                  return (
                    <TimelinePlanItem
                      key={planItem.plan_item_id || planItem._id}
                      planItem={planItem}
                      {...sharedItemHandlers}
                      {...itemProps}
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
            isItemVisibleFn={isItemVisible}
            sharedItemHandlers={sharedItemHandlers}
            getItemProps={getItemProps}
          />
        ))}

        {/* Unscheduled items section */}
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
                          const itemProps = getItemProps(item);
                          return (
                            <TimelinePlanItem
                              key={item.plan_item_id || item._id}
                              planItem={item}
                              {...sharedItemHandlers}
                              {...itemProps}
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
                          const itemProps = getItemProps(item);
                          return (
                            <TimelinePlanItem
                              key={item.plan_item_id || item._id}
                              planItem={item}
                              {...sharedItemHandlers}
                              {...itemProps}
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

        {/* Empty state */}
        {timelineGroups.groups.length === 0 && timelineGroups.unscheduled.length === 0 && (
          <div className="timeline-empty-state">
            <p>No plan items yet. Add items to see them in your timeline.</p>
          </div>
        )}
      </div>
    );
  };

  // Render appropriate view
  switch (viewType) {
    case 'card':
      return renderCardView();
    case 'compact':
      return renderCompactView();
    case 'activity':
      return renderActivityView();
    case 'timeline':
      return renderTimelineView();
    default:
      return null;
  }
}

PlanItemsRenderer.propTypes = {
  viewType: PropTypes.oneOf(['card', 'compact', 'activity', 'timeline']).isRequired,
  itemsToRender: PropTypes.array.isRequired,
  pinnedItems: PropTypes.array,
  activityGroups: PropTypes.shape({
    groups: PropTypes.array,
    ungrouped: PropTypes.array
  }),
  timelineGroups: PropTypes.shape({
    groups: PropTypes.array,
    unscheduled: PropTypes.array,
    unscheduledByActivity: PropTypes.shape({
      groups: PropTypes.array,
      ungrouped: PropTypes.array
    })
  }),
  sensors: PropTypes.array.isRequired,
  onDragEnd: PropTypes.func.isRequired,
  sharedItemHandlers: PropTypes.object.isRequired,
  sharedSortablePlanItemProps: PropTypes.object,
  getItemProps: PropTypes.func.isRequired,
  isItemVisible: PropTypes.func.isRequired,
  pinnedItemId: PropTypes.string
};

PlanItemsRenderer.defaultProps = {
  pinnedItems: [],
  activityGroups: null,
  timelineGroups: null,
  sharedSortablePlanItemProps: {},
  pinnedItemId: null
};

export default PlanItemsRenderer;
