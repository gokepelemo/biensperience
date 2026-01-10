import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import styles from './Button.module.scss';
import { calculateButtonWidth } from '../../utilities/button-utils';

const BOOTSTRAP_VARIANTS = [
  'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark',
  'outline-primary', 'outline-secondary', 'outline-success', 'outline-danger',
  'outline-warning', 'outline-info', 'outline-light', 'outline-dark'
];

/**
 * Button component with unified design system styling
 *
 * Uses standardized design tokens for consistent:
 * - Heights (28px xs, 32px sm, 40px md, 48px lg, 56px xl)
 * - Padding (based on size)
 * - Font sizes (12px xs, 14px sm, 16px md, 18px lg, 20px xl)
 * - Font weight (600 semibold)
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.variant - Button variant: 'gradient', 'outline', 'light', 'tertiary', 'link', 'danger', 'success', 'bootstrap'
 * @param {string} props.bootstrapVariant - Bootstrap variant when variant='bootstrap'
 * @param {boolean} props.rounded - Whether button should be fully rounded (pill shape)
 * @param {boolean} props.shadow - Whether button should have enhanced shadow
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {string} props.size - Button size: 'xs', 'sm', 'md', 'lg', 'xl'
 * @param {string} props.type - Button type attribute
 * @param {function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {string|string[]} props.matchWidth - Text string(s) to calculate consistent width from
 * @param {boolean} props.fullWidth - Whether button should take full container width
 * @param {React.ReactNode} props.leftIcon - Icon to display before text
 * @param {React.ReactNode} props.rightIcon - Icon to display after text
 * @param {Object} props... - Other props passed to button element
 */
const Button = React.forwardRef(function Button({
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
  // e.g. <Button variant="outline-secondary" />
  if (typeof variant === 'string' && BOOTSTRAP_VARIANTS.includes(variant)) {
    normalizedVariant = 'bootstrap';
    effectiveBootstrapVariant = variant;
  }

  // Build className string with CSS Modules
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

  // Render content with optional icons
  const buttonContent = (
    <>
      {leftIcon && <span className={styles.btnIcon}>{leftIcon}</span>}
      {children}
      {rightIcon && <span className={styles.btnIcon}>{rightIcon}</span>}
    </>
  );

  // If caller requested a custom element via `as` (string tag or component), render it
  if (as) {
    const As = as;
    const forwarded = {
      ref,
      className: classes,
      onClick,
      style: calculatedStyle,
      ...props,
    };
    if (href) forwarded.href = href;
    if (to) forwarded.to = to;

    return (
      <As {...forwarded}>
        {buttonContent}
      </As>
    );
  }

  // Default: native button element
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      style={calculatedStyle}
      {...props}
    >
      {buttonContent}
    </button>
  );
});

export default Button;

Button.propTypes = {
  children: PropTypes.node.isRequired,
  // Variants - unified design system
  variant: PropTypes.oneOf([
    'gradient',   // Primary action (purple gradient)
    'outline',    // Secondary action (outlined)
    'light',      // Light/soft variant (light purple bg, purple text)
    'tertiary',   // Ghost button (minimal)
    'link',       // Text-only
    'danger',     // Destructive action (red)
    'success',    // Positive action (green)
    'bootstrap',  // Use Bootstrap styling
    'primary',    // Legacy alias for 'gradient'
    ...BOOTSTRAP_VARIANTS, // Legacy: callers may pass bootstrapVariant through `variant`
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
  // Width matching - ensures consistent button widths
  matchWidth: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
};
