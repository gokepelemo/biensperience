import React from 'react';
import styles from './Checkbox.module.scss';

/**
 * Tokenized Checkbox
 * - 24px square by default
 * - Uses design tokens for colors, radii, focus, and transitions
 *
 * Props:
 * - id: string (required for label association)
 * - label: ReactNode (optional)
 * - checked: boolean (controlled) or defaultChecked (uncontrolled)
 * - onChange: (e) => void
 * - disabled: boolean
 * - size: 'sm' | 'md' | 'lg' (defaults to 'md')
 */
export default function Checkbox({ id, label, checked, defaultChecked, onChange, disabled = false, size = 'md' }) {
  const sizeClass = styles[`bpCheckbox${size.charAt(0).toUpperCase() + size.slice(1)}`];

  return (
    <label htmlFor={id} className={`${styles.bpCheckbox} ${sizeClass} ${disabled ? styles.isDisabled : ''}`}>
      <input
        id={id}
        type="checkbox"
        className={styles.bpCheckboxInput}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className={styles.bpCheckboxBox} aria-hidden="true">
        <svg className={styles.bpCheckboxCheck} viewBox="0 0 24 24" focusable="false">
          <polyline points="20 6 9 17 4 12" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className={styles.bpCheckboxLabel}>{label}</span>}
    </label>
  );
}
