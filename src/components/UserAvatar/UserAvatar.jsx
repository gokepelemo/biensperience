import styles from "./UserAvatar.module.scss";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import debug from "../../utilities/debug";
import EntitySchema from "../OpenGraph/EntitySchema";

/**
 * Ensure a string is safe for use in DOM attributes and text nodes
 * Strips leading/trailing whitespace and converts to string. Does not allow HTML tags.
 */
function sanitizeText(text) {
  if (!text && text !== 0) return '';
  try {
    // Convert to string and remove surrounding whitespace
    const s = String(text).trim();
    // Remove angle brackets to avoid accidental HTML-like values
    return s.replace(/[<>]/g, '');
  } catch (e) {
    return '';
  }
}

/**
 * Validate that a URL is safe for use in img src attribute
 * Prevents XSS via javascript:, data:, or other dangerous protocols
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is safe
 */
function isSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // Only allow http:, https:, and relative URLs
  const trimmedUrl = url.trim().toLowerCase();
  if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('/')) {
    return true;
  }

  // Block dangerous protocols
  if (trimmedUrl.startsWith('javascript:') ||
      trimmedUrl.startsWith('data:') ||
      trimmedUrl.startsWith('vbscript:')) {
    return false;
  }

  // Allow relative URLs without protocol
  if (!trimmedUrl.includes(':')) {
    return true;
  }

  return false;
}

/**
 * UserAvatar - Reusable component for displaying a single user's avatar
 *
 * @param {Object} props - Component props
 * @param {Object} props.user - User object { _id, name, photo }
 * @param {string} props.size - Avatar size: 'sm' (32px), 'md' (40px), 'lg' (48px), 'xl' (64px)
 * @param {boolean} props.linkToProfile - Whether to make avatar a link to profile (default: true)
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onClick - Optional click handler
 * @param {string} props.title - Optional tooltip text (defaults to user.name)
 * @param {boolean} props.includeSchema - Whether to include schema.org markup (default: false)
 */
const UserAvatar = ({
  user,
  size = 'md',
  linkToProfile = true,
  className = "",
  onClick,
  title,
  includeSchema = false
}) => {
  if (!user) return null;

  debug.log('UserAvatar - user:', user);
  debug.log('UserAvatar - user.name:', user.name);
  debug.log('UserAvatar - user.photo:', user.photo);

  // Helper function to get photo URL from photos array
  const getPhotoUrl = (user) => {
    // If using photos array with default_photo_index
    if (user.photos && user.photos.length > 0) {
      const photoIndex = user.default_photo_index || 0;
      const photo = user.photos[photoIndex];
      if (photo && photo.url) {
        return photo.url;
      }
    }

    return null;
  };

  const photoUrl = getPhotoUrl(user);
  debug.log('UserAvatar - photoUrl:', photoUrl);

  const safePhotoUrl = isSafeImageUrl(photoUrl) ? photoUrl : null;
  const sanitizedName = sanitizeText(user.name || '');

  const avatarContent = (
    <>
      {safePhotoUrl ? (
        <img src={safePhotoUrl} alt={sanitizedName || 'User avatar'} />
      ) : (
        <div className={styles.avatarInitials}>
          {sanitizedName ? sanitizedName.charAt(0).toUpperCase() : ''}
        </div>
      )}
    </>
  );

  const sizeClass = styles[`userAvatar${size.charAt(0).toUpperCase() + size.slice(1)}`];
  const avatarClasses = `${styles.userAvatar} ${sizeClass} ${className}`;
  const avatarTitle = sanitizeText(title || user.name || '');

  if (linkToProfile && user._id) {
    return (
      <>
        <Link
          to={`/profile/${user._id}`}
          className={avatarClasses}
          title={avatarTitle}
          onClick={onClick}
        >
          {avatarContent}
        </Link>
        {includeSchema && user && (
          <EntitySchema entity={user} entityType="user" />
        )}
      </>
    );
  }

  return (
    <>
      <div
        className={avatarClasses}
        title={avatarTitle}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {avatarContent}
      </div>
      {includeSchema && user && (
        <EntitySchema entity={user} entityType="user" />
      )}
    </>
  );
};

UserAvatar.propTypes = {
  user: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string.isRequired,
    photo: PropTypes.string,
  }),
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  linkToProfile: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func,
  title: PropTypes.string,
  includeSchema: PropTypes.bool,
};

export default UserAvatar;
