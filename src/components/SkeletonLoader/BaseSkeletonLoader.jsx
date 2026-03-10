/**
 * BaseSkeletonLoader – Native Chakra UI v3 Skeleton
 *
 * Drop-in replacement using Chakra Skeleton with native tokens.
 * No CSS Module import — all styling via Chakra style props / css prop.
 *
 * Benefits:
 * - Built-in ARIA (aria-busy, aria-live)
 * - Reduced-motion support
 * - variant="pulse" (default) and variant="shine"
 *
 * Migrated: P2.8 — biensperience-0777
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Skeleton, Stack } from '@chakra-ui/react';

export default function BaseSkeletonLoader({
  variant = 'text',
  size = 'md',
  width,
  height,
  lines = 1,
  animate = true,
  className = '',
  style = {},
  ...props
}) {
  const w = width != null ? (typeof width === 'number' ? `${width}px` : width) : undefined;
  const h = height != null ? (typeof height === 'number' ? `${height}px` : height) : undefined;

  const common = {
    loading: animate,
    variant: 'pulse',
    className: className || undefined,
    ...props,
  };

  switch (variant) {
    case 'circle': {
      const diameter = h || w;
      return (
        <Skeleton
          {...common}
          width={diameter}
          height={diameter}
          borderRadius="full"
          style={style}
        />
      );
    }

    case 'rectangle':
      return (
        <Skeleton
          {...common}
          width={w || '100%'}
          height={h || '100px'}
          borderRadius="md"
          style={style}
        />
      );

    case 'text':
    default:
      if (lines > 1) {
        return (
          <Stack gap="2" style={style} width={w || '100%'}>
            {Array.from({ length: lines }, (_, i) => (
              <Skeleton
                key={i}
                {...common}
                height={h || '4'}
                width={i === lines - 1 ? '70%' : '100%'}
                borderRadius="sm"
              />
            ))}
          </Stack>
        );
      }

      return (
        <Skeleton
          {...common}
          width={w || '100%'}
          height={h || '4'}
          borderRadius="sm"
          style={style}
        />
      );
  }
}

BaseSkeletonLoader.propTypes = {
  variant: PropTypes.oneOf(['text', 'circle', 'rectangle']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  lines: PropTypes.number,
  animate: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
};
