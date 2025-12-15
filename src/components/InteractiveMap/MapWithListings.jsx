/**
 * MapWithListings Component
 * Full-featured map view with sidebar listings panel
 * Provides hover synchronization between map markers and list items
 */

import React, { useState, useCallback, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import InteractiveMap from './InteractiveMap';
import MapListingsPanel from './MapListingsPanel';
import styles from './MapWithListings.module.scss';

/**
 * MapWithListings component
 * @param {Object} props
 * @param {Array} props.markers - Array of marker objects
 * @param {string} props.height - Map height (default: 100%)
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.showSearch - Show search in panel
 * @param {boolean} props.showFilters - Show filters in panel
 * @param {'30-70'|'40-60'|'35-65'} props.splitRatio - Panel/map split ratio
 * @param {Function} props.onMarkerClick - Custom marker click handler
 */
function MapWithListings({
  markers = [],
  height = '100%',
  loading = false,
  showSearch = true,
  showFilters = true,
  splitRatio = '35-65',
  onMarkerClick
}) {
  const navigate = useNavigate();
  const [hoveredItemId, setHoveredItemId] = useState(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);

  // Prepare items for the listing panel (add location string)
  const listingItems = useMemo(() => {
    return markers.map(marker => ({
      ...marker,
      location: marker.locationName || null
    }));
  }, [markers]);


  // Handle hover from listing panel
  const handleItemHover = useCallback((id) => {
    setHoveredItemId(id);
  }, []);

  const handleItemLeave = useCallback(() => {
    setHoveredItemId(null);
  }, []);

  // Handle click from listing panel
  const handleItemClick = useCallback((id, e) => {
    // If it's a link click, let it propagate
    if (e?.target?.tagName === 'A') return;

    const marker = markers.find(m => m.id === id);
    if (marker?.link) {
      navigate(marker.link);
    }
  }, [markers, navigate]);

  // Handle marker click from map
  const handleMarkerClick = useCallback((marker) => {
    setSelectedMarkerId(marker.id);

    if (onMarkerClick) {
      onMarkerClick(marker);
    } else if (marker.link) {
      navigate(marker.link);
    }
  }, [navigate, onMarkerClick]);

  // Handle marker hover from map (sync with list)
  const handleMarkerHover = useCallback((marker) => {
    setHoveredItemId(marker?.id || null);
  }, []);

  // Active item is either hovered or selected
  const activeItemId = hoveredItemId || selectedMarkerId;

  // Get split ratio CSS classes
  const splitClass = {
    '30-70': styles.split3070,
    '35-65': styles.split3565,
    '40-60': styles.split4060
  }[splitRatio] || styles.split3565;

  return (
    <div className={`${styles.container} ${splitClass}`} style={{ height }}>
      {/* Listings Panel */}
      <div className={styles.panelContainer}>
        <MapListingsPanel
          items={listingItems}
          activeItemId={activeItemId}
          onItemHover={handleItemHover}
          onItemLeave={handleItemLeave}
          onItemClick={handleItemClick}
          showSearch={showSearch}
          showFilters={showFilters}
          loading={loading}
        />
      </div>

      {/* Map Container */}
      <div className={styles.mapContainer}>
        <InteractiveMap
          markers={markers}
          height="100%"
          onMarkerClick={handleMarkerClick}
          hoveredMarkerId={hoveredItemId}
          onMarkerHover={handleMarkerHover}
        />
      </div>
    </div>
  );
}

MapWithListings.propTypes = {
  markers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
    type: PropTypes.oneOf(['destination', 'experience']).isRequired,
    name: PropTypes.string.isRequired,
    photo: PropTypes.string,
    link: PropTypes.string,
    locationName: PropTypes.string
  })),
  height: PropTypes.string,
  loading: PropTypes.bool,
  showSearch: PropTypes.bool,
  showFilters: PropTypes.bool,
  splitRatio: PropTypes.oneOf(['30-70', '35-65', '40-60']),
  onMarkerClick: PropTypes.func
};

export default memo(MapWithListings);
