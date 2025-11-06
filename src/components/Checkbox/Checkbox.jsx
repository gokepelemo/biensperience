import React from 'react';
import './Checkbox.css';

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
  const sizeClass = size === 'sm' ? 'bp-checkbox-sm' : size === 'lg' ? 'bp-checkbox-lg' : 'bp-checkbox-md';
  return (
    <label htmlFor={id} className={`bp-checkbox ${sizeClass} ${disabled ? 'is-disabled' : ''}`}>
      <input
        id={id}
        type="checkbox"
        className="bp-checkbox-input"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="bp-checkbox-box" aria-hidden="true">
        <svg className="bp-checkbox-check" viewBox="0 0 24 24" focusable="false">
          <polyline points="20 6 9 17 4 12" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className="bp-checkbox-label">{label}</span>}
    </label>
  );
}
