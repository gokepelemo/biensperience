import GoogleMap from '../GoogleMap/GoogleMap';
import styles from './MapView.module.scss';
import { lang } from '../../lang.constants';

/**
 * MapView - Interactive Google Maps component for destination browsing
 * Uses the GoogleMap component with overlay controls and legend
 * 
 * @param {Object} props - Component props
 * @param {string} props.location - Location query string (e.g., "Osaka, Japan")
 * @param {string} [props.apiKey] - Google Maps API key (defaults to env key)
 * @param {number} [props.height=500] - Map height in pixels
 * @param {boolean} [props.showControls=true] - Show map controls overlay
 * @param {Array} [props.markers] - Optional array of markers to display info for
 */
export default function MapView({
  location = "Osaka, Japan",
  apiKey,
  height = 500,
  showControls = true,
  markers = []
}) {
  return (
    <div className={styles.mapView}>
      <div className={styles.mapContainer} style={{ height: `${height}px` }}>
        {/* Google Maps Embed via GoogleMap component */}
        <GoogleMap
          location={location}
          apiKey={apiKey}
          height={height}
          width="100%"
          style={{ borderRadius: "var(--border-radius-xl)" }}
        />

        {/* Optional Controls Overlay */}
        {showControls && (
          <>
            {/* Map Controls */}
            <div className={styles.mapControls}>
              <button
                className={styles.mapControlBtn}
                aria-label={lang.current.mapView.zoomIn}
                title={lang.current.mapView.zoomIn}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                className={styles.mapControlBtn}
                aria-label={lang.current.mapView.zoomOut}
                title={lang.current.mapView.zoomOut}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <button
                className={styles.mapControlBtn}
                aria-label={lang.current.mapView.centerMap}
                title={lang.current.mapView.centerMap}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="8" cy="8" r="2" fill="currentColor"/>
                </svg>
              </button>
            </div>

            {/* Location Button */}
            <button
              className={styles.mapLocationBtn}
              aria-label={lang.current.mapView.myLocation}
              title={lang.current.mapView.myLocation}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13Z" fill="currentColor"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Map Legend - Only show if markers provided */}
      {markers && markers.length > 0 && (
        <div className={styles.mapLegend}>
          <div className={styles.legendItem}>
            <div className={styles.legendMarker} style={{ background: 'var(--color-primary)' }}></div>
            <span className={styles.legendLabel}>{lang.current.mapView.hotels} ({markers.filter(m => m.type === 'hotel').length})</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendMarker} style={{ background: 'var(--color-success)' }}></div>
            <span className={styles.legendLabel}>{lang.current.mapView.restaurants} ({markers.filter(m => m.type === 'restaurant').length})</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendMarker} style={{ background: 'var(--color-warning)' }}></div>
            <span className={styles.legendLabel}>{lang.current.mapView.attractions} ({markers.filter(m => m.type === 'attraction').length})</span>
          </div>
        </div>
      )}
    </div>
  );
}
