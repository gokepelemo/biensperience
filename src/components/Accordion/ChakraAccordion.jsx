/**
 * ChakraAccordion - Chakra UI v3 Accordion Component Implementation
 *
 * Drop-in replacement for the react-bootstrap Accordion wrapper.
 * Uses Chakra UI v3 Accordion primitives for built-in accessibility
 * while preserving the existing Accordion.scss styling.
 *
 * IMPORTANT: This implementation uses the existing SCSS styles (global, not module)
 * via the .ds-accordion class, ensuring pixel-perfect visual parity with the original.
 *
 * Chakra benefits gained:
 * - Built-in ARIA attributes
 * - Keyboard navigation (arrow keys, home/end)
 * - Focus management
 * - Controlled/uncontrolled modes
 *
 * Task: biensperience-7d07 - Migrate Accordion component to Chakra UI
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Accordion as ChakraAccordionPrimitive } from '@chakra-ui/react';
import './Accordion.scss';

/**
 * Reset styles to completely override Chakra's default accordion styling.
 * The .ds-accordion class in Accordion.scss handles all visual styling.
 */
const CHAKRA_RESET_STYLES = {
  bg: 'transparent',
  border: 'none',
  borderRadius: 'unset',
  padding: 'unset',
};

/**
 * ChakraAccordion - Chakra UI Accordion.Root with custom styling
 *
 * Uses Chakra Accordion.Root for accessibility benefits,
 * with .ds-accordion class for visual styling.
 */
function ChakraAccordion({ className = '', children, defaultIndex, ...props }) {
  // Convert defaultIndex to defaultValue format for Chakra v3
  // Chakra v3 uses string values like "item-0", "item-1"
  const defaultValue = defaultIndex !== undefined
    ? (Array.isArray(defaultIndex)
        ? defaultIndex.map(i => `item-${i}`)
        : [`item-${defaultIndex}`])
    : undefined;

  return (
    <ChakraAccordionPrimitive.Root
      className={`ds-accordion ${className}`}
      defaultValue={defaultValue}
      variant="plain"
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraAccordionPrimitive.Root>
  );
}

ChakraAccordion.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  defaultIndex: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number)
  ]),
};

/**
 * ChakraAccordionItem - Chakra UI Accordion.Item wrapper
 *
 * Maps to Accordion.Item from react-bootstrap.
 * Requires a value prop for Chakra v3 - auto-generated if not provided.
 */
function ChakraAccordionItem({ eventKey, children, ...props }) {
  // Convert eventKey to value for Chakra v3
  const value = eventKey !== undefined ? `item-${eventKey}` : undefined;

  return (
    <ChakraAccordionPrimitive.Item
      className="accordion-item"
      value={value}
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraAccordionPrimitive.Item>
  );
}

ChakraAccordionItem.propTypes = {
  eventKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  children: PropTypes.node,
};

/**
 * ChakraAccordionHeader - Chakra UI Accordion.ItemTrigger wrapper
 *
 * Maps to Accordion.Header from react-bootstrap.
 * Renders a button that toggles the accordion item.
 */
function ChakraAccordionHeader({ children, ...props }) {
  return (
    <ChakraAccordionPrimitive.ItemTrigger
      className="accordion-button"
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
      <ChakraAccordionPrimitive.ItemIndicator />
    </ChakraAccordionPrimitive.ItemTrigger>
  );
}

ChakraAccordionHeader.propTypes = {
  children: PropTypes.node,
};

/**
 * ChakraAccordionBody - Chakra UI Accordion.ItemContent wrapper
 *
 * Maps to Accordion.Body from react-bootstrap.
 * Contains the collapsible content.
 */
function ChakraAccordionBody({ children, ...props }) {
  return (
    <ChakraAccordionPrimitive.ItemContent
      className="accordion-body"
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraAccordionPrimitive.ItemContent>
  );
}

ChakraAccordionBody.propTypes = {
  children: PropTypes.node,
};

// Attach subcomponents to main component for API parity with react-bootstrap
ChakraAccordion.Item = ChakraAccordionItem;
ChakraAccordion.Header = ChakraAccordionHeader;
ChakraAccordion.Body = ChakraAccordionBody;

export default ChakraAccordion;
