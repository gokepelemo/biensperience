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
 * Normalize an eventKey/activeKey value to Chakra v3 value format.
 * Chakra v3 uses string[] for value; items use "item-{eventKey}" as their value.
 * @param {string|number|null|undefined} key - The react-bootstrap style key
 * @returns {string} The Chakra v3 item value string
 */
function toChakraValue(key) {
  if (key === null || key === undefined) return null;
  const str = String(key);
  // If already prefixed, return as-is
  return str.startsWith('item-') ? str : `item-${str}`;
}

/**
 * Strip the "item-" prefix from a Chakra value to return the original eventKey.
 * @param {string} value - The Chakra v3 item value string
 * @returns {string} The original eventKey
 */
function fromChakraValue(value) {
  if (!value) return null;
  return value.startsWith('item-') ? value.slice(5) : value;
}

/**
 * BaseAccordion - Chakra UI Accordion.Root with custom styling
 *
 * Uses Chakra Accordion.Root for accessibility benefits,
 * with .ds-accordion class for visual styling.
 *
 * Translates react-bootstrap Accordion props to Chakra v3 API:
 * - activeKey → value (controlled)
 * - onSelect → onValueChange (controlled)
 * - defaultActiveKey → defaultValue (uncontrolled)
 * - defaultIndex → defaultValue (uncontrolled, numeric)
 */
function BaseAccordion({ className = '', children, defaultIndex, activeKey, onSelect, defaultActiveKey, ...props }) {
  // Convert defaultIndex to defaultValue format for Chakra v3
  // Chakra v3 uses string values like "item-0", "item-1"
  let defaultValue;
  if (defaultIndex !== undefined) {
    defaultValue = Array.isArray(defaultIndex)
      ? defaultIndex.map(i => `item-${i}`)
      : [`item-${defaultIndex}`];
  } else if (defaultActiveKey !== undefined) {
    defaultValue = Array.isArray(defaultActiveKey)
      ? defaultActiveKey.map(k => toChakraValue(k))
      : [toChakraValue(defaultActiveKey)];
  }

  // Convert activeKey to controlled value for Chakra v3
  const controlledValue = activeKey !== undefined
    ? (activeKey === null ? [] : [toChakraValue(activeKey)])
    : undefined;

  // Convert onSelect to onValueChange for Chakra v3
  const handleValueChange = onSelect
    ? (details) => {
        const openValues = details.value || [];
        if (openValues.length === 0) {
          // All closed - pass null to match react-bootstrap behavior
          onSelect(null);
        } else {
          // Pass the original eventKey (without item- prefix)
          onSelect(fromChakraValue(openValues[openValues.length - 1]));
        }
      }
    : undefined;

  return (
    <AccordionPrimitive.Root
      className={`ds-accordion${className ? ` ${className}` : ''}`}
      defaultValue={defaultValue}
      value={controlledValue}
      onValueChange={handleValueChange}
      collapsible
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
  activeKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelect: PropTypes.func,
  defaultActiveKey: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number]))
  ]),
};

/**
 * BaseAccordionItem - Chakra UI Accordion.Item wrapper
 *
 * Maps to Accordion.Item from react-bootstrap.
 * Requires a value prop for Chakra v3 - auto-generated if not provided.
 */
function BaseAccordionItem({ eventKey, children, className, ...props }) {
  // Convert eventKey to value for Chakra v3
  const value = eventKey !== undefined ? `item-${eventKey}` : undefined;

  const mergedClassName = className
    ? `accordion-item ${className}`
    : 'accordion-item';

  return (
    <AccordionPrimitive.Item
      className={mergedClassName}
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
  className: PropTypes.string,
};

/**
 * BaseAccordionHeader - Chakra UI Accordion.ItemTrigger wrapper
 *
 * Maps to Accordion.Header from react-bootstrap.
 * Renders a button that toggles the accordion item.
 *
 * NOTE: The `as` prop from react-bootstrap (e.g., as="div") is intentionally
 * ignored. In Chakra v3, `as` triggers a complex forwardAsChild composition
 * chain that can break event handling in production builds. The ItemTrigger
 * renders as a native <button> which provides better accessibility.
 */
function BaseAccordionHeader({ children, className, as: _as, ...props }) {
  // Merge classNames: always include 'accordion-button' for SCSS targeting,
  // plus any additional className from consumers
  const mergedClassName = className
    ? `accordion-button ${className}`
    : 'accordion-button';

  return (
    <AccordionPrimitive.ItemTrigger
      className={mergedClassName}
      css={RESET_STYLES}
      {...props}
    >
      {children}
    </AccordionPrimitive.ItemTrigger>
  );
}

BaseAccordionHeader.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.any,
};

/**
 * BaseAccordionBody - Chakra UI Accordion.ItemContent wrapper
 *
 * Maps to Accordion.Body from react-bootstrap.
 * Contains the collapsible content.
 */
function BaseAccordionBody({ children, className, ...props }) {
  const mergedClassName = className
    ? `accordion-body ${className}`
    : 'accordion-body';

  return (
    <AccordionPrimitive.ItemContent
      className={mergedClassName}
      css={RESET_STYLES}
      {...props}
    >
      {children}
    </AccordionPrimitive.ItemContent>
  );
}

BaseAccordionBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

// Attach subcomponents to main component for API parity with react-bootstrap
BaseAccordion.Item = BaseAccordionItem;
BaseAccordion.Header = BaseAccordionHeader;
BaseAccordion.Body = BaseAccordionBody;

export default BaseAccordion;
