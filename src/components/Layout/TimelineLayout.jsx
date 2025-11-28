/**
 * TimelineLayout Component
 * Vertical timeline for itinerary planning with day-based grouping.
 */

import React from 'react';
import PropTypes from 'prop-types';
import styles from './TimelineLayout.module.scss';

/**
 * TimelineItem - Individual item on the timeline
 */
export function TimelineItem({
  time,
  title,
  description,
  children,
  isActive = false,
  isCompleted = false,
  className = '',
}) {
  const itemClasses = [
    styles.timelineItem,
    isActive && styles.active,
    isCompleted && styles.completed,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={itemClasses}>
      <div className={styles.timelineNode} aria-hidden="true" />
      <div className={styles.timelineContent}>
        {time && <time className={styles.timelineTime}>{time}</time>}
        {title && <h4 className={styles.timelineTitle}>{title}</h4>}
        {description && <p className={styles.timelineDescription}>{description}</p>}
        {children && <div className={styles.timelineDetails}>{children}</div>}
      </div>
    </div>
  );
}

TimelineItem.propTypes = {
  time: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  children: PropTypes.node,
  isActive: PropTypes.bool,
  isCompleted: PropTypes.bool,
  className: PropTypes.string,
};

/**
 * TimelineDay - Day group container for timeline items
 */
export function TimelineDay({
  date,
  dayLabel,
  children,
  className = '',
}) {
  return (
    <div className={`${styles.timelineDay} ${className}`}>
      <div className={styles.dayHeader}>
        {dayLabel && <span className={styles.dayLabel}>{dayLabel}</span>}
        {date && <time className={styles.dayDate}>{date}</time>}
      </div>
      <div className={styles.dayItems}>{children}</div>
    </div>
  );
}

TimelineDay.propTypes = {
  date: PropTypes.string,
  dayLabel: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

/**
 * TimelineLayout - Container for vertical timeline itinerary
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - TimelineDay components
 * @param {'left'|'center'|'right'} props.linePosition - Position of timeline line
 * @param {boolean} props.showProgress - Show progress indicator
 * @param {number} props.completedCount - Number of completed items
 * @param {number} props.totalCount - Total number of items
 * @param {string} props.className - Additional CSS classes
 */
export default function TimelineLayout({
  children,
  linePosition = 'left',
  showProgress = false,
  completedCount = 0,
  totalCount = 0,
  className = '',
}) {
  const containerClasses = [
    styles.timelineLayout,
    styles[`line${linePosition.charAt(0).toUpperCase() + linePosition.slice(1)}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className={containerClasses}>
      {showProgress && totalCount > 0 && (
        <div className={styles.progressHeader}>
          <span className={styles.progressText}>
            {completedCount} of {totalCount} completed
          </span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}
      <div className={styles.timelineContainer}>{children}</div>
    </div>
  );
}

TimelineLayout.propTypes = {
  children: PropTypes.node.isRequired,
  linePosition: PropTypes.oneOf(['left', 'center', 'right']),
  showProgress: PropTypes.bool,
  completedCount: PropTypes.number,
  totalCount: PropTypes.number,
  className: PropTypes.string,
};

// Named exports for sub-components
TimelineLayout.Day = TimelineDay;
TimelineLayout.Item = TimelineItem;
