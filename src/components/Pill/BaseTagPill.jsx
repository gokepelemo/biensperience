/**
 * BaseTagPill — Native Chakra UI Tag with token-based styling
 *
 * Uses Chakra's Tag.Root component with native colorPalette tokens.
 * Supports polymorphic rendering (Link, anchor, custom component).
 * No CSS Modules — pure Chakra tokens and css prop.
 *
 * Task: biensperience-5c80 — P2.3 Pill/Badge → Chakra Badge/Tag
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Tag, Box } from '@chakra-ui/react';
import { FaTimes } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { lang } from '../../lang.constants';

// Map TagPill color names to Chakra colorPalette tokens
const COLOR_PALETTE_MAP = {
  primary: 'brand',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  info: 'blue',
  neutral: 'gray',
  light: 'gray',
};

// Size → padding/fontSize maps
const SIZE_STYLES = {
  sm: { fontSize: 'xs', px: '2', py: '0.5', gap: '1' },
  md: { fontSize: 'sm', px: '3', py: '1', gap: '1.5' },
  lg: { fontSize: 'md', px: '4', py: '1.5', gap: '2' },
};

// Gradient background per color
const GRADIENT_MAP = {
  primary: 'linear-gradient(135deg, {colors.brand.500} 0%, {colors.accent.500} 100%)',
  success: 'linear-gradient(135deg, {colors.green.500} 0%, {colors.green.400} 100%)',
  warning: 'linear-gradient(135deg, {colors.yellow.500} 0%, {colors.yellow.400} 100%)',
  danger: 'linear-gradient(135deg, {colors.red.500} 0%, {colors.red.400} 100%)',
  info: 'linear-gradient(135deg, {colors.blue.500} 0%, {colors.blue.400} 100%)',
  neutral: 'linear-gradient(135deg, {colors.gray.500} 0%, {colors.gray.400} 100%)',
  light: 'linear-gradient(135deg, {colors.gray.200} 0%, {colors.gray.100} 100%)',
};

export default function BaseTagPill({
  children,
  color = 'primary',
  gradient = true,
  rounded = true,
  removable = false,
  onRemove,
  size = 'md',
  className = '',
  to,
  as: asProp = null,
  href,
  ...props
}) {
  const sizeTokens = SIZE_STYLES[size] || SIZE_STYLES.md;
  const colorPalette = COLOR_PALETTE_MAP[color] || 'brand';

  // Build shared css prop
  const sharedCss = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: `{spacing.${sizeTokens.gap}}`,
    px: `{spacing.${sizeTokens.px}}`,
    py: `{spacing.${sizeTokens.py}}`,
    fontSize: `{fontSizes.${sizeTokens.fontSize}}`,
    fontWeight: '{fontWeights.medium}',
    lineHeight: '{lineHeights.tight}',
    borderRadius: rounded ? '{radii.full}' : '{radii.md}',
    color: gradient || color === 'light'
      ? (color === 'light' ? '{colors.gray.700}' : 'white')
      : `{colors.${colorPalette}.700}`,
    background: gradient
      ? GRADIENT_MAP[color] || GRADIENT_MAP.primary
      : `{colors.${colorPalette}.100}`,
    whiteSpace: 'nowrap',
    cursor: (to || href || asProp) ? 'pointer' : 'default',
    textDecoration: 'none',
    transition: 'all {durations.fast}',
    _hover: {
      transform: 'translateY(-1px)',
      boxShadow: '{shadows.sm}',
      opacity: 0.9,
      textDecoration: 'none',
    },
    _dark: {
      color: gradient ? 'white' : `{colors.${colorPalette}.200}`,
      background: gradient
        ? GRADIENT_MAP[color] || GRADIENT_MAP.primary
        : `{colors.${colorPalette}.900}`,
    },
  };

  const content = (
    <>
      <span>{children}</span>
      {removable && (
        <Box
          as="button"
          type="button"
          aria-label={lang.current.aria.remove}
          onClick={(e) => { e.stopPropagation(); onRemove && onRemove(e); }}
          css={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'inherit',
            opacity: 0.7,
            transition: 'opacity {durations.fast}',
            _hover: { opacity: 1 },
            '& svg': {
              width: size === 'sm' ? '0.6em' : size === 'lg' ? '0.8em' : '0.7em',
              height: size === 'sm' ? '0.6em' : size === 'lg' ? '0.8em' : '0.7em',
            },
          }}
        >
          <FaTimes />
        </Box>
      )}
    </>
  );

  // React Router link
  if (to) {
    return (
      <Box as={Link} to={to} css={sharedCss} className={className || undefined} {...props}>
        {content}
      </Box>
    );
  }

  // Anchor tag
  if (asProp === 'a') {
    return (
      <Box as="a" href={href} css={sharedCss} className={className || undefined} {...props}>
        {content}
      </Box>
    );
  }

  // Custom component
  if (asProp && typeof asProp !== 'string') {
    return (
      <Box as={asProp} href={href} to={to} css={sharedCss} className={className || undefined} {...props}>
        {content}
      </Box>
    );
  }

  // Default: Chakra Tag.Root
  return (
    <Tag.Root
      colorPalette={colorPalette}
      css={sharedCss}
      className={className || undefined}
      {...props}
    >
      {content}
    </Tag.Root>
  );
}

BaseTagPill.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info', 'neutral', 'light']),
  gradient: PropTypes.bool,
  rounded: PropTypes.bool,
  removable: PropTypes.bool,
  onRemove: PropTypes.func,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  to: PropTypes.string,
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  href: PropTypes.string,
};
