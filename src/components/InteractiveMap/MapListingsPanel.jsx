/**
 * MapListingsPanel Component
 * Scrollable panel for map listings with search and filters
 */

import React, { memo, useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FaSearch, FaStar, FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import MapListingCard from './MapListingCard';
import styles from './MapListingsPanel.module.scss';

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

  // Filter items based on search and type
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filter by type
    if (activeFilter !== 'all') {
      filtered = filtered.filter(item => item.type === activeFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.location && item.location.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [items, searchQuery, activeFilter]);

  // Count by type
  const counts = useMemo(() => ({
    all: items.length,
    destination: items.filter(i => i.type === 'destination').length,
    experience: items.filter(i => i.type === 'experience').length
  }), [items]);

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
      {searchQuery || activeFilter !== 'all' ? (
        <div className={styles.resultsInfo}>
          Showing {filteredItems.length} of {items.length} locations
        </div>
      ) : null}

      {/* Listings */}
      <div className={styles.listings}>
        {loading ? (
          <div className={styles.loadingState}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className={styles.listingsGrid}>
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
          <div className={styles.emptyState}>
            <FaMapMarkerAlt className={styles.emptyIcon} />
            <p>{emptyMessage}</p>
            {(searchQuery || activeFilter !== 'all') && (
              <button
                type="button"
                className={styles.resetButton}
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('all');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
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
