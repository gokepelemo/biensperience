import React from 'react';
import PropTypes from 'prop-types';
import './SkeletonLoader.css';

/**
 * SkeletonLoader component for displaying loading states
 *
 * @param {Object} props - Component props
 * @param {string} props.variant - Loading shape: 'text', 'circle', 'rectangle'
 * @param {string|number} props.width - Width of the skeleton (CSS value or number for pixels)
 * @param {string|number} props.height - Height of the skeleton (CSS value or number for pixels)
 * @param {number} props.lines - Number of text lines (only for text variant)
 * @param {boolean} props.animate - Whether to show animation
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 */
export default function SkeletonLoader({
  variant = 'text',
  width,
  height,
  lines = 1,
  animate = true,
  className = '',
  style = {},
  ...props
}) {
  // Build className string
  const classes = [
    'skeleton-loader',
    `skeleton-${variant}`,
    animate && 'skeleton-animate',
    className
  ].filter(Boolean).join(' ');

  // Handle width and height props
  const computedStyle = {
    ...style,
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  };

  // Render multiple lines for text variant
  if (variant === 'text' && lines > 1) {
    return (
      <div className="skeleton-text-group" style={style}>
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={classes}
            style={{
              ...computedStyle,
              width: index === lines - 1 ? '70%' : '100%', // Last line shorter
              marginBottom: index < lines - 1 ? 'var(--space-2)' : 0
            }}
            {...props}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={classes}
      style={computedStyle}
      {...props}
    />
  );
}

SkeletonLoader.propTypes = {
  variant: PropTypes.oneOf(['text', 'circle', 'rectangle']),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  lines: PropTypes.number,
  animate: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};