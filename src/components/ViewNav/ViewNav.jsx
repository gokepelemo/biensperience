/**
 * ViewNav Component
 *
 * Responsive in-view navigation that renders:
 * - Horizontal pill-style nav on mobile/tablet (≤991px)
 * - Vertical sidebar-style nav on desktop (>991px)
 *
 * Supports hash-based routing with active states and optional badges.
 */

import { useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './ViewNav.module.scss';

/**
 * ViewNav - Responsive hash-based navigation component
 *
 * @param {Object} props
 * @param {Array} props.items - Navigation items [{key: string, label: string, badge?: number}]
 * @param {string} props.activeKey - Currently active tab key
 * @param {function} props.onSelect - Callback when tab is selected (key) => void
 * @param {boolean} props.updateHash - Whether to update URL hash on selection (default: true)
 * @param {string} props.className - Additional CSS class for the container
 */
export default function ViewNav({
  items = [],
  activeKey,
  onSelect,
  updateHash = true,
  className = ''
}) {
  // Handle hash changes from browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = (window.location.hash || '').replace('#', '');
      if (hash && items.some(item => item.key === hash)) {
        onSelect?.(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [items, onSelect]);

  // Handle initial hash on mount
  useEffect(() => {
    const hash = (window.location.hash || '').replace('#', '');
    if (hash && items.some(item => item.key === hash)) {
      onSelect?.(hash);
    }
  }, [items, onSelect]);

  const handleSelect = useCallback((key) => {
    onSelect?.(key);
    if (updateHash) {
      try {
        window.history.pushState(null, '', `${window.location.pathname}#${key}`);
      } catch (e) {
        // Fallback for environments where pushState fails
        window.location.hash = key;
      }
    }
  }, [onSelect, updateHash]);

  const handleKeyPress = useCallback((e, key) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(key);
    }
  }, [handleSelect]);

  if (!items || items.length === 0) return null;

  return (
    <nav
      className={`${styles.viewNav} ${className}`}
      role="tablist"
      aria-label="View navigation"
    >
      <div className={styles.navContainer}>
        {items.map((item) => {
          const isActive = activeKey === item.key;
          return (
            <div
              key={item.key}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              aria-controls={`panel-${item.key}`}
              onClick={() => handleSelect(item.key)}
              onKeyDown={(e) => handleKeyPress(e, item.key)}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navLabel}>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={styles.navBadge}>{item.badge}</span>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

ViewNav.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    badge: PropTypes.number
  })).isRequired,
  activeKey: PropTypes.string,
  onSelect: PropTypes.func,
  updateHash: PropTypes.bool,
  className: PropTypes.string
};
