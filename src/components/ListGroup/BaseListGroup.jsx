/**
 * BaseListGroup - Design System List Implementation
 *
 * Drop-in replacement for react-bootstrap ListGroup / ListGroup.Item.
 * Uses Chakra List primitive with `unstyled` so CSS Modules control visuals.
 *
 * Sub-components: BaseListGroup (Root), BaseListGroupItem
 *
 * Maps react-bootstrap patterns:
 * - <ListGroup> → <List.Root>
 * - <ListGroup.Item> → <List.Item>
 *
 * Task: biensperience-d847
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
    <List.Root className={className} as={as} unstyled listStyleType="none" {...props}>
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
 * Supports `action` (clickable), `active`, `disabled` and `variant` as CSS classes.
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
  const classNames = [
    className,
    action ? 'list-group-item-action' : '',
    active ? 'active' : '',
    disabled ? 'disabled' : '',
    variant ? `list-group-item-${variant}` : '',
  ].filter(Boolean).join(' ');

  return (
    <List.Item
      className={classNames}
      as={as}
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      aria-current={active || undefined}
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
