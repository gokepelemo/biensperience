import "./UserAvatar.css";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import debug from "../../utilities/debug";
import EntitySchema from "../OpenGraph/EntitySchema";

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

  const avatarContent = (
    <>
      {photoUrl ? (
        <img src={photoUrl} alt={user.name} />
      ) : (
        <div className="avatar-initials">
          {user.name?.charAt(0).toUpperCase()}
        </div>
      )}
    </>
  );

  const avatarClasses = `user-avatar user-avatar-${size} ${className}`;
  const avatarTitle = title || user.name;

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
