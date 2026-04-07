/**
 * AvatarRenderer - Design System Avatar Implementation
 *
 * Drop-in replacement for the custom UserAvatar rendering layer.
 * Uses Avatar primitives (Avatar.Root, Avatar.Image,
 * Avatar.Fallback) while preserving the existing SCSS Module styles
 * for sizing and the WebSocket presence indicator (green/gray border).
 *
 * Benefits:
 * - Built-in image loading state machine (loading → loaded | error)
 * - Automatic initial-letter fallback via Avatar.Fallback name prop
 * - Consistent ARIA semantics (role="img", aria-label)
 * - Status change callback (onStatusChange)
 *
 * Existing behaviour preserved:
 * - All five size classes (xs / sm / md / lg / xl) via CSS Modules
 * - Presence ring (green = online, gray = offline) via CSS Modules
 * - Hover lift animation
 * - Link-to-profile wrapping (handled by parent UserAvatar)
 */

<<<<<<< Updated upstream
import { forwardRef, useState, useEffect, useCallback } from 'react';
=======
import { forwardRef, useState, useEffect, useRef } from 'react';
>>>>>>> Stashed changes
import PropTypes from 'prop-types';
import { Avatar } from '@chakra-ui/react';
import styles from './UserAvatar.module.css';

// ── Image-load cache ──────────────────────────────────────────────
// Module-level Set of image URLs that have successfully loaded in this
// session. Persists across component mounts so re-rendered avatars
// whose images are already in the browser cache skip the skeleton.
const loadedImages = new Set();
const MAX_LOADED_CACHE = 500;

function markImageLoaded(url) {
  if (!url) return;
  if (loadedImages.size >= MAX_LOADED_CACHE) {
    const first = loadedImages.values().next().value;
    loadedImages.delete(first);
  }
  loadedImages.add(url);
}

function isImageLoaded(url) {
  return !!url && loadedImages.has(url);
}

// If an image hasn't loaded or errored within this time, treat it as failed
// and show the initials fallback instead of an infinite skeleton.
const IMG_LOAD_TIMEOUT_MS = 8000;

/**
 * AvatarRenderer – renders the visual avatar element using Avatar primitives.
 *
 * This is the *inner* rendering component. Wrapping with <Link>, schema markup,
 * and business logic (URL resolution, lazy-fetching) remain in UserAvatar.jsx.
 *
 * @param {Object}  props
 * @param {string}  [props.src]           – Sanitized image URL
 * @param {string}  [props.name]          – User display name (used for initials fallback)
 * @param {string}  [props.size='md']     – Avatar size: xs | sm | md | lg | xl
 * @param {boolean} [props.showPresence]  – Whether to render the presence dot
 * @param {boolean} [props.isOnline]      – Online status (green vs gray dot)
 * @param {string}  [props.className]     – Extra CSS class names
 * @param {string}  [props.title]         – Tooltip / title text
 * @param {Function} [props.onClick]      – Click handler
 * @param {boolean} [props.loading]       – Whether the avatar URL is still being resolved
 */
const AvatarRenderer = forwardRef(function AvatarRenderer(
  {
    src,
    name = '',
    size = 'md',
    showPresence = false,
    isOnline = false,
    className = '',
    title,
    onClick,
    loading = false,
    ...rest
  },
  ref,
) {
  // Track whether the <img> has finished loading to avoid showing
  // initials while the browser fetches the image.
  // Initialise to true when the URL is already in our loaded-images cache.
  const [imgLoaded, setImgLoaded] = useState(() => isImageLoaded(src));
  // Track image load failures so we can immediately fall back to initials
  const [imgError, setImgError] = useState(false);
  const timeoutRef = useRef(null);

  // Reset loaded/error state when src changes, but skip the skeleton
  // if we've already loaded this URL before.
  useEffect(() => {
    setImgLoaded(isImageLoaded(src));
    setImgError(false);

    // Clear any previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // If there's a src, start a timeout so we don't show a skeleton forever
    // when the image request hangs without firing onLoad or onError.
    if (src) {
      timeoutRef.current = setTimeout(() => {
        setImgError(true);
      }, IMG_LOAD_TIMEOUT_MS);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [src]);

  // Ref callback to handle images that load from browser cache before
  // React attaches the onLoad handler — img.complete is already true,
  // but onLoad never fires, leaving the image hidden behind the skeleton.
  const imgRefCallback = useCallback((imgEl) => {
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0 && !imgError) {
      markImageLoaded(src);
      setImgLoaded(true);
    }
  }, [src, imgError]);

  // Show skeleton when: URL is still being resolved OR image is in flight (not loaded and not errored)
  const showSkeleton = loading || (src && !imgLoaded && !imgError);
  // Show initials fallback when not loading and either no src or the image failed
  const showFallback = !showSkeleton && (!src || imgError);
  const sizeClass =
    styles[`userAvatar${size.charAt(0).toUpperCase() + size.slice(1)}`] || '';
  const presenceClass = showPresence
    ? isOnline
      ? styles.presenceOnline
      : styles.presenceOffline
    : '';

  const rootClasses =
    `${styles.userAvatar} ${sizeClass} ${presenceClass} ${className}`.trim();

  return (
    <Avatar.Root
      ref={ref}
      /* Do NOT pass size — Chakra's recipe sizing fights with SCSS module classes.
         Our SCSS .userAvatarSm / .userAvatarMd / etc. are the sole source of width & height. */
      className={rootClasses}
      title={title}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      /* Use unstyled to disable all Chakra recipe styling.
         This replaces the previous fragile data-scope/data-part CSS selectors
         and ensures our SCSS modules are the sole source of visual styling. */
      unstyled
      css={{
        width: 'var(--user-avatar-size)',
        height: 'var(--user-avatar-size)',
        borderRadius: '50%',
        overflow: 'hidden',
        '& img': {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '50%',
        },
        '& span': {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          color: 'white',
          fontWeight: 'var(--font-weight-semibold)',
          textTransform: 'uppercase',
          fontSize: 'calc(var(--user-avatar-size, 40px) * 0.4)',
          lineHeight: 1,
        },
      }}
      {...rest}
    >
      {/* Skeleton: shown while URL is resolving or image is loading */}
      {showSkeleton && (
        <span className={styles.avatarSkeleton} aria-hidden="true" />
      )}
      {/* Initials fallback: shown when no image is available or image failed to load */}
      {showFallback && (
        <Avatar.Fallback name={name}>
          {/* Chakra auto-generates initials from name */}
        </Avatar.Fallback>
      )}
      {/* Use a plain <img> to avoid Chakra's internal state machine
          which can briefly flash initials before the image loads.
          The img is hidden until onLoad fires, while the skeleton covers it. */}
      {src && !imgError && (
        <img
          ref={imgRefCallback}
          src={src}
          alt={name || 'User avatar'}
<<<<<<< Updated upstream
          referrerPolicy="no-referrer"
          onLoad={() => { markImageLoaded(src); setImgLoaded(true); }}
          onError={() => { loadedImages.delete(src); setImgError(true); }}
=======
          onLoad={() => {
            if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
            setImgLoaded(true);
          }}
          onError={() => {
            if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
            setImgError(true);
          }}
>>>>>>> Stashed changes
          style={{
            position: imgLoaded ? 'static' : 'absolute',
            opacity: imgLoaded ? 1 : 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
          }}
        />
      )}
    </Avatar.Root>
  );
});

AvatarRenderer.displayName = 'AvatarRenderer';

AvatarRenderer.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', 'profile']),
  showPresence: PropTypes.bool,
  isOnline: PropTypes.bool,
  className: PropTypes.string,
  title: PropTypes.string,
  onClick: PropTypes.func,
  loading: PropTypes.bool,
};

export default AvatarRenderer;
