/**
 * BaseGrid - CSS Grid 12-column layout system
 *
 * Drop-in replacement for react-bootstrap Row/Col components.
 * Uses native CSS Grid with responsive column spans via CSS Modules.
 * Breakpoints match Bootstrap 5 (576, 768, 992, 1200, 1400px).
 *
 * Usage:
 *   <BaseRow>
 *     <BaseCol lg={8}>Main content</BaseCol>
 *     <BaseCol lg={4}>Sidebar</BaseCol>
 *   </BaseRow>
 *
 * Task: biensperience-552d
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import styles from './BaseGrid.module.scss';

/**
 * BaseRow - 12-column CSS Grid container
 *
 * Maps to react-bootstrap `<Row>`.
 * Accepts className for additional styling (Bootstrap utilities still work).
 */
export function BaseRow({ children, className = '', style, ...props }) {
  return (
    <div
      className={`${styles.row} ${className}`.trim()}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

BaseRow.displayName = 'Row';

BaseRow.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * BaseCol - Responsive grid column with breakpoint-based spans
 *
 * Maps to react-bootstrap `<Col>`.
 * Accepts xs/sm/md/lg/xl/xxl props (number 1-12) for responsive column spans.
 * Default: full width (12 columns) on all breakpoints.
 *
 * @param {number} xs - Column span for xs+ (≥0)
 * @param {number} sm - Column span for sm+ (≥576px)
 * @param {number} md - Column span for md+ (≥768px)
 * @param {number} lg - Column span for lg+ (≥992px)
 * @param {number} xl - Column span for xl+ (≥1200px)
 * @param {number} xxl - Column span for xxl+ (≥1400px)
 */
export function BaseCol({ children, className = '', xs, sm, md, lg, xl, xxl, style, ...props }) {
  const colClasses = [styles.col];

  if (xs) colClasses.push(styles[`colXs${xs}`]);
  if (sm) colClasses.push(styles[`colSm${sm}`]);
  if (md) colClasses.push(styles[`colMd${md}`]);
  if (lg) colClasses.push(styles[`colLg${lg}`]);
  if (xl) colClasses.push(styles[`colXl${xl}`]);
  if (xxl) colClasses.push(styles[`colXxl${xxl}`]);

  return (
    <div
      className={`${colClasses.filter(Boolean).join(' ')} ${className}`.trim()}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

BaseCol.displayName = 'Col';

const colSpanPropType = PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

BaseCol.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
  xs: colSpanPropType,
  sm: colSpanPropType,
  md: colSpanPropType,
  lg: colSpanPropType,
  xl: colSpanPropType,
  xxl: colSpanPropType,
};

export default BaseRow;
