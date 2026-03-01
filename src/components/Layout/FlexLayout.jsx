/**
 * FlexLayout - Design System Layout Components Implementation
 *
 * Drop-in replacements for custom Layout components (FlexBetween, FlexCenter, SpaceY, Container, Stack).
 * Uses Flex/Box/Stack primitives for built-in accessibility
 * while preserving the existing CSS Modules styling.
 *
 * Benefits:
 * - Responsive prop arrays for breakpoint-based layout
 * - Built-in spacing/alignment utilities
 * - Consistent layout primitives across the design system
 *
 * Task: biensperience-20d0 - Create wrappers for Layout
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Flex, Box, Stack as StackPrimitive } from '@chakra-ui/react';
import styles from './Layout.module.scss';

const GAP_MAP = {
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
};

const ALIGN_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

/**
 * FlexBetweenImpl - Flex layout with space-between
 */
export function FlexBetweenImpl({
  children,
  align = 'center',
  gap = 'md',
  wrap = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    styles.flexBetween,
    styles[`align${align.charAt(0).toUpperCase() + align.slice(1)}`],
    styles[`gap${gap.charAt(0).toUpperCase() + gap.slice(1)}`],
    wrap && styles.flexWrap,
    className
  ].filter(Boolean).join(' ');

  return (
    <Flex
      justify="space-between"
      align={ALIGN_MAP[align] || 'center'}
      gap={GAP_MAP[gap] || gap}
      wrap={wrap ? 'wrap' : 'nowrap'}
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </Flex>
  );
}

FlexBetweenImpl.propTypes = {
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['start', 'center', 'end', 'stretch']),
  gap: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FlexCenterImpl - Flex layout with centered items
 */
export function FlexCenterImpl({
  children,
  direction = 'row',
  wrap = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    styles.flexCenter,
    styles[`direction${direction.charAt(0).toUpperCase() + direction.slice(1)}`],
    wrap && styles.flexWrap,
    className
  ].filter(Boolean).join(' ');

  return (
    <Flex
      justify="center"
      align="center"
      direction={direction}
      wrap={wrap ? 'wrap' : 'nowrap'}
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </Flex>
  );
}

FlexCenterImpl.propTypes = {
  children: PropTypes.node.isRequired,
  direction: PropTypes.oneOf(['row', 'column']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * SpaceYImpl - Vertical spacing between children
 */
export function SpaceYImpl({
  children,
  size = '4',
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    'space-y',
    `space-y-${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <StackPrimitive
      direction="column"
      gap={`var(--space-${size}, ${parseInt(size) * 0.25}rem)`}
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </StackPrimitive>
  );
}

SpaceYImpl.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['1', '2', '3', '4', '5', '6']),
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * ContainerPrimitive - Max-width content container
 */
export function ContainerImpl({
  children,
  size = 'xl',
  center = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    styles.container,
    styles[`container${size.charAt(0).toUpperCase() + size.slice(1)}`],
    center && styles.containerCenter,
    className
  ].filter(Boolean).join(' ');

  return (
    <Box
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </Box>
  );
}

ContainerImpl.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  center: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * StackImpl - Vertical layout with consistent spacing
 */
export function StackImpl({
  children,
  spacing = 'md',
  align = 'start',
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    styles.stack,
    styles[`stackSpacing${spacing.charAt(0).toUpperCase() + spacing.slice(1)}`],
    styles[`stackAlign${align.charAt(0).toUpperCase() + align.slice(1)}`],
    className
  ].filter(Boolean).join(' ');

  return (
    <StackPrimitive
      direction="column"
      gap={GAP_MAP[spacing] || spacing}
      align={ALIGN_MAP[align] || 'flex-start'}
      className={classes}
      style={style}
      {...props}
    >
      {children}
    </StackPrimitive>
  );
}

StackImpl.propTypes = {
  children: PropTypes.node.isRequired,
  spacing: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  align: PropTypes.oneOf(['start', 'center', 'end']),
  className: PropTypes.string,
  style: PropTypes.object
};
