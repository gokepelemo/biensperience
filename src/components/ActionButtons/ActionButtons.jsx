import React from 'react';
import styles from './ActionButtons.module.scss';
import { lang } from '../../lang.constants';

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
    <div className={`${styles.actionButtons} ${alignClass} ${compact ? styles.compact : ''} ${className}`}>
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
            className={`btn btn-${variant} ${styles.actionButton} ${compact ? 'btn-sm' : ''} ${buttonClassName}`}
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
    label: lang.en.button.add,
    onClick,
    variant: 'primary',
    icon: '✚',
    tooltip: lang.en.button.addNewItemTooltip,
    ...options,
  }),

  save: (onClick, options = {}) => ({
    label: lang.en.button.save,
    onClick,
    variant: 'success',
    icon: '💾',
    tooltip: lang.en.button.saveChangesTooltip,
    ...options,
  }),

  cancel: (onClick, options = {}) => ({
    label: lang.en.button.cancel,
    onClick,
    variant: 'secondary',
    tooltip: lang.en.button.cancelTooltip,
    ...options,
  }),

  back: (onClick, options = {}) => ({
    label: lang.en.button.back,
    onClick,
    variant: 'outline-secondary',
    icon: '←',
    tooltip: lang.en.button.backTooltip,
    ...options,
  }),

  favorite: (onClick, isFavorited, options = {}) => ({
    label: isFavorited ? lang.en.button.unfavorite : lang.en.button.favorite,
    onClick,
    variant: isFavorited ? 'warning' : 'outline-warning',
    icon: isFavorited ? '⭐' : '☆',
    tooltip: isFavorited ? lang.en.button.unfavoriteTooltip : lang.en.button.favoriteTooltip,
    ...options,
  }),

  plan: (onClick, isPlanned, options = {}) => ({
    label: isPlanned ? lang.en.button.removeFromPlan : lang.en.button.addToPlan,
    onClick,
    variant: isPlanned ? 'danger' : 'success',
    icon: isPlanned ? '−' : '✚',
    tooltip: isPlanned ? lang.en.button.removeFromPlanTooltip : lang.en.button.planTooltip,
    ...options,
  }),

  share: (onClick, options = {}) => ({
    label: lang.en.button.share,
    onClick,
    variant: 'outline-info',
    icon: '↗',
    tooltip: lang.en.button.shareTooltip,
    ...options,
  }),
};
