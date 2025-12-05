import styles from "./UsersListDisplay.module.scss";
import UserAvatar from "../UserAvatar/UserAvatar";
import { lang } from "../../lang.constants";
import PropTypes from "prop-types";

/**
 * UsersListDisplay - Reusable component for displaying a list of users with avatars
 * Shows owner + additional users with overlap effect and count message
 *
 * @param {Object} props - Component props
 * @param {Object} props.owner - Primary user object { _id, name, photo }
 * @param {Array} props.users - Array of additional user objects [{ _id, name, photo }]
 * @param {string} props.messageKey - Key for message in lang.constants (e.g., 'CreatingPlan', 'PlanningExperience')
 * @param {string} props.heading - Custom heading text (defaults to lang.current.heading.collaborators)
 * @param {number} props.maxVisible - Maximum users to show before "+N" badge (default: 7)
 * @param {boolean} props.showMessage - Whether to show count message (default: true)
 * @param {boolean} props.showHeading - Whether to show heading (default: true)
 * @param {string} props.size - Avatar size: 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.loading - Whether data is still loading (reserves space)
 * @param {boolean} props.reserveSpace - Whether to reserve space when no users (default: false)
 * @param {Set|Array} props.onlineUserIds - Set or array of user IDs that are currently online
 * @param {boolean} props.showPresence - Whether to show presence indicators (default: false)
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
  className = "",
  loading = false,
  reserveSpace = false,
  onlineUserIds = null,
  showPresence = false
}) => {
  // Helper to check if a user is online
  const isUserOnline = (userId) => {
    if (!showPresence || !onlineUserIds || !userId) return false;
    if (onlineUserIds instanceof Set) {
      return onlineUserIds.has(userId.toString());
    }
    if (Array.isArray(onlineUserIds)) {
      return onlineUserIds.some(id => id?.toString() === userId?.toString());
    }
    return false;
  };
  // Reserve space if requested and no users (and not loading)
  if (!loading && reserveSpace && !owner && (!users || users.length === 0)) {
    return (
      <div className={`${styles.usersListDisplay} ${className}`} style={{ minHeight: '40px', minWidth: '200px' }}>
        {/* Always show heading to prevent layout shift */}
        <h6 className="mb-2">{heading || lang.current.heading.collaborators}</h6>
      </div>
    );
  }

  // Don't render if there's no owner and no users (0 people total) and not loading
  if (!loading && !owner && (!users || users.length === 0)) {
    return null;
  }

  // If only owner, show single avatar without overlap (and not loading)
  if (!loading && users.length === 0 && owner) {
    return (
      <div className={`${styles.usersListDisplay} ${styles.usersListSingle} ${className}`}>
        {showHeading && (
          <h6 className="mb-2">{heading || lang.current.heading.collaborators}</h6>
        )}
        <UserAvatar
          user={owner}
          size={size}
          showPresence={showPresence}
          isOnline={isUserOnline(owner._id)}
        />
      </div>
    );
  }

  // Calculate expected count for loading placeholders
  const expectedCount = loading ? Math.max(1, (users?.length || 0) + (owner ? 1 : 0)) : (users?.length || 0) + (owner ? 1 : 0);
  const totalCount = expectedCount;
  const remainingCount = Math.max(0, expectedCount - maxVisible);
  
  // Get singular and plural message keys
  const singularKey = `person${messageKey}`;
  const pluralKey = `people${messageKey}`;

  // Get message from lang constants
  const message = loading
    ? "Loading..." // Show loading message when loading
    : totalCount === 1
    ? lang.current.message[singularKey]?.replace('{count}', totalCount)
    : lang.current.message[pluralKey]?.replace('{count}', totalCount);

  return (
    <div className={`${styles.usersListDisplay} ${className}`}>
      {showHeading && (
        <h6 className="mb-2">{heading || lang.current.heading.collaborators}</h6>
      )}

      {/* Loading State: Show only "Loading..." text with animated dots */}
      {loading ? (
        <div className="d-flex align-items-center" style={{ minHeight: '44px' }}>
          <p className="mb-0 text-muted small">
            Loading
            <span className={styles.animatedDots} aria-hidden="true">
              <span className={styles.dot} />
              <span className={styles.dot} />
              <span className={styles.dot} />
            </span>
            <span className="visually-hidden"> Loading</span>
          </p>
        </div>
      ) : (
        <div className="d-flex align-items-center">
          <div className={styles.usersAvatarStack}>
            {/* Owner Avatar */}
            {owner && (
              <UserAvatar
                user={owner}
                size={size}
                className="stacked-avatar"
                showPresence={showPresence}
                isOnline={isUserOnline(owner._id)}
              />
            )}

            {/* Additional User Avatars */}
            {users.slice(0, maxVisible).map((user, idx) => (
              <UserAvatar
                key={user._id || idx}
                user={user}
                size={size}
                className="stacked-avatar"
                showPresence={showPresence}
                isOnline={isUserOnline(user._id)}
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
      )}
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
  loading: PropTypes.bool,
  reserveSpace: PropTypes.bool,
  onlineUserIds: PropTypes.oneOfType([
    PropTypes.instanceOf(Set),
    PropTypes.arrayOf(PropTypes.string),
  ]),
  showPresence: PropTypes.bool,
};

export default UsersListDisplay;
