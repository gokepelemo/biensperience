/**
 * Layout – Native Chakra UI v3 layout primitives
 *
 * Replaces CSS-Module-based Layout components with native Chakra Flex, Box,
 * Stack and Container primitives.  All spacing / alignment is expressed via
 * Chakra token props so no SCSS module is imported.
 *
 * Migrated: P2.7 — biensperience-b918
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Flex,
  Box,
  Stack as ChakraStack,
  Container as ChakraContainer,
} from '@chakra-ui/react';

/* ── token maps ─────────────────────────────────────────────────────── */

const GAP_MAP = { sm: '2', md: '4', lg: '6', xl: '8' };

const ALIGN_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  stretch: 'stretch',
};

const CONTAINER_MAX_W = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: 'none',
};

/* ── FlexBetween ────────────────────────────────────────────────────── */

export function FlexBetween({
  children,
  align = 'center',
  gap = 'md',
  wrap = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Flex
      justify="space-between"
      align={ALIGN_MAP[align] || 'center'}
      gap={GAP_MAP[gap] || gap}
      wrap={wrap ? 'wrap' : 'nowrap'}
      className={className || undefined}
      style={style}
      css={{
        '@media (max-width: 767px)': {
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 'var(--chakra-spacing-3)',
        },
      }}
      {...props}
    >
      {children}
    </Flex>
  );
}

FlexBetween.propTypes = {
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['start', 'center', 'end', 'stretch']),
  gap: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
};

/* ── FlexCenter ─────────────────────────────────────────────────────── */

export function FlexCenter({
  children,
  direction = 'row',
  wrap = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Flex
      justify="center"
      align="center"
      direction={direction}
      wrap={wrap ? 'wrap' : 'nowrap'}
      className={className || undefined}
      style={style}
      {...props}
    >
      {children}
    </Flex>
  );
}

FlexCenter.propTypes = {
  children: PropTypes.node.isRequired,
  direction: PropTypes.oneOf(['row', 'column']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
};

/* ── SpaceY ─────────────────────────────────────────────────────────── */

export function SpaceY({
  children,
  size = '4',
  className = '',
  style = {},
  ...props
}) {
  return (
    <ChakraStack
      direction="column"
      gap={size}
      className={className || undefined}
      style={style}
      {...props}
    >
      {children}
    </ChakraStack>
  );
}

SpaceY.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['1', '2', '3', '4', '5', '6']),
  className: PropTypes.string,
  style: PropTypes.object,
};

/* ── Container ──────────────────────────────────────────────────────── */

export function Container({
  children,
  size = 'xl',
  center = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Box
      width="100%"
      maxW={CONTAINER_MAX_W[size] || '1280px'}
      mx={center ? 'auto' : undefined}
      px={{ base: '3', sm: '4' }}
      className={className || undefined}
      style={style}
      {...props}
    >
      {children}
    </Box>
  );
}

Container.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  center: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
};

/* ── Stack ──────────────────────────────────────────────────────────── */

export function Stack({
  children,
  spacing = 'md',
  align = 'start',
  className = '',
  style = {},
  ...props
}) {
  return (
    <ChakraStack
      direction="column"
      gap={GAP_MAP[spacing] || spacing}
      align={ALIGN_MAP[align] || 'flex-start'}
      className={className || undefined}
      style={style}
      {...props}
    >
      {children}
    </ChakraStack>
  );
}

Stack.propTypes = {
  children: PropTypes.node.isRequired,
  spacing: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  align: PropTypes.oneOf(['start', 'center', 'end']),
  className: PropTypes.string,
  style: PropTypes.object,
};