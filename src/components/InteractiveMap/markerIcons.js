/**
 * Marker Icon Constants
 * Reusable SVG marker icons for Google Maps
 *
 * Colors:
 * - Experience: Amber/Orange (#F59E0B, stroke #B45309, inner #FEF3C7)
 * - Destination: Blue (#3B82F6, stroke #1D4ED8, inner #DBEAFE)
 */

// Marker icon sizes
export const MARKER_SIZE = {
  width: 32,
  height: 32
};

// SVG paths and colors for marker types
export const MARKER_COLORS = {
  experience: {
    fill: '#F59E0B',
    stroke: '#B45309',
    inner: '#FEF3C7'
  },
  destination: {
    fill: '#3B82F6',
    stroke: '#1D4ED8',
    inner: '#DBEAFE'
  }
};

/**
 * Generate marker SVG string
 * @param {Object} colors - Color configuration { fill, stroke, inner }
 * @returns {string} SVG markup string
 */
export function generateMarkerSvg(colors) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${MARKER_SIZE.width}" height="${MARKER_SIZE.height}">
      <path fill="${colors.fill}" stroke="${colors.stroke}" stroke-width="1" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle fill="${colors.inner}" cx="12" cy="9" r="3"/>
    </svg>
  `;
}

// Pre-generated SVG strings for each marker type
export const MARKER_SVGS = {
  experience: generateMarkerSvg(MARKER_COLORS.experience),
  destination: generateMarkerSvg(MARKER_COLORS.destination)
};

// Data URI encoded SVGs for direct use in Google Maps
export const MARKER_DATA_URIS = {
  experience: 'data:image/svg+xml,' + encodeURIComponent(MARKER_SVGS.experience),
  destination: 'data:image/svg+xml,' + encodeURIComponent(MARKER_SVGS.destination)
};

/**
 * Create a Google Maps marker icon configuration
 * Requires window.google.maps to be loaded
 *
 * @param {string} type - Marker type ('experience' or 'destination')
 * @returns {Object} Google Maps icon configuration
 */
export function createMarkerIcon(type) {
  const dataUri = MARKER_DATA_URIS[type] || MARKER_DATA_URIS.destination;

  return {
    url: dataUri,
    scaledSize: new window.google.maps.Size(MARKER_SIZE.width, MARKER_SIZE.height),
    anchor: new window.google.maps.Point(MARKER_SIZE.width / 2, MARKER_SIZE.height)
  };
}
