import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button } from '../design-system';
import styles from './EmptyState.module.scss';
import { addEasterEgg } from '../../utilities/paquette-utils';

/**
 * EmptyState - Reusable empty state component for displaying when no data is available
 *
 * @param {string} variant - The type of empty state: 'plans', 'experiences', 'destinations', 'favorites', 'activity', 'search', 'generic'
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

// Default configurations for each variant
const VARIANT_CONFIG = {
  plans: {
    icon: '📭',
    title: 'No Plans Yet',
    description: 'Start planning your next adventure! Browse our curated experiences or create a new experience to plan.',
    primaryAction: 'Browse Experiences',
    secondaryAction: 'Plan New Experience',
  },
  experiences: {
    icon: '🎯',
    title: 'No Experiences Found',
    description: 'Discover amazing travel experiences or create your own to share with others.',
    primaryAction: 'Browse Experiences',
    secondaryAction: 'Create Experience',
  },
  destinations: {
    icon: '🗺️',
    title: 'No Destinations Yet',
    description: 'Start exploring the world! Add destinations you want to visit or have visited.',
    primaryAction: 'Browse Destinations',
    secondaryAction: 'Add Destination',
  },
  favorites: {
    icon: '💜',
    title: 'No Favorites Yet',
    description: 'Save your favorite experiences and destinations for easy access later.',
    primaryAction: 'Browse Experiences',
    secondaryAction: null,
  },
  activity: {
    icon: '📊',
    title: 'No Recent Activity',
    description: 'Your recent actions will appear here once you start planning and exploring.',
    primaryAction: 'Get Started',
    secondaryAction: null,
  },
  search: {
    icon: '🔍',
    title: 'No Results Found',
    description: 'We couldn\'t find anything matching your search. Try adjusting your filters or search terms.',
    primaryAction: 'Clear Filters',
    secondaryAction: null,
  },
  collaborators: {
    icon: '👥',
    title: 'No Collaborators Yet',
    description: 'Invite friends and family to collaborate on your travel plans together.',
    primaryAction: 'Invite Collaborators',
    secondaryAction: null,
  },
  photos: {
    icon: '📷',
    title: 'No Photos Yet',
    description: 'Add photos to showcase this experience and inspire others.',
    primaryAction: 'Upload Photos',
    secondaryAction: null,
  },
  notes: {
    icon: '📝',
    title: 'No Notes Yet',
    description: 'Add notes to keep track of important details, tips, or memories.',
    primaryAction: 'Add Note',
    secondaryAction: null,
  },
  users: {
    icon: '👤',
    title: 'No Users Found',
    description: 'No users match your current filters. Try adjusting your search or filters.',
    primaryAction: 'Clear Filters',
    secondaryAction: null,
  },
  invites: {
    icon: '✉️',
    title: 'No Invite Codes Yet',
    description: 'Create invite codes to share Biensperience with friends and family.',
    primaryAction: 'Create Invite',
    secondaryAction: null,
  },
  generic: {
    icon: '📦',
    title: 'Nothing Here Yet',
    description: 'There\'s nothing to display at the moment.',
    primaryAction: null,
    secondaryAction: null,
  },
};

export default function EmptyState({
  variant = 'generic',
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
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.generic;

  const displayIcon = icon ?? config.icon;
  const displayTitle = title ?? config.title;
  const baseDescription = description ?? config.description;
  
  // Apply Easter egg utility intermittently (30% chance for key variants)
  // Use useMemo with deterministic seed to prevent flashing on re-render
  const displayDescription = useMemo(() => {
    if (['plans', 'experiences', 'destinations'].includes(variant)) {
      // Generate seed from base description for deterministic behavior
      const seed = baseDescription.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return addEasterEgg(baseDescription, { 
        probability: 0.3, 
        category: 'tagline',
        seed: seed 
      });
    }
    return baseDescription;
  }, [variant, baseDescription]);
  
  const displayPrimaryAction = primaryAction ?? config.primaryAction;
  const displaySecondaryAction = secondaryAction ?? config.secondaryAction;

  const containerClasses = [
    styles.emptyState,
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

      {displayDescription && (
        <p className={styles.description}>{displayDescription}</p>
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

EmptyState.propTypes = {
  variant: PropTypes.oneOf([
    'plans',
    'experiences',
    'destinations',
    'favorites',
    'activity',
    'search',
    'collaborators',
    'photos',
    'notes',
    'users',
    'invites',
    'generic',
  ]),
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

// Export variant config for use in Storybook
export { VARIANT_CONFIG };
