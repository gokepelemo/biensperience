/**
 * BaseTable — Native Chakra UI v3 Table compound component
 *
 * Uses Chakra's Table.Root/Header/Body/Row/ColumnHeader/Cell
 * with the table slotRecipe from ui-theme.js.
 * No CSS Modules — pure Chakra tokens.
 *
 * Task: biensperience-6995 — P2.6 Table → Chakra Table
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Table as TablePrimitive } from '@chakra-ui/react';

/**
 * BaseTable — Chakra Table.Root with slotRecipe variants
 */
export default function BaseTable({
  children,
  hover = true,
  striped = false,
  bordered = false,
  responsive = true,
  size = 'md',
  className = '',
  style = {},
  ...props
}) {
  const tableElement = (
    <TablePrimitive.Root
      variant={bordered ? 'outline' : 'line'}
      size={size}
      interactive={hover || undefined}
      striped={striped || undefined}
      stickyHeader
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
    </TablePrimitive.Root>
  );

  if (responsive) {
    return (
      <TablePrimitive.ScrollArea>
        {tableElement}
      </TablePrimitive.ScrollArea>
    );
  }

  return tableElement;
}

BaseTable.propTypes = {
  children: PropTypes.node.isRequired,
  hover: PropTypes.bool,
  striped: PropTypes.bool,
  bordered: PropTypes.bool,
  responsive: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseTableHead — Chakra Table.Header
 */
export function BaseTableHead({ children, className = '', style = {}, ...props }) {
  return (
    <TablePrimitive.Header
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
    </TablePrimitive.Header>
  );
}

BaseTableHead.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseTableBody — Chakra Table.Body
 */
export function BaseTableBody({ children, className = '', style = {}, ...props }) {
  return (
    <TablePrimitive.Body
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
    </TablePrimitive.Body>
  );
}

BaseTableBody.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseTableRow — Chakra Table.Row
 */
export function BaseTableRow({ children, className = '', style = {}, ...props }) {
  return (
    <TablePrimitive.Row
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
    </TablePrimitive.Row>
  );
}

BaseTableRow.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseTableCell — Chakra Table.Cell / Table.ColumnHeader
 */
export function BaseTableCell({
  children,
  header = false,
  className = '',
  style = {},
  ...props
}) {
  const Component = header ? TablePrimitive.ColumnHeader : TablePrimitive.Cell;

  return (
    <Component
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
    </Component>
  );
}

BaseTableCell.propTypes = {
  children: PropTypes.node,
  header: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};
