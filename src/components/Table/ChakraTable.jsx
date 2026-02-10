/**
 * ChakraTable - Chakra UI v3 Table Components Implementation
 *
 * Drop-in replacements for the custom Table components.
 * Uses Chakra UI v3 Table primitives for built-in accessibility
 * while preserving the existing Table.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets Chakra's default styling
 * and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Table components.
 *
 * Chakra benefits gained:
 * - Built-in ARIA attributes for table accessibility
 * - Semantic table structure
 * - Consistent focus management for interactive tables
 *
 * Task: biensperience-9bf2 - Migrate Table component to Chakra UI
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Table as ChakraTablePrimitive } from '@chakra-ui/react';
import styles from './Table.module.scss';

/**
 * Reset styles to completely override Chakra's default table styling.
 * This ensures the CSS Module classes from Table.module.scss are the
 * sole source of visual styling — pixel-perfect match with the original.
 */
const CHAKRA_RESET_STYLES = {
  bg: 'transparent',
  color: 'inherit',
  border: 'none',
  borderRadius: 'unset',
  fontWeight: 'unset',
  fontSize: 'unset',
  lineHeight: 'unset',
  _hover: {
    bg: 'transparent',
  },
};

/**
 * ChakraTable - Chakra UI Table.Root with CSS Module styling
 *
 * Uses Chakra Table.Root for accessibility benefits,
 * with reset styling to use CSS Modules.
 */
export default function ChakraTable({
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
    <ChakraTablePrimitive.Root
      className={classes}
      style={style}
      variant="plain"
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraTablePrimitive.Root>
  );

  if (responsive) {
    return (
      <ChakraTablePrimitive.ScrollArea className={styles.tableResponsive}>
        {tableElement}
      </ChakraTablePrimitive.ScrollArea>
    );
  }

  return tableElement;
}

ChakraTable.propTypes = {
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
 * ChakraTableHead - Chakra Table.Header with CSS Module styling
 */
export function ChakraTableHead({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableHead, className].filter(Boolean).join(' ');

  return (
    <ChakraTablePrimitive.Header
      className={classes}
      style={style}
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraTablePrimitive.Header>
  );
}

ChakraTableHead.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * ChakraTableBody - Chakra Table.Body with CSS Module styling
 */
export function ChakraTableBody({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableBody, className].filter(Boolean).join(' ');

  return (
    <ChakraTablePrimitive.Body
      className={classes}
      style={style}
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraTablePrimitive.Body>
  );
}

ChakraTableBody.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * ChakraTableRow - Chakra Table.Row with CSS Module styling
 */
export function ChakraTableRow({ children, className = '', style = {}, ...props }) {
  const classes = [styles.tableRow, className].filter(Boolean).join(' ');

  return (
    <ChakraTablePrimitive.Row
      className={classes}
      style={style}
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </ChakraTablePrimitive.Row>
  );
}

ChakraTableRow.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * ChakraTableCell - Chakra Table.Cell/Table.ColumnHeader with CSS Module styling
 *
 * Uses Table.ColumnHeader for header cells, Table.Cell for data cells.
 */
export function ChakraTableCell({
  children,
  header = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [styles.tableCell, className].filter(Boolean).join(' ');
  const Component = header ? ChakraTablePrimitive.ColumnHeader : ChakraTablePrimitive.Cell;

  return (
    <Component
      className={classes}
      style={style}
      css={CHAKRA_RESET_STYLES}
      {...props}
    >
      {children}
    </Component>
  );
}

ChakraTableCell.propTypes = {
  children: PropTypes.node,
  header: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};
