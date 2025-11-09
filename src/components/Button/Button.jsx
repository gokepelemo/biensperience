import React from 'react';
import PropTypes from 'prop-types';
import './Button.css';

/**
 * Button component with multiple variants and styling options
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {string} props.variant - Button variant: 'gradient', 'outline', 'bootstrap'
 * @param {string} props.bootstrapVariant - Bootstrap variant when variant='bootstrap'
 * @param {boolean} props.rounded - Whether button should be fully rounded
 * @param {boolean} props.shadow - Whether button should have shadow
 * @param {boolean} props.disabled - Whether button is disabled
 * @param {string} props.size - Button size: 'sm', 'md', 'lg'
 * @param {string} props.type - Button type attribute
 * @param {function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
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
  ...props
}) {
  // Build className string
  const classes = [
    'btn-custom',
    `btn-${variant}`,
    rounded && 'btn-rounded',
    shadow && 'btn-shadow',
    size !== 'md' && `btn-${size}`,
    variant === 'bootstrap' && `btn btn-${bootstrapVariant}`,
    className
  ].filter(Boolean).join(' ');

  // If caller requested a custom element via `as` (string tag or component), render it
  if (as) {
    const As = as;
    const forwarded = {
      className: classes,
      onClick,
      style,
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
      style={style}
      {...props}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['gradient', 'outline', 'bootstrap']),
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
  style: PropTypes.object
  ,
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  href: PropTypes.string,
  to: PropTypes.string,
};