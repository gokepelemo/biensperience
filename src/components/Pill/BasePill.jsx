/**
 * BasePill — Native Chakra UI Badge with recipe-based styling
 *
 * Uses Chakra's native Badge component with the badge recipe from ui-theme.js.
 * Variant → colorPalette mapping + recipe variant (solid/outline).
 * No CSS Modules — pure Chakra tokens.
 *
 * Task: biensperience-5c80 — P2.3 Pill/Badge → Chakra Badge
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@chakra-ui/react';

// Map Pill variant names to Chakra colorPalette tokens
const COLOR_PALETTE_MAP = {
  primary: 'brand',
  secondary: 'gray',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  info: 'blue',
  neutral: 'gray',
};

export default function BasePill({
  children,
  variant = 'neutral',
  size = 'md',
  rounded = false,
  outline = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Badge
      colorPalette={COLOR_PALETTE_MAP[variant] || 'gray'}
      variant={outline ? 'outline' : 'subtle'}
      size={size}
      borderRadius={rounded ? 'full' : undefined}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      css={{
        gap: '{spacing.1}',
        transition: 'all {durations.fast}',
        _hover: {
          transform: 'translateY(-1px) scale(1.02)',
          boxShadow: '{shadows.sm}',
        },
      }}
      {...props}
    >
      {children}
    </Badge>
  );
}

BasePill.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  rounded: PropTypes.bool,
  outline: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};
