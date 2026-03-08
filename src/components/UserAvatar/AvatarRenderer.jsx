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

import { forwardRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Avatar } from '@chakra-ui/react';
import styles from './UserAvatar.module.scss';

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

  // Reset loaded/error state when src changes, but skip the skeleton
  // if we've already loaded this URL before.
  useEffect(() => {
    setImgLoaded(isImageLoaded(src));
    setImgError(false);
  }, [src]);

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
          src={src}
          alt={name || 'User avatar'}
          onLoad={() => { markImageLoaded(src); setImgLoaded(true); }}
          onError={() => { loadedImages.delete(src); setImgError(true); }}
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
