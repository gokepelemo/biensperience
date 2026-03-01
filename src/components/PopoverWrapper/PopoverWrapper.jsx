/**
 * Popover/OverlayTrigger Abstraction Layer
 *
 * Provides a stable API for OverlayTrigger + Popover usage across the application.
 * Wraps either react-bootstrap OverlayTrigger/Popover or the modern BasePopover
 * (CSS-based), controlled by the 'bootstrap_popover' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All OverlayTrigger/Popover consumers should import from design-system,
 * NOT directly from react-bootstrap.
 *
 * Implementation Status:
 * - Phase 4 (Current): modern Popover is default; legacy available via 'bootstrap_popover' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-f51a
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { OverlayTrigger as RBOverlayTrigger, Popover as RBPopover } from 'react-bootstrap';
import { BaseOverlayTrigger, BasePopover } from '../Popover/BasePopover';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * OverlayTriggerWrapper - Design System Abstraction for OverlayTrigger
 */
export function OverlayTriggerWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_popover');
  const Component = useLegacy ? RBOverlayTrigger : BaseOverlayTrigger;
  return <Component {...props} />;
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
 * PopoverWrapper - Design System Abstraction for Popover
 */
export function PopoverWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_popover');
  const PopoverComponent = useLegacy ? RBPopover : BasePopover;
  return <PopoverComponent {...props} />;
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
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_popover');
  const Component = useLegacy ? RBPopover.Header : BasePopover.Header;
  return <Component {...props} />;
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
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_popover');
  const Component = useLegacy ? RBPopover.Body : BasePopover.Body;
  return <Component {...props} />;
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
