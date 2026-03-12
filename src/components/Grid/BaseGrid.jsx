/**
 * BaseGrid – Native Chakra UI v3 Grid / GridItem
 *
 * 12-column responsive grid via Chakra Grid + GridItem.
 * No CSS Module import — responsive column spans expressed with
 * Chakra responsive object syntax (`base`, `sm`, `md`, `lg`, `xl`).
 *
 * Breakpoints match the theme: xs 320, sm 480, md 768, lg 992, xl 1200, 2xl 1400.
 *
 * Migrated: P2.11 — biensperience-3aaa
 */

import PropTypes from 'prop-types';
import { Grid, GridItem } from '@chakra-ui/react';

/* ── BaseRow ────────────────────────────────────────────────────────── */

export function BaseRow({ children, className = '', style, ...props }) {
  return (
    <Grid
      templateColumns="repeat(12, 1fr)"
      gap="6"
      width="100%"
      className={className || undefined}
      style={style}
      {...props}
    >
      {children}
    </Grid>
  );
}

BaseRow.displayName = 'Row';

BaseRow.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

/* ── BaseCol ────────────────────────────────────────────────────────── */

/**
 * Responsive grid column.  Accepts xs/sm/md/lg/xl/xxl (1-12).
 * Default: full width (colSpan 12) on all breakpoints.
 *
 * Converts to Chakra responsive object: { base, sm, md, lg, xl, "2xl" }.
 */
export function BaseCol({ children, className = '', xs, sm, md, lg, xl, xxl, style, ...props }) {
  // Build responsive colSpan — only include set breakpoints
  const colSpan = {};
  if (xs)  colSpan.base = xs;
  if (sm)  colSpan.sm   = sm;
  if (md)  colSpan.md   = md;
  if (lg)  colSpan.lg   = lg;
  if (xl)  colSpan.xl   = xl;
  if (xxl) colSpan['2xl'] = xxl;

  const hasResponsive = Object.keys(colSpan).length > 0;

  // Default to full-width (12 cols) on mobile when responsive breakpoints are set
  // but no base/xs value is specified. Matches Bootstrap behavior where columns
  // are full-width by default and only resize at the specified breakpoint.
  if (hasResponsive && !colSpan.base) {
    colSpan.base = 12;
  }

  return (
    <GridItem
      colSpan={hasResponsive ? colSpan : 12}
      minW="0"
      className={className || undefined}
      style={style}
      {...props}
    >
      {children}
    </GridItem>
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
