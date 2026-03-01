/**
 * Tabs Abstraction Layer
 *
 * Provides a stable API for Tabs usage across the application.
 * Wraps either the react-bootstrap Tabs/Tab or the modern BaseTabs (Chakra),
 * controlled by the 'bootstrap_tabs' feature flag.
 *
 * Task: biensperience-5447
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { Tabs as RBTabs, Tab as RBTab } from 'react-bootstrap';
import BaseTabs, {
  BaseTab,
  BaseTabList,
  BaseTabTrigger,
  BaseTabContent
} from '../Tabs/BaseTabs';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * TabsWrapper - Design System Abstraction for Tabs
 */
export function TabsWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_tabs');
  const Component = useLegacy ? RBTabs : BaseTabs;
  return <Component {...props} />;
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
 * TabWrapper - Design System Abstraction for Tab
 */
export function TabWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_tabs');
  const Component = useLegacy ? RBTab : BaseTab;
  return <Component {...props} />;
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
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_tabs');
  // react-bootstrap doesn't have a separate TabList — it's implicit.
  // When legacy, just render children in a nav wrapper.
  if (useLegacy) {
    return <nav className={props.className}>{props.children}</nav>;
  }
  return <BaseTabList {...props} />;
}

TabListWrapper.displayName = 'Tabs.List';
TabListWrapper.propTypes = { children: PropTypes.node, className: PropTypes.string };

/**
 * TabTriggerWrapper
 */
export function TabTriggerWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_tabs');
  // react-bootstrap doesn't have a separate TabTrigger — triggers are generated from Tab's title.
  if (useLegacy) {
    return <button className={props.className} type="button">{props.children}</button>;
  }
  return <BaseTabTrigger {...props} />;
}

TabTriggerWrapper.displayName = 'Tabs.Trigger';
TabTriggerWrapper.propTypes = { children: PropTypes.node, value: PropTypes.string, className: PropTypes.string };

/**
 * TabContentWrapper
 */
export function TabContentWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_tabs');
  if (useLegacy) {
    return <div className={props.className}>{props.children}</div>;
  }
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
