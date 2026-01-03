import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Form, Dropdown } from 'react-bootstrap';
import { FaSearch, FaUser, FaMapMarkerAlt, FaStar, FaGlobe } from 'react-icons/fa';
import Loading from '../Loading/Loading';
import { Pill } from '../design-system';
import { createFilter } from '../../utilities/trie';
import { lang } from '../../lang.constants';
import styles from './Autocomplete.module.scss';

/**
 * Unified Autocomplete Component
 * 
 * Supports multiple entity types with consistent styling:
 * - Users (with avatars, usernames, status)
 * - Destinations (with flags, location info)
 * - Experiences (with ratings, categories)
 * - Countries (with flags)
 * - Categories (with icons)
 * 
 * @param {Object} props
 * @param {string} props.placeholder - Input placeholder text
 * @param {Array} props.items - Array of items to search/display
 * @param {string} props.entityType - Type of entity ('user', 'destination', 'experience', 'country', 'category')
 * @param {function} props.onSelect - Callback when item is selected
 * @param {function} props.onSearch - Callback when search input changes
 * @param {boolean} props.showAvatar - Show avatar for user type
 * @param {boolean} props.showStatus - Show online status for user type
 * @param {boolean} props.showMeta - Show metadata (badges, locations, etc.)
 * @param {string} props.value - Controlled input value
 * @param {function} props.onChange - Controlled input change handler
 * @param {boolean} props.loading - Show loading state
 * @param {string} props.emptyMessage - Message when no results
 * @param {boolean} props.disableFilter - Disable client-side filtering (use for API-based search)
 */
export default function Autocomplete({
  inputId,
  placeholder = lang.current.autocomplete.defaultPlaceholder,
  items = [],
  entityType = 'user',
  onSelect,
  onSearch,
  showAvatar = true,
  showStatus = true,
  showMeta = true,
  value,
  onChange,
  displayValue,
  loading = false,
  emptyMessage = lang.current.autocomplete.defaultEmptyMessage,
  disabled = false,
  size = 'md', // 'sm', 'md', 'lg'
  disableFilter = false, // Disable client-side filtering
  multi = false,
  selected = [],
  keepDropdownOpenOnSelect = false,
}) {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const wrapperRef = useRef(null);
  const [selectedItems, setSelectedItems] = useState(Array.isArray(selected) ? selected : []);
  const justSelectedRef = useRef(false); // Track when selection just occurred to prevent auto-reopen
  const hasUserInteractedRef = useRef(false); // Track if user has interacted with the input

  // Handle controlled vs uncontrolled
  // Consider the input controlled only if the parent passed both `value` and `onChange`.
  // This prevents a parent from accidentally making the input read-only by providing
  // a `value` without an `onChange` handler.
  const isControlled = value !== undefined && typeof onChange === 'function';
  // currentValue reflects the visible input content
  const currentValue = isControlled ? value : searchTerm;

  // Sync internal searchTerm with external value prop (semi-controlled mode)
  // This handles the case where parent controls value without onChange
  // Only sync when value is cleared (to empty string) to avoid fighting with user input
  useEffect(() => {
    if (value !== undefined && !isControlled && value === '') {
      // Parent cleared the value - sync internal state
      setSearchTerm('');
    }
  }, [value, isControlled]);

  // When a selected label (displayValue) is provided from parent, and the user hasn't typed
  // (searchTerm is empty or equals previous displayValue), seed the searchTerm so the input
  // shows the selected label but remains editable.
  useEffect(() => {
    if (displayValue !== undefined && !isControlled) {
      const next = displayValue || '';
      setSearchTerm(next);
    }
  }, [displayValue, isControlled]);

  // Sync selected items from parent prop in multi-select mode
  // Separate effect to avoid circular dependencies
  useEffect(() => {
    if (multi) {
      const nextSelected = Array.isArray(selected) ? selected : [];
      const lengthsEqual = nextSelected.length === selectedItems.length;
      const idsEqual =
        lengthsEqual &&
        nextSelected.every((item, index) => {
          const current = selectedItems[index];
          if (!current && !item) return true;
          if (!current || !item) return false;
          const currentId = current._id || current.id || current.name;
          const nextId = item._id || item.id || item.name;
          return currentId === nextId;
        });

      if (!lengthsEqual || !idsEqual) {
        setSelectedItems(nextSelected);
      }
    }
  }, [selected, multi]);

  // Build trie index from items for fast O(m) filtering
  const trieFilter = useMemo(() => {
    if (disableFilter || !items || items.length === 0) {
      return null;
    }

    return createFilter({
      fields: [
        { path: 'name', score: 100 },
        { path: 'username', score: 80 },
        { path: 'email', score: 60 },
        { path: 'location', score: 50 },
        { path: 'country', score: 50 },
        { path: 'category', score: 40 },
      ]
    }).buildIndex(items);
  }, [items, disableFilter]);

  // Filter items based on search term using trie (unless filtering is disabled for API-based search)
  const filteredItems = useMemo(() => {
    if (disableFilter) {
      // For API-based search, return items as-is without filtering
      return items;
    }

    if (!currentValue.trim()) return items;

    // Use trie-based filtering for O(m) performance
    if (trieFilter) {
      return trieFilter.filter(currentValue, { rankResults: true });
    }

    // Fallback to linear search if trie not available
    const term = currentValue.toLowerCase();
    return items.filter(item => {
      const searchableText = [
        item.name,
        item.username,
        item.email,
        item.location,
        item.country,
        item.category,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchableText.includes(term);
    });
  }, [items, currentValue, disableFilter, trieFilter]);

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value;

    // Mark that user has interacted with this input
    hasUserInteractedRef.current = true;

    if (isControlled) {
      // Let the parent handle value updates
      onChange(e);
    } else {
      // Uncontrolled mode: keep internal state in sync so typing works
      setSearchTerm(newValue);
    }

    if (onSearch) {
      onSearch(newValue);
    }

    // Only open dropdown if there's a value or if there are items to show
    setIsOpen(newValue.trim().length > 0 || items.length > 0);
    setHighlightedIndex(-1);
  };

  // Clear input and prepare for new selection
  const handleClear = (e) => {
    e.preventDefault();
    // Reset controlled and internal inputs
    if (isControlled) {
      try { onChange({ target: { value: '' } }); } catch (err) { /* swallow */ }
    } else {
      setSearchTerm('');
    }
    if (onSearch) onSearch('');
    // Notify parent that selection was cleared (for controlled parents)
    if (typeof onSelect === 'function') {
      try {
        // For single-select callers, pass an empty object to avoid null deref in parent handlers
        if (multi) {
          onSelect([]);
        } else {
          // Pass `null` for single-select to indicate no selection. Parents should
          // handle null/undefined values rather than assuming an object with fields.
          onSelect(null);
        }
      } catch (err) {
        // swallow errors from parent handlers
      }
    }
    // Clear internal multi selection state as well
    if (multi) {
      setSelectedItems([]);
    }
    // Focus input and open dropdown so user can type/select again
    setTimeout(() => {
      inputRef.current?.focus();
      setIsOpen(items.length > 0);
      setHighlightedIndex(-1);
    }, 0);
  };

  // Handle item selection
  const handleSelect = (item) => {
    if (multi) {
      // add to selectedItems if not already present (by _id or id or name)
      const exists = selectedItems.some(si => (si._id && item._id && String(si._id) === String(item._id)) || (si.id && item.id && String(si.id) === String(item.id)) || (si.name && item.name && si.name === item.name));
      if (!exists) {
        const next = [...selectedItems, item];
        setSelectedItems(next);
        if (typeof onSelect === 'function') onSelect(next);
      } else {
        // still notify with current selection
        if (typeof onSelect === 'function') onSelect(selectedItems);
      }
      // clear input for next selection
      setSearchTerm('');
      // Respect caller preference: keep dropdown open for rapid multi-select or close it
      setIsOpen(!!keepDropdownOpenOnSelect);
      setHighlightedIndex(-1);
      return;
    }

    if (onSelect) {
      onSelect(item);
    }

    // Update input with selected item's display name
    // Only update internal state if parent is not controlling the value via `value` prop
    // If parent provides `value` prop, they control clearing/setting through their own state
    const display = item.name || item.username || item.label || '';
    if (onChange) {
      onChange({ target: { value: display } });
      setSearchTerm(display);
    } else if (value === undefined) {
      // Only set display name if parent is not providing value prop at all
      setSearchTerm(display);
    }
    // If parent provides value prop without onChange (semi-controlled),
    // let parent control the value - don't override with display name

    // Mark that selection just occurred to prevent auto-reopen effect
    justSelectedRef.current = true;
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleRemoveSelected = (item) => {
    const next = selectedItems.filter(si => !((si._id && item._id && String(si._id) === String(item._id)) || (si.id && item.id && String(si.id) === String(item.id)) || (si.name && item.name && si.name === item.name)));
    setSelectedItems(next);
    if (typeof onSelect === 'function') onSelect(next);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    // Handle clicks outside and focus changes for robust closing behavior
    const handleClickOutside = (e) => {
      const target = e.target;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleFocusIn = (e) => {
      const active = document.activeElement;
      if (
        wrapperRef.current && !wrapperRef.current.contains(active) &&
        dropdownRef.current && !dropdownRef.current.contains(active)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      // jsdom doesn't implement scrollIntoView; guard for non-browser environments
      highlightedElement?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex]);

  // Open dropdown when items arrive from API (if user has typed something)
  useEffect(() => {
    // Don't auto-open if selection just occurred
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    // Only auto-open if user has interacted with the input (typed or focused)
    // This prevents dropdown from opening on initial mount when items are pre-loaded
    // Ensure the input is still focused before auto-opening. This avoids reopening
    // the dropdown after the user has blurred or scrolled the page.
    const inputIsFocused = document.activeElement === inputRef.current;
    if (
      hasUserInteractedRef.current &&
      items.length > 0 &&
      currentValue.trim().length > 0 &&
      !isOpen &&
      inputIsFocused
    ) {
      setIsOpen(true);
    }
  }, [items.length, currentValue]);

  // Size class mapping
  const sizeClass = {
    sm: styles.autocompleteSizeSm,
    md: styles.autocompleteSizeMd,
    lg: styles.autocompleteSizeLg,
  }[size] || styles.autocompleteSizeMd;

  return (
  <div ref={wrapperRef} className={`${styles.autocompleteWrapper} ${sizeClass} ${isOpen ? styles.autocompleteOpen : ''}`}>
      {/* Search Input */}
      <div className={styles.autocompleteInputWrapper}>
        <FaSearch className={styles.autocompleteSearchIcon} />
        <Form.Control
          ref={inputRef}
          id={inputId}
          type="text"
          placeholder={placeholder}
          value={currentValue}
          onChange={handleInputChange}
          onFocus={() => {
            // Mark that user has interacted
            hasUserInteractedRef.current = true;
            // Only open dropdown if there's a value or items to show
            if (currentValue.trim().length > 0 || items.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={(e) => {
            // If focus moved to an element inside the dropdown, keep it open
            const related = e.relatedTarget;
            if (related && dropdownRef.current && dropdownRef.current.contains(related)) {
              return;
            }
            // Otherwise close the dropdown
            setIsOpen(false);
            setHighlightedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={styles.autocompleteInput}
          autoComplete="off"
        />
        {/* Clear button - shown when there is a value */}
        {currentValue && currentValue.toString().trim().length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={lang.current.autocomplete.clearAriaLabel}
            className={styles.autocompleteClear}
          >
            ×
          </button>
        )}
      </div>
      {multi && selectedItems && selectedItems.length > 0 && (
        <div className={styles.autocompleteSelectedChips}>
          {selectedItems.map((si, idx) => (
            <Pill
              key={si._id || si.id || `${si.name}-${idx}`}
              // Use design-system tokens: destinations should use the neutral variant
              // and be rendered filled (no outline) for better contrast in dark mode.
              variant={entityType === 'destination' ? 'neutral' : 'primary'}
              outline={entityType !== 'destination'}
              rounded
              size="sm"
              className={`${styles.autocompleteChipPill} ${entityType === 'destination' ? styles.destinationChip : ''}`}
            >
              <span className={styles.chipLabel}>{si.name || si.label || si.value}</span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => handleRemoveSelected(si)}
                aria-label={lang.current.autocomplete.removeItemAriaLabel.replace('{name}', si.name || si.label || si.value)}
              >
                ×
              </button>
            </Pill>
          ))}
        </div>
      )}

      {/* Dropdown Results */}
      {isOpen && (
        <div ref={dropdownRef} className={styles.autocompleteDropdown}>
          {loading ? (
            <div className={styles.autocompleteLoading}>
              <Loading
                size="sm"
                animation="engine"
                showMessage={true}
                message={lang.current.autocomplete.searchingMessage}
              />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.autocompleteEmpty}>
              {emptyMessage}
            </div>
          ) : (
            <div className={styles.autocompleteItems}>
              {filteredItems.map((item, index) => (
                <AutocompleteItem
                  key={item.id || item.username || index}
                  item={item}
                  entityType={entityType}
                  isHighlighted={index === highlightedIndex}
                  onSelect={() => handleSelect(item)}
                  showAvatar={showAvatar}
                  showStatus={showStatus}
                  showMeta={showMeta}
                  dataIndex={index}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual Autocomplete Item
 * Renders different layouts based on entity type
 */
function AutocompleteItem({
  item,
  entityType,
  isHighlighted,
  onSelect,
  showAvatar,
  showStatus,
  showMeta,
  dataIndex,
}) {
  const renderContent = () => {
    // Auto-detect entity type from item.type if available (for mixed results)
    const detectedType = item.type || entityType;
    
    switch (detectedType) {
      case 'user':
        return (
          <UserItem
            item={item}
            showAvatar={showAvatar}
            showStatus={showStatus}
            showMeta={showMeta}
          />
        );
      case 'destination':
        return <DestinationItem item={item} showMeta={showMeta} />;
      case 'experience':
        return <ExperienceItem item={item} showMeta={showMeta} />;
      case 'plan':
        // Render plans as experience items with special category badge
        return <ExperienceItem item={{ ...item, category: 'Plan' }} showMeta={showMeta} />;
      case 'country':
        return <CountryItem item={item} />;
      case 'category':
        return <CategoryItem item={item} />;
      default:
        return <DefaultItem item={item} />;
    }
  };

  return (
    <div
      className={`${styles.autocompleteItem} ${isHighlighted ? styles.highlighted : ''}`}
      onClick={onSelect}
      tabIndex={0}
      data-index={dataIndex}
      data-entity-type={item.type || ''}
      role="option"
      aria-selected={isHighlighted}
    >
      {renderContent()}
    </div>
  );
}

// Entity-specific renderers
function UserItem({ item, showAvatar, showStatus, showMeta }) {
  // Format role display - convert camelCase/snake_case to Title Case
  const formatRole = (role) => {
    if (!role) return '';
    
    // Convert snake_case or camelCase to words
    const words = role
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .toLowerCase()
      .split(' ');
    
    // Capitalize each word (Title Case)
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Only show role badge for super_admin
  const shouldShowRole = item.role === 'super_admin';
  
  return (
    <div className={styles.autocompleteUser}>
      {showAvatar && (
        <div className={styles.userAvatarWrapper}>
          {item.avatar ? (
            <img src={item.avatar} alt={item.name} className={styles.userAvatar} />
          ) : (
            <div className={styles.userAvatarPlaceholder}>
              <FaUser />
            </div>
          )}
          {showStatus && item.isOnline && (
            <span className={`${styles.userStatusIndicator} ${styles.online}`} />
          )}
        </div>
      )}
      <div className={styles.userInfo}>
        <div className={styles.userName}>{item.name}</div>
        {showMeta && item.username && (
          <div className={styles.userMeta}>@{item.username}</div>
        )}
        {showMeta && false && item.email && !item.username && (
          <div className={styles.userMeta}>{item.email}</div>
        )}
      </div>
      {showMeta && shouldShowRole && (
        <div className={styles.userBadge}>
          <span className={`badge badge-${item.role}`}>{formatRole(item.role)}</span>
        </div>
      )}
    </div>
  );
}

function DestinationItem({ item, showMeta }) {
  return (
    <div className={styles.autocompleteDestination}>
      <div className={styles.destinationIcon}>
        <FaMapMarkerAlt />
      </div>
      <div className={styles.destinationInfo}>
        <div className={styles.destinationName}>{item.name}</div>
        {showMeta && item.country && (
          <div className={styles.destinationMeta}>
            {item.flag && <span className={styles.destinationFlag}>{item.flag}</span>}
            {item.country}
          </div>
        )}
      </div>

    </div>
  );
}

function ExperienceItem({ item, showMeta }) {
  return (
    <div className={styles.autocompleteExperience}>
      <div className={styles.experienceIcon}>
        <FaStar />
      </div>
      <div className={styles.experienceInfo}>
        <div className={styles.experienceName}>{item.name}</div>
        {showMeta && (
          <div className={styles.experienceMeta}>
            {item.destination && (
              <span className={styles.experienceLocation}>
                <FaMapMarkerAlt /> {item.destination}
              </span>
            )}
          </div>
        )}
      </div>
      {showMeta && item.category && (
        <div className={styles.experienceBadge}>
          <span className="badge">{item.category}</span>
        </div>
      )}
    </div>
  );
}

function CountryItem({ item }) {
  return (
    <div className={styles.autocompleteCountry}>
      {item.flag && <span className={styles.countryFlag}>{item.flag}</span>}
      <div className={styles.countryInfo}>
        <div className={styles.countryName}>{item.name}</div>
        {item.code && <div className={styles.countryCode}>{item.code}</div>}
      </div>
    </div>
  );
}

function CategoryItem({ item }) {
  return (
    <div className={styles.autocompleteCategory}>
      {item.icon && <span className={styles.categoryIcon}>{item.icon}</span>}
      <div className={styles.categoryName}>{item.name || item.label}</div>
    </div>
  );
}

function DefaultItem({ item }) {
  return (
    <div className={styles.autocompleteDefault}>
      <div className={styles.defaultName}>{item.name || item.label || item.value}</div>
    </div>
  );
}
