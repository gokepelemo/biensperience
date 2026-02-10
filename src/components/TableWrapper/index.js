/**
 * TableWrapper - Design System Table Components
 *
 * Re-exports the table wrapper components with user-friendly names.
 * All consumers should import from design-system for automatic
 * feature-flagged switching between implementations.
 */
export {
  TableWrapper as Table,
  TableHeadWrapper as TableHead,
  TableBodyWrapper as TableBody,
  TableRowWrapper as TableRow,
  TableCellWrapper as TableCell
} from './TableWrapper';

export { default } from './TableWrapper';
