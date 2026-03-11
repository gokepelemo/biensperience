/**
 * BaseTabs - Native Chakra UI v3 Tabs Implementation
 *
 * Drop-in replacement for react-bootstrap Tabs/Tab components.
 * Uses Chakra Tabs compound components with the slot recipe from ui-theme.js
 * for styling (no `unstyled` prop — recipe is the sole styling source).
 *
 * Supports two usage patterns:
 *
 * 1. React-bootstrap style (auto-generates triggers from Tab children):
 *    <Tabs activeKey={key} onSelect={setKey}>
 *      <Tab eventKey="one" title="First">Content 1</Tab>
 *      <Tab eventKey="two" title="Second">Content 2</Tab>
 *    </Tabs>
 *
 * 2. Explicit compound pattern (full control):
 *    <Tabs activeKey={key} onSelect={setKey}>
 *      <Tabs.List>
 *        <Tabs.Trigger value="one">First</Tabs.Trigger>
 *        <Tabs.Trigger value="two">Second</Tabs.Trigger>
 *      </Tabs.List>
 *      <Tabs.Content value="one">Content 1</Tabs.Content>
 *      <Tabs.Content value="two">Content 2</Tabs.Content>
 *    </Tabs>
 *
 * Migration: biensperience-87fe (P3.2)
 */

import React, { Children, isValidElement } from 'react';
import PropTypes from 'prop-types';
import { Tabs as TabsPrimitive } from '@chakra-ui/react';

/**
 * BaseTabs - Chakra Tabs.Root wrapper
 *
 * Maps react-bootstrap `<Tabs>` API to Chakra's `<Tabs.Root>`.
 * When children contain `<Tab eventKey title>` components, auto-generates
 * a `<Tabs.List>` with `<Tabs.Trigger>` for each tab and renders their
 * content as `<Tabs.Content>` panels.
 */
function BaseTabs({
  children,
  activeKey,
  defaultActiveKey,
  onSelect,
  className = '',
  variant,
  size,
  fitted,
  ...props
}) {
  // Collect Tab children for auto-generation of triggers + content
  const tabs = [];
  const otherChildren = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type && child.type._isBaseTab) {
      tabs.push(child);
    } else {
      otherChildren.push(child);
    }
  });

  // Determine if we have Tab children (react-bootstrap pattern)
  // or explicit compound children (Chakra pattern)
  const hasTabChildren = tabs.length > 0;

  return (
    <TabsPrimitive.Root
      className={className}
      value={activeKey}
      defaultValue={defaultActiveKey}
      onValueChange={onSelect ? (details) => onSelect(details.value) : undefined}
      variant={variant}
      size={size}
      fitted={fitted}
      {...props}
    >
      {hasTabChildren ? (
        <>
          {/* Auto-generated trigger list from <Tab eventKey title> children */}
          <TabsPrimitive.List>
            {tabs.map((tab) => (
              <TabsPrimitive.Trigger
                key={tab.props.eventKey}
                value={tab.props.eventKey}
                disabled={tab.props.disabled}
              >
                {tab.props.title}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>

          {/* Auto-generated content panels from <Tab eventKey> children */}
          {tabs.map((tab) => (
            <TabsPrimitive.Content
              key={tab.props.eventKey}
              value={tab.props.eventKey}
              className={tab.props.className || undefined}
            >
              {tab.props.children}
            </TabsPrimitive.Content>
          ))}
        </>
      ) : (
        // Explicit compound pattern — render children as-is
        children
      )}

      {/* Render non-Tab children (e.g., custom content below tabs) */}
      {hasTabChildren && otherChildren.length > 0 && otherChildren}
    </TabsPrimitive.Root>
  );
}

BaseTabs.propTypes = {
  children: PropTypes.node,
  activeKey: PropTypes.string,
  defaultActiveKey: PropTypes.string,
  onSelect: PropTypes.func,
  className: PropTypes.string,
  variant: PropTypes.oneOf(['line', 'enclosed', 'subtle', 'outline', 'plain']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  fitted: PropTypes.bool,
};

/**
 * BaseTabList - Chakra Tabs.List wrapper
 *
 * Container for tab triggers. Used in explicit compound pattern.
 */
function BaseTabList({ children, className = '', ...props }) {
  return (
    <TabsPrimitive.List className={className} {...props}>
      {children}
    </TabsPrimitive.List>
  );
}

BaseTabList.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};

/**
 * BaseTabTrigger - Chakra Tabs.Trigger wrapper
 *
 * The clickable tab button. Used in explicit compound pattern.
 */
function BaseTabTrigger({ children, value, className = '', ...props }) {
  return (
    <TabsPrimitive.Trigger className={className} value={value} {...props}>
      {children}
    </TabsPrimitive.Trigger>
  );
}

BaseTabTrigger.propTypes = {
  children: PropTypes.node,
  value: PropTypes.string.isRequired,
  className: PropTypes.string,
};

/**
 * BaseTabContent - Chakra Tabs.Content wrapper
 *
 * The tab panel content area. Used in explicit compound pattern.
 */
function BaseTabContent({ children, value, className = '', ...props }) {
  return (
    <TabsPrimitive.Content className={className} value={value} {...props}>
      {children}
    </TabsPrimitive.Content>
  );
}

BaseTabContent.propTypes = {
  children: PropTypes.node,
  value: PropTypes.string.isRequired,
  className: PropTypes.string,
};

/**
 * BaseTab - Virtual component for react-bootstrap <Tab> compatibility
 *
 * In the react-bootstrap pattern, <Tab eventKey title> renders both a trigger
 * and content panel. This component is consumed by BaseTabs which extracts
 * eventKey/title to auto-generate Tabs.Trigger + Tabs.Content pairs.
 *
 * Can also be used standalone as a Tabs.Content wrapper.
 */
function BaseTab({ children, eventKey, title, className = '', ...props }) {
  // When used standalone (outside of BaseTabs auto-generation),
  // renders just the content panel
  return (
    <TabsPrimitive.Content className={className} value={eventKey} {...props}>
      {children}
    </TabsPrimitive.Content>
  );
}

BaseTab.propTypes = {
  children: PropTypes.node,
  eventKey: PropTypes.string.isRequired,
  title: PropTypes.node,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

// Mark as tab for parent detection
BaseTab._isBaseTab = true;

// Compound component pattern
BaseTabs.Tab = BaseTab;
BaseTabs.List = BaseTabList;
BaseTabs.Trigger = BaseTabTrigger;
BaseTabs.Content = BaseTabContent;

export default BaseTabs;
export { BaseTabs, BaseTab, BaseTabList, BaseTabTrigger, BaseTabContent };
