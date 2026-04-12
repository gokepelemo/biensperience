import { memo, useMemo } from 'react';
import TimelinePlanItem from './TimelinePlanItem';

/**
 * TimelineDateGroup - Renders a group of plan items for a specific date.
 * Items are grouped first by time of day, then by activity type within each time section.
 */
const TimelineDateGroup = memo(function TimelineDateGroup({
  group,
  isItemVisibleFn,
  sharedItemHandlers,
  getItemProps,
  isNew = null
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

  const { isGroupOverdue, overdueCount } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groupDate = new Date(group.date);
    groupDate.setHours(0, 0, 0, 0);
    if (groupDate >= today) return { isGroupOverdue: false, overdueCount: 0 };

    let count = 0;
    const allActivityData = [
      group.morningByActivity,
      group.afternoonByActivity,
      group.eveningByActivity,
      group.unspecifiedByActivity,
    ].filter(Boolean);

    for (const activityData of allActivityData) {
      for (const g of (activityData.groups || [])) {
        count += (g.items || []).filter(item => !item.complete).length;
      }
      count += (activityData.ungrouped || []).filter(item => !item.complete).length;
    }

    return { isGroupOverdue: count > 0, overdueCount: count };
  }, [group]);

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
                  const itemProps = typeof getItemProps === 'function' ? getItemProps(item) : {};
                  return (
                    <TimelinePlanItem
                      key={item.plan_item_id || item._id}
                      planItem={item}
                      {...sharedItemHandlers}
                      {...itemProps}
                      isNew={typeof isNew === 'function' ? isNew(item) : false}
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
                  const itemProps = typeof getItemProps === 'function' ? getItemProps(item) : {};
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
      <div className={`timeline-date-header${isGroupOverdue ? ' overdue' : ''}`}>
        {formatDateHeader(group.date)}
        {isGroupOverdue && (
          <span
            className="timeline-date-overdue-badge"
            title={`${overdueCount} incomplete ${overdueCount === 1 ? 'item' : 'items'} past their scheduled date`}
          >
            ⚠ {overdueCount} overdue
          </span>
        )}
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

export default TimelineDateGroup;
