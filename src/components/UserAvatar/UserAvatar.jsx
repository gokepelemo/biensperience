import { useState, useEffect } from "react";
import styles from "./UserAvatar.module.scss";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import DOMPurify from "dompurify";
import debug from "../../utilities/debug";
import EntitySchema from "../OpenGraph/EntitySchema";
import { resolveAvatarUrl, fetchAvatarUrl } from "../../utilities/avatar-cache";
import { eventBus } from "../../utilities/event-bus";
import AvatarRenderer from "./AvatarRenderer";

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
 * Sanitize a URL for safe use in img src attribute
 * Uses DOMPurify to prevent XSS via javascript:, data:, or other dangerous protocols
 *
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if unsafe
 */
function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmedUrl = url.trim();

  // Block dangerous protocols before sanitization
  const lowerUrl = trimmedUrl.toLowerCase();
  if (lowerUrl.startsWith('javascript:') ||
      lowerUrl.startsWith('data:') ||
      lowerUrl.startsWith('vbscript:')) {
    return null;
  }

  // Only allow http:, https:, and relative URLs
  if (!lowerUrl.startsWith('http://') &&
      !lowerUrl.startsWith('https://') &&
      !lowerUrl.startsWith('/') &&
      lowerUrl.includes(':')) {
    return null;
  }

  // Use DOMPurify to sanitize the URL.
  // RETURN_DOM_FRAGMENT avoids DOMPurify treating the string as HTML
  // (which would encode & as &amp; in query params, breaking S3 URLs).
  // With ALLOWED_TAGS:[] it strips any HTML — a plain URL string passes
  // through unchanged.
  const sanitized = DOMPurify.sanitize(trimmedUrl, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });

  // DOMPurify may entity-encode ampersands in URLs (& → &amp;).
  // Decode entities before comparing so valid URLs with query params
  // are not rejected.
  const decoded = sanitized.replace(/&amp;/g, '&');

  // Return null if DOMPurify removed meaningful content
  if (!decoded || decoded !== trimmedUrl) {
    return null;
  }

  return trimmedUrl;
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
 * @param {boolean} props.isOnline - Whether user is currently online (shows green border)
 * @param {boolean} props.showPresence - Whether to show presence indicator (default: false)
 */
const UserAvatar = ({
  user,
  size = 'md',
  linkToProfile = true,
  className = "",
  onClick,
  title,
  includeSchema = false,
  isOnline = false,
  showPresence = false
}) => {
  if (!user) return null;

  debug.log('UserAvatar - user:', user);
  debug.log('UserAvatar - user.name:', user.name);
  debug.log('UserAvatar - user.photos:', user.photos);
  debug.log('UserAvatar - user.default_photo_id:', user.default_photo_id);

  // Resolve avatar URL via the shared cache (O(1) Map lookup on re-renders).
  // If the user object has photo data, the URL is resolved and cached immediately.
  // If not, it returns null and the lazy fetch below handles it.
  const resolvedUrl = resolveAvatarUrl(user);

  // Lazy fetch: when the user object has an _id but no resolvable photo data,
  // fetch the avatar URL from the lightweight /api/users/avatars endpoint.
  // Multiple UserAvatar instances in the same render cycle are batched into
  // a single API request via microtask batching in avatar-cache.js.
  const [lazyUrl, setLazyUrl] = useState(null);
  const [fetchDone, setFetchDone] = useState(false);

  // Version counter bumped when the avatar cache is invalidated for this user.
  // Adding it to the fetch effect deps forces a re-fetch even when the other
  // deps (resolvedUrl, user._id) haven't changed.
  const [fetchVersion, setFetchVersion] = useState(0);

  // Subscribe to avatar:changed events so already-mounted components
  // re-fetch when a photo is uploaded/deleted or the user record changes.
  useEffect(() => {
    if (!user?._id) return;
    const userId = user._id.toString();
    const unsub = eventBus.subscribe('avatar:changed', (event) => {
      if (event?.userId?.toString() === userId) {
        setLazyUrl(null);
        setFetchDone(false);
        setFetchVersion(v => v + 1);
      }
    });
    return unsub;
  }, [user?._id]);

  useEffect(() => {
    if (resolvedUrl !== null || !user?._id) {
      if (lazyUrl !== null) setLazyUrl(null);
      setFetchDone(false);
      return;
    }

    let cancelled = false;
    fetchAvatarUrl(user._id).then(url => {
      if (!cancelled) {
        if (url) setLazyUrl(url);
        setFetchDone(true);
      }
    });
    return () => { cancelled = true; };
  }, [resolvedUrl, user?._id, fetchVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const photoUrl = resolvedUrl || lazyUrl;
  debug.log('UserAvatar - photoUrl:', photoUrl);

  const safePhotoUrl = sanitizeImageUrl(photoUrl);
  const sanitizedName = sanitizeText(user.name || '');
  const avatarTitle = sanitizeText(title || user.name || '');

  // Still resolving the avatar URL (cache miss + lazy fetch in flight)
  const isResolving = resolvedUrl === null && lazyUrl === null && !fetchDone && !!user?._id;

  const avatarProps = {
    src: safePhotoUrl || undefined,
    name: sanitizedName,
    size,
    showPresence,
    isOnline,
    title: avatarTitle,
    loading: isResolving,
  };

  if (linkToProfile && user._id) {
    return (
      <>
        <Link
          to={`/profile/${user._id}`}
          className={`${styles.avatarLink} ${className}`.trim()}
          title={avatarTitle}
          onClick={onClick}
        >
          <AvatarRenderer {...avatarProps} />
        </Link>
        {includeSchema && user && (
          <EntitySchema entity={user} entityType="user" />
        )}
      </>
    );
  }

  return (
    <>
      <AvatarRenderer {...avatarProps} className={className} onClick={onClick} />
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
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', 'profile']),
  linkToProfile: PropTypes.bool,
  className: PropTypes.string,
  onClick: PropTypes.func,
  title: PropTypes.string,
  includeSchema: PropTypes.bool,
  isOnline: PropTypes.bool,
  showPresence: PropTypes.bool,
};

export default UserAvatar;
