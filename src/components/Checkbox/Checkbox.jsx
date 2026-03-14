import React, { useId } from 'react';
import PropTypes from 'prop-types';
import styles from './Checkbox.module.css';

/**
 * Checkbox — Chakra-inspired, tokenized checkbox component.
 *
 * Supports three visual variants inspired by Chakra UI:
 * - **outline** (default): Bordered control, fills on check.
 * - **subtle**: Light tinted background, fills on check.
 * - **solid**: Always filled primary background.
 *
 * Sizes: 'sm' (18 px), 'md' (22 px), 'lg' (26 px).
 *
 * @example
 * <Checkbox id="terms" label="Accept terms" variant="outline" />
 * <Checkbox id="newsletter" checked onChange={fn} variant="subtle" size="lg" />
 */
export default function Checkbox({
  id,
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  size = 'md',
  variant = 'outline',
  className = '',
  colorScheme = 'primary',
  indeterminate = false,
  ...rest
}) {
  const autoId = useId();
  const resolvedId = id || autoId;

  const sizeClass = styles[`size${size.charAt(0).toUpperCase() + size.slice(1)}`] || '';
  const variantClass = styles[`variant${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || '';
  const colorClass = styles[`color${colorScheme.charAt(0).toUpperCase() + colorScheme.slice(1)}`] || '';

  const rootClasses = [
    styles.root,
    sizeClass,
    variantClass,
    colorClass,
    disabled ? styles.isDisabled : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label htmlFor={resolvedId} className={rootClasses} {...rest}>
      <input
        id={resolvedId}
        type="checkbox"
        className={styles.hiddenInput}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
      />
      <span className={styles.control} aria-hidden="true">
        {indeterminate ? (
          <svg className={styles.indicator} viewBox="0 0 24 24" focusable="false">
            <line x1="5" y1="12" x2="19" y2="12" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className={styles.indicator} viewBox="0 0 24 24" focusable="false">
            <polyline points="20 6 9 17 4 12" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}

Checkbox.propTypes = {
  /** Unique id — auto-generated if omitted */
  id: PropTypes.string,
  /** Label text or ReactNode */
  label: PropTypes.node,
  /** Controlled checked state */
  checked: PropTypes.bool,
  /** Uncontrolled initial checked state */
  defaultChecked: PropTypes.bool,
  /** Change handler */
  onChange: PropTypes.func,
  /** Disabled state */
  disabled: PropTypes.bool,
  /** Size: 'sm' | 'md' | 'lg' */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Visual variant: 'outline' | 'subtle' | 'solid' */
  variant: PropTypes.oneOf(['outline', 'subtle', 'solid']),
  /** Additional CSS class */
  className: PropTypes.string,
  /** Color scheme token name */
  colorScheme: PropTypes.oneOf(['primary', 'success', 'warning', 'danger']),
  /** Show indeterminate (minus) icon instead of check */
  indeterminate: PropTypes.bool,
};
