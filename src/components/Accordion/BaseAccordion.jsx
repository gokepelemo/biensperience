/**
 * BaseAccordion - Design System Accordion Component Implementation
 *
 * Drop-in replacement for the react-bootstrap Accordion wrapper.
 * Uses Accordion primitives for built-in accessibility
 * while preserving the existing Accordion.scss styling.
 *
 * IMPORTANT: This implementation uses the existing SCSS styles (global, not module)
 * via the .ds-accordion class, ensuring pixel-perfect visual parity with the original.
 *
 * Benefits:
 * - Built-in ARIA attributes
 * - Keyboard navigation (arrow keys, home/end)
 * - Focus management
 * - Controlled/uncontrolled modes
 *
 * Task: biensperience-7d07 - Migrate Accordion component
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Accordion as AccordionPrimitive } from '@chakra-ui/react';
import './Accordion.scss';

/**
 * Reset styles to completely override default accordion styling.
 * The .ds-accordion class in Accordion.scss handles all visual styling.
 */
const RESET_STYLES = {
  bg: 'transparent',
  border: 'none',
  borderRadius: 'unset',
  padding: 'unset',
};

/**
 * BaseAccordion - Chakra UI Accordion.Root with custom styling
 *
 * Uses Chakra Accordion.Root for accessibility benefits,
 * with .ds-accordion class for visual styling.
 */
function BaseAccordion({ className = '', children, defaultIndex, ...props }) {
  // Convert defaultIndex to defaultValue format for Chakra v3
  // Chakra v3 uses string values like "item-0", "item-1"
  const defaultValue = defaultIndex !== undefined
    ? (Array.isArray(defaultIndex)
        ? defaultIndex.map(i => `item-${i}`)
        : [`item-${defaultIndex}`])
    : undefined;

  return (
    <AccordionPrimitive.Root
      className={`ds-accordion ${className}`}
      defaultValue={defaultValue}
      variant="plain"
      css={RESET_STYLES}
      {...props}
    >
      {children}
    </AccordionPrimitive.Root>
  );
}

BaseAccordion.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
  defaultIndex: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.number)
  ]),
};

/**
 * BaseAccordionItem - Chakra UI Accordion.Item wrapper
 *
 * Maps to Accordion.Item from react-bootstrap.
 * Requires a value prop for Chakra v3 - auto-generated if not provided.
 */
function BaseAccordionItem({ eventKey, children, ...props }) {
  // Convert eventKey to value for Chakra v3
  const value = eventKey !== undefined ? `item-${eventKey}` : undefined;

  return (
    <AccordionPrimitive.Item
      className="accordion-item"
      value={value}
      css={RESET_STYLES}
      {...props}
    >
      {children}
    </AccordionPrimitive.Item>
  );
}

BaseAccordionItem.propTypes = {
  eventKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  children: PropTypes.node,
};

/**
 * BaseAccordionHeader - Chakra UI Accordion.ItemTrigger wrapper
 *
 * Maps to Accordion.Header from react-bootstrap.
 * Renders a button that toggles the accordion item.
 */
function BaseAccordionHeader({ children, ...props }) {
  return (
    <AccordionPrimitive.ItemTrigger
      className="accordion-button"
      css={RESET_STYLES}
      {...props}
    >
      {children}
      <AccordionPrimitive.ItemIndicator />
    </AccordionPrimitive.ItemTrigger>
  );
}

BaseAccordionHeader.propTypes = {
  children: PropTypes.node,
};

/**
 * BaseAccordionBody - Chakra UI Accordion.ItemContent wrapper
 *
 * Maps to Accordion.Body from react-bootstrap.
 * Contains the collapsible content.
 */
function BaseAccordionBody({ children, ...props }) {
  return (
    <AccordionPrimitive.ItemContent
      className="accordion-body"
      css={RESET_STYLES}
      {...props}
    >
      {children}
    </AccordionPrimitive.ItemContent>
  );
}

BaseAccordionBody.propTypes = {
  children: PropTypes.node,
};

// Attach subcomponents to main component for API parity with react-bootstrap
BaseAccordion.Item = BaseAccordionItem;
BaseAccordion.Header = BaseAccordionHeader;
BaseAccordion.Body = BaseAccordionBody;

export default BaseAccordion;
