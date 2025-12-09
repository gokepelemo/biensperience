/**
 * ActivityTypeSelect Component
 *
 * Simple dropdown for selecting activity types.
 * Uses native filtering instead of trie for stability with small dataset.
 */

import { useState, useCallback, useMemo, useRef, useEffect, useId } from 'react';
import {
  ACTIVITY_TYPES,
  ACTIVITY_CATEGORIES,
  getActivityType
} from '../../constants/activity-types';
import styles from './ActivityTypeSelect.module.scss';

// Pre-compute category order once at module level (stable, no side effects)
const CATEGORY_ORDER = Object.keys(ACTIVITY_CATEGORIES)
  .sort((a, b) => ACTIVITY_CATEGORIES[a].order - ACTIVITY_CATEGORIES[b].order);

// Pre-group activity types by category (stable, computed once)
const GROUPED_ACTIVITY_TYPES = CATEGORY_ORDER.reduce((acc, category) => {
  const items = ACTIVITY_TYPES.filter(t => t.category === category);
  if (items.length > 0) {
    acc[category] = items;
  }
  return acc;
}, {});

/**
 * Simple case-insensitive filter for activity types
 */
function filterActivityTypes(query, maxResults = 15) {
  if (!query || !query.trim()) {
    return ACTIVITY_TYPES;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return ACTIVITY_TYPES
    .filter(type => {
      // Check label
      if (type.label.toLowerCase().includes(normalizedQuery)) return true;
      // Check value
      if (type.value.toLowerCase().includes(normalizedQuery)) return true;
      // Check keywords
      if (type.keywords?.some(kw => kw.toLowerCase().includes(normalizedQuery))) return true;
      return false;
    })
    .slice(0, maxResults);
}

/**
 * ActivityTypeSelect - Dropdown for activity types
 */
export default function ActivityTypeSelect({
  value,
  onChange,
  placeholder = 'Select or search activity type...',
  disabled = false,
  size = 'md',
  className = '',
  showClear = true,
  groupByCategory = true,
  maxResults = 15
}) {
  const inputId = useId();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Get selected type object
  const selectedType = value ? getActivityType(value) : null;

  // Filter results based on input
  const filteredResults = useMemo(() => {
    return filterActivityTypes(inputValue, maxResults);
  }, [inputValue, maxResults]);

  // Group filtered results by category (only when grouping enabled and no search)
  const displayData = useMemo(() => {
    // When searching, show flat list for better UX
    if (inputValue.trim()) {
      return { type: 'flat', items: filteredResults };
    }

    // When not searching and grouping enabled, show grouped
    if (groupByCategory) {
      return { type: 'grouped', groups: GROUPED_ACTIVITY_TYPES };
    }

    // Flat list fallback
    return { type: 'flat', items: ACTIVITY_TYPES };
  }, [inputValue, groupByCategory, filteredResults]);

  // Calculate flat list for keyboard navigation
  const flatList = useMemo(() => {
    if (displayData.type === 'flat') {
      return displayData.items;
    }
    // Flatten grouped results in category order
    return CATEGORY_ORDER.flatMap(cat => displayData.groups[cat] || []);
  }, [displayData]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [flatList.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setInputValue('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;

    const highlighted = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [highlightedIndex, isOpen]);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
  }, []);

  // Handle option selection - simplified, no async operations
  const handleSelect = useCallback((type) => {
    // Immediately update local state
    setIsOpen(false);
    setInputValue('');
    setHighlightedIndex(0);

    // Notify parent
    onChange(type.value);
  }, [onChange]);

  // Handle clear
  const handleClear = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    setInputValue('');
    onChange(null);
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      return;
    }

    const len = flatList.length;
    if (len === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % len);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + len) % len);
        break;
      case 'Enter':
        e.preventDefault();
        if (flatList[highlightedIndex]) {
          handleSelect(flatList[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setInputValue('');
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [isOpen, flatList, highlightedIndex, handleSelect]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Handle blur - simple, no timeout needed with mousedown prevention
  const handleBlur = useCallback(() => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setIsOpen(false);
        setInputValue('');
      }
    }, 100);
  }, []);

  // Render a single option
  const renderOption = (type, index) => {
    const isHighlighted = index === highlightedIndex;
    const isSelected = type.value === value;

    return (
      <div
        key={type.value}
        data-index={index}
        className={`${styles.option} ${isHighlighted ? styles.highlighted : ''} ${isSelected ? styles.selected : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => handleSelect(type)}
        onMouseEnter={() => setHighlightedIndex(index)}
        role="option"
        aria-selected={isSelected}
      >
        <span className={styles.optionIcon}>{type.icon}</span>
        <span className={styles.optionLabel}>{type.label}</span>
        {isSelected && <span className={styles.checkmark}>✓</span>}
      </div>
    );
  };

  // Render dropdown content
  const renderDropdownContent = () => {
    if (flatList.length === 0) {
      return (
        <div className={styles.noResults}>
          No matching activity types
        </div>
      );
    }

    // Flat view (when searching or groupByCategory is false)
    if (displayData.type === 'flat') {
      return displayData.items.map((type, index) => renderOption(type, index));
    }

    // Grouped view
    let globalIndex = 0;
    return CATEGORY_ORDER.map(category => {
      const types = displayData.groups[category];
      if (!types || types.length === 0) return null;

      const categoryInfo = ACTIVITY_CATEGORIES[category];
      const startIndex = globalIndex;

      // Increment global index for each item in this category
      globalIndex += types.length;

      return (
        <div key={category} className={styles.categoryGroup}>
          <div className={styles.categoryHeader}>
            <span className={styles.categoryIcon}>{categoryInfo.icon}</span>
            <span className={styles.categoryLabel}>{categoryInfo.label}</span>
          </div>
          {types.map((type, i) => renderOption(type, startIndex + i))}
        </div>
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.activityTypeSelect} ${styles[size]} ${className}`}
    >
      {/* Input wrapper */}
      <div className={styles.inputWrapper}>
        {/* Selected value badge */}
        {selectedType && !inputValue && (
          <div className={styles.selectedBadge}>
            <span className={styles.selectedIcon}>{selectedType.icon}</span>
            <span className={styles.selectedLabel}>{selectedType.label}</span>
          </div>
        )}

        {/* Search input */}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className={`${styles.input} ${selectedType && !inputValue ? styles.hasSelection : ''}`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={selectedType ? '' : placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${inputId}-listbox`}
        />

        {/* Clear button */}
        {showClear && selectedType && !disabled && (
          <button
            type="button"
            className={styles.clearButton}
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            aria-label="Clear selection"
            tabIndex={-1}
          >
            ×
          </button>
        )}

        {/* Dropdown arrow */}
        <div className={styles.arrow} aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 4L6 8L10 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          id={`${inputId}-listbox`}
          role="listbox"
        >
          {renderDropdownContent()}
        </div>
      )}
    </div>
  );
}
