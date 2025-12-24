/**
 * MapListingsPanel Component
 * Scrollable panel for map listings with search and filters
 */

import React, { memo, useMemo, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaSearch, FaStar, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import MapListingCard from './MapListingCard';
import MapListingCardSkeleton from './MapListingCardSkeleton';
import EmptyState from '../EmptyState/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { useGridNavigation } from '../../hooks/useKeyboardNavigation';
import styles from './MapListingsPanel.module.scss';

// Debounce delay for search input (ms)
const SEARCH_DEBOUNCE_DELAY = 300;

/**
 * MapListingsPanel component
 * @param {Object} props
 * @param {Array} props.items - Array of listing items
 * @param {string} props.activeItemId - Currently active/hovered item ID
 * @param {Function} props.onItemHover - Callback when item is hovered
 * @param {Function} props.onItemLeave - Callback when hover ends
 * @param {Function} props.onItemClick - Callback when item is clicked
 * @param {boolean} props.showSearch - Show search input
 * @param {boolean} props.showFilters - Show type filters
 * @param {boolean} props.loading - Loading state
 * @param {string} props.emptyMessage - Message when no items
 */
function MapListingsPanel({
  items = [],
  activeItemId,
  onItemHover,
  onItemLeave,
  onItemClick,
  showSearch = true,
  showFilters = true,
  loading = false,
  emptyMessage = 'No locations found'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const listingsGridRef = useRef(null);

  // Debounce search query to reduce re-renders while typing
  const debouncedSearchQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_DELAY);

  // Show skeleton when search is pending (user is typing)
  const isSearchPending = searchQuery !== debouncedSearchQuery;

  // Filter items based on debounced search and type
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by type
    if (activeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === activeFilter);
    }

    // Filter by debounced search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.location && item.location.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [items, debouncedSearchQuery, activeFilter]);

  // Count by type
  const counts = useMemo(() => ({
    all: items.length,
    destination: items.filter(i => i.type === 'destination').length,
    experience: items.filter(i => i.type === 'experience').length
  }), [items]);

  // Enable keyboard navigation between listing cards
  // Uses arrow keys (up/down/left/right), Home, and End keys
  const hasItems = !loading && !isSearchPending && filteredItems.length > 0;
  useGridNavigation(listingsGridRef, '[role="option"]', hasItems);

  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <div className={styles.panel}>
      {/* Search */}
      {showSearch && (
        <div className={styles.searchContainer}>
          <div className={styles.searchInput}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search locations..."
              className={styles.input}
            />
            {searchQuery && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearSearch}
                aria-label="Clear search"
              >
                <FaTimes />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className={styles.filters}>
          <button
            type="button"
            className={`${styles.filterButton} ${activeFilter === 'all' ? styles.active : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${activeFilter === 'destination' ? styles.active : ''} ${styles.destination}`}
            onClick={() => setActiveFilter('destination')}
          >
            <FaMapMarkerAlt />
            Destinations ({counts.destination})
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${activeFilter === 'experience' ? styles.active : ''} ${styles.experience}`}
            onClick={() => setActiveFilter('experience')}
          >
            <FaStar />
            Experiences ({counts.experience})
          </button>
        </div>
      )}

      {/* Results Info */}
      {debouncedSearchQuery || activeFilter !== 'all' ? (
        <div className={styles.resultsInfo}>
          {isSearchPending ? 'Searching...' : `Showing ${filteredItems.length} of ${items.length} locations`}
        </div>
      ) : null}

      {/* Listings */}
      <div className={styles.listings}>
        {loading || isSearchPending ? (
          <div className={styles.loadingState}>
            <MapListingCardSkeleton count={4} />
          </div>
        ) : filteredItems.length > 0 ? (
          <div ref={listingsGridRef} className={styles.listingsGrid} role="listbox" aria-label="Map listings">
            {filteredItems.map(item => (
              <MapListingCard
                key={item.id}
                id={item.id}
                name={item.name}
                photo={item.photo}
                type={item.type}
                link={item.link}
                location={item.location}
                isActive={activeItemId === item.id}
                onHover={onItemHover}
                onLeave={onItemLeave}
                onClick={onItemClick}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            variant="mapLocations"
            title={emptyMessage}
            size="sm"
            compact
            primaryAction={(debouncedSearchQuery || activeFilter !== 'all') ? 'Clear Filters' : undefined}
            onPrimaryAction={(debouncedSearchQuery || activeFilter !== 'all') ? () => {
              setSearchQuery('');
              setActiveFilter('all');
            } : undefined}
          />
        )}
      </div>
    </div>
  );
}

MapListingsPanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    photo: PropTypes.string,
    type: PropTypes.oneOf(['destination', 'experience']).isRequired,
    link: PropTypes.string.isRequired,
    location: PropTypes.string,
    lat: PropTypes.number,
    lng: PropTypes.number
  })),
  activeItemId: PropTypes.string,
  onItemHover: PropTypes.func,
  onItemLeave: PropTypes.func,
  onItemClick: PropTypes.func,
  showSearch: PropTypes.bool,
  showFilters: PropTypes.bool,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string
};

export default memo(MapListingsPanel);
