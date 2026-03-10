/**
 * BaseButton — Native Chakra UI v3 Button
 *
 * Uses the Chakra `Button` recipe component (defined in ui-theme.js recipes.button)
 * for ALL styling. No CSS Modules — pure Chakra recipe tokens.
 *
 * Variant mapping (legacy → recipe):
 *   primary → gradient, light → secondary, outline-secondary → outline,
 *   outline-primary → outline, bootstrap variants → mapped to closest recipe variant
 *
 * Benefits:
 *   - Zero CSS Module dependency — styling 100% from Chakra recipe
 *   - Dark mode via semantic tokens (automatic)
 *   - Type-safe variant/size from theme recipe
 *   - Built-in ARIA, focus ring, keyboard handling
 *   - Polymorphic `as` prop
 *
 * Task: biensperience-1c90 — P2.1 Button → Chakra Button
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button as ChakraButton } from '@chakra-ui/react';
import { calculateButtonWidth } from '../../utilities/button-utils';

// Map legacy / Bootstrap variant names → Chakra recipe variants
const VARIANT_MAP = {
  // Direct recipe variants (pass through)
  gradient: 'gradient',
  secondary: 'secondary',
  tertiary: 'tertiary',
  danger: 'danger',
  success: 'success',
  link: 'link',
  outline: 'outline',
  ghost: 'ghost',

  // Legacy aliases
  primary: 'gradient',
  light: 'secondary',

  // Bootstrap → recipe
  'outline-primary': 'outline',
  'outline-secondary': 'outline',
  'outline-success': 'outline',
  'outline-danger': 'outline',
  'outline-warning': 'outline',
  'outline-info': 'outline',
  'outline-light': 'outline',
  'outline-dark': 'outline',
  warning: 'secondary',
  info: 'secondary',
  dark: 'ghost',
};

const ALL_VARIANT_KEYS = Object.keys(VARIANT_MAP);

const BaseButton = React.forwardRef(function BaseButton({
  children,
  variant = 'gradient',
  bootstrapVariant,
  rounded = false,
  shadow = false,
  disabled = false,
  size = 'md',
  type = 'button',
  onClick,
  className = '',
  style = {},
  as = null,
  href,
  to,
  matchWidth = null,
  fullWidth = false,
  leftIcon = null,
  rightIcon = null,
  ...rest
}, ref) {
  // Resolve variant: use bootstrapVariant if variant is 'bootstrap'
  const effectiveVariant = variant === 'bootstrap'
    ? (bootstrapVariant || 'primary')
    : variant;

  // Map to Chakra recipe variant
  const recipeVariant = VARIANT_MAP[effectiveVariant] || 'gradient';

  // Map size — Chakra recipe supports xs / sm / md / lg; xl → lg
  const recipeSize = size === 'xl' ? 'lg' : size;

  // Extra style props for rounded, shadow, fullWidth, matchWidth
  const extraStyles = useMemo(() => {
    const s = { ...style };

    if (fullWidth) {
      s.width = '100%';
    } else if (matchWidth) {
      const texts = Array.isArray(matchWidth) ? matchWidth : [matchWidth];
      const maxWidth = Math.max(
        ...texts.map(text => calculateButtonWidth(text, { size }))
      );
      s.minWidth = `${maxWidth}px`;
      s.width = `${maxWidth}px`;
    }

    return s;
  }, [matchWidth, fullWidth, size, style]);

  // Compose CSS overrides for rounded / shadow
  const cssOverrides = useMemo(() => {
    const css = {};
    if (rounded) css.borderRadius = 'full';
    if (shadow) css.boxShadow = 'lg';
    return Object.keys(css).length ? css : undefined;
  }, [rounded, shadow]);

  // Content with optional icons
  const content = (
    <>
      {leftIcon && <span style={{ display: 'inline-flex', marginRight: '0.35em' }}>{leftIcon}</span>}
      {children}
      {rightIcon && <span style={{ display: 'inline-flex', marginLeft: '0.35em' }}>{rightIcon}</span>}
    </>
  );

  const buttonProps = {
    ref,
    variant: recipeVariant,
    size: recipeSize,
    type,
    disabled,
    onClick,
    className: className || undefined,
    style: Object.keys(extraStyles).length ? extraStyles : undefined,
    css: cssOverrides,
    ...rest,
  };

  // Polymorphic rendering
  if (as) {
    buttonProps.as = as;
    if (href) buttonProps.href = href;
    if (to) buttonProps.to = to;
  }

  return (
    <ChakraButton {...buttonProps}>
      {content}
    </ChakraButton>
  );
});

export default BaseButton;

BaseButton.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf([
    'gradient', 'outline', 'secondary', 'tertiary', 'link',
    'danger', 'success', 'ghost', 'bootstrap',
    'primary', 'light',   // Legacy aliases
    ...ALL_VARIANT_KEYS.filter(k => k.includes('-')),
  ]),
  bootstrapVariant: PropTypes.string,
  rounded: PropTypes.bool,
  shadow: PropTypes.bool,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  onClick: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  href: PropTypes.string,
  to: PropTypes.string,
  matchWidth: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
};

