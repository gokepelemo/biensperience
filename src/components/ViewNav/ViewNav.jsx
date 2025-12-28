/**
 * ViewNav Component
 *
 * Responsive in-view navigation that renders:
 * - Dropdown select on mobile (≤575px)
 * - Horizontal pill-style nav on tablet (576px-991px)
 * - Vertical sidebar-style nav on desktop (>991px)
 *
 * Supports hash-based routing with active states and optional badges.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import PropTypes from 'prop-types';
import styles from './ViewNav.module.scss';
import { lang } from '../../lang.constants';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleSelect = useCallback((key) => {
    onSelect?.(key);
    setDropdownOpen(false);
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

  const handleDropdownKeyPress = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDropdownOpen(prev => !prev);
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  }, []);

  if (!items || items.length === 0) return null;

  const activeItem = items.find(item => item.key === activeKey) || items[0];

  return (
    <nav
      className={`${styles.viewNav} ${className}`}
      role="tablist"
      aria-label={lang.current.viewNav.viewNavigation}
    >
      {/* Mobile dropdown (≤575px) */}
      <div className={styles.mobileDropdown} ref={dropdownRef}>
        <button
          type="button"
          className={`${styles.dropdownTrigger} ${dropdownOpen ? styles.dropdownTriggerOpen : ''}`}
          onClick={() => setDropdownOpen(prev => !prev)}
          onKeyDown={handleDropdownKeyPress}
          aria-expanded={dropdownOpen}
          aria-haspopup="listbox"
        >
          <span className={styles.dropdownLabel}>
            {activeItem?.label || 'Select'}
            {typeof activeItem?.badge === 'number' && activeItem.badge > 0 && (
              <span className={styles.dropdownBadge}>{activeItem.badge}</span>
            )}
          </span>
          <FaChevronDown className={`${styles.dropdownIcon} ${dropdownOpen ? styles.dropdownIconOpen : ''}`} />
        </button>
        {dropdownOpen && (
          <div className={styles.dropdownMenu} role="listbox">
            {items.map((item) => {
              const isActive = activeKey === item.key;
              return (
                <div
                  key={item.key}
                  role="option"
                  tabIndex={0}
                  aria-selected={isActive}
                  onClick={() => handleSelect(item.key)}
                  onKeyDown={(e) => handleKeyPress(e, item.key)}
                  className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
                >
                  <span className={styles.dropdownItemLabel}>{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className={styles.dropdownItemBadge}>{item.badge}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tablet/Desktop pill nav (>575px) */}
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
