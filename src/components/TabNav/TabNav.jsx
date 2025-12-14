/**
 * TabNav Component
 * A horizontal tab navigation with icons, underline indicator, and optional badges
 * Design inspired by GitHub-style tab navigation
 */

import React from 'react';
import PropTypes from 'prop-types';
import styles from './TabNav.module.scss';

/**
 * Individual tab item
 * @param {Object} props
 * @param {string} props.id - Unique identifier for the tab
 * @param {string} props.label - Display label for the tab
 * @param {React.ReactNode} [props.icon] - Icon component to display
 * @param {number|string} [props.badge] - Optional badge/count to display
 * @param {boolean} [props.isActive] - Whether this tab is currently active
 * @param {Function} props.onClick - Click handler
 * @param {boolean} [props.disabled] - Whether the tab is disabled
 * @param {string} [props.variant] - Visual variant for the badge ('default', 'warning', 'danger')
 */
function TabItem({ id, label, icon, badge, isActive, onClick, disabled, variant }) {
  return (
    <button
      type="button"
      className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ''} ${disabled ? styles.tabItemDisabled : ''}`}
      onClick={() => !disabled && onClick(id)}
      disabled={disabled}
      aria-selected={isActive}
      role="tab"
      tabIndex={isActive ? 0 : -1}
    >
      {icon && <span className={styles.tabIcon}>{icon}</span>}
      <span className={styles.tabLabel}>{label}</span>
      {badge !== undefined && badge !== null && (
        <span className={`${styles.tabBadge} ${variant ? styles[`tabBadge${variant.charAt(0).toUpperCase() + variant.slice(1)}`] : ''}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

TabItem.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.node,
  badge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isActive: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(['default', 'warning', 'danger']),
};

/**
 * TabNav Component
 * @param {Object} props
 * @param {Array} props.tabs - Array of tab configurations
 * @param {string} props.activeTab - Currently active tab ID
 * @param {Function} props.onTabChange - Callback when tab changes (receives tab ID)
 * @param {string} [props.className] - Additional CSS class
 * @param {boolean} [props.borderBottom] - Show bottom border (default: true)
 */
export default function TabNav({ tabs, activeTab, onTabChange, className, borderBottom = true }) {
  return (
    <div
      className={`${styles.tabNav} ${borderBottom ? styles.tabNavBordered : ''} ${className || ''}`}
      role="tablist"
      aria-label="Navigation tabs"
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          id={tab.id}
          label={tab.label}
          icon={tab.icon}
          badge={tab.badge}
          isActive={activeTab === tab.id}
          onClick={onTabChange}
          disabled={tab.disabled}
          variant={tab.variant}
        />
      ))}
    </div>
  );
}

TabNav.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
      badge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      disabled: PropTypes.bool,
      variant: PropTypes.oneOf(['default', 'warning', 'danger']),
    })
  ).isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  borderBottom: PropTypes.bool,
};
