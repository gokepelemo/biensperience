import React from 'react';
import { OverlayTrigger, Tooltip as BootstrapTooltip } from 'react-bootstrap';
import PropTypes from 'prop-types';

/**
 * Tooltip Component - Bootstrap Tooltip with Popper.js
 * Wraps child element with a tooltip that appears on hover/focus
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Element to attach tooltip to
 * @param {string|React.ReactNode} props.content - Tooltip content
 * @param {string} [props.placement='top'] - Tooltip placement: 'top', 'bottom', 'left', 'right', 'auto'
 * @param {string[]} [props.trigger=['hover', 'focus']] - Trigger events
 * @param {number} [props.delay] - Delay in ms before showing/hiding
 * @param {Object} [props.delayShow] - Delay before showing
 * @param {Object} [props.delayHide] - Delay before hiding
 * @param {string} [props.className] - Additional CSS class for tooltip
 * @param {boolean} [props.show] - Controlled show state
 * @param {Function} [props.onToggle] - Callback when tooltip toggles
 */
export default function Tooltip({
  children,
  content,
  placement = 'top',
  trigger = ['hover', 'focus'],
  delay,
  delayShow,
  delayHide,
  className = '',
  show,
  onToggle,
}) {

  // If no content, just return children without tooltip
  if (!content) {
    return <>{children}</>;
  }

  const renderTooltip = (props) => (
    <BootstrapTooltip id={`tooltip-${Math.random().toString(36).substr(2, 9)}`} className={className} {...props}>
      {content}
    </BootstrapTooltip>
  );

  // Popper.js configuration to prevent flash at (0,0) position
  const popperConfig = {
    modifiers: [
      {
        name: 'preventOverflow',
        options: {
          boundary: 'viewport',
        },
      },
      {
        name: 'offset',
        options: {
          offset: [0, 8], // Add space between trigger and tooltip
        },
      },
    ],
  };

  return (
    <OverlayTrigger
      placement={placement}
      delay={delay || { show: delayShow, hide: delayHide }}
      overlay={renderTooltip}
      trigger={trigger}
      show={show}
      onToggle={onToggle}
      popperConfig={popperConfig}
    >
      {children}
    </OverlayTrigger>
  );
}

Tooltip.propTypes = {
  children: PropTypes.node.isRequired,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placement: PropTypes.oneOf(['auto', 'top', 'bottom', 'left', 'right', 'auto-start', 'auto-end', 'top-start', 'top-end', 'bottom-start', 'bottom-end', 'left-start', 'left-end', 'right-start', 'right-end']),
  trigger: PropTypes.arrayOf(PropTypes.string),
  delay: PropTypes.number,
  delayShow: PropTypes.number,
  delayHide: PropTypes.number,
  className: PropTypes.string,
  show: PropTypes.bool,
  onToggle: PropTypes.func,
};

/**
 * FormTooltip Component - Specialized tooltip for form fields
 * Shows an info icon with tooltip next to form labels
 * 
 * @param {Object} props
 * @param {string|React.ReactNode} props.content - Tooltip content
 * @param {string} [props.placement='top'] - Tooltip placement
 * @param {string} [props.icon='ℹ️'] - Icon to display
 * @param {string} [props.iconClass='text-info ms-2'] - CSS class for icon
 */
export function FormTooltip({ content, placement = 'top', icon = 'ℹ️', iconClass = 'text-info ms-2' }) {
  if (!content) return null;

  return (
    <Tooltip content={content} placement={placement}>
      <span 
        className={iconClass} 
        style={{ cursor: 'help' }}
        tabIndex={0}
        role="button"
        aria-label="More information"
      >
        {icon}
      </span>
    </Tooltip>
  );
}

FormTooltip.propTypes = {
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placement: PropTypes.string,
  icon: PropTypes.string,
  iconClass: PropTypes.string,
};
