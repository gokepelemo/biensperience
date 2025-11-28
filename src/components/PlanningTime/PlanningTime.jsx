import { useMemo } from 'react';
import { FaClock } from 'react-icons/fa';
import { formatPlanningTime, getPlanningTimeTooltip, getPlanningTimeLabel } from '../../utilities/planning-time-utils';
import InfoTooltip from '../InfoTooltip/InfoTooltip';
import styles from './PlanningTime.module.scss';

/**
 * PlanningTime Component
 *
 * Displays formatted planning time with an optional tooltip explaining
 * what planning time means. Inherits font/color styles from parent container.
 *
 * @param {Object} props
 * @param {number} props.days - Number of days (stored value from database)
 * @param {boolean} props.showIcon - Show clock icon before the time (default: false)
 * @param {boolean} props.showLabel - Show "Planning Time:" prefix (default: false)
 * @param {boolean} props.showTooltip - Show info icon with tooltip (default: true)
 * @param {string} props.className - Additional CSS classes
 */
export default function PlanningTime({
  days,
  showIcon = false,
  showLabel = false,
  showTooltip = true,
  className = ''
}) {
  const formattedTime = useMemo(() => formatPlanningTime(days), [days]);
  const tooltipText = getPlanningTimeTooltip();
  const label = getPlanningTimeLabel();

  // Don't render if no valid planning time
  if (!formattedTime) {
    return null;
  }

  return (
    <span className={`${styles.planningTime} ${className}`.trim()}>
      {showIcon && (
        <FaClock className={styles.clockIcon} aria-hidden="true" />
      )}
      {showLabel && (
        <span className={styles.label}>{label}: </span>
      )}
      <span className={styles.value}>{formattedTime}</span>
      {showTooltip && (
        <InfoTooltip
          content={tooltipText}
          ariaLabel="Planning time information"
        />
      )}
    </span>
  );
}

/**
 * PlanningTimeBadge Component
 *
 * A badge-styled variant of PlanningTime for card displays.
 *
 * @param {Object} props
 * @param {number} props.days - Number of days
 * @param {string} props.className - Additional CSS classes
 */
export function PlanningTimeBadge({ days, className = '' }) {
  const formattedTime = useMemo(() => formatPlanningTime(days), [days]);
  const tooltipText = getPlanningTimeTooltip();

  if (!formattedTime) {
    return null;
  }

  return (
    <span className={`${styles.badge} ${className}`.trim()}>
      <FaClock className={styles.badgeIcon} aria-hidden="true" />
      {formattedTime}
      <InfoTooltip
        content={tooltipText}
        ariaLabel={`Planning time: ${formattedTime}. Tap for more info.`}
      />
    </span>
  );
}

/**
 * PlanningTimeInline Component
 *
 * Minimal inline variant without icons for text flow.
 * Inherits all styles from parent.
 *
 * @param {Object} props
 * @param {number} props.days - Number of days
 * @param {string} props.className - Additional CSS classes
 */
export function PlanningTimeInline({ days, className = '' }) {
  const formattedTime = useMemo(() => formatPlanningTime(days), [days]);
  const tooltipText = getPlanningTimeTooltip();

  if (!formattedTime) {
    return null;
  }

  return (
    <span className={`${styles.inline} ${className}`.trim()}>
      {formattedTime}
      <InfoTooltip
        content={tooltipText}
        ariaLabel={`Planning time: ${formattedTime}. Tap for more info.`}
      />
    </span>
  );
}
