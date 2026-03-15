/**
 * SearchableSelectBasic Component
 *
 * The original custom-built searchable dropdown (pre-Chakra migration).
 * A plain React implementation with keyboard navigation and click-outside handling.
 * Use this for simple, non-modal dropdowns like activity feed filters.
 *
 * For richer combobox behaviour (portal positioning, multi-select, trie search)
 * use the SearchableSelect component instead.
 *
 * @example
 * <SearchableSelectBasic
 *   options={[
 *     { value: 'all', label: 'All Activity', icon: FaList },
 *     { value: 'own', label: 'Mine', icon: FaList },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 *   placeholder="Filter activity"
 *   searchable={false}
 * />
 */

import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import PropTypes from 'prop-types';
import { FaSearch, FaChevronDown, FaCheck } from 'react-icons/fa';
import styles from './SearchableSelect.module.css';

export default function SearchableSelectBasic({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  searchable = true,
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

  // Find selected option
  const selectedOption = options.find(opt => opt.value === value);

  // Filter options based on search
  const filteredOptions = searchQuery
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opt.suffix && opt.suffix.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    onChange(option.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(prev => !prev);
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
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={containerRef}
      className={styles.container}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden native input for form submission */}
      {name && (
        <input type="hidden" name={name} value={value || ''} />
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
          {selectedOption ? (
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
      {isOpen && (
        <div className={styles.dropdown} role="presentation">
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
                aria-label="Search options"
              />
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            className={styles.optionsList}
            role="listbox"
            aria-activedescendant={filteredOptions[highlightedIndex]?.value}
          >
            {filteredOptions.length === 0 ? (
              <li className={styles.noResults}>No results found</li>
            ) : (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  data-index={index}
                  className={[
                    styles.option,
                    index === highlightedIndex ? styles.highlighted : '',
                    option.value === value ? styles.selected : '',
                  ].filter(Boolean).join(' ')}
                  role="option"
                  aria-selected={option.value === value}
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
                  {option.value === value && (
                    <FaCheck className={styles.checkIcon} aria-hidden="true" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

SearchableSelectBasic.propTypes = {
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    suffix: PropTypes.string,
  })).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  searchPlaceholder: PropTypes.string,
  searchable: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  isValid: PropTypes.bool,
  isInvalid: PropTypes.bool,
  name: PropTypes.string,
  id: PropTypes.string,
  'aria-label': PropTypes.string,
  'aria-describedby': PropTypes.string,
};
