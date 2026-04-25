import React from 'react';
import PropTypes from 'prop-types';
import { FaBell } from 'react-icons/fa';
import { Text } from '../design-system';
import styles from './BienBotPanel.module.css';

function NotificationItem({ notification, onView, onViewSession }) {
  const message = notification.reason ||
    `${notification.actor?.name || 'Someone'} added you as a collaborator to ${notification.resource?.name || 'an experience'}`;
  const resourceId = notification.resource?.id || notification.resource?._id;
  const isBienBotSession = notification.resource?.type === 'BienBotSession';

  return (
    <div className={styles.notificationItem}>
      <span className={styles.notificationIcon} aria-hidden="true">
        <FaBell size={14} />
      </span>
      <div className={styles.notificationContent}>
        <Text size="sm">{message}</Text>
        {resourceId && !isBienBotSession && (
          <button
            type="button"
            className={styles.notificationViewButton}
            onClick={() => onView(resourceId, notification._id)}
          >
            View
          </button>
        )}
        {isBienBotSession && resourceId && (
          <button
            type="button"
            className={styles.notificationViewButton}
            onClick={() => onViewSession?.(resourceId, notification._id)}
          >
            View session
          </button>
        )}
        {isBienBotSession && !resourceId && (
          <button
            type="button"
            className={styles.notificationViewButton}
            onClick={() => onView(null, notification._id)}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    _id: PropTypes.string,
    reason: PropTypes.string,
    actor: PropTypes.shape({ name: PropTypes.string }),
    resource: PropTypes.shape({
      id: PropTypes.string,
      _id: PropTypes.string,
      name: PropTypes.string
    })
  }).isRequired,
  onView: PropTypes.func.isRequired,
  onViewSession: PropTypes.func
};

export default NotificationItem;
