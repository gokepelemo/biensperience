/**
 * BasePopover - Native Chakra UI v3 Popover Implementation
 *
 * Drop-in replacement for the CSS-based popover system.
 * Uses Chakra Popover compound components with the slot recipe from
 * ui-theme.js for styling — no SCSS, no manual positioning.
 *
 * Features:
 * - Automatic positioning via Chakra's Popover engine
 * - Portal rendering (escapes overflow:hidden ancestors)
 * - Hover and focus trigger support via controlled state
 * - Header/Body slots styled by popover recipe
 * - Keyboard accessible
 *
 * Migration: biensperience-605a (P3.5)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Popover as PopoverPrimitive, Portal } from '@chakra-ui/react';

/**
 * BaseOverlayTrigger - Shows an overlay element on hover/focus
 *
 * Uses Chakra Popover with controlled state to implement hover/focus
 * trigger behavior. Replaces manual getBoundingClientRect positioning
 * and createPortal with Chakra's built-in positioning engine.
 *
 * @param {Array} trigger - Trigger types: ['hover'], ['focus'], or ['hover', 'focus']
 * @param {string} placement - Overlay placement: 'top', 'bottom', 'left', 'right'
 * @param {ReactElement} overlay - The overlay content to display
 */
export function BaseOverlayTrigger({ trigger = ['hover', 'focus'], placement = 'top', overlay, children }) {
  const [open, setOpen] = useState(false);
  const hideTimerRef = useRef(null);
  const triggerArr = Array.isArray(trigger) ? trigger : [trigger];

  const showOverlay = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setOpen(true);
  }, []);

  const hideOverlay = useCallback(() => {
    // Small delay to allow moving cursor to the popover content
    hideTimerRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Build event handlers based on trigger types
  const triggerHandlers = {};
  const contentHandlers = {};

  if (triggerArr.includes('hover')) {
    triggerHandlers.onMouseEnter = showOverlay;
    triggerHandlers.onMouseLeave = hideOverlay;
    contentHandlers.onMouseEnter = showOverlay;
    contentHandlers.onMouseLeave = hideOverlay;
  }
  if (triggerArr.includes('focus')) {
    triggerHandlers.onFocus = showOverlay;
    triggerHandlers.onBlur = hideOverlay;
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) setOpen(false);
      }}
      positioning={{ placement }}
      autoFocus={false}
      closeOnInteractOutside={true}
      lazyMount
      unmountOnExit
    >
      <PopoverPrimitive.Trigger asChild>
        <span
          {...triggerHandlers}
          style={{ display: 'inline' }}
        >
          {children}
        </span>
      </PopoverPrimitive.Trigger>
      <Portal>
        <PopoverPrimitive.Positioner>
          <PopoverPrimitive.Content {...contentHandlers}>
            {overlay}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Positioner>
      </Portal>
    </PopoverPrimitive.Root>
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
 * Renders as a simple wrapper div since Chakra Popover.Content handles
 * the popup container styling via the recipe.
 */
function BasePopover({ id, children, className = '' }) {
  return (
    <div id={id} className={className || undefined}>
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
 * BasePopoverHeader - Chakra Popover.Header wrapper
 *
 * NOTE: The `as` prop from react-bootstrap is intentionally ignored.
 * Chakra Popover.Header renders with recipe slot styling.
 */
function BasePopoverHeader({ as: _as, children, className = '' }) {
  return (
    <PopoverPrimitive.Header className={className || undefined}>
      {children}
    </PopoverPrimitive.Header>
  );
}

BasePopoverHeader.displayName = 'Popover.Header';
BasePopoverHeader.propTypes = {
  as: PropTypes.elementType,
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BasePopoverBody - Chakra Popover.Body wrapper
 */
function BasePopoverBody({ children, className = '' }) {
  return (
    <PopoverPrimitive.Body className={className || undefined}>
      {children}
    </PopoverPrimitive.Body>
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
