/**
 * BaseText — Native Chakra UI v3 Text / Heading components
 *
 * Uses Chakra's native Text and Heading components with recipe-based styling
 * from ui-theme.js. No CSS Modules — pure Chakra tokens and textStyles.
 *
 * Prop mapping:
 *   size → Chakra fontSize token
 *   weight → Chakra fontWeight token
 *   variant → color/gradient mapping
 *   gradient → backgroundClip text + gradient
 *   truncate → Chakra lineClamp
 *   level → Heading as={`h${level}`} + recipe size
 *
 * Task: biensperience-6614 — P2.2 Text/Heading → Chakra
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Text as ChakraText,
  Heading as ChakraHeading,
} from '@chakra-ui/react';

// Map size prop to Chakra fontSize tokens
const SIZE_MAP = {
  xs: 'xs',
  sm: 'sm',
  base: 'md',
  lg: 'lg',
  xl: 'xl',
  '2xl': '2xl',
  '3xl': '3xl',
};

// Map heading levels to Chakra Heading recipe sizes
const HEADING_LEVEL_TO_SIZE = {
  1: '2xl',
  2: 'xl',
  3: 'lg',
  4: 'md',
  5: 'sm',
  6: 'xs',
};

// Map weight prop to Chakra fontWeight tokens
const WEIGHT_MAP = {
  light: 'light',
  normal: 'normal',
  medium: 'medium',
  semibold: 'semibold',
  bold: 'bold',
};

// Gradient styles for text
const GRADIENT_STYLES = {
  backgroundImage: 'linear-gradient(135deg, {colors.brand.500} 0%, {colors.accent.500} 100%)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
};

/**
 * BaseText — Native Chakra Text component
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
  // Resolve variant to color
  const variantColor = {
    body: 'fg',
    lead: 'fg',
    caption: 'fg.muted',
    muted: 'fg.muted',
    gradient: undefined,  // handled by gradient prop
    heading: 'fg',
  }[variant] || 'fg';

  // Resolve fontSize
  const sizeKey = size.startsWith('heading-')
    ? HEADING_LEVEL_TO_SIZE[parseInt(size.split('-')[1])]
    : SIZE_MAP[size] || 'md';

  // Build css prop for gradient/shadow
  const cssOverrides = {};
  if (gradient || variant === 'gradient') {
    Object.assign(cssOverrides, GRADIENT_STYLES);
  }
  if (shadow) {
    cssOverrides.textShadow = 'text';
  }

  return (
    <ChakraText
      as={Component}
      fontSize={sizeKey}
      fontWeight={WEIGHT_MAP[weight] || 'normal'}
      lineHeight={variant === 'lead' ? 'relaxed' : 'normal'}
      color={color || (gradient || variant === 'gradient' ? undefined : variantColor)}
      textAlign={align !== 'left' ? align : undefined}
      lineClamp={truncate > 0 ? truncate : undefined}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      css={Object.keys(cssOverrides).length ? cssOverrides : undefined}
      {...props}
    >
      {children}
    </ChakraText>
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
 * BaseHeading — Native Chakra Heading with recipe sizing
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
  // Resolve recipe size from level or explicit size
  const recipeSize = size
    ? (SIZE_MAP[size] || HEADING_LEVEL_TO_SIZE[level] || 'lg')
    : (HEADING_LEVEL_TO_SIZE[level] || 'lg');

  // Build css overrides
  const cssOverrides = {};
  if (gradient || variant === 'gradient') {
    Object.assign(cssOverrides, GRADIENT_STYLES);
  }
  if (shadow) {
    cssOverrides.textShadow = 'text';
  }

  return (
    <ChakraHeading
      as={`h${level}`}
      size={recipeSize}
      fontWeight={WEIGHT_MAP[weight] || 'bold'}
      color={gradient || variant === 'gradient' ? undefined : (variant === 'muted' ? 'fg.muted' : undefined)}
      textAlign={align !== 'left' ? align : undefined}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      css={Object.keys(cssOverrides).length ? cssOverrides : undefined}
      {...props}
    >
      {children}
    </ChakraHeading>
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
 * BaseParagraph — Convenience wrapper for paragraph text
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

