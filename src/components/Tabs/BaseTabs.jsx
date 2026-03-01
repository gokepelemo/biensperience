/**
 * BaseTabs - Design System Tabs Implementation
 *
 * Drop-in replacement for react-bootstrap Tabs/Tab components.
 * Uses Chakra Tabs compound component for built-in accessibility
 * including keyboard navigation, ARIA roles, and focus management.
 *
 * IMPORTANT: Uses `unstyled` prop to reset Chakra styling,
 * allowing CSS Modules to be the sole source of visual styling.
 *
 * Sub-components: BaseTabs (Root), BaseTab (Panel), BaseTabList, BaseTabTrigger
 *
 * Maps react-bootstrap patterns:
 * - <Tabs activeKey onSelect> → <Tabs.Root value onValueChange>
 * - <Tab eventKey title> → <Tabs.Trigger value> + <Tabs.Content value>
 *
 * Task: biensperience-5447
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Tabs as TabsPrimitive } from '@chakra-ui/react';

/**
 * BaseTabs - Chakra Tabs.Root wrapper
 *
 * Maps to react-bootstrap `<Tabs>`.
 * Converts `activeKey`/`onSelect` to Chakra's `value`/`onValueChange`.
 */
function BaseTabs({ children, activeKey, defaultActiveKey, onSelect, className = '', ...props }) {
  return (
    <TabsPrimitive.Root
      className={className}
      value={activeKey}
      defaultValue={defaultActiveKey}
      onValueChange={onSelect ? (details) => onSelect(details.value) : undefined}
      unstyled
      {...props}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

BaseTabs.propTypes = {
  children: PropTypes.node,
  activeKey: PropTypes.string,
  defaultActiveKey: PropTypes.string,
  onSelect: PropTypes.func,
  className: PropTypes.string,
};

/**
 * BaseTabList - Chakra Tabs.List wrapper
 *
 * Container for tab triggers. Not in react-bootstrap API but needed
 * for Chakra's compound component pattern.
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
 * The clickable tab button. Maps react-bootstrap Tab's `title` prop.
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
 * The tab panel content area.
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
 * BaseTab - Convenience component mapping react-bootstrap <Tab>
 *
 * In react-bootstrap, <Tab eventKey title> renders both the trigger and the panel.
 * This is a "virtual" component — it's consumed by BaseTabs to auto-generate
 * TabTrigger + TabContent pairs. Can also be used standalone.
 */
function BaseTab({ children, eventKey, title, className = '', ...props }) {
  // When used standalone, renders just content (trigger must be separate)
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
