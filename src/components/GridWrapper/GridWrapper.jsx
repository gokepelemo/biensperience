/**
 * Grid Abstraction Layer (Row/Col)
 *
 * Provides a stable API for Row/Col grid usage across the application.
 * Wraps either react-bootstrap Row/Col or the modern BaseGrid (CSS Grid),
 * controlled by the 'bootstrap_grid' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All Row/Col consumers should import from design-system, NOT directly from react-bootstrap.
 *
 * Implementation Status:
 * - Phase 4 (Current): modern Grid is default; legacy available via 'bootstrap_grid' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-552d
 * Related: biensperience-e5c4 (epic)
 */

import PropTypes from 'prop-types';
import { Row as RBRow, Col as RBCol } from 'react-bootstrap';
import { BaseRow, BaseCol } from '../Grid/BaseGrid';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * RowWrapper - Design System Abstraction for Row
 *
 * Uses modern CSS Grid implementation by default.
 * Legacy react-bootstrap Row available via feature flag.
 */
export function RowWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_grid');
  const Component = useLegacy ? RBRow : BaseRow;
  return <Component {...props} />;
}

RowWrapper.displayName = 'Row';

RowWrapper.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

/**
 * ColWrapper - Design System Abstraction for Col
 *
 * Uses modern CSS Grid column implementation by default.
 * Legacy react-bootstrap Col available via feature flag.
 */
export function ColWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_grid');
  const Component = useLegacy ? RBCol : BaseCol;
  return <Component {...props} />;
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
