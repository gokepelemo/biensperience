/**
 * BaseDropdown - Design System Dropdown/Menu Implementation
 *
 * Drop-in replacement for react-bootstrap Dropdown component.
 * Uses Chakra Menu compound component for built-in accessibility
 * including keyboard navigation, focus management, and ARIA attributes.
 *
 * IMPORTANT: Uses `unstyled` approach for Root, allowing CSS Modules
 * to be the sole source of visual styling.
 *
 * Sub-components: BaseDropdown (Root), BaseDropdownToggle, BaseDropdownMenu,
 *                 BaseDropdownItem, BaseDropdownDivider
 *
 * Maps react-bootstrap patterns:
 * - Dropdown → Menu.Root
 * - Dropdown.Toggle → Menu.Trigger (wraps a button)
 * - Dropdown.Menu → Menu.Content (via Portal)
 * - Dropdown.Item → Menu.Item
 * - Dropdown.Divider → Menu.Separator
 *
 * Task: biensperience-bb6a
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Menu, Portal, chakra } from '@chakra-ui/react';

const StyledButton = chakra('button');

/**
 * BaseDropdown - Chakra Menu.Root wrapper
 *
 * Maps to react-bootstrap `<Dropdown>`.
 * Supports `onSelect` callback fired with the selected item's value.
 */
function BaseDropdown({ children, className = '', onSelect, ...props }) {
  return (
    <Menu.Root
      className={className}
      onSelect={onSelect ? (details) => onSelect(details.value) : undefined}
      {...props}
    >
      {children}
    </Menu.Root>
  );
}

BaseDropdown.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  onSelect: PropTypes.func,
};

/**
 * BaseDropdownToggle - Chakra Menu.Trigger wrapper
 *
 * Maps to react-bootstrap `<Dropdown.Toggle>`.
 * Renders a button that opens the dropdown menu.
 */
function BaseDropdownToggle({ children, className = '', variant, ...props }) {
  return (
    <Menu.Trigger asChild>
      <StyledButton className={className} {...props}>
        {children}
      </StyledButton>
    </Menu.Trigger>
  );
}

BaseDropdownToggle.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  variant: PropTypes.string,
};

/**
 * BaseDropdownMenu - Chakra Menu.Content via Portal
 *
 * Maps to react-bootstrap `<Dropdown.Menu>`.
 * Renders in a Portal for proper z-index stacking.
 */
function BaseDropdownMenu({ children, className = '', usePortal = true, ...props }) {
  const content = (
    <Menu.Content className={className} {...props}>
      {children}
    </Menu.Content>
  );

  return usePortal ? <Portal>{content}</Portal> : content;
}

BaseDropdownMenu.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  usePortal: PropTypes.bool,
};

/**
 * BaseDropdownItem - Chakra Menu.Item wrapper
 *
 * Maps to react-bootstrap `<Dropdown.Item>`.
 * `eventKey` maps to Chakra's `value` prop for onSelect identification.
 */
function BaseDropdownItem({ children, eventKey, className = '', active, ...props }) {
  return (
    <Menu.Item
      className={`${className}${active ? ' active' : ''}`}
      value={eventKey}
      {...props}
    >
      {children}
    </Menu.Item>
  );
}

BaseDropdownItem.propTypes = {
  children: PropTypes.node,
  eventKey: PropTypes.string,
  className: PropTypes.string,
  active: PropTypes.bool,
};

/**
 * BaseDropdownDivider - Chakra Menu.Separator
 */
function BaseDropdownDivider(props) {
  return <Menu.Separator {...props} />;
}

// Compound component pattern
BaseDropdown.Toggle = BaseDropdownToggle;
BaseDropdown.Menu = BaseDropdownMenu;
BaseDropdown.Item = BaseDropdownItem;
BaseDropdown.Divider = BaseDropdownDivider;

export default BaseDropdown;
export {
  BaseDropdown,
  BaseDropdownToggle,
  BaseDropdownMenu,
  BaseDropdownItem,
  BaseDropdownDivider
};
