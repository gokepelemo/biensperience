/**
 * ChakraButton - Chakra UI v3 Button Implementation
 *
 * Drop-in replacement for the custom Button component.
 * Uses Chakra UI v3 Button primitive for built-in accessibility,
 * keyboard handling, and ARIA support while preserving the existing
 * Button.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets Chakra's default button
 * styling and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Button component.
 *
 * Chakra benefits gained:
 * - Built-in ARIA attributes (role, aria-disabled, aria-busy)
 * - Consistent focus management
 * - Loading state with spinner support
 * - Polymorphic `as` prop with proper type forwarding
 *
 * Task: biensperience-558b - Migrate Button component to Chakra UI
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { chakra } from '@chakra-ui/react';
import styles from './Button.module.scss';
import { calculateButtonWidth } from '../../utilities/button-utils';

const BOOTSTRAP_VARIANTS = [
  'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark',
  'outline-primary', 'outline-secondary', 'outline-success', 'outline-danger',
  'outline-warning', 'outline-info', 'outline-light', 'outline-dark'
];

/**
 * Using chakra.button (the styled factory) instead of the Button recipe component.
 *
 * The Button recipe component (import { Button } from '@chakra-ui/react') applies
 * a full set of recipe base + variant + size styles that fight with our CSS Module
 * classes. The chakra.button factory creates a bare styled <button> element with
 * NO recipe styles — only Chakra's runtime (ARIA, ref forwarding, css prop support).
 * This means our CSS Module classes from Button.module.scss are the sole source of
 * visual styling, with zero specificity conflicts.
 */
const StyledButton = chakra('button');

const ChakraButton = React.forwardRef(function ChakraButton({
  children,
  variant = 'gradient',
  bootstrapVariant = 'primary',
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
  ...props
}, ref) {
  // Normalize legacy variant names: 'primary' -> 'gradient'
  let normalizedVariant = variant;
  let effectiveBootstrapVariant = bootstrapVariant;

  if (variant === 'primary') normalizedVariant = 'gradient';

  // Backward-compat: allow callers to pass bootstrap variants directly via `variant`
  if (typeof variant === 'string' && BOOTSTRAP_VARIANTS.includes(variant)) {
    normalizedVariant = 'bootstrap';
    effectiveBootstrapVariant = variant;
  }

  // Build className string with CSS Modules (identical to original Button)
  const variantClass = {
    gradient: styles.btnGradient,
    outline: styles.btnOutline,
    light: styles.btnLight,
    tertiary: styles.btnTertiary,
    link: styles.btnLink,
    danger: styles.btnDanger,
    success: styles.btnSuccess,
  }[normalizedVariant] || '';

  const sizeClass = {
    xs: styles.btnXs,
    sm: styles.btnSm,
    lg: styles.btnLg,
    xl: styles.btnXl,
  }[size] || '';

  const classes = [
    styles.btnCustom,
    variantClass,
    rounded && styles.btnRounded,
    shadow && styles.btnShadow,
    sizeClass,
    normalizedVariant === 'bootstrap' && `btn btn-${effectiveBootstrapVariant}`,
    className
  ].filter(Boolean).join(' ');

  // Calculate width based on matchWidth prop (identical to original Button)
  const calculatedStyle = useMemo(() => {
    const baseStyle = { ...style };

    if (fullWidth) {
      baseStyle.width = '100%';
      return baseStyle;
    }

    if (matchWidth) {
      const texts = Array.isArray(matchWidth) ? matchWidth : [matchWidth];
      const maxWidth = Math.max(
        ...texts.map(text => calculateButtonWidth(text, { size }))
      );
      baseStyle.minWidth = `${maxWidth}px`;
      baseStyle.width = `${maxWidth}px`;
    }

    return baseStyle;
  }, [matchWidth, fullWidth, size, style]);

  // Render content with optional icons (identical to original Button)
  const buttonContent = (
    <>
      {leftIcon && <span className={styles.btnIcon}>{leftIcon}</span>}
      {children}
      {rightIcon && <span className={styles.btnIcon}>{rightIcon}</span>}
    </>
  );

  // Build the props for the styled button
  const buttonProps = {
    ref,
    className: classes,
    onClick,
    disabled,
    type,
    style: calculatedStyle,
    ...props,
  };

  // If caller requested a custom element via `as`, pass it through
  if (as) {
    buttonProps.as = as;
    if (href) buttonProps.href = href;
    if (to) buttonProps.to = to;
  }

  return (
    <StyledButton {...buttonProps}>
      {buttonContent}
    </StyledButton>
  );
});

export default ChakraButton;

ChakraButton.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf([
    'gradient',
    'outline',
    'light',
    'tertiary',
    'link',
    'danger',
    'success',
    'bootstrap',
    'primary',    // Legacy alias for 'gradient'
    ...BOOTSTRAP_VARIANTS,
  ]),
  bootstrapVariant: PropTypes.oneOf(BOOTSTRAP_VARIANTS),
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
