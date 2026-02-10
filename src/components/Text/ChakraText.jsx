/**
 * ChakraText - Chakra UI v3 Text Components Implementation
 *
 * Drop-in replacements for the custom Text components.
 * Uses Chakra UI v3 Text and Heading primitives for built-in accessibility
 * while preserving the existing Text.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets Chakra's default styling
 * and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Text components.
 *
 * Chakra benefits gained:
 * - Built-in accessibility attributes
 * - Semantic heading structure
 * - Consistent typography handling
 *
 * Task: biensperience-445f - Migrate Text and Typography components to Chakra UI
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Text as ChakraTextPrimitive, Heading as ChakraHeadingPrimitive } from '@chakra-ui/react';
import styles from './Text.module.scss';

/**
 * Reset styles to completely override Chakra's default text styling.
 * This ensures the CSS Module classes from Text.module.scss are the
 * sole source of visual styling — pixel-perfect match with the original.
 */
const CHAKRA_RESET_STYLES = {
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  lineHeight: 'inherit',
  color: 'inherit',
  letterSpacing: 'inherit',
  margin: 0,
  padding: 0,
};

/**
 * ChakraText - Chakra UI Text with CSS Module styling
 *
 * Uses Chakra Text primitive for accessibility benefits,
 * with reset styling to use CSS Modules.
 */
export default function ChakraText({
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
    <ChakraTextPrimitive
      as={Component}
      className={classes}
      style={style}
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraTextPrimitive>
  );
}

ChakraText.propTypes = {
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
 * ChakraHeading - Chakra UI Heading with CSS Module styling
 *
 * Uses Chakra Heading primitive for semantic heading structure,
 * with reset styling to use CSS Modules.
 */
export function ChakraHeading({
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
    <ChakraHeadingPrimitive
      as={`h${level}`}
      className={classes}
      style={style}
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraHeadingPrimitive>
  );
}

ChakraHeading.propTypes = {
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
 * ChakraParagraph - Chakra UI Text as paragraph with CSS Module styling
 */
export function ChakraParagraph({
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
    <ChakraText
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
    </ChakraText>
  );
}

ChakraParagraph.propTypes = {
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
