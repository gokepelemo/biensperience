import React from 'react';
import styles from './Divider.module.scss';

/**
 * Divider with centered label and tokenized shadow.
 * Props:
 * - label: string | ReactNode
 * - shadow: 'none' | 'sm' | 'md' | 'lg' (default 'sm')
 * - className: string
 */
export default function Divider({ label = 'Or continue with', shadow = 'sm', className = '' }) {
  const shadowClass = styles[`bpDividerShadow${shadow.charAt(0).toUpperCase() + shadow.slice(1)}`];

  return (
    <div className={`${styles.bpDivider} ${className} ${shadowClass}`}>
      <span className={styles.bpDividerLabel}>{label}</span>
    </div>
  );
}
