import { useState } from 'react';
import styles from './GoogleMap.module.scss';
import Modal from '../Modal/Modal';
import { FaDirections } from 'react-icons/fa';

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
  const directionsUrl = `https://www.google.com/maps/embed/v1/directions?destination=${encodeURIComponent(location)}&key=${apiKey}&mode=driving`;

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
          <iframe
            width="100%"
            height="100%"
            title={`Directions to ${location}`}
            className={styles.directionsMap}
            src={directionsUrl}
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
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
