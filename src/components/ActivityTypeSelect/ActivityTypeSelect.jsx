/**
 * ActivityTypeSelect Component
 *
 * Autocomplete dropdown for selecting activity types using trie-based search.
 * Supports keyboard navigation, grouping by category, and quick selection.
 */

import { useState, useCallback, useMemo, useRef, useEffect, useId } from 'react';
import { createFilter } from '../../utilities/trie';
import {
  ACTIVITY_TYPES,
  ACTIVITY_CATEGORIES,
  getActivityType,
  getActivityTypeSearchTerms
} from '../../constants/activity-types';
import styles from './ActivityTypeSelect.module.scss';

/**
 * Build the trie filter for activity type search
 * @returns {TrieFilter} Configured filter
 */
function buildActivityTypeFilter() {
  const filter = createFilter({
    fields: [
      { path: 'label', score: 100 },
      { path: 'value', score: 80 },
      (item) => item.keywords || []
    ]
  });

  filter.buildIndex(ACTIVITY_TYPES);
  return filter;
}

// Singleton filter instance (built once, reused)
let activityTypeFilter = null;

function getFilter() {
  if (!activityTypeFilter) {
    activityTypeFilter = buildActivityTypeFilter();
  }
  return activityTypeFilter;
}

/**
 * ActivityTypeSelect - Autocomplete for activity types
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
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Get the selected type object
  const selectedType = getActivityType(value);

  // Filter results based on input
  const filteredResults = useMemo(() => {
    const filter = getFilter();

    if (!inputValue.trim()) {
      // Show all types grouped by category when no search
      return ACTIVITY_TYPES;
    }

    // Use trie-based filtering
    return filter.filter(inputValue, {
      rankResults: true,
      limit: maxResults
    });
  }, [inputValue, maxResults]);

  // Group results by category if enabled
  const groupedResults = useMemo(() => {
    if (!groupByCategory) {
      return { all: filteredResults };
    }

    const groups = {};
    for (const type of filteredResults) {
      const category = type.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(type);
    }

    // Sort groups by category order
    const sortedGroups = {};
    const categoryOrder = Object.keys(ACTIVITY_CATEGORIES)
      .sort((a, b) => ACTIVITY_CATEGORIES[a].order - ACTIVITY_CATEGORIES[b].order);

    for (const cat of categoryOrder) {
      if (groups[cat]?.length > 0) {
        sortedGroups[cat] = groups[cat];
      }
    }

    return sortedGroups;
  }, [filteredResults, groupByCategory]);

  // Flatten grouped results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!groupByCategory) {
      return filteredResults;
    }

    const flat = [];
    for (const category of Object.keys(groupedResults)) {
      flat.push(...groupedResults[category]);
    }
    return flat;
  }, [groupedResults, groupByCategory, filteredResults]);

  // Handle input change
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(0);
  }, []);

  // Handle option selection
  const handleSelect = useCallback((type) => {
    onChange(type.value);
    setInputValue('');
    setIsOpen(false);
    inputRef.current?.blur();
  }, [onChange]);

  // Handle clear selection
  const handleClear = useCallback((e) => {
    e.stopPropagation();
    onChange(null);
    setInputValue('');
  }, [onChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < flatResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : flatResults.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (flatResults[highlightedIndex]) {
          handleSelect(flatResults[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  }, [isOpen, flatResults, highlightedIndex, handleSelect]);

  // Handle focus
  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Handle blur (close dropdown after a delay to allow clicks)
  const handleBlur = useCallback((e) => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      if (!dropdownRef.current?.contains(document.activeElement)) {
        setIsOpen(false);
        setInputValue('');
      }
    }, 150);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const highlighted = dropdownRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setIsOpen(false);
        setInputValue('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Build flat index for items
  let flatIndex = 0;

  return (
    <div className={`${styles.activityTypeSelect} ${styles[size]} ${className}`}>
      {/* Input field */}
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
          {flatResults.length === 0 ? (
            <div className={styles.noResults}>
              No matching activity types
            </div>
          ) : groupByCategory ? (
            // Grouped view
            Object.entries(groupedResults).map(([category, types]) => {
              const categoryInfo = ACTIVITY_CATEGORIES[category] || { label: category, icon: '📦' };

              return (
                <div key={category} className={styles.categoryGroup}>
                  <div className={styles.categoryHeader}>
                    <span className={styles.categoryIcon}>{categoryInfo.icon}</span>
                    <span className={styles.categoryLabel}>{categoryInfo.label}</span>
                  </div>
                  {types.map((type) => {
                    const itemIndex = flatIndex++;
                    const isHighlighted = itemIndex === highlightedIndex;

                    return (
                      <div
                        key={type.value}
                        data-index={itemIndex}
                        className={`${styles.option} ${isHighlighted ? styles.highlighted : ''} ${type.value === value ? styles.selected : ''}`}
                        onClick={() => handleSelect(type)}
                        role="option"
                        aria-selected={type.value === value}
                      >
                        <span className={styles.optionIcon}>{type.icon}</span>
                        <span className={styles.optionLabel}>{type.label}</span>
                        {type.value === value && (
                          <span className={styles.checkmark}>✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          ) : (
            // Flat view
            flatResults.map((type, index) => (
              <div
                key={type.value}
                data-index={index}
                className={`${styles.option} ${index === highlightedIndex ? styles.highlighted : ''} ${type.value === value ? styles.selected : ''}`}
                onClick={() => handleSelect(type)}
                role="option"
                aria-selected={type.value === value}
              >
                <span className={styles.optionIcon}>{type.icon}</span>
                <span className={styles.optionLabel}>{type.label}</span>
                {type.value === value && (
                  <span className={styles.checkmark}>✓</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
