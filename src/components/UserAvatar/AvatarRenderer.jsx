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

import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Avatar } from '@chakra-ui/react';
import styles from './UserAvatar.module.scss';

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
    ...rest
  },
  ref,
) {
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
      <Avatar.Fallback name={name}>
        {/* Chakra auto-generates initials from name */}
      </Avatar.Fallback>
      <Avatar.Image src={src} alt={name || 'User avatar'} />
    </Avatar.Root>
  );
});

AvatarRenderer.displayName = 'AvatarRenderer';

AvatarRenderer.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  showPresence: PropTypes.bool,
  isOnline: PropTypes.bool,
  className: PropTypes.string,
  title: PropTypes.string,
  onClick: PropTypes.func,
};

export default AvatarRenderer;
