/**
 * Tabs Abstraction Layer
 *
 * Provides a stable API for Tabs usage across the application.
 * Implementation: Chakra UI Tabs (BaseTabs) — Phase 5 complete.
 *
 * Task: biensperience-5447
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import BaseTabs, {
  BaseTab,
  BaseTabList,
  BaseTabTrigger,
  BaseTabContent
} from '../Tabs/BaseTabs';

/**
 * TabsWrapper - Design System Tabs
 */
export function TabsWrapper(props) {
  return <BaseTabs {...props} />;
}

TabsWrapper.displayName = 'Tabs';

TabsWrapper.propTypes = {
  children: PropTypes.node,
  activeKey: PropTypes.string,
  defaultActiveKey: PropTypes.string,
  onSelect: PropTypes.func,
  className: PropTypes.string,
};

/**
 * TabWrapper
 */
export function TabWrapper(props) {
  return <BaseTab {...props} />;
}

TabWrapper.displayName = 'Tab';

TabWrapper.propTypes = {
  children: PropTypes.node,
  eventKey: PropTypes.string.isRequired,
  title: PropTypes.node,
  className: PropTypes.string,
};

/**
 * TabListWrapper
 */
export function TabListWrapper(props) {
  return <BaseTabList {...props} />;
}

TabListWrapper.displayName = 'Tabs.List';
TabListWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * TabTriggerWrapper
 */
export function TabTriggerWrapper(props) {
  return <BaseTabTrigger {...props} />;
}

TabTriggerWrapper.displayName = 'Tabs.Trigger';
TabTriggerWrapper.propTypes = { children: PropTypes.node, value: PropTypes.string, className: PropTypes.string };

/**
 * TabContentWrapper
 */
export function TabContentWrapper(props) {
  return <BaseTabContent {...props} />;
}

TabContentWrapper.displayName = 'Tabs.Content';
TabContentWrapper.propTypes = { children: PropTypes.node, value: PropTypes.string, className: PropTypes.string };

// Compound sub-components
TabsWrapper.Tab = TabWrapper;
TabsWrapper.List = TabListWrapper;
TabsWrapper.Trigger = TabTriggerWrapper;
TabsWrapper.Content = TabContentWrapper;

export default TabsWrapper;
