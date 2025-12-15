/**
 * InteractiveMap Component
 * Interactive Google Map with custom markers, clustering, and info windows
 * Uses @react-google-maps/api for full JavaScript SDK support
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { FaStar, FaMapMarkerAlt } from 'react-icons/fa';
import MapInfoCard from './MapInfoCard';
import styles from './InteractiveMap.module.scss';
import { logger } from '../../utilities/logger';

// Google Maps API Key (same as used in GoogleMap component)
const GOOGLE_MAPS_API_KEY = 'AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0';

// Default map options
const DEFAULT_MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

// Default center (world view)
const DEFAULT_CENTER = { lat: 20, lng: 0 };
const DEFAULT_ZOOM = 2;

/**
 * InteractiveMap component
 * @param {Object} props
 * @param {Array} props.markers - Array of marker objects with id, lat, lng, type, name, photo, link
 * @param {Object} props.center - Optional center point { lat, lng }
 * @param {number} props.zoom - Optional initial zoom level
 * @param {Function} props.onMarkerClick - Optional callback when marker is clicked
 * @param {Function} props.onMarkerHover - Optional callback when marker is hovered (for external sync)
 * @param {string} props.hoveredMarkerId - External hovered marker ID (for sync with listings)
 * @param {string} props.height - Optional map height (default: 500px)
 * @param {boolean} props.fitBounds - Whether to auto-fit bounds to markers (default: true)
 * @param {boolean} props.showLegend - Whether to show the legend (default: true)
 */
export default function InteractiveMap({
  markers = [],
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onMarkerClick,
  onMarkerHover,
  hoveredMarkerId,
  height = '500px',
  fitBounds = true,
  showLegend = true
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [internalHoveredMarker, setInternalHoveredMarker] = useState(null);
  const [isHoveringInfoWindow, setIsHoveringInfoWindow] = useState(false);
  const mapRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    id: 'google-map-script'
  });

  // Container style
  const containerStyle = useMemo(() => ({
    width: '100%',
    height
  }), [height]);

  // Calculate and fit bounds when map loads and markers are ready
  const fitMapBounds = useCallback(() => {
    if (!mapRef.current || !isLoaded || !window.google) return;

    // Get valid markers for bounds calculation
    const seen = new Set();
    const validForBounds = markers.filter(marker => {
      if (typeof marker.lat !== 'number' || typeof marker.lng !== 'number' ||
          isNaN(marker.lat) || isNaN(marker.lng)) return false;
      if (marker.lat < -90 || marker.lat > 90 || marker.lng < -180 || marker.lng > 180) return false;
      if (seen.has(marker.id)) return false;
      seen.add(marker.id);
      return true;
    });

    if (validForBounds.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    validForBounds.forEach(marker => {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
    });

    mapRef.current.fitBounds(bounds, { padding: 50 });

    // Set max zoom to prevent over-zoom on single marker
    window.google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
      if (mapRef.current && mapRef.current.getZoom() > 15) {
        mapRef.current.setZoom(15);
      }
    });
  }, [markers, isLoaded]);

  // Fit map to bounds when markers change
  useEffect(() => {
    if (fitBounds && mapRef.current && markers.length > 0) {
      fitMapBounds();
    }
  }, [fitBounds, markers, fitMapBounds]);

  // Map load handler
  const onLoad = useCallback((map) => {
    mapRef.current = map;
    // Fit bounds after map loads
    if (fitBounds && markers.length > 0) {
      setTimeout(fitMapBounds, 100);
    }
  }, [fitBounds, markers.length, fitMapBounds]);

  // Map unmount handler
  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  // Handle marker click
  const handleMarkerClick = useCallback((marker) => {
    setSelectedMarker(marker);
    if (onMarkerClick) {
      onMarkerClick(marker);
    }
  }, [onMarkerClick]);

  // Handle marker hover - with delay on mouseout to allow hover on info window
  const handleMarkerHover = useCallback((marker) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setInternalHoveredMarker(marker);
    // Notify parent for external sync
    if (onMarkerHover) {
      onMarkerHover(marker);
    }
  }, [onMarkerHover]);

  // Handle marker mouse out - delay hiding to allow moving to info window
  const handleMarkerMouseOut = useCallback(() => {
    // Don't hide immediately - give time to move to info window
    hoverTimeoutRef.current = setTimeout(() => {
      if (!isHoveringInfoWindow) {
        setInternalHoveredMarker(null);
        if (onMarkerHover) {
          onMarkerHover(null);
        }
      }
    }, 200);
  }, [isHoveringInfoWindow, onMarkerHover]);

  // Handle info window hover
  const handleInfoWindowMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoveringInfoWindow(true);
  }, []);

  const handleInfoWindowMouseLeave = useCallback(() => {
    setIsHoveringInfoWindow(false);
    setInternalHoveredMarker(null);
    if (onMarkerHover) {
      onMarkerHover(null);
    }
  }, [onMarkerHover]);

  // Handle info window close
  const handleInfoWindowClose = useCallback(() => {
    setSelectedMarker(null);
    setInternalHoveredMarker(null);
    setIsHoveringInfoWindow(false);
    if (onMarkerHover) {
      onMarkerHover(null);
    }
  }, [onMarkerHover]);

  // Get marker icon based on type - using SVG data URIs for reliable coloring
  const getMarkerIcon = useCallback((type) => {
    // Experience markers: amber/orange color
    if (type === 'experience') {
      return {
        url: 'data:image/svg+xml,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <path fill="#F59E0B" stroke="#B45309" stroke-width="1" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle fill="#FEF3C7" cx="12" cy="9" r="3"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(32, 32),
        anchor: new window.google.maps.Point(16, 32)
      };
    }
    // Destination markers: blue color
    return {
      url: 'data:image/svg+xml,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
          <path fill="#3B82F6" stroke="#1D4ED8" stroke-width="1" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle fill="#DBEAFE" cx="12" cy="9" r="3"/>
        </svg>
      `),
      scaledSize: new window.google.maps.Size(32, 32),
      anchor: new window.google.maps.Point(16, 32)
    };
  }, []);

  // Filter to only valid markers with proper coordinates
  // NOTE: This must be called before any early returns to follow React hooks rules
  const validMarkers = useMemo(() => {
    const seen = new Set();
    return markers.filter(marker => {
      // Check for valid coordinates
      if (typeof marker.lat !== 'number' || typeof marker.lng !== 'number' ||
          isNaN(marker.lat) || isNaN(marker.lng)) {
        logger.warn('[InteractiveMap] Skipping marker with invalid coordinates', { id: marker.id, lat: marker.lat, lng: marker.lng });
        return false;
      }
      // Check for valid lat/lng ranges
      if (marker.lat < -90 || marker.lat > 90 || marker.lng < -180 || marker.lng > 180) {
        logger.warn('[InteractiveMap] Skipping marker with out-of-range coordinates', { id: marker.id, lat: marker.lat, lng: marker.lng });
        return false;
      }
      // Check for duplicate IDs
      if (seen.has(marker.id)) {
        logger.warn('[InteractiveMap] Skipping duplicate marker', { id: marker.id });
        return false;
      }
      seen.add(marker.id);
      return true;
    });
  }, [markers]);

  // Determine hovered marker - external ID takes priority, then internal state
  const hoveredMarker = useMemo(() => {
    if (hoveredMarkerId) {
      return validMarkers.find(m => m.id === hoveredMarkerId) || null;
    }
    return internalHoveredMarker;
  }, [hoveredMarkerId, validMarkers, internalHoveredMarker]);

  // Active marker for info window (selected takes priority over hovered)
  const activeMarker = selectedMarker || hoveredMarker;

  // Loading state
  if (loadError) {
    return (
      <div className={styles.mapError}>
        <FaMapMarkerAlt className={styles.errorIcon} />
        <p>Error loading map</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={styles.mapLoading} style={{ height }}>
        <div className={styles.loadingSpinner} />
        <p>Loading map...</p>
      </div>
    );
  }

  // Empty state
  if (markers.length === 0) {
    return (
      <div className={styles.mapEmpty} style={{ height }}>
        <FaMapMarkerAlt className={styles.emptyIcon} />
        <p>No locations to display</p>
      </div>
    );
  }

  // Log marker data for debugging
  logger.debug('[InteractiveMap] Rendering markers', {
    total: markers.length,
    valid: validMarkers.length,
    sample: validMarkers.slice(0, 3).map(m => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      type: m.type,
      name: m.name
    }))
  });

  return (
    <div className={styles.mapContainer}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={DEFAULT_MAP_OPTIONS}
      >
        {validMarkers.map((marker) => (
          <MarkerF
            key={marker.id}
            position={{ lat: marker.lat, lng: marker.lng }}
            icon={getMarkerIcon(marker.type)}
            onClick={() => handleMarkerClick(marker)}
            onMouseOver={() => handleMarkerHover(marker)}
            onMouseOut={handleMarkerMouseOut}
          />
        ))}

        {activeMarker && (
          <InfoWindowF
            position={{ lat: activeMarker.lat, lng: activeMarker.lng }}
            onCloseClick={handleInfoWindowClose}
            options={{
              pixelOffset: new window.google.maps.Size(0, -32),
              maxWidth: 300,
              disableAutoPan: false
            }}
          >
            <div
              onMouseEnter={handleInfoWindowMouseEnter}
              onMouseLeave={handleInfoWindowMouseLeave}
            >
              <MapInfoCard
                name={activeMarker.name}
                photo={activeMarker.photo}
                type={activeMarker.type}
                link={activeMarker.link}
                onClose={handleInfoWindowClose}
              />
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      {/* Legend */}
      {showLegend && (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <FaStar className={styles.legendIconExperience} />
            <span>Experience</span>
          </div>
          <div className={styles.legendItem}>
            <FaMapMarkerAlt className={styles.legendIconDestination} />
            <span>Destination</span>
          </div>
        </div>
      )}
    </div>
  );
}

InteractiveMap.propTypes = {
  markers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired,
    type: PropTypes.oneOf(['destination', 'experience']).isRequired,
    name: PropTypes.string.isRequired,
    photo: PropTypes.string,
    link: PropTypes.string
  })),
  center: PropTypes.shape({
    lat: PropTypes.number.isRequired,
    lng: PropTypes.number.isRequired
  }),
  zoom: PropTypes.number,
  onMarkerClick: PropTypes.func,
  onMarkerHover: PropTypes.func,
  hoveredMarkerId: PropTypes.string,
  height: PropTypes.string,
  fitBounds: PropTypes.bool,
  showLegend: PropTypes.bool
};
