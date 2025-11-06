import React from 'react';
import './Divider.css';

/**
 * Divider with centered label and tokenized shadow.
 * Props:
 * - label: string | ReactNode
 * - shadow: 'none' | 'sm' | 'md' | 'lg' (default 'sm')
 * - className: string
 */
export default function Divider({ label = 'Or continue with', shadow = 'sm', className = '' }) {
  return (
    <div className={`bp-divider ${className} bp-divider-shadow-${shadow}`}>
      <span className="bp-divider-label">{label}</span>
    </div>
  );
}
