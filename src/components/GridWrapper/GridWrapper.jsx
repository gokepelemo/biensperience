/**
 * Grid Abstraction Layer (Row/Col)
 *
 * Provides a stable API for Row/Col grid usage across the application.
 * All Row/Col consumers should import from design-system, NOT directly from BaseGrid.
 *
 * Implementation: CSS Grid (BaseGrid) — Phase 5 complete.
 *
 * Task: biensperience-552d
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { BaseRow, BaseCol } from '../Grid/BaseGrid';

/**
 * RowWrapper - Design System Row
 */
export function RowWrapper(props) {
  return <BaseRow {...props} />;
}

RowWrapper.displayName = 'Row';

RowWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * ColWrapper - Design System Col
 */
export function ColWrapper(props) {
  return <BaseCol {...props} />;
}

ColWrapper.displayName = 'Col';

const colSpanPropType = PropTypes.oneOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

ColWrapper.propTypes = {
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

export default RowWrapper;
