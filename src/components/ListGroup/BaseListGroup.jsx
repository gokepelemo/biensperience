/**
 * BaseListGroup - Native Chakra UI v3 List Implementation
 *
 * Drop-in replacement for react-bootstrap ListGroup / ListGroup.Item.
 * Uses Chakra List compound components with the slot recipe from
 * ui-theme.js for styling — no SCSS, no Bootstrap class names.
 *
 * Features:
 * - Action items (clickable/hoverable) via data-action attribute
 * - Active state highlighting via data-active attribute
 * - Disabled state via aria-disabled
 * - Recipe-based styling for all states
 *
 * Migration: biensperience-b905 (P3.8)
 */

import React from 'react';
import PropTypes from 'prop-types';
import { List } from '@chakra-ui/react';

/**
 * BaseListGroup - Chakra List.Root wrapper
 *
 * Maps to react-bootstrap `<ListGroup>`.
 */
function BaseListGroup({ children, className = '', as, ...props }) {
  return (
    <List.Root className={className || undefined} as={as} {...props}>
      {children}
    </List.Root>
  );
}

BaseListGroup.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.elementType,
};

/**
 * BaseListGroupItem - Chakra List.Item wrapper
 *
 * Maps to react-bootstrap `<ListGroup.Item>`.
 * Uses data attributes for state-based styling via the list recipe.
 */
function BaseListGroupItem({
  children,
  className = '',
  action = false,
  active = false,
  disabled = false,
  variant,
  as,
  onClick,
  ...props
}) {
  return (
    <List.Item
      className={className || undefined}
      as={as}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      aria-current={active || undefined}
      data-action={action || undefined}
      data-active={active || undefined}
      data-variant={variant || undefined}
      {...props}
    >
      {children}
    </List.Item>
  );
}

BaseListGroupItem.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  action: PropTypes.bool,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  variant: PropTypes.string,
  as: PropTypes.elementType,
  onClick: PropTypes.func,
};

// Compound component pattern
BaseListGroup.Item = BaseListGroupItem;

export default BaseListGroup;
export { BaseListGroup, BaseListGroupItem };
