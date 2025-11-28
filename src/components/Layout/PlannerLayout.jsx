/**
 * PlannerLayout Component
 * Two-column layout with collapsible sidebar for plan items.
 * Mobile: Sidebar becomes bottom sheet/expandable panel.
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa';
import styles from './PlannerLayout.module.scss';

/**
 * PlannerLayout - Two-column layout optimized for trip planning
 *
 * @param {Object} props
 * @param {React.ReactNode} props.header - Header content (title, actions)
 * @param {React.ReactNode} props.main - Main content area (map, photos, etc.)
 * @param {React.ReactNode} props.sidebar - Sidebar content (plan items)
 * @param {React.ReactNode} props.footer - Footer content (metrics)
 * @param {string} props.sidebarTitle - Title for mobile collapsed sidebar
 * @param {number} props.itemCount - Number of items for mobile badge
 * @param {'left'|'right'} props.sidebarPosition - Sidebar position
 * @param {boolean} props.sidebarCollapsible - Whether sidebar can collapse on desktop
 * @param {boolean} props.defaultCollapsed - Default collapsed state
 * @param {string} props.className - Additional CSS classes
 */
export default function PlannerLayout({
  header,
  main,
  sidebar,
  footer,
  sidebarTitle = 'Plan Items',
  itemCount = 0,
  sidebarPosition = 'right',
  sidebarCollapsible = true,
  defaultCollapsed = false,
  className = '',
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const toggleMobileExpand = useCallback(() => {
    setIsMobileExpanded((prev) => !prev);
  }, []);

  const containerClasses = [
    styles.plannerLayout,
    sidebarPosition === 'left' && styles.sidebarLeft,
    isCollapsed && styles.sidebarCollapsed,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {/* Header */}
      {header && <header className={styles.header}>{header}</header>}

      {/* Main Content Area */}
      <div className={styles.contentArea}>
        {/* Main Content */}
        <main className={styles.main}>{main}</main>

        {/* Desktop Sidebar */}
        <aside className={styles.sidebar}>
          {sidebarCollapsible && (
            <button
              type="button"
              className={styles.collapseToggle}
              onClick={toggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? '◀' : '▶'}
            </button>
          )}
          <div className={styles.sidebarContent}>{sidebar}</div>
        </aside>
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={`${styles.mobileSheet} ${isMobileExpanded ? styles.expanded : ''}`}
      >
        <button
          type="button"
          className={styles.mobileSheetToggle}
          onClick={toggleMobileExpand}
          aria-expanded={isMobileExpanded}
          aria-label={isMobileExpanded ? 'Collapse panel' : 'Expand panel'}
        >
          <span className={styles.mobileSheetTitle}>
            {sidebarTitle}
            {itemCount > 0 && (
              <span className={styles.itemBadge}>{itemCount}</span>
            )}
          </span>
          {isMobileExpanded ? <FaChevronDown /> : <FaChevronUp />}
        </button>
        <div className={styles.mobileSheetContent}>{sidebar}</div>
      </div>

      {/* Footer */}
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  );
}

PlannerLayout.propTypes = {
  header: PropTypes.node,
  main: PropTypes.node.isRequired,
  sidebar: PropTypes.node.isRequired,
  footer: PropTypes.node,
  sidebarTitle: PropTypes.string,
  itemCount: PropTypes.number,
  sidebarPosition: PropTypes.oneOf(['left', 'right']),
  sidebarCollapsible: PropTypes.bool,
  defaultCollapsed: PropTypes.bool,
  className: PropTypes.string,
};
