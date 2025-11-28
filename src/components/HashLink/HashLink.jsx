import React, { cloneElement, isValidElement } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useNavigationIntent, INTENT_TYPES } from '../../contexts/NavigationIntentContext';
import { parseHash } from '../../utilities/hash-navigation';
import { logger } from '../../utilities/logger';

/**
 * HashLink - A component that handles hash-based deep linking
 *
 * Uses NavigationIntentContext to manage navigation intent instead of localStorage.
 * The destination component (e.g., SingleExperience) consumes the intent and
 * handles scroll/highlight animations.
 *
 * @param {Object} props
 * @param {string} props.to - Destination URL (can include hash fragment)
 * @param {function} props.onClick - Optional click handler
 * @param {React.ReactNode} props.children - Link content
 * @param {string} props.className - CSS classes
 * @param {Object} props.style - Inline styles
 * @param {boolean} props.disabled - Whether the link is disabled
 * @param {boolean} props.shouldShake - Whether to trigger highlight animation (default: true)
 *
 * @example
 * // Link to plan
 * <HashLink to="/experiences/123#plan-456">View Plan</HashLink>
 *
 * @example
 * // Link to plan item
 * <HashLink to="/experiences/123#plan-456-item-789">View Item</HashLink>
 *
 * @example
 * // Without highlight animation
 * <HashLink to="/experiences/123#plan-456" shouldShake={false}>View Plan</HashLink>
 */
export default function HashLink({
  to,
  onClick,
  children,
  className = '',
  style = {},
  disabled = false,
  activitySource, // Extract to prevent passing to DOM (kept for backward compat)
  shouldShake = true, // Whether to trigger highlight animation
  ...props        // Remaining props safe for DOM
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { createIntent } = useNavigationIntent();

  const handleClick = (e) => {
    try {
      if (disabled) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      // Call custom onClick handler if provided
      // If it returns `false` explicitly, abort navigation
      let handlerResult;
      if (onClick) {
        try { handlerResult = onClick(e); } catch (err) { /* ignore */ }
      }
      if (handlerResult === false) {
        return;
      }

      // Normalize target string (trim accidental whitespace)
      const target = typeof to === 'string' ? to.trim() : to;

      // Parse the target URL (handles absolute URLs and relative paths)
      if (target) {
        try {
          const parsed = new URL(target, window.location.origin);
          const path = `${parsed.pathname}${parsed.search || ''}`;
          const cleanHash = parsed.hash || '';

          // If target origin differs, do a full navigation
          if (parsed.origin !== window.location.origin) {
            window.location.href = to;
            return;
          }

          // Determine current path for comparison
          const currentPath = location.pathname + (location.search || '');
          const isSamePage = path === currentPath;

          // If there's a hash, create navigation intent
          if (cleanHash) {
            const { planId, itemId } = parseHash(cleanHash);

            if (planId) {
              // Determine intent type based on navigation
              const intentType = isSamePage ? INTENT_TYPES.SAME_PAGE : INTENT_TYPES.CROSS_VIEW;

              // Create intent (destination component will handle scroll/highlight)
              createIntent(intentType, planId, itemId, shouldShake);

              logger.debug('[HashLink] Created navigation intent:', {
                type: intentType,
                planId,
                itemId,
                shouldShake,
                isSamePage,
                path
              });
            }

            // For same-page navigation, update URL hash and let intent consumer handle scroll
            if (isSamePage) {
              const newUrl = `${path}${cleanHash}`;
              if (window.location.href !== newUrl) {
                window.history.pushState(null, '', newUrl);
              }
              // Intent already created, consumer will handle it
              return;
            }
          }

          // Navigate using React Router for cross-page navigation
          navigate(path);

          // Safety fallback: if React Router didn't change location within a short time,
          // perform a full navigation to ensure the user reaches the target.
          setTimeout(() => {
            try {
              if ((window.location.pathname + (window.location.search || '')) !== path) {
                window.location.href = path + (cleanHash || '');
              }
            } catch (err) {
              // ignore
            }
          }, 200);
          return;
        } catch (err) {
          logger.warn('[HashLink] URL parsing failed, falling back to direct navigation:', err);
        }
      }

    } catch (err) {
      // Fallback: attempt to navigate directly
      logger.error('[HashLink] Error in handleClick:', err);
      try { navigate(to); } catch (e) { window.location.href = to; }
    }
  };

  return (
    // If the child is a single interactive element (e.g., react-bootstrap Button),
    // clone it and inject our click handler to avoid nesting <button> inside <a>.
    isValidElement(children)
      ? cloneElement(children, {
          onClick: (e) => {
            try {
              handleClick(e);
            } catch (err) {
              // swallow
            }

            // Call child's original handler if it exists
            try {
              if (children.props && typeof children.props.onClick === 'function') {
                children.props.onClick(e);
              }
            } catch (err) {
              // ignore
            }
          },
          className: [children.props?.className, className].filter(Boolean).join(' '),
          style: { cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, textDecoration: 'none', ...(children.props?.style || {}), ...style },
          disabled: disabled || children.props?.disabled,
          ...props
        })
      : (
        <a
          href={to}
          onClick={handleClick}
          className={className}
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            textDecoration: 'none',
            ...style
          }}
          {...props}
        >
          {children}
        </a>
      )
  );
}
