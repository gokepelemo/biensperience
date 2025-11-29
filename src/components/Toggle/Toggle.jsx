/**
 * Toggle Component
 * A flexible toggle/switch component with multiple variants and sizes
 * Supports labels, icons, and different visual styles
 */

import { useId } from 'react';
import PropTypes from 'prop-types';
import { FaCheck, FaTimes } from 'react-icons/fa';
import styles from './Toggle.module.scss';

/**
 * Toggle component with multiple variants
 */
export default function Toggle({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  variant = 'default',
  showIcons = false,
  label,
  labelPosition = 'right',
  description,
  name,
  className = '',
  ...props
}) {
  const id = useId();
  const toggleId = name || id;

  const handleChange = (e) => {
    if (!disabled && onChange) {
      onChange(e.target.checked, e);
    }
  };

  const sizeClass = styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`];
  const variantClass = styles[`variant${variant.charAt(0).toUpperCase() + variant.slice(1)}`];

  const toggleElement = (
    <label
      className={`${styles.toggle} ${sizeClass} ${variantClass} ${disabled ? styles.disabled : ''} ${className}`}
      htmlFor={toggleId}
    >
      <input
        type="checkbox"
        id={toggleId}
        name={toggleId}
        className={styles.input}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        {...props}
      />
      <span className={styles.slider}>
        {showIcons && (
          <>
            <span className={styles.iconOff}>
              <FaTimes />
            </span>
            <span className={styles.iconOn}>
              <FaCheck />
            </span>
          </>
        )}
        <span className={styles.knob} />
      </span>
    </label>
  );

  // If no label, just return the toggle
  if (!label && !description) {
    return toggleElement;
  }

  // With label and/or description
  return (
    <div className={`${styles.toggleWrapper} ${styles[`label${labelPosition.charAt(0).toUpperCase() + labelPosition.slice(1)}`]}`}>
      {labelPosition === 'left' && (
        <div className={styles.labelContainer}>
          {label && <span className={styles.label}>{label}</span>}
          {description && <span className={styles.description}>{description}</span>}
        </div>
      )}
      {toggleElement}
      {labelPosition === 'right' && (
        <div className={styles.labelContainer}>
          {label && <span className={styles.label}>{label}</span>}
          {description && <span className={styles.description}>{description}</span>}
        </div>
      )}
    </div>
  );
}

Toggle.propTypes = {
  /** Whether the toggle is checked */
  checked: PropTypes.bool,
  /** Callback when toggle state changes */
  onChange: PropTypes.func,
  /** Whether the toggle is disabled */
  disabled: PropTypes.bool,
  /** Size of the toggle */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  /** Visual variant of the toggle */
  variant: PropTypes.oneOf(['default', 'primary', 'success', 'outline', 'filled', 'minimal']),
  /** Whether to show check/x icons inside the toggle */
  showIcons: PropTypes.bool,
  /** Label text for the toggle */
  label: PropTypes.node,
  /** Position of the label relative to toggle */
  labelPosition: PropTypes.oneOf(['left', 'right']),
  /** Description text below the label */
  description: PropTypes.string,
  /** Name attribute for the input */
  name: PropTypes.string,
  /** Additional CSS class */
  className: PropTypes.string,
};

/**
 * ToggleGroup - A group of toggles with consistent styling
 */
export function ToggleGroup({ children, className = '' }) {
  return (
    <div className={`${styles.toggleGroup} ${className}`}>
      {children}
    </div>
  );
}

ToggleGroup.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};
