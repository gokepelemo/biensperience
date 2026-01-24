import React, { useMemo, isValidElement } from 'react';
import { Tooltip as ChakraTooltip, Box } from '@chakra-ui/react';
import PropTypes from 'prop-types';
import { lang } from '../../lang.constants';
import styles from './Tooltip.module.scss';

/**
 * Tooltip Component - Chakra UI v3 tooltip implementation
 * Wraps child element with a tooltip that appears on hover/focus
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Element to attach tooltip to
 * @param {string|React.ReactNode} props.content - Tooltip content
 * @param {string} [props.placement='top'] - Tooltip placement: 'top', 'bottom', 'left', 'right', 'auto', etc.
 * @param {string[]} [props.trigger=['hover', 'focus']] - Trigger events (Chakra handles hover/focus by default)
 * @param {number} [props.delay] - Delay in ms before showing/hiding
 * @param {Object} [props.delayShow] - Delay before showing (maps to openDelay)
 * @param {Object} [props.delayHide] - Delay before hiding (maps to closeDelay)
 * @param {string} [props.className] - Additional CSS class for tooltip
 * @param {boolean} [props.show] - Controlled show state (maps to open)
 * @param {Function} [props.onToggle] - Callback when tooltip toggles
 * @param {boolean} [props.rootClose=false] - Close on click outside (maps to closeOnClick)
 * @param {string} [props.variant] - Tooltip variant ('light' for light backgrounds)
 */
function Tooltip({
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
  variant,
}) {
  // Calculate delay configuration
  const openDelay = useMemo(() => {
    if (delay != null) return delay;
    if (delayShow != null) return delayShow;
    return 250; // Default delay
  }, [delay, delayShow]);

  const closeDelay = useMemo(() => {
    if (delay != null) return delay;
    if (delayHide != null) return delayHide;
    return 0;
  }, [delay, delayHide]);

  // If no content, just return children without tooltip
  if (!content) {
    return <>{children}</>;
  }

  // Ensure children can receive refs - wrap in Box if necessary
  const wrappedChildren = useMemo(() => {
    // If children is a valid React element and can accept ref, use it directly
    if (isValidElement(children)) {
      return children;
    }
    // Otherwise wrap in a span to receive the tooltip ref
    return (
      <Box as="span" display="inline-block" className={styles.tooltipTrigger}>
        {children}
      </Box>
    );
  }, [children]);

  // Memoize CSS styles to prevent re-renders
  const tooltipStyles = useMemo(() => ({
    bg: 'var(--color-bg-tertiary, #2d2d2d)',
    color: 'var(--color-text-primary, #fff)',
    fontSize: 'var(--font-size-sm)',
    px: 'var(--space-3)',
    py: 'var(--space-2)',
    borderRadius: 'var(--radius-sm, 0.25rem)',
    boxShadow: 'var(--shadow-md)',
    maxWidth: '300px',
    zIndex: 1800,
  }), []);

  const arrowStyles = useMemo(() => ({
    '--arrow-background': 'var(--color-bg-tertiary, #2d2d2d)',
  }), []);

  return (
    <ChakraTooltip.Root
      openDelay={openDelay}
      closeDelay={closeDelay}
      open={show}
      onOpenChange={show !== undefined ? (details) => onToggle?.(details.open) : undefined}
      closeOnClick={rootClose}
      positioning={{ placement }}
    >
      <ChakraTooltip.Trigger asChild>
        {wrappedChildren}
      </ChakraTooltip.Trigger>
      <ChakraTooltip.Positioner>
        <ChakraTooltip.Content
          className={className}
          css={tooltipStyles}
        >
          <ChakraTooltip.Arrow>
            <ChakraTooltip.ArrowTip
              css={arrowStyles}
            />
          </ChakraTooltip.Arrow>
          {content}
        </ChakraTooltip.Content>
      </ChakraTooltip.Positioner>
    </ChakraTooltip.Root>
  );
}

const MemoizedTooltip = React.memo(Tooltip, (prevProps, nextProps) => {
  // Custom comparison for memoization - only re-render if key props change
  return (
    prevProps.content === nextProps.content &&
    prevProps.placement === nextProps.placement &&
    prevProps.show === nextProps.show &&
    prevProps.className === nextProps.className &&
    prevProps.delay === nextProps.delay &&
    prevProps.delayShow === nextProps.delayShow &&
    prevProps.delayHide === nextProps.delayHide &&
    prevProps.rootClose === nextProps.rootClose &&
    prevProps.variant === nextProps.variant &&
    // Shallow compare children (React elements are stable if props don't change)
    prevProps.children === nextProps.children
  );
});

MemoizedTooltip.propTypes = {
  children: PropTypes.node.isRequired,
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placement: PropTypes.oneOf([
    'auto', 'top', 'bottom', 'left', 'right',
    'auto-start', 'auto-end',
    'top-start', 'top-end',
    'bottom-start', 'bottom-end',
    'left-start', 'left-end',
    'right-start', 'right-end'
  ]),
  trigger: PropTypes.arrayOf(PropTypes.string),
  delay: PropTypes.number,
  delayShow: PropTypes.number,
  delayHide: PropTypes.number,
  className: PropTypes.string,
  show: PropTypes.bool,
  onToggle: PropTypes.func,
  rootClose: PropTypes.bool,
  container: PropTypes.any,
  variant: PropTypes.string,
};

export default MemoizedTooltip;

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
      <Box
        as="span"
        className={`${iconClass} ${styles.cursorHelp}`}
        tabIndex={0}
        role="button"
        aria-label={lang.current.tooltip.moreInformation}
        display="inline-flex"
        alignItems="center"
        cursor="help"
      >
        {icon}
      </Box>
    </Tooltip>
  );
}

FormTooltip.propTypes = {
  content: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  placement: PropTypes.string,
  icon: PropTypes.string,
  iconClass: PropTypes.string,
};
