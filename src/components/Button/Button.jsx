import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './Button.module.scss';
import { calculateButtonWidth } from '../../utilities/button-utils';

/**
 * Button component with unified design system styling
 *
 * Uses standardized design tokens for consistent:
 * - Heights (36px sm, 44px md, 52px lg)
 * - Padding (based on size)
 * - Font sizes (14px sm, 16px md, 18px lg)
 * - Font weight (600 semibold)
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.variant - Button variant: 'gradient', 'outline', 'tertiary', 'link', 'danger', 'success', 'bootstrap'
 * @param {string} props.bootstrapVariant - Bootstrap variant when variant='bootstrap'
 * @param {boolean} props.rounded - Whether button should be fully rounded (pill shape)
 * @param {boolean} props.shadow - Whether button should have enhanced shadow
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {string} props.size - Button size: 'sm', 'md', 'lg'
 * @param {string} props.type - Button type attribute
 * @param {function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {string|string[]} props.matchWidth - Text string(s) to calculate consistent width from
 * @param {boolean} props.fullWidth - Whether button should take full container width
 * @param {Object} props... - Other props passed to button element
 */
export default function Button({
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
  ...props
}) {
  // Normalize legacy variant names: 'primary' -> 'gradient'
  let normalizedVariant = variant;
  if (variant === 'primary') normalizedVariant = 'gradient';

  // Build className string with CSS Modules
  const variantClass = {
    gradient: styles.btnGradient,
    outline: styles.btnOutline,
    tertiary: styles.btnTertiary,
    link: styles.btnLink,
    danger: styles.btnDanger,
    success: styles.btnSuccess,
  }[normalizedVariant] || '';

  const sizeClass = {
    sm: styles.btnSm,
    lg: styles.btnLg,
  }[size] || '';

  const classes = [
    styles.btnCustom,
    variantClass,
    rounded && styles.btnRounded,
    shadow && styles.btnShadow,
    sizeClass,
    normalizedVariant === 'bootstrap' && `btn btn-${bootstrapVariant}`,
    className
  ].filter(Boolean).join(' ');

  // Calculate width based on matchWidth prop (for consistent button sizing)
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

  // If caller requested a custom element via `as` (string tag or component), render it
  if (as) {
    const As = as;
    const forwarded = {
      className: classes,
      onClick,
      style: calculatedStyle,
      ...props,
    };
    if (href) forwarded.href = href;
    if (to) forwarded.to = to;

    return (
      <As {...forwarded}>
        {children}
      </As>
    );
  }

  // Default: native button element
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      style={calculatedStyle}
      {...props}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  // Variants - unified design system
  variant: PropTypes.oneOf([
    'gradient',   // Primary action (purple gradient)
    'outline',    // Secondary action (outlined)
    'tertiary',   // Ghost button (minimal)
    'link',       // Text-only
    'danger',     // Destructive action (red)
    'success',    // Positive action (green)
    'bootstrap',  // Use Bootstrap styling
    'primary',    // Legacy alias for 'gradient'
  ]),
  bootstrapVariant: PropTypes.oneOf([
    'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark',
    'outline-primary', 'outline-secondary', 'outline-success', 'outline-danger',
    'outline-warning', 'outline-info', 'outline-light', 'outline-dark'
  ]),
  rounded: PropTypes.bool,
  shadow: PropTypes.bool,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  onClick: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  href: PropTypes.string,
  to: PropTypes.string,
  // Width matching - ensures consistent button widths
  matchWidth: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  fullWidth: PropTypes.bool,
};
