/**
 * SearchableSelect Component
 *
 * A styled searchable dropdown with icon support matching the design system.
 * Can be used standalone or integrated with FormField.
 *
 * @example
 * <SearchableSelect
 *   options={[
 *     { value: 'us', label: 'United States', icon: FaFlag, suffix: 'USD' },
 *     { value: 'uk', label: 'United Kingdom', icon: FaFlag, suffix: 'GBP' },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 *   placeholder="Select country..."
 *   searchable
 * />
 */

import React, { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { FaSearch, FaChevronDown, FaCheck } from 'react-icons/fa';
import { createFilter } from '../../utilities/trie';
import { lang } from '../../lang.constants';
import styles from './SearchableSelect.module.scss';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  multiple = false,
  placeholder = lang.current.searchableSelect.defaultPlaceholder,
  searchPlaceholder = lang.current.searchableSelect.searchPlaceholder,
  searchable = true,
  portal = false,
  disabled = false,
  className = '',
  size = 'md',
  isValid,
  isInvalid,
  name,
  id: providedId,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) {
  const generatedId = useId();
  const selectId = providedId || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  const isMobileOrTabletViewport = typeof window !== 'undefined' && window.innerWidth <= 767; // breakpoint-md - 1
  const shouldPortal = portal || isMobileOrTabletViewport;

  const selectedValues = useMemo(() => {
    if (!multiple) return value;
    if (Array.isArray(value)) return value;
    return [];
  }, [multiple, value]);

  const selectedOptions = useMemo(() => {
    if (!multiple) return [];
    const valueSet = new Set(selectedValues);
    return options.filter(opt => valueSet.has(opt.value));
  }, [multiple, options, selectedValues]);

  // Find selected option
  const selectedOption = useMemo(() => {
    if (multiple) return null;
    return options.find(opt => opt.value === value);
  }, [multiple, options, value]);

  // Build trie filter index when options change
  const trieFilter = useMemo(() => {
    const filter = createFilter({
      fields: [
        { path: 'label', score: 100 },
        { path: 'suffix', score: 50 },
      ],
    });
    filter.buildIndex(options);
    return filter;
  }, [options]);

  // Filter options based on search using trie
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    return trieFilter.filter(searchQuery, { rankResults: true });
  }, [searchQuery, options, trieFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      // When portaled, the dropdown is fixed and outside the container DOM subtree.
      // Check outside both the container AND the dropdown.
      const dropdownRef = document.querySelector(`[data-searchable-select="${selectId}"]`);

      const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(e.target);
      const clickedOutsideDropdown = shouldPortal && dropdownRef && !dropdownRef.contains(e.target);

      if (clickedOutsideContainer && (!shouldPortal || clickedOutsideDropdown)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, selectId, shouldPortal]);

  // Position dropdown when portaled (fixed positioning)
  const positionDropdown = useCallback(() => {
    if (!isOpen) return;
    if (!shouldPortal) return;

    // Query dropdown and trigger
    const dropdown = document.querySelector(`[data-searchable-select="${selectId}"]`);
    const trigger = containerRef.current?.querySelector(`.${styles.trigger}`);

    if (!dropdown || !trigger) return;

    // Ensure fixed positioning for predictable placement
    dropdown.style.position = 'fixed';
    dropdown.style.visibility = 'hidden';

    // Run in RAF and a short timeout to ensure layout has settled and dropdown height is measured
    const applyPosition = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = dropdown.offsetHeight || 300; // fallback height
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - triggerRect.bottom - 8; // 8px gap
      const spaceAbove = triggerRect.top - 8;

      // Position below trigger if there's enough space, otherwise above
      if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
        dropdown.style.top = `${Math.min(viewportHeight - dropdownHeight - 8, triggerRect.bottom + 4)}px`;
        dropdown.style.bottom = 'auto';
        dropdown.style.maxHeight = `${Math.min(dropdownHeight, spaceBelow)}px`;
      } else {
        dropdown.style.top = 'auto';
        dropdown.style.bottom = `${Math.min(viewportHeight - 8, viewportHeight - triggerRect.top + 4)}px`;
        dropdown.style.maxHeight = `${Math.min(dropdownHeight, spaceAbove)}px`;
      }

      // Ensure stylesheet doesn't leave right anchored; JS fully controls geometry
      dropdown.style.right = 'auto';
      // Use the trigger rect so the dropdown matches the visible trigger width
      // This avoids issues when ancestor layout/padding differs from container
      const left = Math.max(0, triggerRect.left);
      const targetWidth = Math.max(120, triggerRect.width);
      dropdown.style.left = `${left}px`;
      dropdown.style.width = `${targetWidth}px`;
      dropdown.style.boxSizing = 'border-box';
      dropdown.style.transform = 'none';
      dropdown.style.visibility = 'visible';
    };

    // Use RAF then a micro timeout for cross-browser stability
    window.requestAnimationFrame(() => {
      applyPosition();
      setTimeout(applyPosition, 20);
    });
  }, [isOpen, selectId, shouldPortal]);

  // Keep position in sync while open (modal body scroll uses capture)
  useEffect(() => {
    if (!isOpen || !shouldPortal) return;

    const handleScroll = () => positionDropdown();
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen, shouldPortal, positionDropdown]);

  // Reposition when dropdown opens, when filtered options change, or on searchQuery updates
  useEffect(() => {
    if (!isOpen) return;
    positionDropdown();

    // small delay to handle content rendering
    const t = setTimeout(() => positionDropdown(), 30);
    return () => clearTimeout(t);
  }, [isOpen, filteredOptions.length, searchQuery, positionDropdown]);

  // Reposition on window resize while open
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => positionDropdown();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, positionDropdown]);

  

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchQuery('');
        break;
      default:
        break;
    }
  }, [isOpen, filteredOptions, highlightedIndex]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (option) => {
    if (!multiple) {
      onChange(option.value);
      setIsOpen(false);
      setSearchQuery('');
      return;
    }

    const next = new Set(selectedValues);
    if (next.has(option.value)) {
      next.delete(option.value);
    } else {
      next.add(option.value);
    }
    onChange(Array.from(next));
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) {
        setSearchQuery('');
      }
    }
  };

  // Build trigger class names
  const triggerClasses = [
    styles.trigger,
    styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`],
    isOpen && styles.open,
    disabled && styles.disabled,
    isValid && styles.valid,
    isInvalid && styles.invalid,
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden native select for form submission */}
      {name && (
        multiple ? (
          (Array.isArray(selectedValues) ? selectedValues : []).map((v) => (
            <input
              key={v}
              type="hidden"
              name={name.endsWith('[]') ? name : `${name}[]`}
              value={v}
            />
          ))
        ) : (
          <input type="hidden" name={name} value={value || ''} />
        )
      )}

      {/* Trigger button */}
      <button
        type="button"
        id={selectId}
        className={triggerClasses}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
      >
        <span className={styles.triggerContent}>
          {multiple ? (
            selectedOptions.length > 0 ? (
              <>
                <span className={styles.triggerLabel}>
                  {selectedOptions.length === 1
                    ? selectedOptions[0].label
                    : `${selectedOptions[0].label} +${selectedOptions.length - 1}`}
                </span>
              </>
            ) : (
              <span className={styles.placeholder}>{placeholder}</span>
            )
          ) : selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className={styles.optionIcon}>
                  {React.createElement(selectedOption.icon)}
                </span>
              )}
              <span className={styles.triggerLabel}>{selectedOption.label}</span>
              {selectedOption.suffix && (
                <span className={styles.triggerSuffix}>{selectedOption.suffix}</span>
              )}
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </span>
        <FaChevronDown className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (() => {
        const dropdown = (
          <div
            className={styles.dropdown}
            role="presentation"
            data-searchable-select={selectId}
            style={shouldPortal ? { visibility: 'hidden', zIndex: 'calc(var(--z-index-tooltip, 1070) + 100)' } : undefined}
          >
            {/* Search input */}
            {searchable && (
              <div className={styles.searchWrapper}>
                <FaSearch className={styles.searchIcon} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label={lang.current.searchableSelect.searchOptionsAria}
                />
              </div>
            )}

            {/* Options list */}
            <ul
              ref={listRef}
              className={styles.optionsList}
              role="listbox"
              aria-multiselectable={multiple || undefined}
              aria-activedescendant={filteredOptions[highlightedIndex]?.value}
            >
              {filteredOptions.length === 0 ? (
                <li className={styles.noResults}>{lang.current.searchableSelect.noResultsFound}</li>
              ) : (
                filteredOptions.map((option, index) => (
                  <li
                    key={option.value}
                    data-index={index}
                    className={`${styles.option} ${index === highlightedIndex ? styles.highlighted : ''} ${(multiple ? selectedValues.includes(option.value) : option.value === value) ? styles.selected : ''}`}
                    role="option"
                    aria-selected={(multiple ? selectedValues.includes(option.value) : option.value === value)}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {option.icon && (
                      <span className={styles.optionIcon}>
                        {React.createElement(option.icon)}
                      </span>
                    )}
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.suffix && (
                      <span className={styles.optionSuffix}>{option.suffix}</span>
                    )}
                    {(multiple ? selectedValues.includes(option.value) : option.value === value) && (
                      <FaCheck className={styles.checkIcon} aria-hidden="true" />
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        );

        // When portaled, `position: fixed` stays viewport-relative even when
        // ancestors (like modals/FadeIn) apply transforms or overflow clipping.
        if (shouldPortal) {
          return createPortal(dropdown, document.body);
        }

        return dropdown;
      })()}
    </div>
  );
}

SearchableSelect.propTypes = {
  /** Array of options with value, label, optional icon component, and optional suffix */
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    suffix: PropTypes.string,
  })).isRequired,
  /** Currently selected value (string) or selected values (array) when multiple */
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  /** Enable multi-select behavior */
  multiple: PropTypes.bool,
  /** Change handler - receives the selected value (string) or values (array) */
  onChange: PropTypes.func.isRequired,
  /** Placeholder text when no option selected */
  placeholder: PropTypes.string,
  /** Placeholder for search input */
  searchPlaceholder: PropTypes.string,
  /** Enable search functionality */
  searchable: PropTypes.bool,
  /** Portal dropdown to document.body with fixed positioning (recommended in modals) */
  portal: PropTypes.bool,
  /** Disable the select */
  disabled: PropTypes.bool,
  /** Additional CSS class */
  className: PropTypes.string,
  /** Size variant: 'sm', 'md', 'lg' */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Valid state styling */
  isValid: PropTypes.bool,
  /** Invalid state styling */
  isInvalid: PropTypes.bool,
  /** Form field name for native form submission */
  name: PropTypes.string,
  /** Element ID */
  id: PropTypes.string,
  /** Aria label */
  'aria-label': PropTypes.string,
  /** Aria described by */
  'aria-describedby': PropTypes.string,
};
