import React, { cloneElement, isValidElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeHash, parseHash, scrollToElement, clearStoredHash } from '../../utilities/hash-navigation';

/**
 * HashLink - A component that handles hash-based deep linking
 *
 * Solves React Router's hash stripping limitation by:
 * 1. Detecting hash fragments in the target URL
 * 2. Storing hash in sessionStorage before navigation
 * 3. Navigating without the hash (so React Router doesn't strip it)
 * 4. Hash is restored on destination component mount
 *
 * @param {Object} props
 * @param {string} props.to - Destination URL (can include hash fragment)
 * @param {function} props.onClick - Optional click handler
 * @param {React.ReactNode} props.children - Link content
 * @param {string} props.className - CSS classes
 * @param {Object} props.style - Inline styles
 * @param {boolean} props.disabled - Whether the link is disabled
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
 * // With custom styling
 * <HashLink
 *   to="/experiences/123#plan-456"
 *   style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}
 * >
 *   View Plan
 * </HashLink>
 */
export default function HashLink({
  to,
  onClick,
  children,
  className = '',
  style = {},
  disabled = false,
  activitySource, // Extract to prevent passing to DOM
  shouldShake,    // Extract to prevent passing to DOM
  ...props        // Remaining props safe for DOM
}) {
  const navigate = useNavigate();

  const handleClick = (e) => {
    try {
      if (disabled) {
        e.preventDefault();
        return;
      }

      e.preventDefault();

      // Call custom onClick handler if provided. If it returns `false`
      // explicitly, treat that as a signal to abort navigation. We no longer
      // rely on `e.defaultPrevented` because other libraries sometimes set it
      // unexpectedly.
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
        try {
          // parsed URL
        } catch (err) {}
        const path = `${parsed.pathname}${parsed.search || ''}`;
        const cleanHash = parsed.hash || '';

        // If there's a hash, store it for destination handling
        if (cleanHash) {
          // Allow callers to pass metadata (e.g., activitySource or shouldShake)
          const meta = {};
          if (activitySource) meta.activitySource = activitySource;
          if (shouldShake) meta.shouldShake = true;

          try {
            storeHash(cleanHash, window.location.pathname, Object.keys(meta).length ? meta : null);
            console.log('[HashLink] ✅ Stored hash for cross-navigation:', {
              hash: cleanHash,
              originPath: window.location.pathname,
              targetPath: path,
              meta
            });
          } catch (err) {
            console.error('[HashLink] ❌ Failed to store hash:', err);
            try { storeHash(cleanHash, null, Object.keys(meta).length ? meta : null); } catch (e) { storeHash(cleanHash); }
          }
        }

        // If target origin differs, do a full navigation
        if (parsed.origin !== window.location.origin) {
          window.location.href = to;
          return;
        }

        // Same-origin: if path equals current path, update hash and scroll immediately
        const currentPath = window.location.pathname + (window.location.search || '');
        if (path === currentPath && cleanHash) {
          const newUrl = `${path}${cleanHash}`;
          if (window.location.href !== newUrl) {
            window.history.pushState(null, '', newUrl);
          }

          const { planId, itemId } = parseHash(cleanHash);
          const elementId = planId ? (itemId ? `plan-${planId}-item-${itemId}` : `plan-${planId}`) : null;
          if (elementId) scrollToElement(elementId, true);

          clearStoredHash();
          return;
        }

        // Otherwise navigate using React Router to the same-origin path
        try {
          // navigate
        } catch (err) {}
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
        // If URL parsing fails, fall back to navigate/to string behavior
      }
    }

    } catch (err) {
      // Fallback: attempt to navigate directly
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
