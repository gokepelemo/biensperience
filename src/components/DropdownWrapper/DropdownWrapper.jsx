/**
 * Dropdown Abstraction Layer
 *
 * Provides a stable API for Dropdown usage across the application.
 * Wraps either the react-bootstrap Dropdown or the modern BaseDropdown (Chakra Menu),
 * controlled by the 'bootstrap_dropdown' feature flag.
 *
 * Task: biensperience-bb6a
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { Dropdown as RBDropdown } from 'react-bootstrap';
import BaseDropdown, {
  BaseDropdownToggle,
  BaseDropdownMenu,
  BaseDropdownItem,
  BaseDropdownDivider
} from '../Dropdown/BaseDropdown';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * DropdownWrapper - Design System Abstraction for Dropdown
 */
export function DropdownWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_dropdown');
  const Component = useLegacy ? RBDropdown : BaseDropdown;
  return <Component {...props} />;
}

DropdownWrapper.displayName = 'Dropdown';

DropdownWrapper.propTypes = {
  children: PropTypes.node,
  onSelect: PropTypes.func,
  className: PropTypes.string,
};

/**
 * DropdownToggleWrapper
 */
export function DropdownToggleWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_dropdown');
  const Component = useLegacy ? RBDropdown.Toggle : BaseDropdownToggle;
  return <Component {...props} />;
}

DropdownToggleWrapper.displayName = 'Dropdown.Toggle';
DropdownToggleWrapper.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.string,
  className: PropTypes.string,
};

/**
 * DropdownMenuWrapper
 */
export function DropdownMenuWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_dropdown');
  const Component = useLegacy ? RBDropdown.Menu : BaseDropdownMenu;
  return <Component {...props} />;
}

DropdownMenuWrapper.displayName = 'Dropdown.Menu';
DropdownMenuWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  renderOnMount: PropTypes.bool,
  popperConfig: PropTypes.object,
};

/**
 * DropdownItemWrapper
 */
export function DropdownItemWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_dropdown');
  const Component = useLegacy ? RBDropdown.Item : BaseDropdownItem;
  return <Component {...props} />;
}

DropdownItemWrapper.displayName = 'Dropdown.Item';
DropdownItemWrapper.propTypes = {
  children: PropTypes.node,
  eventKey: PropTypes.string,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

/**
 * DropdownDividerWrapper
 */
export function DropdownDividerWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_dropdown');
  const Component = useLegacy ? RBDropdown.Divider : BaseDropdownDivider;
  return <Component {...props} />;
}

DropdownDividerWrapper.displayName = 'Dropdown.Divider';
DropdownDividerWrapper.propTypes = { className: PropTypes.string };

// Compound sub-components
DropdownWrapper.Toggle = DropdownToggleWrapper;
DropdownWrapper.Menu = DropdownMenuWrapper;
DropdownWrapper.Item = DropdownItemWrapper;
DropdownWrapper.Divider = DropdownDividerWrapper;

export default DropdownWrapper;
