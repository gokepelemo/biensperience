import styles from './GoogleMap.module.scss';

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
 */
export default function GoogleMap({
  location,
  apiKey = "AIzaSyDqWtvNnjYES1pd6ssnZ7gvddUVHrlNaR0",
  height = 300,
  width = "100%",
  title,
  style = {},
  className = ""
}) {
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

  return (
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
  );
}
