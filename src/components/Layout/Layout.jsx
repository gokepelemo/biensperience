import React from 'react';
import PropTypes from 'prop-types';
import './Layout.css';

/**
 * FlexBetween component for flexbox with space-between alignment
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Layout content
 * @param {string} props.align - Vertical alignment: 'start', 'center', 'end', 'stretch'
 * @param {string} props.gap - Gap between items: 'sm', 'md', 'lg', 'xl'
 * @param {boolean} props.wrap - Whether items should wrap
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to div element
 */
export function FlexBetween({
  children,
  align = 'center',
  gap = 'md',
  wrap = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'flex-between',
    `align-${align}`,
    `gap-${gap}`,
    wrap && 'flex-wrap',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}

FlexBetween.propTypes = {
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['start', 'center', 'end', 'stretch']),
  gap: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FlexCenter component for flexbox with center alignment
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Layout content
 * @param {string} props.direction - Flex direction: 'row', 'column'
 * @param {boolean} props.wrap - Whether items should wrap
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to div element
 */
export function FlexCenter({
  children,
  direction = 'row',
  wrap = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'flex-center',
    `direction-${direction}`,
    wrap && 'flex-wrap',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}

FlexCenter.propTypes = {
  children: PropTypes.node.isRequired,
  direction: PropTypes.oneOf(['row', 'column']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * SpaceY component for vertical spacing between child elements
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Layout content
 * @param {string} props.size - Spacing size: '1', '2', '3', '4', '5', '6'
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to div element
 */
export function SpaceY({
  children,
  size = '4',
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'space-y',
    `space-y-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}

SpaceY.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['1', '2', '3', '4', '5', '6']),
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Container component for max-width content wrapper
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Layout content
 * @param {string} props.size - Container max-width: 'sm', 'md', 'lg', 'xl', 'full'
 * @param {boolean} props.center - Whether to center the container
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to div element
 */
export function Container({
  children,
  size = 'xl',
  center = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'container',
    `container-${size}`,
    center && 'container-center',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}

Container.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  center: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Stack component for vertical layout with consistent spacing
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Layout content
 * @param {string} props.spacing - Spacing between items: 'sm', 'md', 'lg', 'xl'
 * @param {string} props.align - Horizontal alignment: 'start', 'center', 'end'
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to div element
 */
export function Stack({
  children,
  spacing = 'md',
  align = 'start',
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'stack',
    `stack-spacing-${spacing}`,
    `stack-align-${align}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}

Stack.propTypes = {
  children: PropTypes.node.isRequired,
  spacing: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  align: PropTypes.oneOf(['start', 'center', 'end']),
  className: PropTypes.string,
  style: PropTypes.object
};