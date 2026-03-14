/**
 * BaseDivider – Native Chakra UI v3 Separator
 *
 * Drop-in replacement for the custom CSS-module Divider component.
 * Uses Chakra's `Separator` primitive with an optional centred label rendered
 * via an HStack layout. Supports the same props as the legacy Divider:
 *   - label  : string | ReactNode — shown between two separator lines
 *   - shadow : 'none' | 'sm' | 'md' | 'lg' — decorative drop-shadow
 *
 * When no label is provided a single full-width Separator is rendered.
 *
 * Migrated: biensperience-049a
 */

import React from 'react';
import PropTypes from 'prop-types';
import { HStack, Separator, Text } from '@chakra-ui/react';

const SHADOW_MAP = {
  none: 'none',
  sm: '0 1px 3px rgba(0,0,0,0.08)',
  md: '0 2px 6px rgba(0,0,0,0.12)',
  lg: '0 4px 12px rgba(0,0,0,0.16)',
};

export default function BaseDivider({ label = '', shadow = 'sm', className = '' }) {
  const boxShadow = SHADOW_MAP[shadow] ?? SHADOW_MAP.sm;

  // Simple separator with no label
  if (!label) {
    return (
      <Separator
        className={className}
        css={{ boxShadow }}
      />
    );
  }

  // Separator with centred label (matches original .bpDivider layout)
  return (
    <HStack
      className={className}
      gap="3"
      width="100%"
      css={{ boxShadow }}
    >
      <Separator flex="1" />
      <Text
        flexShrink="0"
        fontSize="sm"
        color="fg.muted"
        whiteSpace="nowrap"
      >
        {label}
      </Text>
      <Separator flex="1" />
    </HStack>
  );
}

BaseDivider.propTypes = {
  /** Text or ReactNode displayed between the two separator lines */
  label: PropTypes.node,
  /** Decorative shadow: 'none' | 'sm' | 'md' | 'lg' */
  shadow: PropTypes.oneOf(['none', 'sm', 'md', 'lg']),
  /** Additional CSS class */
  className: PropTypes.string,
};
