/**
 * MetricsBar Component
 * Displays plan metrics in a responsive bar (desktop) or cards (mobile/tablet).
 * Supports multiple metric types: date, string, cost, days, completion
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import * as FaIcons from 'react-icons/fa';
import { formatDateMetricCard } from '../../utilities/date-utils';
import { formatCostEstimate } from '../../utilities/cost-utils';
import { formatPlanningTime } from '../../utilities/planning-time-utils';
import styles from './MetricsBar.module.scss';

/**
 * Detect if a string is an emoji
 * @param {string} str - String to check
 * @returns {boolean} - True if the string is an emoji
 */
function isEmoji(str) {
  if (!str || typeof str !== 'string') return false;
  // Match common emoji patterns including multi-codepoint emojis
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Emoji}\uFE0F)/u;
  return emojiRegex.test(str.trim());
}

/**
 * Get FontAwesome icon component by name
 * @param {string} iconName - FA icon name (e.g., 'FaCalendarAlt', 'calendar-alt', 'CalendarAlt')
 * @returns {React.Component|null} - FA icon component or null
 */
function getFaIcon(iconName) {
  if (!iconName || typeof iconName !== 'string') return null;

  // Normalize icon name to PascalCase with Fa prefix
  let normalizedName = iconName.trim();

  // If it already starts with Fa, use as-is
  if (normalizedName.startsWith('Fa')) {
    return FaIcons[normalizedName] || null;
  }

  // Convert kebab-case or snake_case to PascalCase
  // e.g., 'calendar-alt' -> 'CalendarAlt', 'check_circle' -> 'CheckCircle'
  const pascalCase = normalizedName
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  return FaIcons[`Fa${pascalCase}`] || null;
}

/**
 * Render icon - handles emoji, FA icon, or React node
 * @param {string|React.ReactNode} icon - Icon to render
 * @returns {React.ReactNode} - Rendered icon
 */
function renderIcon(icon) {
  if (!icon) return null;

  // If it's already a React element, render as-is
  if (React.isValidElement(icon)) {
    return icon;
  }

  // If it's a string
  if (typeof icon === 'string') {
    // Check if it's an emoji
    if (isEmoji(icon)) {
      return <span className={styles.iconEmoji}>{icon}</span>;
    }

    // Try to get FontAwesome icon
    const FaIcon = getFaIcon(icon);
    if (FaIcon) {
      return <FaIcon className={styles.iconFa} />;
    }

    // Fallback: render as text (might be a custom emoji or symbol)
    return <span className={styles.iconEmoji}>{icon}</span>;
  }

  return null;
}

/**
 * Format metric value based on type
 * @param {*} value - Value to format
 * @param {string} type - Metric type
 * @returns {string|React.ReactNode} - Formatted value
 */
function formatValue(value, type) {
  if (value === null || value === undefined) {
    return '—';
  }

  switch (type) {
    case 'date':
      return formatDateMetricCard(value);

    case 'cost':
      return formatCostEstimate(value);

    case 'days':
      return formatPlanningTime(value);

    case 'completion':
      // Expect value to be 0-100 or 0-1
      const percentage = value > 1 ? value : value * 100;
      return `${Math.round(percentage)}%`;

    case 'string':
    default:
      return String(value);
  }
}

/**
 * Individual Metric Item
 */
export function MetricItem({
  title,
  type = 'string',
  value,
  icon,
  footer,
  color = 'default',
  progress,
  action,
  onClick,
  className = ''
}) {
  const formattedValue = useMemo(() => formatValue(value, type), [value, type]);

  // For completion type, calculate progress automatically if not provided
  const progressValue = useMemo(() => {
    if (progress !== undefined) return progress;
    if (type === 'completion') {
      return value > 1 ? value : value * 100;
    }
    return undefined;
  }, [progress, type, value]);

  const itemClasses = [
    styles.metricItem,
    styles[`color${color.charAt(0).toUpperCase() + color.slice(1)}`],
    onClick && styles.clickable,
    className
  ].filter(Boolean).join(' ');

  const handleClick = onClick ? (e) => onClick(e, { title, type, value }) : undefined;
  const handleKeyDown = onClick ? (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e, { title, type, value });
    }
  } : undefined;

  return (
    <div
      className={itemClasses}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {icon && <div className={styles.metricIcon}>{renderIcon(icon)}</div>}
      <div className={styles.metricContent}>
        <span className={styles.metricTitle}>{title}</span>
        <span className={styles.metricValue}>{formattedValue}</span>
        {footer && <span className={styles.metricFooter}>{footer}</span>}
        {progressValue !== undefined && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, Math.max(0, progressValue))}%` }}
              role="progressbar"
              aria-valuenow={progressValue}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        )}
      </div>
      {action && <div className={styles.metricAction}>{action}</div>}
    </div>
  );
}

MetricItem.propTypes = {
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['date', 'string', 'cost', 'days', 'completion']),
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.instanceOf(Date)
  ]),
  icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  footer: PropTypes.string,
  color: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'danger']),
  progress: PropTypes.number,
  action: PropTypes.node,
  onClick: PropTypes.func,
  className: PropTypes.string
};

/**
 * MetricsBar - Container for metrics display
 * Renders as horizontal bar on desktop, stacked cards on mobile/tablet
 *
 * @param {Object} props
 * @param {Array} props.metrics - Array of metric objects
 * @param {boolean} props.compact - Compact mode with reduced padding
 * @param {boolean} props.bordered - Show borders between items
 * @param {string} props.className - Additional CSS classes
 */
export default function MetricsBar({
  metrics = [],
  compact = false,
  bordered = true,
  className = ''
}) {
  const containerClasses = [
    styles.metricsBar,
    compact && styles.compact,
    bordered && styles.bordered,
    className
  ].filter(Boolean).join(' ');

  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <div className={containerClasses}>
      {metrics.map((metric, index) => (
        <MetricItem
          key={metric.id || metric.title || index}
          {...metric}
        />
      ))}
    </div>
  );
}

MetricsBar.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['date', 'string', 'cost', 'days', 'completion']),
      value: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
        PropTypes.instanceOf(Date)
      ]),
      icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
      footer: PropTypes.string,
      color: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'danger']),
      progress: PropTypes.number,
      action: PropTypes.node,
      onClick: PropTypes.func
    })
  ),
  compact: PropTypes.bool,
  bordered: PropTypes.bool,
  className: PropTypes.string
};

// Export MetricItem as named export and on MetricsBar
MetricsBar.Item = MetricItem;
