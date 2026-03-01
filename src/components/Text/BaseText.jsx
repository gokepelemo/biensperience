/**
 * BaseText - Design System Text Components Implementation
 *
 * Drop-in replacements for the custom Text components.
 * Uses Text and Heading primitives for built-in accessibility
 * while preserving the existing Text.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets default styling
 * and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Text components.
 *
 * Benefits:
 * - Built-in accessibility attributes
 * - Semantic heading structure
 * - Consistent typography handling
 *
 * Task: biensperience-445f - Migrate Text and Typography components
 */

import React from 'react';
import PropTypes from 'prop-types';
import { chakra } from '@chakra-ui/react';
import styles from './Text.module.scss';

/**
 * Using chakra() factory instead of the Text/Heading recipe components.
 *
 * The Text recipe component (import { Text } from '@chakra-ui/react') applies
 * default font-size, line-height, and color styles that fight with our CSS Module
 * classes. The chakra() factory creates bare styled elements with NO recipe styles —
 * only Chakra's runtime (ref forwarding, css prop support).
 * This means our CSS Module classes from Text.module.scss are the sole source of
 * visual styling, with zero specificity conflicts.
 */
const StyledText = chakra('p');
const StyledHeading = chakra('h1');

/**
 * BaseText - Chakra UI Text with CSS Module styling
 *
 * Uses Chakra Text primitive for accessibility benefits,
 * with reset styling to use CSS Modules.
 */
export default function BaseText({
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
  const variantClass = styles[`text${variant.charAt(0).toUpperCase() + variant.slice(1)}`];
  const sizeClass = size.includes('-')
    ? styles[`text${size.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`]
    : styles[`text${size.charAt(0).toUpperCase() + size.slice(1)}`];
  const weightClass = styles[`weight${weight.charAt(0).toUpperCase() + weight.slice(1)}`];
  const alignClass = align !== 'left' ? styles[`text${align.charAt(0).toUpperCase() + align.slice(1)}`] : '';
  const colorClass = color ? styles[`textColor${color.charAt(0).toUpperCase() + color.slice(1)}`] : '';

  const classes = [
    styles.textComponent,
    variantClass,
    sizeClass,
    weightClass,
    gradient && 'text-gradient-primary', // From utilities.css
    shadow && 'text-shadow-md', // From utilities.css
    truncate > 0 && `text-truncate-${truncate}`, // From utilities.css
    alignClass,
    colorClass,
    className
  ].filter(Boolean).join(' ');

  return (
    <StyledText
      as={Component}
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </StyledText>
  );
}

BaseText.propTypes = {
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
 * BaseHeading - Chakra UI Heading with CSS Module styling
 *
 * Uses Chakra Heading primitive for semantic heading structure,
 * with reset styling to use CSS Modules.
 */
export function BaseHeading({
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
  const headingSize = size || `heading-${level}`;

  // Build className string
  const variantClass = styles[`text${variant.charAt(0).toUpperCase() + variant.slice(1)}`];
  const sizeClass = headingSize.includes('-')
    ? styles[`text${headingSize.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`]
    : styles[`text${headingSize.charAt(0).toUpperCase() + headingSize.slice(1)}`];
  const weightClass = styles[`weight${weight.charAt(0).toUpperCase() + weight.slice(1)}`];
  const alignClass = align !== 'left' ? styles[`text${align.charAt(0).toUpperCase() + align.slice(1)}`] : '';

  const classes = [
    styles.textComponent,
    variantClass,
    sizeClass,
    weightClass,
    gradient && 'text-gradient-primary',
    shadow && 'text-shadow-md',
    alignClass,
    className
  ].filter(Boolean).join(' ');

  return (
    <StyledHeading
      as={`h${level}`}
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </StyledHeading>
  );
}

BaseHeading.propTypes = {
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
 * BaseParagraph - Chakra UI Text as paragraph with CSS Module styling
 */
export function BaseParagraph({
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
    <BaseText
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
    </BaseText>
  );
}

BaseParagraph.propTypes = {
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
