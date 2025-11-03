import "./Loading.css";

/**
 * Loading - A reusable loading component with pulsing logo animation
 *
 * @param {Object} props
 * @param {string} props.size - Size variant: 'sm' (32px), 'md' (64px), 'lg' (96px), 'xl' (128px)
 * @param {string} props.variant - Display variant: 'inline' (default), 'fullscreen', 'centered'
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.message - Optional loading message
 * @param {boolean} props.showMessage - Whether to show the loading message
 * @param {string} props.overlay - Overlay style: 'none', 'light', 'dark'
 *
 * @example
 * // Inline loading (default)
 * <Loading size="md" message="Loading..." />
 *
 * @example
 * // Full-screen loading overlay
 * <Loading variant="fullscreen" size="lg" message="Loading..." overlay="light" />
 *
 * @example
 * // Centered loading (no overlay, but centered in container)
 * <Loading variant="centered" size="md" />
 */
export default function Loading({
  size = "md",
  variant = "inline",
  className = "",
  message = "Loading...",
  showMessage = true,
  overlay = "none"
}) {
  const containerClass = `loading-container loading-variant-${variant} ${overlay !== 'none' ? `loading-overlay-${overlay}` : ''} ${className}`;

  return (
    <div className={containerClass}>
      <div className="loading-content">
        <div className={`loading-logo loading-${size}`}>
          <svg
            width="256"
            height="256"
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Biensperience logo"
            className="loading-svg"
          >
            <defs>
              <linearGradient id={`grad-${size}-${variant}`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#7d88f2"/>
                <stop offset="100%" stopColor="#8a6ccf"/>
              </linearGradient>
              <filter id={`softShadow-${size}-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.25"/>
              </filter>
            </defs>

            <rect
              x="12"
              y="12"
              width="232"
              height="232"
              rx="46"
              ry="46"
              fill={`url(#grad-${size}-${variant})`}
              filter={`url(#softShadow-${size}-${variant})`}
            />

            <rect x="116" y="72" width="24" height="112" rx="12" ry="12" fill="#ffffff"/>
            <rect x="72" y="116" width="112" height="24" rx="12" ry="12" fill="#ffffff"/>
          </svg>
        </div>
        {showMessage && message && (
          <div className="loading-message">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}