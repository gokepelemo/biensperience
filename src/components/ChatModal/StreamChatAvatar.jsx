/**
 * StreamChatAvatar - Custom avatar for Stream Chat that uses the app's AvatarRenderer.
 *
 * Stream Chat's default Avatar component has its own styling and loading behaviour.
 * This wrapper ensures chat avatars look identical to the rest of the application
 * (same skeleton shimmer, same initials fallback, same sizing).
 *
 * Avatars link to the user's profile page when a user object with an id is available.
 *
 * Stream Chat passes: { image, name, size (px number), user, onClick, onMouseOver }
 */

import { Link } from 'react-router-dom';
import AvatarRenderer from '../UserAvatar/AvatarRenderer';

/**
 * Map a Stream Chat numeric pixel size to our design-system size token.
 */
function toSizeToken(px) {
  if (typeof px !== 'number') return 'sm';
  if (px <= 24) return 'xs';
  if (px <= 32) return 'sm';
  if (px <= 40) return 'md';
  if (px <= 48) return 'lg';
  return 'xl';
}

export default function StreamChatAvatar({ image, name, size, user, onClick, onMouseOver }) {
  const avatar = (
    <AvatarRenderer
      src={image || undefined}
      name={name || ''}
      size={toSizeToken(size)}
      onClick={onClick}
      onMouseOver={onMouseOver}
    />
  );

  if (user?.id) {
    return (
      <Link to={`/profile/${user.id}`} title={name || 'View profile'} style={{ lineHeight: 0 }}>
        {avatar}
      </Link>
    );
  }

  return avatar;
}
