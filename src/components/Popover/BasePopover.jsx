/**
 * BasePopover - CSS/React-based popover and overlay trigger
 *
 * Drop-in replacement for react-bootstrap OverlayTrigger + Popover.
 * Uses CSS positioning and React state for hover/focus-triggered popovers.
 * No external dependencies beyond React.
 *
 * Components:
 * - BaseOverlayTrigger: Wraps a child element and shows an overlay on hover/focus
 * - BasePopover: Container with compound .Header and .Body sub-components
 *
 * Task: biensperience-f51a
 * Related: biensperience-e5c4 (epic)
 */

import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import styles from './BasePopover.module.scss';

/**
 * BaseOverlayTrigger - Shows an overlay element on hover/focus
 *
 * Maps to react-bootstrap `<OverlayTrigger>`.
 *
 * @param {Array} trigger - Trigger types: ['hover'], ['focus'], or ['hover', 'focus']
 * @param {string} placement - Overlay placement: 'top', 'bottom', 'left', 'right'
 * @param {ReactElement} overlay - The overlay content to display
 */
export function BaseOverlayTrigger({ trigger = ['hover', 'focus'], placement = 'top', overlay, children }) {
  const [show, setShow] = useState(false);
  const hideTimerRef = useRef(null);

  const showOverlay = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setShow(true);
  }, []);

  const hideOverlay = useCallback(() => {
    // Small delay to allow moving cursor to the popover content
    hideTimerRef.current = setTimeout(() => setShow(false), 150);
  }, []);

  const triggerHandlers = {};
  const triggerArr = Array.isArray(trigger) ? trigger : [trigger];

  if (triggerArr.includes('hover')) {
    triggerHandlers.onMouseEnter = showOverlay;
    triggerHandlers.onMouseLeave = hideOverlay;
  }
  if (triggerArr.includes('focus')) {
    triggerHandlers.onFocus = showOverlay;
    triggerHandlers.onBlur = hideOverlay;
  }

  const placementClass = styles[`placement${placement.charAt(0).toUpperCase()}${placement.slice(1)}`] || styles.placementTop;

  return (
    <span
      className={styles.overlayTriggerContainer}
      {...triggerHandlers}
    >
      {children}
      {show && (
        <div
          className={`${styles.overlayContent} ${placementClass}`}
          onMouseEnter={triggerArr.includes('hover') ? showOverlay : undefined}
          onMouseLeave={triggerArr.includes('hover') ? hideOverlay : undefined}
        >
          {overlay}
        </div>
      )}
    </span>
  );
}

BaseOverlayTrigger.displayName = 'OverlayTrigger';

BaseOverlayTrigger.propTypes = {
  trigger: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  placement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  overlay: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};

/**
 * BasePopover - Popover container with compound sub-components
 *
 * Maps to react-bootstrap `<Popover>`.
 */
function BasePopover({ id, children, className = '' }) {
  return (
    <div id={id} className={`${styles.popover} ${className}`.trim()} role="tooltip">
      {children}
    </div>
  );
}

BasePopover.displayName = 'Popover';

BasePopover.propTypes = {
  id: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BasePopoverHeader
 */
function BasePopoverHeader({ as: Component = 'h3', children, className = '' }) {
  return (
    <Component className={`${styles.popoverHeader} ${className}`.trim()}>
      {children}
    </Component>
  );
}

BasePopoverHeader.displayName = 'Popover.Header';
BasePopoverHeader.propTypes = {
  as: PropTypes.elementType,
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BasePopoverBody
 */
function BasePopoverBody({ children, className = '' }) {
  return (
    <div className={`${styles.popoverBody} ${className}`.trim()}>
      {children}
    </div>
  );
}

BasePopoverBody.displayName = 'Popover.Body';
BasePopoverBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

// Attach compound sub-components
BasePopover.Header = BasePopoverHeader;
BasePopover.Body = BasePopoverBody;

export { BasePopover };
export default BaseOverlayTrigger;
