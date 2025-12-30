import { lang } from '../../lang.constants';
import styles from "./Loading.module.scss";

/**
 * Loading - A reusable loading component with multiple animation variations
 *
 * @param {Object} props
 * @param {string} props.size - Size variant: 'xs' (16px), 'sm' (32px), 'md' (64px), 'lg' (96px), 'xl' (128px)
 * @param {string} props.variant - Display variant: 'inline' (default), 'fullscreen', 'centered'
 * @param {string} props.animation - Animation type: 'pulse', 'spin', 'fan', 'orbit', 'breathe', 'bounce', 'engine'
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.message - Optional loading message
 * @param {boolean} props.showMessage - Whether to show the loading message
 * @param {string} props.overlay - Overlay style: 'none', 'light', 'dark'
 *
 * Animation Types:
 * - 'pulse': Default pulsing scale animation (smooth, subtle)
 * - 'spin': Entire logo rotates continuously (smooth rotation)
 * - 'fan': Plus sign rotates like a starting fan (slow to fast)
 * - 'orbit': Purple gradient trails orbit around the icon (circular motion)
 * - 'breathe': Gentle breathing effect with scale and glow (calm, meditative)
 * - 'bounce': Playful bouncing animation (energetic)
 * - 'engine': Plus morphs into airplane engine with spinning fan (transformation)
 *
 * @example
 * // Default pulse animation
 * <Loading size="md" message="Loading..." />
 *
 * @example
 * // Spinning fan animation
 * <Loading animation="fan" size="lg" message="Starting up..." />
 *
 * @example
 * // Orbiting gradient with fullscreen overlay
 * <Loading animation="orbit" variant="fullscreen" size="lg" message="Loading..." overlay="light" />
 *
 * @example
 * // Engine transformation animation
 * <Loading animation="engine" variant="centered" size="lg" message="Preparing flight..." />
 */
export default function Loading({
  size = "md",
  variant = "inline",
  animation = "pulse",
  className = "",
  message = "Loading...",
  showMessage = true,
  overlay = "none",
  allowCustomMessage = false, // If false, show terse animated ellipsis instead of verbose messages
}) {
  const variantClass = styles[`loadingVariant${variant.charAt(0).toUpperCase() + variant.slice(1)}`];
  const overlayClass = overlay !== 'none' ? styles[`loadingOverlay${overlay.charAt(0).toUpperCase() + overlay.slice(1)}`] : '';
  const containerClass = `${styles.loadingContainer} ${variantClass} ${overlayClass} ${className}`;
  const animationClass = styles[`loadingAnimation${animation.charAt(0).toUpperCase() + animation.slice(1)}`];
  const sizeClass = styles[`loading${size.charAt(0).toUpperCase() + size.slice(1)}`];
  const useTerse = showMessage && !allowCustomMessage; // global preference: minimal loading message

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message || 'Loading'}
    >
      <div className={styles.loadingContent}>
        <div className={`${styles.loadingLogo} ${sizeClass} ${animationClass}`}>
          <svg
            width="256"
            height="256"
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={lang.current.loading.biensperienceLogo}
            className={styles.loadingSvg}
          >
            <defs>
              <linearGradient id={`grad-${size}-${variant}`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#7d88f2"/>
                <stop offset="100%" stopColor="#8a6ccf"/>
              </linearGradient>
              <filter id={`softShadow-${size}-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.25"/>
              </filter>
              <filter id={`glow-${size}-${variant}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4"/>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Background rectangle */}
            <rect
              x="12"
              y="12"
              width="232"
              height="232"
              rx="46"
              ry="46"
              fill={`url(#grad-${size}-${variant})`}
              filter={`url(#softShadow-${size}-${variant})`}
              className="loading-bg"
            />

            {/* Engine animation - plus morphing into airplane engine */}
            {animation === 'engine' ? (
              <>
                {/* Plus icon */}
                <g className="loading-plus-engine">
                  <rect x="116" y="72" width="24" height="112" rx="12" ry="12" fill="#ffffff"/>
                  <rect x="72" y="116" width="112" height="24" rx="12" ry="12" fill="#ffffff"/>
                </g>

                {/* Airplane engine */}
                <g className="loading-engine">
                  {/* Outer ring */}
                  <circle cx="128" cy="128" r="48" fill="none" stroke="#ffffff" strokeWidth="10"/>

                  {/* Inner housing */}
                  <circle cx="128" cy="128" r="36" fill="rgba(255,255,255,0.1)" stroke="#ffffff" strokeWidth="3"/>

                  {/* Spinning fan */}
                  <g className="loading-engine-fan">
                    <g transform="translate(128,128)">
                      <path d="M0,-28 a6,6 0 0 1 6,6 v16 a6,6 0 0 1 -12,0 v-16 a6,6 0 0 1 6,-6z" fill="#ffffff"/>
                      <path d="M0,-28 a6,6 0 0 1 6,6 v16 a6,6 0 0 1 -12,0 v-16 a6,6 0 0 1 6,-6z" fill="#ffffff" transform="rotate(120)"/>
                      <path d="M0,-28 a6,6 0 0 1 6,6 v16 a6,6 0 0 1 -12,0 v-16 a6,6 0 0 1 6,-6z" fill="#ffffff" transform="rotate(240)"/>
                      <circle cx="0" cy="0" r="6" fill="#ffffff"/>
                    </g>
                  </g>
                </g>
              </>
            ) : (
              /* Plus sign group - for independent rotation */
              <g className="loading-plus">
                <rect x="116" y="72" width="24" height="112" rx="12" ry="12" fill="#ffffff"/>
                <rect x="72" y="116" width="112" height="24" rx="12" ry="12" fill="#ffffff"/>
              </g>
            )}

            {/* Orbit trail (only visible for orbit animation) */}
            {animation === 'orbit' && (
              <circle
                cx="128"
                cy="128"
                r="100"
                fill="none"
                stroke="url(#orbitGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="50 314"
                className="loading-orbit-trail"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 128 128"
                  to="360 128 128"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}

            {/* Orbit gradient definition */}
            <defs>
              <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7d88f2" stopOpacity="0"/>
                <stop offset="50%" stopColor="#8a6ccf" stopOpacity="1"/>
                <stop offset="100%" stopColor="#7d88f2" stopOpacity="0"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        {showMessage && (
          <div className={styles.loadingMessage}>
            {useTerse ? (
              <span className={styles.loadingTerse}>
                Loading
                <span className={styles.loadingDots}>
                  <span className="dot dot-1">.</span>
                  <span className="dot dot-2">.</span>
                  <span className="dot dot-3">.</span>
                </span>
              </span>
            ) : (
              message
            )}
          </div>
        )}
      </div>
    </div>
  );
}
