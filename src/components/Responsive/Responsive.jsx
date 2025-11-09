import React from 'react';
import PropTypes from 'prop-types';
import './Responsive.css';

/**
 * Show component that only displays content on specific screen sizes
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content to conditionally show
 * @param {string} props.on - Screen sizes to show on: 'mobile', 'tablet', 'desktop', 'mobile-tablet', 'tablet-desktop'
 * @param {string} props.as - HTML element to render: 'div', 'span', 'section', etc.
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to element
 */
export function Show({
  children,
  on = 'mobile',
  as: Component = 'div',
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'responsive-show',
    `show-${on}`,
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

Show.propTypes = {
  children: PropTypes.node.isRequired,
  on: PropTypes.oneOf(['mobile', 'tablet', 'desktop', 'mobile-tablet', 'tablet-desktop']),
  as: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Hide component that hides content on specific screen sizes
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Content to conditionally hide
 * @param {string} props.on - Screen sizes to hide on: 'mobile', 'tablet', 'desktop', 'mobile-tablet', 'tablet-desktop'
 * @param {string} props.as - HTML element to render: 'div', 'span', 'section', etc.
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to element
 */
export function Hide({
  children,
  on = 'mobile',
  as: Component = 'div',
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'responsive-hide',
    `hide-${on}`,
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

Hide.propTypes = {
  children: PropTypes.node.isRequired,
  on: PropTypes.oneOf(['mobile', 'tablet', 'desktop', 'mobile-tablet', 'tablet-desktop']),
  as: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Mobile component that only shows content on mobile devices
 */
export function Mobile({ children, className = '', style = {}, ...props }) {
  return (
    <Show
      on="mobile"
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Show>
  );
}

Mobile.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Tablet component that only shows content on tablet devices
 */
export function Tablet({ children, className = '', style = {}, ...props }) {
  return (
    <Show
      on="tablet"
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Show>
  );
}

Tablet.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Desktop component that only shows content on desktop devices
 */
export function Desktop({ children, className = '', style = {}, ...props }) {
  return (
    <Show
      on="desktop"
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Show>
  );
}

Desktop.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * HiddenOnMobile component that hides content on mobile devices
 */
export function HiddenOnMobile({ children, className = '', style = {}, ...props }) {
  return (
    <Hide
      on="mobile"
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Hide>
  );
}

HiddenOnMobile.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * VisibleOnMobile component that only shows content on mobile devices
 */
export function VisibleOnMobile({ children, className = '', style = {}, ...props }) {
  return (
    <Show
      on="mobile"
      className={className}
      style={style}
      {...props}
    >
      {children}
    </Show>
  );
}

VisibleOnMobile.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};