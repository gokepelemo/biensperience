/**
 * Popover/OverlayTrigger Abstraction Layer
 *
 * Provides a stable API for OverlayTrigger + Popover usage across the application.
 * All consumers should import from design-system, NOT directly from BasePopover.
 *
 * Implementation: CSS-based Popover (BasePopover) — Phase 5 complete.
 *
 * Task: biensperience-f51a
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { BaseOverlayTrigger, BasePopover } from '../Popover/BasePopover';

/**
 * OverlayTriggerWrapper - Design System OverlayTrigger
 */
export function OverlayTriggerWrapper(props) {
  return <BaseOverlayTrigger {...props} />;
}

OverlayTriggerWrapper.displayName = 'OverlayTrigger';

OverlayTriggerWrapper.propTypes = {
  trigger: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  placement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  overlay: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};

/**
 * PopoverWrapper - Design System Popover
 */
export function PopoverWrapper(props) {
  return <BasePopover {...props} />;
}

PopoverWrapper.displayName = 'Popover';

PopoverWrapper.propTypes = {
  id: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * PopoverHeaderWrapper
 */
export function PopoverHeaderWrapper(props) {
  return <BasePopover.Header {...props} />;
}

PopoverHeaderWrapper.displayName = 'Popover.Header';
PopoverHeaderWrapper.propTypes = {
  as: PropTypes.elementType,
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * PopoverBodyWrapper
 */
export function PopoverBodyWrapper(props) {
  return <BasePopover.Body {...props} />;
}

PopoverBodyWrapper.displayName = 'Popover.Body';
PopoverBodyWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

// Attach compound sub-components for <Popover.Header> / <Popover.Body> syntax
PopoverWrapper.Header = PopoverHeaderWrapper;
PopoverWrapper.Body = PopoverBodyWrapper;

export default OverlayTriggerWrapper;
