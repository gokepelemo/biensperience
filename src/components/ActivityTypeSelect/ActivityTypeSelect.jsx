/**
 * ActivityTypeSelect Component
 *
 * Minimal, stable dropdown for selecting activity types.
 * Avoids useMemo chains and complex state dependencies to prevent browser crashes.
 */

import { useState, useCallback, useRef, useEffect, useId, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  ACTIVITY_TYPES,
  ACTIVITY_CATEGORIES,
  getActivityType
} from '../../constants/activity-types';
import styles from './ActivityTypeSelect.module.scss';

// Pre-compute stable data at module level
const CATEGORY_ORDER = ['essentials', 'experiences', 'services', 'other'];

// Pre-group items by category (computed once, never changes)
const ITEMS_BY_CATEGORY = {};
for (const type of ACTIVITY_TYPES) {
  if (!ITEMS_BY_CATEGORY[type.category]) {
    ITEMS_BY_CATEGORY[type.category] = [];
  }
  ITEMS_BY_CATEGORY[type.category].push(type);
}

// Pre-compute index lookup for keyboard navigation in grouped view
const ITEM_TO_INDEX = new Map();
let idx = 0;
for (const cat of CATEGORY_ORDER) {
  const items = ITEMS_BY_CATEGORY[cat] || [];
  for (const item of items) {
    ITEM_TO_INDEX.set(item.value, idx++);
  }
}

/**
 * Filter activity types by search query
 */
function filterByQuery(query) {
  if (!query) return null;

  const q = query.toLowerCase();
  const results = [];

  for (const type of ACTIVITY_TYPES) {
    if (results.length >= 15) break;

    if (
      type.label.toLowerCase().includes(q) ||
      type.value.includes(q) ||
      (type.keywords && type.keywords.some(k => k.toLowerCase().includes(q)))
    ) {
      results.push(type);
    }
  }

  return results;
}

/**
 * Option component - defined outside to prevent recreation on every render
 * This is CRITICAL for performance - defining components inside render causes
 * React to unmount/remount them on every render, causing exponential re-renders
 */
const Option = memo(function Option({ type, index, isHighlighted, isSelected, onSelect, onHighlight }) {
  return (
    <div
      data-i={index}
      className={`${styles.option} ${isHighlighted ? styles.highlighted : ''} ${isSelected ? styles.selected : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(type)}
      onMouseEnter={() => onHighlight(index)}
      role="option"
      aria-selected={isSelected}
    >
      <span className={styles.optionIcon}>{type.icon}</span>
      <span className={styles.optionLabel}>{type.label}</span>
      {isSelected && <span className={styles.checkmark}>✓</span>}
    </div>
  );
});

export default function ActivityTypeSelect({
  value,
  onChange,
  placeholder = 'Select activity type...',
  disabled = false,
  size = 'md',
  className = '',
  showClear = true
}) {
  const uid = useId();
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Selected type info (simple lookup, no memo needed for single lookup)
  const selectedType = value ? getActivityType(value) : null;

  // Determine what to render: filtered list or all grouped
  const searchResults = query.trim() ? filterByQuery(query.trim()) : null;

  // For keyboard nav, determine the list of items
  const navItems = searchResults || ACTIVITY_TYPES;
  const navLen = navItems.length;

  // Calculate dropdown position when opening
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const updatePosition = () => {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
        setHighlight(-1);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || highlight < 0 || !dropdownRef.current) return;

    const el = dropdownRef.current.querySelector(`[data-i="${highlight}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlight]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlight(-1);
  }, [query]);

  const doSelect = useCallback((type) => {
    setOpen(false);
    setQuery('');
    setHighlight(-1);
    onChange(type.value);
  }, [onChange]);

  const doClear = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuery('');
    onChange(null);
  }, [onChange]);

  const onKeyDown = useCallback((e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (navLen === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlight(h => (h + 1) % navLen);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlight(h => (h <= 0 ? navLen - 1 : h - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlight >= 0 && highlight < navLen) {
          doSelect(navItems[highlight]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        setHighlight(-1);
        break;
      case 'Tab':
        setOpen(false);
        setQuery('');
        break;
      default:
        break;
    }
  }, [open, navLen, highlight, navItems, doSelect]);

  // Stable callback for highlighting - wrapped in useCallback to prevent recreation
  const handleHighlight = useCallback((index) => {
    setHighlight(index);
  }, []);

  // Render dropdown content
  const renderDropdown = () => {
    // Filtered view
    if (searchResults !== null) {
      if (searchResults.length === 0) {
        return <div className={styles.noResults}>No matching activity types</div>;
      }
      return searchResults.map((type, i) => (
        <Option
          key={type.value}
          type={type}
          index={i}
          isHighlighted={i === highlight}
          isSelected={type.value === value}
          onSelect={doSelect}
          onHighlight={handleHighlight}
        />
      ));
    }

    // Grouped view - use pre-computed index mapping
    return CATEGORY_ORDER.map(cat => {
      const items = ITEMS_BY_CATEGORY[cat];
      if (!items || items.length === 0) return null;

      const catInfo = ACTIVITY_CATEGORIES[cat];

      return (
        <div key={cat} className={styles.categoryGroup}>
          <div className={styles.categoryHeader}>
            <span className={styles.categoryIcon}>{catInfo.icon}</span>
            <span className={styles.categoryLabel}>{catInfo.label}</span>
          </div>
          {items.map(type => {
            const itemIndex = ITEM_TO_INDEX.get(type.value);
            return (
              <Option
                key={type.value}
                type={type}
                index={itemIndex}
                isHighlighted={itemIndex === highlight}
                isSelected={type.value === value}
                onSelect={doSelect}
                onHighlight={handleHighlight}
              />
            );
          })}
        </div>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.activityTypeSelect} ${styles[size]} ${className}`}
    >
      <div className={styles.inputWrapper}>
        {/* Selected badge */}
        {selectedType && !query && (
          <div className={styles.selectedBadge}>
            <span className={styles.selectedIcon}>{selectedType.icon}</span>
            <span className={styles.selectedLabel}>{selectedType.label}</span>
          </div>
        )}

        {/* Input */}
        <input
          id={uid}
          type="text"
          className={`${styles.input} ${selectedType && !query ? styles.hasSelection : ''}`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => {
              if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
                setOpen(false);
                setQuery('');
                setHighlight(-1);
              }
            }, 150);
          }}
          onKeyDown={onKeyDown}
          placeholder={selectedType ? '' : placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-haspopup="listbox"
          aria-expanded={open}
        />

        {/* Clear */}
        {showClear && selectedType && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onMouseDown={(e) => e.preventDefault()}
            onClick={doClear}
            aria-label="Clear"
            tabIndex={-1}
          >
            ×
          </button>
        )}

        {/* Arrow */}
        <div className={styles.arrow} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 4L6 8L10 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Dropdown - rendered via portal to float above modals */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`
          }}
          role="listbox"
        >
          {renderDropdown()}
        </div>,
        document.body
      )}
    </div>
  );
}
