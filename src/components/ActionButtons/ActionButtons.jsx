import React from 'react';
import './ActionButtons.css';

/**
 * ActionButtons Component
 * Standardized action button container for all views
 * Supports responsive layouts and consistent styling
 *
 * @param {Object} props
 * @param {Array} props.buttons - Array of button configurations
 * @param {string} props.align - Alignment: 'left', 'center', 'right' (default: 'right')
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.compact - Compact mode for navbar (smaller buttons)
 */
export default function ActionButtons({
  buttons = [],
  align = 'right',
  className = '',
  compact = false
}) {
  if (!buttons || buttons.length === 0) {
    return null;
  }

  const alignClass = {
    left: 'justify-content-start',
    center: 'justify-content-center',
    right: 'justify-content-end',
  }[align] || 'justify-content-end';

  return (
    <div className={`action-buttons ${alignClass} ${compact ? 'compact' : ''} ${className}`}>
      {buttons.map((button, index) => {
        const {
          label,
          onClick,
          variant = 'primary',
          icon,
          disabled = false,
          tooltip,
          type = 'button',
          className: buttonClassName = '',
          compact: buttonCompact, // Extract compact to avoid passing to DOM
          ...restProps
        } = button;

        return (
          <button
            key={index}
            type={type}
            className={`btn btn-${variant} action-button ${compact ? 'btn-sm' : ''} ${buttonClassName}`}
            onClick={onClick}
            disabled={disabled}
            title={tooltip}
            aria-label={tooltip || label}
            {...restProps}
          >
            {icon && <span className="button-icon">{icon}</span>}
            {!compact && label && <span className="button-label">{label}</span>}
            {compact && !icon && label && <span className="button-label">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Common button presets for consistency
 */
export const ButtonPresets = {
  edit: (onClick, options = {}) => ({
    label: 'Edit',
    onClick,
    variant: 'outline-primary',
    icon: '✏️',
    tooltip: 'Edit this item',
    ...options,
  }),

  delete: (onClick, options = {}) => ({
    label: 'Delete',
    onClick,
    variant: 'outline-danger',
    icon: '🗑️',
    tooltip: 'Delete this item',
    ...options,
  }),

  add: (onClick, options = {}) => ({
    label: 'Add',
    onClick,
    variant: 'primary',
    icon: '✚',
    tooltip: 'Add new item',
    ...options,
  }),

  save: (onClick, options = {}) => ({
    label: 'Save',
    onClick,
    variant: 'success',
    icon: '💾',
    tooltip: 'Save changes',
    ...options,
  }),

  cancel: (onClick, options = {}) => ({
    label: 'Cancel',
    onClick,
    variant: 'secondary',
    tooltip: 'Cancel action',
    ...options,
  }),

  back: (onClick, options = {}) => ({
    label: 'Back',
    onClick,
    variant: 'outline-secondary',
    icon: '←',
    tooltip: 'Go back',
    ...options,
  }),

  favorite: (onClick, isFavorited, options = {}) => ({
    label: isFavorited ? 'Unfavorite' : 'Favorite',
    onClick,
    variant: isFavorited ? 'warning' : 'outline-warning',
    icon: isFavorited ? '⭐' : '☆',
    tooltip: isFavorited ? 'Remove from favorites' : 'Add to favorites',
    ...options,
  }),

  plan: (onClick, isPlanned, options = {}) => ({
    label: isPlanned ? 'Remove from Plan' : 'Add to Plan',
    onClick,
    variant: isPlanned ? 'danger' : 'success',
    icon: isPlanned ? '−' : '✚',
    tooltip: isPlanned ? 'Remove from your plan' : 'Add to your plan',
    ...options,
  }),

  share: (onClick, options = {}) => ({
    label: 'Share',
    onClick,
    variant: 'outline-info',
    icon: '↗',
    tooltip: 'Share this item',
    ...options,
  }),
};
