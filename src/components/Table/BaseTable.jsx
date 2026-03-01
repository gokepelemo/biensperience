/**
 * BaseTable - Design System Table Components Implementation
 *
 * Drop-in replacements for the custom Table components.
 * Uses Table primitives for built-in accessibility
 * while preserving the existing Table.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets default styling
 * and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Table components.
 *
 * Benefits:
 * - Built-in ARIA attributes for table accessibility
 * - Semantic table structure
 * - Consistent focus management for interactive tables
 *
 * Task: biensperience-9bf2 - Migrate Table component
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Table as TablePrimitive } from '@chakra-ui/react';
import styles from './Table.module.scss';

/**
 * BaseTable - Chakra UI Table.Root with CSS Module styling
 *
 * Uses Chakra Table.Root for accessibility benefits,
 * with reset styling to use CSS Modules.
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
  // Build className string with dynamic size classes
  const sizeClass = size !== 'md' ? styles[`table${size.charAt(0).toUpperCase() + size.slice(1)}`] : '';

  const classes = [
    styles.tableUnified,
    hover && styles.tableHover,
    striped && styles.tableStriped,
    bordered && styles.tableBordered,
    sizeClass,
    className
  ].filter(Boolean).join(' ');

  const tableElement = (
    <TablePrimitive.Root
      className={classes}
      style={style}
      unstyled
      {...props}
    >
      {children}
    </TablePrimitive.Root>
  );

  if (responsive) {
    return (
      <TablePrimitive.ScrollArea className={styles.tableResponsive}>
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
 * BaseTableHead - Chakra Table.Header with CSS Module styling
 */
export function BaseTableHead({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableHead, className].filter(Boolean).join(' ');

  return (
    <TablePrimitive.Header
      className={classes}
      style={style}
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
 * BaseTableBody - Chakra Table.Body with CSS Module styling
 */
export function BaseTableBody({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableBody, className].filter(Boolean).join(' ');

  return (
    <TablePrimitive.Body
      className={classes}
      style={style}
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
 * BaseTableRow - Chakra Table.Row with CSS Module styling
 */
export function BaseTableRow({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableRow, className].filter(Boolean).join(' ');

  return (
    <TablePrimitive.Row
      className={classes}
      style={style}
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
 * BaseTableCell - Chakra Table.Cell/Table.ColumnHeader with CSS Module styling
 *
 * Uses Table.ColumnHeader for header cells, Table.Cell for data cells.
 */
export function BaseTableCell({
  children,
  header = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [styles.tableCell, className].filter(Boolean).join(' ');
  const Component = header ? TablePrimitive.ColumnHeader : TablePrimitive.Cell;

  return (
    <Component
      className={classes}
      style={style}
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
