/**
 * Dropdown Abstraction Layer
 *
 * Provides a stable API for Dropdown usage across the application.
 * Implementation: Chakra UI Menu (BaseDropdown) — Phase 5 complete.
 *
 * Task: biensperience-bb6a
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import BaseDropdown, {
  BaseDropdownToggle,
  BaseDropdownMenu,
  BaseDropdownItem,
  BaseDropdownDivider
} from '../Dropdown/BaseDropdown';

/**
 * DropdownWrapper - Design System Dropdown
 */
export function DropdownWrapper(props) {
  return <BaseDropdown {...props} />;
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
  return <BaseDropdownToggle {...props} />;
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
  return <BaseDropdownMenu {...props} />;
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
  return <BaseDropdownItem {...props} />;
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
  return <BaseDropdownDivider {...props} />;
}

DropdownDividerWrapper.displayName = 'Dropdown.Divider';
DropdownDividerWrapper.propTypes = { className: PropTypes.string };

// Compound sub-components
DropdownWrapper.Toggle = DropdownToggleWrapper;
DropdownWrapper.Menu = DropdownMenuWrapper;
DropdownWrapper.Item = DropdownItemWrapper;
DropdownWrapper.Divider = DropdownDividerWrapper;

export default DropdownWrapper;
