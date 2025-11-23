import React from 'react';
import PropTypes from 'prop-types';
import styles from './Pill.module.scss';

/**
 * Pill/Badge component for displaying status, tags, or labels
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Pill content
 * @param {string} props.variant - Color variant: 'primary', 'success', 'warning', 'danger', 'info', 'neutral'
 * @param {string} props.size - Size variant: 'sm', 'md', 'lg'
 * @param {boolean} props.rounded - Whether pill should be fully rounded
 * @param {boolean} props.outline - Whether pill should have outline style instead of filled
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to span element
 */
export default function Pill({
  children,
  variant = 'neutral',
  size = 'md',
  rounded = false,
  outline = false,
  className = '',
  style = {},
  ...props
}) {
  // Build className string with dynamic variant and size classes
  const variantClass = styles[`pillVariant${variant.charAt(0).toUpperCase() + variant.slice(1)}`];
  const sizeClass = size !== 'md' ? styles[`pill${size.charAt(0).toUpperCase() + size.slice(1)}`] : '';

  const classes = [
    styles.pill,
    variantClass,
    sizeClass,
    rounded && styles.pillRounded,
    outline && styles.pillOutline,
    className
  ].filter(Boolean).join(' ');

  return (
    <span
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

Pill.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info', 'neutral']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  rounded: PropTypes.bool,
  outline: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};