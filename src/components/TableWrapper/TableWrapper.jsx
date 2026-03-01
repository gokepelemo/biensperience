/**
 * Table Abstraction Layer
 *
 * This module provides stable APIs for Table component usage across the application.
 * It wraps either the current custom Table components or the modern Table implementations,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All table consumers should import from design-system, NOT directly from Table.
 *
 * Implementation Status:
 * - Phase 1: Custom Table with CSS Modules (completed)
 * - Phase 2: Feature-flagged modern (completed) Table
 * - Phase 3: modern Table validation (completed)
 * - Phase 4 (Current): modern Table is default; legacy available via 'bootstrap_table' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { Table, TableHead, etc. } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-9bf2
 * Related: biensperience-2a7f (Phase 2), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import Table, { TableHead, TableBody, TableRow, TableCell } from '../Table/Table';
import BaseTable, {
  BaseTableHead,
  BaseTableBody,
  BaseTableRow,
  BaseTableCell
} from '../Table/BaseTable';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * TableWrapper - Design System Abstraction for Table
 *
 * Uses modern Table implementation by default.
 * Legacy Table available via feature flag.
 */
export function TableWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_table');
  const TableComponent = useLegacy ? Table : BaseTable;
  return <TableComponent {...props} />;
}

TableWrapper.displayName = 'Table';

TableWrapper.propTypes = {
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
 * TableHeadWrapper - Design System Abstraction for TableHead
 */
export function TableHeadWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_table');
  const Component = useLegacy ? TableHead : BaseTableHead;
  return <Component {...props} />;
}

TableHeadWrapper.displayName = 'TableHead';

TableHeadWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * TableBodyWrapper - Design System Abstraction for TableBody
 */
export function TableBodyWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_table');
  const Component = useLegacy ? TableBody : BaseTableBody;
  return <Component {...props} />;
}

TableBodyWrapper.displayName = 'TableBody';

TableBodyWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * TableRowWrapper - Design System Abstraction for TableRow
 */
export function TableRowWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_table');
  const Component = useLegacy ? TableRow : BaseTableRow;
  return <Component {...props} />;
}

TableRowWrapper.displayName = 'TableRow';

TableRowWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * TableCellWrapper - Design System Abstraction for TableCell
 */
export function TableCellWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_table');
  const Component = useLegacy ? TableCell : BaseTableCell;
  return <Component {...props} />;
}

TableCellWrapper.displayName = 'TableCell';

TableCellWrapper.propTypes = {
  children: PropTypes.node,
  header: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

// Default export for Table
export default TableWrapper;
