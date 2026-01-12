import React, { useId, useMemo } from 'react';
import { OverlayTrigger, Tooltip as BootstrapTooltip } from 'react-bootstrap';
import PropTypes from 'prop-types';
import { lang } from '../../lang.constants';

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
 * @param {boolean} [props.rootClose=false] - Close on click outside (for click-triggered tooltips)
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
  rootClose = false,
  container,
}) {
  // Generate stable ID using React's useId hook to prevent re-render issues
  const tooltipId = useId();

  // Default to rendering overlays at the document.body level.
  // This avoids tooltips being clipped by parents (e.g., modals with overflow hidden).
  const resolvedContainer = useMemo(() => {
    if (container !== undefined) return container;
    if (typeof document !== 'undefined') return document.body;
    return undefined;
  }, [container]);

  // If no content, just return children without tooltip
  if (!content) {
    return <>{children}</>;
  }

  // Memoize the tooltip render function to prevent unnecessary re-renders
  const renderTooltip = useMemo(() => (props) => (
    <BootstrapTooltip id={`tooltip-${tooltipId}`} className={className} {...props}>
      {content}
    </BootstrapTooltip>
  ), [tooltipId, className, content]);

  // Memoize Popper.js configuration to prevent re-initialization on every render
  const popperConfig = useMemo(() => ({
    modifiers: [
      {
        // react-bootstrap normally enables flip by default.
        // Since we provide a custom popperConfig, include flip explicitly so tooltips
        // still appear when there's not enough room for the preferred placement.
        name: 'flip',
        options: {
          fallbackPlacements: ['top', 'bottom', 'right', 'left'],
        },
      },
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
  }), []);

  // Memoize delay configuration to prevent reference changes
  const delayConfig = useMemo(() => {
    if (delay != null) return delay;
    if (delayShow != null || delayHide != null) {
      return { show: delayShow ?? 0, hide: delayHide ?? 0 };
    }
    return undefined;
  }, [delay, delayShow, delayHide]);

  return (
    <OverlayTrigger
      placement={placement}
      delay={delayConfig}
      overlay={renderTooltip}
      trigger={trigger}
      show={show}
      onToggle={onToggle}
      popperConfig={popperConfig}
      rootClose={rootClose}
      container={resolvedContainer}
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
  rootClose: PropTypes.bool,
  container: PropTypes.any,
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
        className={`${iconClass} cursor-help`} 
        tabIndex={0}
        role="button"
        aria-label={lang.current.tooltip.moreInformation}
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
