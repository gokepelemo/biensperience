import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '../design-system';
import styles from './EntityNotFound.module.scss';

/**
 * EntityNotFound - Component displayed when an entity (experience, destination, etc.) is not found (404)
 *
 * @param {string} entityType - The type of entity: 'experience', 'destination', 'plan'
 * @param {string} entityName - The name of the entity that was not found (optional)
 * @param {string} title - Override the default title
 * @param {string} description - Override the default description
 * @param {string} icon - Override the default icon/emoji
 * @param {string} primaryAction - Primary button text
 * @param {function} onPrimaryAction - Primary button click handler
 * @param {string} secondaryAction - Secondary button text
 * @param {function} onSecondaryAction - Secondary button click handler
 * @param {string} size - Size variant: 'sm', 'md', 'lg'
 * @param {boolean} compact - Use compact layout (less padding)
 * @param {string} className - Additional CSS classes
 */

// Default configurations for each entity type
const ENTITY_CONFIG = {
  experience: {
    icon: '🗂️',
    title: 'Experience Not Found',
    description: 'This experience may have been deleted or you may not have permission to view it.',
    primaryAction: 'Browse Experiences',
    secondaryAction: 'Go Home',
  },
  destination: {
    icon: '🗺️',
    title: 'Destination Not Found',
    description: 'This destination may have been deleted or you may not have permission to view it.',
    primaryAction: 'Browse Destinations',
    secondaryAction: 'Go Home',
  },
  plan: {
    icon: '📋',
    title: 'Plan Not Found',
    description: 'This plan may have been deleted or you may not have permission to view it.',
    primaryAction: 'My Plans',
    secondaryAction: 'Go Home',
  },
  user: {
    icon: '👤',
    title: 'User Not Found',
    description: 'This user profile may have been deleted or you may not have permission to view it.',
    primaryAction: 'Browse Users',
    secondaryAction: 'Go Home',
  },
  generic: {
    icon: '❓',
    title: 'Not Found',
    description: 'The requested item could not be found.',
    primaryAction: 'Go Home',
    secondaryAction: null,
  },
};

export default function EntityNotFound({
  entityType = 'generic',
  entityName,
  title,
  description,
  icon,
  primaryAction,
  onPrimaryAction,
  secondaryAction,
  onSecondaryAction,
  size = 'md',
  compact = false,
  className = '',
}) {
  const config = ENTITY_CONFIG[entityType] || ENTITY_CONFIG.generic;

  const displayIcon = icon ?? config.icon;
  const displayTitle = title ?? config.title;
  const displayDescription = description ?? config.description;
  const displayPrimaryAction = primaryAction ?? config.primaryAction;
  const displaySecondaryAction = secondaryAction ?? config.secondaryAction;

  // Customize description if entity name is provided
  const finalDescription = entityName
    ? `${entityName} may have been deleted or you may not have permission to view it.`
    : displayDescription;

  const containerClasses = [
    styles.entityNotFound,
    styles[`size${size.charAt(0).toUpperCase()}${size.slice(1)}`],
    compact && styles.compact,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {displayIcon && (
        <div className={styles.iconContainer}>
          <span className={styles.icon} role="img" aria-label={displayTitle}>
            {displayIcon}
          </span>
        </div>
      )}

      {displayTitle && (
        <h2 className={styles.title}>{displayTitle}</h2>
      )}

      {finalDescription && (
        <p className={styles.description}>{finalDescription}</p>
      )}

      {(displayPrimaryAction || displaySecondaryAction) && (
        <div className={styles.actions}>
          {displayPrimaryAction && onPrimaryAction && (
            <Button
              variant="primary"
              size={size === 'sm' ? 'sm' : 'lg'}
              rounded
              onClick={onPrimaryAction}
              className={styles.primaryButton}
            >
              {displayPrimaryAction}
            </Button>
          )}
          {displaySecondaryAction && onSecondaryAction && (
            <Button
              variant="outline"
              size={size === 'sm' ? 'sm' : 'lg'}
              rounded
              onClick={onSecondaryAction}
              className={styles.secondaryButton}
            >
              {displaySecondaryAction}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

EntityNotFound.propTypes = {
  entityType: PropTypes.oneOf([
    'experience',
    'destination',
    'plan',
    'user',
    'generic',
  ]),
  entityName: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  icon: PropTypes.string,
  primaryAction: PropTypes.string,
  onPrimaryAction: PropTypes.func,
  secondaryAction: PropTypes.string,
  onSecondaryAction: PropTypes.func,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  compact: PropTypes.bool,
  className: PropTypes.string,
};

// Export entity config for use in Storybook or testing
export { ENTITY_CONFIG };