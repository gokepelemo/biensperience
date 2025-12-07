import { useState, useEffect, useCallback } from 'react';
import styles from './GoogleMap.module.scss';
import Modal from '../Modal/Modal';
import { FaDirections, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';

/**
 * GoogleMap - Reusable Google Maps Embed component
 * Uses the same Google Maps Embed API integration as SingleExperience view
 *
 * @param {Object} props - Component props
 * @param {string} props.location - Location query string (e.g., "Osaka, Japan" or "Tokyo Tower, Tokyo")
 * @param {string} [props.apiKey] - Google Maps API key (defaults to env key)
 * @param {number} [props.height=300] - Map height in pixels
 * @param {number} [props.width='100%'] - Map width (string or number)
 * @param {string} [props.title] - Iframe title for accessibility
 * @param {Object} [props.style] - Additional inline styles
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.showDirections=true] - Whether to show the Get Directions button
 */
export default function GoogleMap({
  location,
  apiKey = "AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0",
  height = 300,
  width = "100%",
  title,
  style = {},
  className = "",
  showDirections = true
}) {
  const [showDirectionsModal, setShowDirectionsModal] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Get user's location when modal opens
  const getUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        if (error.code === error.PERMISSION_DENIED) {
          errorMessage = 'Location access denied. Please enable location services.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMessage = 'Location information unavailable';
        } else if (error.code === error.TIMEOUT) {
          errorMessage = 'Location request timed out';
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Request location when modal opens
  useEffect(() => {
    if (showDirectionsModal && !userLocation && !locationError) {
      getUserLocation();
    }
  }, [showDirectionsModal, userLocation, locationError, getUserLocation]);

  if (!location) {
    return (
      <div
        className={`${styles.googleMapPlaceholder} ${className}`}
        style={{ height: `${height}px`, ...style }}
      >
        <p className={styles.mapPlaceholderText}>Location not available</p>
      </div>
    );
  }

  const mapUrl = `https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(location)}&key=${apiKey}`;

  // Build directions URL with origin if user location is available
  const directionsUrl = userLocation
    ? `https://www.google.com/maps/embed/v1/directions?origin=${userLocation.lat},${userLocation.lng}&destination=${encodeURIComponent(location)}&key=${apiKey}&mode=driving`
    : null;

  return (
    <>
      <div className={styles.googleMapContainer}>
        <iframe
          width={width}
          height={height}
          title={title || `Map of ${location}`}
          className={`${styles.googleMap} ${className}`}
          style={{
            border: 0,
            borderRadius: "var(--border-radius-md)",
            ...style
          }}
          loading="lazy"
          src={mapUrl}
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
        {showDirections && (
          <button
            type="button"
            className={styles.directionsButton}
            onClick={() => setShowDirectionsModal(true)}
            aria-label="Get directions"
          >
            <FaDirections />
            <span>Get Directions</span>
          </button>
        )}
      </div>

      {/* Fullscreen Directions Modal */}
      <Modal
        show={showDirectionsModal}
        onClose={() => setShowDirectionsModal(false)}
        title={`Directions to ${location}`}
        size="fullscreen"
        showSubmitButton={false}
        bodyClassName={styles.directionsModalBody}
      >
        <div className={styles.directionsModalContent}>
          {/* Loading state while getting user location */}
          {isGettingLocation && (
            <div className={styles.directionsLoading}>
              <FaSpinner className={styles.spinner} />
              <p>Getting your location...</p>
            </div>
          )}

          {/* Error state - show fallback with link to Google Maps */}
          {locationError && !isGettingLocation && (
            <div className={styles.directionsError}>
              <FaExclamationTriangle className={styles.errorIcon} />
              <p>{locationError}</p>
              <p className={styles.errorHint}>
                You can still get directions by opening Google Maps directly.
              </p>
            </div>
          )}

          {/* Show map with directions when location is available */}
          {directionsUrl && !isGettingLocation && (
            <iframe
              width="100%"
              height="100%"
              title={`Directions to ${location}`}
              className={styles.directionsMap}
              src={directionsUrl}
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}

          <div className={styles.directionsActions}>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.openInGoogleMaps}
            >
              <FaDirections />
              <span>Open in Google Maps</span>
            </a>
          </div>
        </div>
      </Modal>
    </>
  );
}
