/**
 * BaseLoading — Native Chakra UI v3 Loading Component
 *
 * Uses Chakra primitives (`Box`, `Center`, `Text`) for ALL layout. No CSS Modules.
 * Complex SVG logo retained verbatim; keyframe animations defined via Emotion.
 *
 * Animation Types:
 * - 'pulse': Default pulsing scale animation (smooth, subtle)
 * - 'spin': Entire logo rotates continuously
 * - 'fan': Plus sign rotates like a starting fan (slow to fast)
 * - 'orbit': Purple gradient trails orbit around the icon
 * - 'breathe': Gentle breathing with scale and glow
 * - 'bounce': Playful bouncing
 * - 'engine': Plus morphs into airplane engine with spinning fan
 *
 * Task: biensperience-dd5f — P4.1 App view & global layout → Chakra
 */

import React, { useId, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Center, Text } from '@chakra-ui/react';
import { lang } from '../../lang.constants';

// ──────────────────────────────────────────────
// SIZE MAP (px)
// ──────────────────────────────────────────────
const SIZE_MAP = {
  xs: 16,
  sm: 32,
  md: 64,
  lg: 96,
  xl: 128,
};

const MOBILE_SIZE_MAP = {
  xs: 16,
  sm: 32,
  md: 64,
  lg: 80,
  xl: 96,
};

// ──────────────────────────────────────────────
// KEYFRAME CSS (embedded once via <style>)
// ──────────────────────────────────────────────
const KEYFRAMES = `
@keyframes bl-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.85); opacity: 0.6; }
}
@keyframes bl-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes bl-fan {
  0% { transform: rotate(0deg); }
  20% { transform: rotate(90deg); }
  40% { transform: rotate(180deg); }
  60% { transform: rotate(360deg); }
  75% { transform: rotate(540deg); }
  85% { transform: rotate(720deg); }
  95% { transform: rotate(900deg); }
  100% { transform: rotate(1080deg); }
}
@keyframes bl-orbit-pulse {
  0%, 100% { transform: scale(0.95); }
  50% { transform: scale(1.05); }
}
@keyframes bl-breathe {
  0%, 100% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 1; }
}
@keyframes bl-breathe-glow {
  0%, 100% { filter: drop-shadow(0 0 5px rgba(125, 136, 242, 0.3)); }
  50% { filter: drop-shadow(0 0 20px rgba(125, 136, 242, 0.6)); }
}
@keyframes bl-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  25% { transform: translateY(-20px) scale(1.05, 0.95); }
  50% { transform: translateY(0) scale(1); }
  60% { transform: translateY(-10px) scale(1.02, 0.98); }
  75% { transform: translateY(0) scale(1); }
  85% { transform: translateY(-5px) scale(1.01, 0.99); }
}
@keyframes bl-shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25% { transform: translateX(-5px) rotate(-2deg); }
  75% { transform: translateX(5px) rotate(2deg); }
}
@keyframes bl-wave {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-10px) rotate(5deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(10px) rotate(-5deg); }
}
@keyframes bl-engine-plus {
  0%, 25% { opacity: 1; transform: scale(1); }
  35%, 90% { opacity: 0; transform: scale(0.6); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes bl-engine-reveal {
  0%, 25% { opacity: 0; transform: scale(0.6); }
  35%, 85% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.6); }
}
@keyframes bl-engine-fan {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes bl-fade-in-msg {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bl-dot {
  0%, 20% { opacity: 0.2; }
  40% { opacity: 0.5; }
  60% { opacity: 0.8; }
  80%, 100% { opacity: 1; }
}
`;

// Inject keyframes once
let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-bl-keyframes', '');
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
  keyframesInjected = true;
}

// ──────────────────────────────────────────────
// SVG ANIMATION CLASS MAPPING
// ──────────────────────────────────────────────
const SVG_ANIMATION = {
  pulse: 'bl-pulse 2s ease-in-out infinite',
  spin: 'bl-spin 2s linear infinite',
  fan: undefined, // applied to inner .loading-plus group via CSS below
  orbit: 'bl-orbit-pulse 2s ease-in-out infinite',
  breathe: 'bl-breathe 4s ease-in-out infinite',
  bounce: 'bl-bounce 1.5s cubic-bezier(0.28, 0.84, 0.42, 1) infinite',
  shake: 'bl-shake 0.5s ease-in-out infinite',
  wave: 'bl-wave 2s ease-in-out infinite',
  engine: undefined, // handled per-group
};

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export default function BaseLoading({
  size = 'md',
  variant = 'inline',
  animation = 'pulse',
  className = '',
  message = 'Loading...',
  showMessage = true,
  overlay = 'none',
  allowCustomMessage = false,
}) {
  const uid = useId();
  const px = SIZE_MAP[size] || SIZE_MAP.md;

  // Inject keyframes on first render
  React.useEffect(() => { ensureKeyframes(); }, []);

  const useTerse = showMessage && !allowCustomMessage;

  // Container props for variant
  const containerProps = useMemo(() => {
    const base = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4',
      p: '4',
      boxSizing: 'border-box',
    };

    if (variant === 'fullscreen') {
      return {
        ...base,
        position: 'fixed',
        inset: 0,
        w: '100%',
        h: '100%',
        zIndex: 9999,
        p: 0,
      };
    }
    if (variant === 'centered') {
      return { ...base, position: 'relative', w: '100%', minH: '300px' };
    }
    // inline (default)
    return { ...base, position: 'relative', w: '100%', minH: '100px' };
  }, [variant]);

  // Overlay styles
  const overlayProps = useMemo(() => {
    if (overlay === 'light') {
      return {
        bg: { base: 'rgba(255,255,255,0.9)', _dark: 'rgba(26,32,44,0.95)' },
        backdropFilter: 'blur(4px)',
      };
    }
    if (overlay === 'dark') {
      return {
        bg: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      };
    }
    return {};
  }, [overlay]);

  // SVG animation string
  const svgAnim = SVG_ANIMATION[animation];

  // Inner group CSS for animations that target SVG sub-groups
  const innerGroupCss = useMemo(() => {
    if (animation === 'fan') {
      return {
        '& .loading-plus': {
          transformOrigin: 'center',
          animation: 'bl-fan 3s ease-in-out infinite',
        },
      };
    }
    if (animation === 'breathe') {
      return {
        '& .loading-bg': {
          animation: 'bl-breathe-glow 4s ease-in-out infinite',
        },
      };
    }
    if (animation === 'engine') {
      return {
        '& .loading-plus-engine': {
          transformOrigin: '128px 128px',
          animation: 'bl-engine-plus 6s ease-in-out infinite',
        },
        '& .loading-engine': {
          transformOrigin: '128px 128px',
          animation: 'bl-engine-reveal 6s ease-in-out infinite',
        },
        '& .loading-engine-fan': {
          transformOrigin: '128px 128px',
          animation: 'bl-engine-fan 0.7s linear infinite',
        },
      };
    }
    return {};
  }, [animation]);

  // Reduced-motion overrides applied via CSS
  const reducedMotionCss = {
    '@media (prefers-reduced-motion: reduce)': {
      '& svg, & .loading-plus, & .loading-bg, & .loading-orbit-trail, & .loading-plus-engine, & .loading-engine, & .loading-engine-fan': {
        animation: 'none !important',
      },
      '& svg': { opacity: 0.9 },
      '& .loading-orbit-trail': { strokeDasharray: 'none', opacity: 0.3 },
      '& .loading-plus-engine': { opacity: '1 !important', transform: 'scale(1) !important' },
      '& .loading-engine': { opacity: '0 !important' },
    },
  };

  // Message color based on overlay
  const messageColor = overlay === 'dark'
    ? 'white'
    : overlay === 'light'
      ? { base: 'fg', _dark: 'white' }
      : 'fg.muted';

  return (
    <Box
      {...containerProps}
      {...overlayProps}
      className={className || undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message || 'Loading'}
      css={reducedMotionCss}
    >
      {/* Logo + message wrapper */}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap="4"
      >
        {/* Logo container */}
        <Center
          w={{ base: `${MOBILE_SIZE_MAP[size] || px}px`, md: `${px}px` }}
          h={{ base: `${MOBILE_SIZE_MAP[size] || px}px`, md: `${px}px` }}
          css={innerGroupCss}
        >
          <svg
            width="256"
            height="256"
            viewBox="0 0 256 256"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={lang.current.loading?.biensperienceLogo || 'Biensperience logo'}
            style={{
              width: '100%',
              height: '100%',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))',
              willChange: 'transform, opacity',
              animation: svgAnim || undefined,
            }}
          >
            <defs>
              <linearGradient id={`bl-grad-${uid}`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#7d88f2" />
                <stop offset="100%" stopColor="#8a6ccf" />
              </linearGradient>
              <filter id={`bl-shadow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.25" />
              </filter>
              <filter id={`bl-glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id={`bl-orbit-grad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7d88f2" stopOpacity="0" />
                <stop offset="50%" stopColor="#8a6ccf" stopOpacity="1" />
                <stop offset="100%" stopColor="#7d88f2" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Background rectangle */}
            <rect
              x="12" y="12" width="232" height="232"
              rx="46" ry="46"
              fill={`url(#bl-grad-${uid})`}
              filter={`url(#bl-shadow-${uid})`}
              className="loading-bg"
            />

            {animation === 'engine' ? (
              <>
                {/* Plus icon (engine morph) */}
                <g className="loading-plus-engine">
                  <rect x="116" y="72" width="24" height="112" rx="12" ry="12" fill="#ffffff" />
                  <rect x="72" y="116" width="112" height="24" rx="12" ry="12" fill="#ffffff" />
                </g>
                {/* Airplane engine */}
                <g className="loading-engine">
                  <circle cx="128" cy="128" r="48" fill="none" stroke="#ffffff" strokeWidth="10" />
                  <circle cx="128" cy="128" r="36" fill="rgba(255,255,255,0.1)" stroke="#ffffff" strokeWidth="3" />
                  <g className="loading-engine-fan">
                    <g transform="translate(128,128)">
                      <path d="M0,-28 a6,6 0 0 1 6,6 v16 a6,6 0 0 1 -12,0 v-16 a6,6 0 0 1 6,-6z" fill="#ffffff" />
                      <path d="M0,-28 a6,6 0 0 1 6,6 v16 a6,6 0 0 1 -12,0 v-16 a6,6 0 0 1 6,-6z" fill="#ffffff" transform="rotate(120)" />
                      <path d="M0,-28 a6,6 0 0 1 6,6 v16 a6,6 0 0 1 -12,0 v-16 a6,6 0 0 1 6,-6z" fill="#ffffff" transform="rotate(240)" />
                      <circle cx="0" cy="0" r="6" fill="#ffffff" />
                    </g>
                  </g>
                </g>
              </>
            ) : (
              <g className="loading-plus">
                <rect x="116" y="72" width="24" height="112" rx="12" ry="12" fill="#ffffff" />
                <rect x="72" y="116" width="112" height="24" rx="12" ry="12" fill="#ffffff" />
              </g>
            )}

            {/* Orbit trail */}
            {animation === 'orbit' && (
              <circle
                cx="128" cy="128" r="100"
                fill="none"
                stroke={`url(#bl-orbit-grad-${uid})`}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray="50 314"
                className="loading-orbit-trail"
              >
                <animateTransform
                  attributeName="transform" type="rotate"
                  from="0 128 128" to="360 128 128"
                  dur="2s" repeatCount="indefinite"
                />
              </circle>
            )}
          </svg>
        </Center>

        {/* Loading message */}
        {showMessage && (
          <Text
            color={messageColor}
            fontSize="sm"
            fontWeight="medium"
            textAlign="center"
            maxW="300px"
            mt="2"
            css={{
              animation: 'bl-fade-in-msg 0.3s ease-in',
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
              },
            }}
          >
            {useTerse ? (
              <Box as="span" display="inline-flex" alignItems="baseline" gap="0.5">
                Loading
                <Box as="span" display="inline-flex" ml="0.5">
                  <Box as="span" css={{ animation: 'bl-dot 1.2s infinite', animationDelay: '0s', opacity: 0.2 }}>.</Box>
                  <Box as="span" css={{ animation: 'bl-dot 1.2s infinite', animationDelay: '0.2s', opacity: 0.2 }}>.</Box>
                  <Box as="span" css={{ animation: 'bl-dot 1.2s infinite', animationDelay: '0.4s', opacity: 0.2 }}>.</Box>
                </Box>
              </Box>
            ) : (
              message
            )}
          </Text>
        )}
      </Box>
    </Box>
  );
}

BaseLoading.displayName = 'BaseLoading';

BaseLoading.propTypes = {
  /** Size variant */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  /** Display variant */
  variant: PropTypes.oneOf(['inline', 'fullscreen', 'centered']),
  /** Animation type */
  animation: PropTypes.oneOf(['pulse', 'spin', 'fan', 'orbit', 'breathe', 'bounce', 'shake', 'wave', 'engine']),
  /** Additional CSS class name */
  className: PropTypes.string,
  /** Loading message text */
  message: PropTypes.string,
  /** Whether to show the loading message */
  showMessage: PropTypes.bool,
  /** Overlay style */
  overlay: PropTypes.oneOf(['none', 'light', 'dark']),
  /** If false (default), show terse animated ellipsis; if true, show the full message */
  allowCustomMessage: PropTypes.bool,
};
