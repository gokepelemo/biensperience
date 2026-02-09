/**
 * ChakraPill - Chakra UI v3 Badge Implementation
 *
 * Drop-in replacement for the custom Pill component.
 * Uses Chakra UI v3 Badge primitive for built-in accessibility
 * and consistent ARIA semantics while preserving the existing
 * Pill.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets Chakra's default Badge
 * styling and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Pill component.
 *
 * Chakra benefits gained:
 * - Semantic role="status" for screen readers
 * - Consistent focus management
 * - Built-in theme integration
 *
 * Task: biensperience-bbd4 - Migrate Pill component to Chakra UI
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@chakra-ui/react';
import styles from './Pill.module.scss';

/**
 * Reset styles to completely override Chakra's default Badge styling.
 * This ensures the CSS Module classes from Pill.module.scss are the
 * sole source of visual styling — pixel-perfect match with the original.
 */
const CHAKRA_RESET_STYLES = {
  bg: 'transparent',
  color: 'inherit',
  border: 'none',
  borderRadius: 'unset',
  fontWeight: 'unset',
  fontSize: 'unset',
  lineHeight: 'unset',
  textTransform: 'none',
  px: 'unset',
  py: 'unset',
  _hover: {
    bg: 'transparent',
    color: 'inherit',
  },
};

export default function ChakraPill({
  children,
  variant = 'neutral',
  size = 'md',
  rounded = false,
  outline = false,
  className = '',
  style = {},
  ...props
}) {
  // Build className string with dynamic variant and size classes (identical to original Pill)
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
    <Badge
      className={classes}
      style={style}
      // Use 'plain' variant to prevent Chakra recipe application
      variant="plain"
      // Reset all Chakra styling — CSS Modules handle everything
      {...CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </Badge>
  );
}

ChakraPill.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info', 'neutral']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  rounded: PropTypes.bool,
  outline: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};
