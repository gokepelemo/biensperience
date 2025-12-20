/**
 * TabNav Component
 * A horizontal tab navigation with icons, underline indicator, and optional badges
 * Design inspired by GitHub-style tab navigation
 * On mobile, displays as a dropdown for better usability
 */

import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FaChevronDown } from 'react-icons/fa';
import { lang } from '../../lang.constants';
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
 * Mobile dropdown for tab navigation
 */
function MobileTabDropdown({ tabs, activeTab, onTabChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const activeTabData = tabs.find(tab => tab.id === activeTab) || tabs[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleTabSelect = (tabId) => {
    onTabChange(tabId);
    setIsOpen(false);
  };

  return (
    <div className={styles.mobileDropdown} ref={dropdownRef}>
      <button
        type="button"
        className={styles.dropdownTrigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className={styles.dropdownTriggerContent}>
          {activeTabData.icon && <span className={styles.tabIcon}>{activeTabData.icon}</span>}
          <span className={styles.tabLabel}>{activeTabData.label}</span>
          {activeTabData.badge !== undefined && activeTabData.badge !== null && (
            <span className={styles.tabBadge}>{activeTabData.badge}</span>
          )}
        </span>
        <FaChevronDown className={`${styles.dropdownChevron} ${isOpen ? styles.dropdownChevronOpen : ''}`} />
      </button>

      {isOpen && (
        <ul className={styles.dropdownMenu} role="listbox">
          {tabs.map((tab) => (
            <li key={tab.id}>
              <button
                type="button"
                className={`${styles.dropdownItem} ${tab.id === activeTab ? styles.dropdownItemActive : ''} ${tab.disabled ? styles.dropdownItemDisabled : ''}`}
                onClick={() => !tab.disabled && handleTabSelect(tab.id)}
                disabled={tab.disabled}
                role="option"
                aria-selected={tab.id === activeTab}
              >
                {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
                <span className={styles.tabLabel}>{tab.label}</span>
                {tab.badge !== undefined && tab.badge !== null && (
                  <span className={`${styles.tabBadge} ${tab.variant ? styles[`tabBadge${tab.variant.charAt(0).toUpperCase() + tab.variant.slice(1)}`] : ''}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

MobileTabDropdown.propTypes = {
  tabs: PropTypes.array.isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
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
    <>
      {/* Desktop: Horizontal tabs */}
      <div
        className={`${styles.tabNav} ${borderBottom ? styles.tabNavBordered : ''} ${className || ''}`}
        role="tablist"
        aria-label={lang.current.aria.navigationTabs}
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

      {/* Mobile: Dropdown */}
      <MobileTabDropdown
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
    </>
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
