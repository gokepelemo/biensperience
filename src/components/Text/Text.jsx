import React from 'react';
import PropTypes from 'prop-types';
import './Text.css';

/**
 * Text component with typography variants and effects
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Text content
 * @param {string} props.as - HTML element to render: 'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
 * @param {string} props.variant - Text variant: 'body', 'lead', 'caption', 'gradient', 'muted'
 * @param {string} props.size - Text size: 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'
 * @param {string} props.weight - Font weight: 'light', 'normal', 'medium', 'semibold', 'bold'
 * @param {boolean} props.gradient - Whether to apply gradient effect
 * @param {boolean} props.shadow - Whether to apply text shadow
 * @param {number} props.truncate - Number of lines to truncate (1-3), 0 for no truncation
 * @param {string} props.align - Text alignment: 'left', 'center', 'right', 'justify'
 * @param {string} props.color - Text color override
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to element
 */
export default function Text({
  children,
  as: Component = 'p',
  variant = 'body',
  size = 'base',
  weight = 'normal',
  gradient = false,
  shadow = false,
  truncate = 0,
  align = 'left',
  color,
  className = '',
  style = {},
  ...props
}) {
  // Build className string
  const classes = [
    'text-component',
    `text-${variant}`,
    `text-${size}`,
    `weight-${weight}`,
    gradient && 'text-gradient-primary',
    shadow && 'text-shadow-md',
    truncate > 0 && `text-truncate-${truncate}`,
    align !== 'left' && `text-${align}`,
    color && `text-color-${color}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <Component
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

Text.propTypes = {
  children: PropTypes.node.isRequired,
  as: PropTypes.oneOf(['p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
  variant: PropTypes.oneOf(['body', 'lead', 'caption', 'gradient', 'muted', 'heading']),
  size: PropTypes.oneOf(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']),
  weight: PropTypes.oneOf(['light', 'normal', 'medium', 'semibold', 'bold']),
  gradient: PropTypes.bool,
  shadow: PropTypes.bool,
  truncate: PropTypes.oneOf([0, 1, 2, 3]),
  align: PropTypes.oneOf(['left', 'center', 'right', 'justify']),
  color: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Heading component for semantic headings
 */
export function Heading({
  children,
  level = 1,
  variant = 'heading',
  size,
  weight = 'bold',
  gradient = false,
  shadow = false,
  align = 'left',
  className = '',
  style = {},
  ...props
}) {
  const Component = `h${level}`;
  const headingSize = size || `heading-${level}`;

  return (
    <Text
      as={Component}
      variant={variant}
      size={headingSize}
      weight={weight}
      gradient={gradient}
      shadow={shadow}
      align={align}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Text>
  );
}

Heading.propTypes = {
  children: PropTypes.node.isRequired,
  level: PropTypes.oneOf([1, 2, 3, 4, 5, 6]),
  variant: PropTypes.oneOf(['body', 'lead', 'caption', 'gradient', 'muted', 'heading']),
  size: PropTypes.oneOf(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'heading-1', 'heading-2', 'heading-3', 'heading-4', 'heading-5', 'heading-6']),
  weight: PropTypes.oneOf(['light', 'normal', 'medium', 'semibold', 'bold']),
  gradient: PropTypes.bool,
  shadow: PropTypes.bool,
  align: PropTypes.oneOf(['left', 'center', 'right', 'justify']),
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Paragraph component for semantic paragraphs
 */
export function Paragraph({
  children,
  variant = 'body',
  size = 'base',
  weight = 'normal',
  gradient = false,
  shadow = false,
  truncate = 0,
  align = 'left',
  className = '',
  style = {},
  ...props
}) {
  return (
    <Text
      as="p"
      variant={variant}
      size={size}
      weight={weight}
      gradient={gradient}
      shadow={shadow}
      truncate={truncate}
      align={align}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Text>
  );
}

Paragraph.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['body', 'lead', 'caption', 'gradient', 'muted']),
  size: PropTypes.oneOf(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']),
  weight: PropTypes.oneOf(['light', 'normal', 'medium', 'semibold', 'bold']),
  gradient: PropTypes.bool,
  shadow: PropTypes.bool,
  truncate: PropTypes.oneOf([0, 1, 2, 3]),
  align: PropTypes.oneOf(['left', 'center', 'right', 'justify']),
  className: PropTypes.string,
  style: PropTypes.object
};