import React from 'react';
import styles from './ActionButtons.module.scss';
import { lang } from '../../lang.constants';
import {
  FaEdit,
  FaTrash,
  FaPlus,
  FaSave,
  FaArrowLeft,
  FaStar,
  FaRegStar,
  FaMinus,
  FaShareAlt
} from 'react-icons/fa';

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
    label: lang.current.button.edit,
    onClick,
    variant: 'outline-primary',
    icon: <FaEdit />,
    tooltip: lang.current.button.editTooltip,
    ...options,
  }),

  delete: (onClick, options = {}) => ({
    label: lang.current.button.delete,
    onClick,
    variant: 'outline-danger',
    icon: <FaTrash />,
    tooltip: lang.current.button.deleteTooltip,
    ...options,
  }),

  add: (onClick, options = {}) => ({
    label: lang.current.button.add,
    onClick,
    variant: 'primary',
    icon: <FaPlus />,
    tooltip: lang.current.button.addNewItemTooltip,
    ...options,
  }),

  save: (onClick, options = {}) => ({
    label: lang.current.button.save,
    onClick,
    variant: 'success',
    icon: <FaSave />,
    tooltip: lang.current.button.saveChangesTooltip,
    ...options,
  }),

  cancel: (onClick, options = {}) => ({
    label: lang.current.button.cancel,
    onClick,
    variant: 'secondary',
    tooltip: lang.current.button.cancelTooltip,
    ...options,
  }),

  back: (onClick, options = {}) => ({
    label: lang.current.button.back,
    onClick,
    variant: 'outline-secondary',
    icon: <FaArrowLeft />,
    tooltip: lang.current.button.backTooltip,
    ...options,
  }),

  favorite: (onClick, isFavorited, options = {}) => ({
    label: isFavorited ? lang.current.button.unfavorite : lang.current.button.favorite,
    onClick,
    variant: isFavorited ? 'warning' : 'outline-warning',
    icon: isFavorited ? <FaStar /> : <FaRegStar />,
    tooltip: isFavorited ? lang.current.button.unfavoriteTooltip : lang.current.button.favoriteTooltip,
    ...options,
  }),

  plan: (onClick, isPlanned, options = {}) => ({
    label: isPlanned ? lang.current.button.removeFromPlan : lang.current.button.addToPlan,
    onClick,
    variant: isPlanned ? 'danger' : 'success',
    icon: isPlanned ? <FaMinus /> : <FaPlus />,
    tooltip: isPlanned ? lang.current.button.removeFromPlanTooltip : lang.current.button.planTooltip,
    ...options,
  }),

  share: (onClick, options = {}) => ({
    label: lang.current.button.share,
    onClick,
    variant: 'outline-info',
    icon: <FaShareAlt />,
    tooltip: lang.current.button.shareTooltip,
    ...options,
  }),
};
