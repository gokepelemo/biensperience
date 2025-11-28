/**
 * MetricsBarLayout Component
 * Horizontal metrics display for dashboards and summaries.
 */

import React from 'react';
import PropTypes from 'prop-types';
import styles from './MetricsBarLayout.module.scss';

/**
 * MetricItem - Individual metric display
 */
export function MetricItem({
  label,
  value,
  subValue,
  icon,
  progress,
  action,
  variant = 'default',
  className = '',
}) {
  const itemClasses = [
    styles.metricItem,
    styles[`variant${variant.charAt(0).toUpperCase() + variant.slice(1)}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={itemClasses}>
      {icon && <div className={styles.metricIcon}>{icon}</div>}
      <div className={styles.metricContent}>
        <span className={styles.metricLabel}>{label}</span>
        <span className={styles.metricValue}>{value}</span>
        {subValue && <span className={styles.metricSubValue}>{subValue}</span>}
        {progress !== undefined && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              role="progressbar"
              aria-valuenow={progress}
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
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  subValue: PropTypes.node,
  icon: PropTypes.node,
  progress: PropTypes.number,
  action: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'danger']),
  className: PropTypes.string,
};

/**
 * MetricsBarLayout - Container for horizontal metrics display
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - MetricItem components
 * @param {'horizontal'|'vertical'} props.direction - Layout direction
 * @param {boolean} props.bordered - Show borders between items
 * @param {boolean} props.compact - Compact mode for less padding
 * @param {string} props.className - Additional CSS classes
 */
export default function MetricsBarLayout({
  children,
  direction = 'horizontal',
  bordered = true,
  compact = false,
  className = '',
}) {
  const containerClasses = [
    styles.metricsBar,
    styles[`direction${direction.charAt(0).toUpperCase() + direction.slice(1)}`],
    bordered && styles.bordered,
    compact && styles.compact,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={containerClasses}>{children}</div>;
}

MetricsBarLayout.propTypes = {
  children: PropTypes.node.isRequired,
  direction: PropTypes.oneOf(['horizontal', 'vertical']),
  bordered: PropTypes.bool,
  compact: PropTypes.bool,
  className: PropTypes.string,
};

// Named export for sub-component
MetricsBarLayout.Item = MetricItem;
