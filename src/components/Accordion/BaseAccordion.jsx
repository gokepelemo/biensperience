/**
 * BaseAccordion - Native Chakra UI v3 Accordion Implementation
 *
 * Drop-in replacement for the react-bootstrap Accordion wrapper.
 * Uses Chakra Accordion compound components with the slot recipe from
 * ui-theme.js for styling — no SCSS, no RESET_STYLES.
 *
 * Features:
 * - Built-in ARIA attributes
 * - Keyboard navigation (arrow keys, home/end)
 * - Focus management
 * - Controlled/uncontrolled modes
 * - Auto-generated chevron indicator via ItemIndicator
 *
 * Migration: biensperience-0dd9 (P3.3)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Accordion as AccordionPrimitive } from '@chakra-ui/react';

/**
 * Chevron SVG icon for accordion indicator.
 * Uses currentColor to inherit the trigger's text color.
 */
const ChevronIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
  </svg>
);

/**
 * Normalize an eventKey/activeKey value to Chakra v3 value format.
 * Chakra v3 uses string[] for value; items use "item-{eventKey}" as their value.
 * @param {string|number|null|undefined} key - The react-bootstrap style key
 * @returns {string} The Chakra v3 item value string
 */
function toChakraValue(key) {
  if (key === null || key === undefined) return null;
  const str = String(key);
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
 * BaseAccordion - Chakra UI Accordion.Root
 *
 * Translates react-bootstrap Accordion props to Chakra v3 API:
 * - activeKey → value (controlled)
 * - onSelect → onValueChange (controlled)
 * - defaultActiveKey → defaultValue (uncontrolled)
 * - defaultIndex → defaultValue (uncontrolled, numeric)
 */
function BaseAccordion({ className = '', children, defaultIndex, activeKey, onSelect, defaultActiveKey, ...props }) {
  // Convert defaultIndex to defaultValue format for Chakra v3
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
          onSelect(null);
        } else {
          onSelect(fromChakraValue(openValues[openValues.length - 1]));
        }
      }
    : undefined;

  return (
    <AccordionPrimitive.Root
      className={className || undefined}
      defaultValue={defaultValue}
      value={controlledValue}
      onValueChange={handleValueChange}
      collapsible
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
 */
function BaseAccordionItem({ eventKey, children, className, ...props }) {
  const value = eventKey !== undefined ? `item-${eventKey}` : undefined;

  return (
    <AccordionPrimitive.Item
      className={className || undefined}
      value={value}
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
 * Automatically renders a chevron indicator that rotates on expand.
 *
 * NOTE: The `as` prop from react-bootstrap is intentionally ignored.
 * Chakra v3 ItemTrigger renders as a native <button> for accessibility.
 */
function BaseAccordionHeader({ children, className, as: _as, ...props }) {
  return (
    <AccordionPrimitive.ItemTrigger
      className={className || undefined}
      {...props}
    >
      {children}
      <AccordionPrimitive.ItemIndicator>
        <ChevronIcon />
      </AccordionPrimitive.ItemIndicator>
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
 * Uses ItemBody inside ItemContent for proper Chakra slot styling.
 */
function BaseAccordionBody({ children, className, ...props }) {
  return (
    <AccordionPrimitive.ItemContent
      className={className || undefined}
      {...props}
    >
      <AccordionPrimitive.ItemBody>
        {children}
      </AccordionPrimitive.ItemBody>
    </AccordionPrimitive.ItemContent>
  );
}

BaseAccordionBody.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

// Attach subcomponents for API parity with react-bootstrap
BaseAccordion.Item = BaseAccordionItem;
BaseAccordion.Header = BaseAccordionHeader;
BaseAccordion.Body = BaseAccordionBody;

export default BaseAccordion;
