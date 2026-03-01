/**
 * BaseSkeletonLoader - Design System Skeleton Implementation
 *
 * Drop-in replacement for the custom SkeletonLoader component.
 * Uses Skeleton primitive for built-in accessibility
 * and animation support while preserving the existing styling.
 *
 * IMPORTANT: This implementation resets default skeleton
 * styling and applies the existing CSS Module classes, ensuring
 * visual parity with the original SkeletonLoader component.
 *
 * Benefits:
 * - Built-in ARIA attributes (aria-busy, aria-live)
 * - Reduced-motion support (respects prefers-reduced-motion)
 * - Consistent animation across the design system
 *
 * Task: biensperience-20d0 - Create wrappers for SkeletonLoader
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Skeleton as SkeletonPrimitive, Box } from '@chakra-ui/react';
import styles from './SkeletonLoader.module.scss';

/**
 * Reset styles to override default skeleton styling.
 */
const RESET_STYLES = {
  bg: 'transparent',
  _dark: { bg: 'transparent' },
};

/**
 * BaseSkeletonLoader - Accessible skeleton with existing CSS Modules styling
 *
 * @param {Object} props
 * @param {'text'|'circle'|'rectangle'} props.variant - Loading shape
 * @param {'sm'|'md'|'lg'} props.size - Size variant for text
 * @param {string|number} props.width - Width (CSS value or px number)
 * @param {string|number} props.height - Height (CSS value or px number)
 * @param {number} props.lines - Number of text lines (text variant only)
 * @param {boolean} props.animate - Whether to show animation
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 */
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
  const classes = [
    styles.skeletonLoader,
    className
  ].filter(Boolean).join(' ');

  const computedStyle = {
    ...style,
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  };

  const commonProps = {
    className: classes,
    style: computedStyle,
    loading: animate,
    ...RESET_STYLES,
    ...props
  };

  switch (variant) {
    case 'circle': {
      const diameter = height || width;
      return (
        <SkeletonPrimitive
          {...commonProps}
          style={{
            ...computedStyle,
            width: typeof diameter === 'number' ? `${diameter}px` : diameter,
            height: typeof diameter === 'number' ? `${diameter}px` : diameter,
            borderRadius: '50%',
          }}
        />
      );
    }

    case 'rectangle':
      return (
        <SkeletonPrimitive
          {...commonProps}
          style={{
            ...computedStyle,
            borderRadius: '8px',
          }}
        />
      );

    case 'text':
    default:
      if (lines > 1) {
        return (
          <Box className={styles.skeletonTextGroup} style={style}>
            {Array.from({ length: lines }, (_, index) => (
              <SkeletonPrimitive
                key={index}
                {...commonProps}
                style={{
                  ...computedStyle,
                  width: index === lines - 1 ? '70%' : '100%',
                  marginBottom: index < lines - 1 ? 'var(--space-2)' : 0,
                  borderRadius: '4px',
                }}
              />
            ))}
          </Box>
        );
      }

      return (
        <SkeletonPrimitive
          {...commonProps}
          style={{
            ...computedStyle,
            borderRadius: '4px',
          }}
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
  style: PropTypes.object
};
