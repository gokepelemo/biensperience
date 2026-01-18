import React from 'react';
import PropTypes from 'prop-types';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import styles from './SkeletonLoader.module.scss';

/**
 * SkeletonLoader component for displaying loading states
 * Now uses react-loading-skeleton library for better performance and features
 *
 * @param {Object} props - Component props
 * @param {string} props.variant - Loading shape: 'text', 'circle', 'rectangle'
 * @param {string} props.size - Size variant for text: 'sm', 'md' (default), 'lg'
 * @param {string|number} props.width - Width of the skeleton (CSS value or number for pixels)
 * @param {string|number} props.height - Height of the skeleton (CSS value or number for pixels)
 * @param {number} props.lines - Number of text lines (only for text variant)
 * @param {boolean} props.animate - Whether to show animation
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 */
export default function SkeletonLoader({
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
  // Build className string with CSS Modules
  const classes = [
    styles.skeletonLoader,
    className
  ].filter(Boolean).join(' ');

  // Handle width and height props
  const computedStyle = {
    ...style,
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  };

  // Map our variants to react-loading-skeleton props
  const skeletonProps = {
    width: computedStyle.width,
    height: computedStyle.height,
    style: computedStyle,
    className: classes,
    enableAnimation: animate,
    ...props
  };

  // Handle different variants
  switch (variant) {
    case 'circle':
      return (
        <Skeleton
          {...skeletonProps}
          circle
          width={height || width} // Use height for circle diameter
          height={height || width}
        />
      );

    case 'rectangle':
      return (
        <Skeleton
          {...skeletonProps}
          borderRadius={8} // Match our rectangle border radius
        />
      );

    case 'text':
    default:
      // Handle multiple lines
      if (lines > 1) {
        return (
          <div className={styles.skeletonTextGroup} style={style}>
            {Array.from({ length: lines }, (_, index) => (
              <Skeleton
                key={index}
                {...skeletonProps}
                width={index === lines - 1 ? '70%' : '100%'} // Last line shorter
                style={{
                  ...computedStyle,
                  width: index === lines - 1 ? '70%' : '100%',
                  marginBottom: index < lines - 1 ? 'var(--space-2)' : 0
                }}
              />
            ))}
          </div>
        );
      }

      // Single line text
      return (
        <Skeleton
          {...skeletonProps}
          borderRadius={4} // Match our text border radius
        />
      );
  }
}

SkeletonLoader.propTypes = {
  variant: PropTypes.oneOf(['text', 'circle', 'rectangle']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  lines: PropTypes.number,
  animate: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};