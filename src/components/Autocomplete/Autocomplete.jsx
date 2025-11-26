import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Form, Dropdown } from 'react-bootstrap';
import { FaSearch, FaUser, FaMapMarkerAlt, FaStar, FaGlobe } from 'react-icons/fa';
import Loading from '../Loading/Loading';
import { Pill } from '../design-system';
import { createFilter } from '../../utilities/trie';
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
  placeholder = 'Search...',
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
  emptyMessage = 'No results found',
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
  const [selectedItems, setSelectedItems] = useState(Array.isArray(selected) ? selected : []);
  const justSelectedRef = useRef(false); // Track when selection just occurred to prevent auto-reopen
  const hasUserInteractedRef = useRef(false); // Track if user has interacted with the input

  // Handle controlled vs uncontrolled
  // If parent provides a controlled `value`, use it. Otherwise use internal searchTerm.
  // If displayValue (a selected label) is provided, seed the internal searchTerm with it
  // but allow the user to type (so displayValue does not permanently control the input).
  const currentValue = value !== undefined ? value : searchTerm;

  // When a selected label (displayValue) is provided from parent, and the user hasn't typed
  // (searchTerm is empty or equals previous displayValue), seed the searchTerm so the input
  // shows the selected label but remains editable.
  useEffect(() => {
    if (displayValue !== undefined) {
      // Only seed when searchTerm is empty or matches previous displayValue
      if (!searchTerm || searchTerm === displayValue) {
        setSearchTerm(displayValue || '');
      }
    }
    // initialize selected items from prop changes
    if (multi) {
      setSelectedItems(Array.isArray(selected) ? selected : []);
    }
    // include selected and multi in deps so parent-driven selection updates are reflected
  }, [displayValue, selected, multi]);

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

    if (onChange) {
      onChange(e);
    }
    // Always update internal searchTerm for local filtering and display
    setSearchTerm(newValue);

    if (onSearch) {
      onSearch(newValue);
    }

    // Only open dropdown if there's a value or if there are items to show
    setIsOpen(newValue.trim().length > 0 || items.length > 0);
    setHighlightedIndex(-1);
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
    const display = item.name || item.username || item.label || '';
    if (onChange) {
      onChange({ target: { value: display } });
    }
    setSearchTerm(display);

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
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      highlightedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
    if (hasUserInteractedRef.current && items.length > 0 && currentValue.trim().length > 0 && !isOpen) {
      setIsOpen(true);
    }
  }, [items, currentValue, isOpen]);

  // Size class mapping
  const sizeClass = {
    sm: styles.autocompleteSizeSm,
    md: styles.autocompleteSizeMd,
    lg: styles.autocompleteSizeLg,
  }[size] || styles.autocompleteSizeMd;

  return (
  <div className={`${styles.autocompleteWrapper} ${sizeClass} ${isOpen ? styles.autocompleteOpen : ''}`}>
      {/* Search Input */}
      <div className={styles.autocompleteInputWrapper}>
        <FaSearch className={styles.autocompleteSearchIcon} />
        <Form.Control
          ref={inputRef}
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
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={styles.autocompleteInput}
          autoComplete="off"
        />
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
                aria-label={`Remove ${si.name || si.label || si.value}`}
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
                message="Searching..."
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
