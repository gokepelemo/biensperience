import "./UsersListDisplay.css";
import UserAvatar from "../UserAvatar/UserAvatar";
import { lang } from "../../lang.constants";
import PropTypes from "prop-types";
import debug from "../../utilities/debug";

/**
 * UsersListDisplay - Reusable component for displaying a list of users with avatars
 * Shows owner + additional users with overlap effect and count message
 * 
 * @param {Object} props - Component props
 * @param {Object} props.owner - Primary user object { _id, name, photo }
 * @param {Array} props.users - Array of additional user objects [{ _id, name, photo }]
 * @param {string} props.messageKey - Key for message in lang.constants (e.g., 'CreatingPlan', 'PlanningExperience')
 * @param {string} props.heading - Custom heading text (defaults to lang.en.heading.collaborators)
 * @param {number} props.maxVisible - Maximum users to show before "+N" badge (default: 7)
 * @param {boolean} props.showMessage - Whether to show count message (default: true)
 * @param {boolean} props.showHeading - Whether to show heading (default: true)
 * @param {string} props.size - Avatar size: 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} props.className - Additional CSS classes
 */
const UsersListDisplay = ({ 
  owner, 
  users = [], 
  messageKey = 'CreatingPlan',
  heading,
  maxVisible = 7,
  showMessage = true,
  showHeading = true,
  size = 'md',
  className = ""
}) => {
  // Debug logging
  debug.log('UsersListDisplay - owner:', owner);
  debug.log('UsersListDisplay - users:', users);

  // Don't render if there's no owner and no users (0 people total)
  if (!owner && (!users || users.length === 0)) {
    return null;
  }

  // If only owner, show single avatar without overlap
  if (users.length === 0 && owner) {
    return (
      <div className={`users-list-display users-list-single ${className}`}>
        {showHeading && (
          <h6 className="mb-2">{heading || lang.en.heading.collaborators}</h6>
        )}
        <UserAvatar user={owner} size={size} />
      </div>
    );
  }

  const totalCount = users.length + (owner ? 1 : 0);
  const remainingCount = Math.max(0, users.length - maxVisible);
  
  // Get singular and plural message keys
  const singularKey = `person${messageKey}`;
  const pluralKey = `people${messageKey}`;
  
  // Get message from lang constants
  const message = totalCount === 1
    ? lang.en.message[singularKey]?.replace('{count}', totalCount)
    : lang.en.message[pluralKey]?.replace('{count}', totalCount);

  return (
    <div className={`users-list-display ${className}`}>
      {showHeading && (
        <h6 className="mb-2">{heading || lang.en.heading.collaborators}</h6>
      )}
      <div className="d-flex align-items-center">
        <div className="users-avatar-stack">
          {/* Owner Avatar */}
          {owner && (
            <UserAvatar 
              user={owner} 
              size={size}
              className="stacked-avatar"
            />
          )}
          
          {/* Additional User Avatars */}
          {users.slice(0, maxVisible).map((user, idx) => (
            <UserAvatar 
              key={user._id || idx}
              user={user} 
              size={size}
              className="stacked-avatar"
            />
          ))}
          
          {/* +N Badge */}
          {remainingCount > 0 && (
            <div 
              className={`user-avatar user-avatar-${size} avatar-more stacked-avatar`}
              title={`${remainingCount} more`}
            >
              <div className="avatar-initials">+{remainingCount}</div>
            </div>
          )}
        </div>
        
        {/* Count Message */}
        {showMessage && message && (
          <div className="ms-3">
            <p className="mb-0 text-muted small">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
};

UsersListDisplay.propTypes = {
  owner: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string.isRequired,
    photo: PropTypes.string,
  }),
  users: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string.isRequired,
      photo: PropTypes.string,
    })
  ),
  messageKey: PropTypes.string,
  heading: PropTypes.string,
  maxVisible: PropTypes.number,
  showMessage: PropTypes.bool,
  showHeading: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  className: PropTypes.string,
};

export default UsersListDisplay;
