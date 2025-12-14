/**
 * InteractiveMap Component
 * Interactive Google Map with custom markers, clustering, and info windows
 * Uses @react-google-maps/api for full JavaScript SDK support
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { FaStar, FaMapMarkerAlt } from 'react-icons/fa';
import MapInfoCard from './MapInfoCard';
import styles from './InteractiveMap.module.scss';

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
 * @param {string} props.height - Optional map height (default: 500px)
 * @param {boolean} props.fitBounds - Whether to auto-fit bounds to markers (default: true)
 */
export default function InteractiveMap({
  markers = [],
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onMarkerClick,
  height = '500px',
  fitBounds = true
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const mapRef = useRef(null);
  const clustererRef = useRef(null);
  const markersRef = useRef([]);

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

  // Calculate bounds from markers
  const bounds = useMemo(() => {
    if (!isLoaded || !markers.length || !window.google) return null;

    const newBounds = new window.google.maps.LatLngBounds();
    markers.forEach(marker => {
      if (marker.lat && marker.lng) {
        newBounds.extend({ lat: marker.lat, lng: marker.lng });
      }
    });
    return newBounds;
  }, [markers, isLoaded]);

  // Fit map to bounds when markers change
  useEffect(() => {
    if (fitBounds && mapRef.current && bounds && markers.length > 0) {
      mapRef.current.fitBounds(bounds, { padding: 50 });

      // Set max zoom to prevent over-zoom on single marker
      const listener = window.google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
        if (mapRef.current.getZoom() > 15) {
          mapRef.current.setZoom(15);
        }
      });
      return () => window.google.maps.event.removeListener(listener);
    }
  }, [bounds, fitBounds, markers.length]);

  // Map load handler
  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Map unmount handler
  const onUnmount = useCallback(() => {
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    mapRef.current = null;
  }, []);

  // Handle marker click
  const handleMarkerClick = useCallback((marker) => {
    setSelectedMarker(marker);
    if (onMarkerClick) {
      onMarkerClick(marker);
    }
  }, [onMarkerClick]);

  // Handle marker hover
  const handleMarkerHover = useCallback((marker) => {
    setHoveredMarker(marker);
  }, []);

  // Handle info window close
  const handleInfoWindowClose = useCallback(() => {
    setSelectedMarker(null);
    setHoveredMarker(null);
  }, []);

  // Get marker icon based on type
  const getMarkerIcon = useCallback((type) => {
    if (!isLoaded || !window.google) return null;

    const iconBase = {
      scaledSize: new window.google.maps.Size(32, 32),
      anchor: new window.google.maps.Point(16, 32),
      labelOrigin: new window.google.maps.Point(16, -8)
    };

    if (type === 'experience') {
      return {
        ...iconBase,
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <path fill="#F59E0B" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        `)
      };
    }

    // Default destination marker
    return {
      ...iconBase,
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
          <path fill="#3B82F6" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      `)
    };
  }, [isLoaded]);

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
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={{ lat: marker.lat, lng: marker.lng }}
            icon={getMarkerIcon(marker.type)}
            onClick={() => handleMarkerClick(marker)}
            onMouseOver={() => handleMarkerHover(marker)}
            onMouseOut={() => setHoveredMarker(null)}
          />
        ))}

        {activeMarker && (
          <InfoWindow
            position={{ lat: activeMarker.lat, lng: activeMarker.lng }}
            onCloseClick={handleInfoWindowClose}
            options={{
              pixelOffset: new window.google.maps.Size(0, -32),
              maxWidth: 280
            }}
          >
            <MapInfoCard
              name={activeMarker.name}
              photo={activeMarker.photo}
              type={activeMarker.type}
              link={activeMarker.link}
            />
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Legend */}
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
  height: PropTypes.string,
  fitBounds: PropTypes.bool
};
