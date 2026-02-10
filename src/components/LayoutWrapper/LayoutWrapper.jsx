/**
 * Layout Abstraction Layer
 *
 * Provides stable API for Layout components (FlexBetween, FlexCenter, SpaceY, Container, Stack).
 * Wraps either custom CSS Modules or Chakra UI implementations,
 * controlled by the 'chakra_ui' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All layout consumers should import from design-system, NOT directly from Layout.
 *
 * Implementation Status:
 * - Phase 1: Custom Layout with CSS Modules (completed)
 * - Phase 2: Feature-flagged Chakra UI Layout (completed)
 * - Phase 3: Chakra UI Layout validation (completed)
 * - Phase 4 (Current): Chakra UI Layout is default; legacy available via 'bootstrap_layout' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-20d0
 */

import PropTypes from 'prop-types';
import {
  FlexBetween as LegacyFlexBetween,
  FlexCenter as LegacyFlexCenter,
  SpaceY as LegacySpaceY,
  Container as LegacyContainer,
  Stack as LegacyStack
} from '../Layout/Layout';
import {
  ChakraFlexBetween,
  ChakraFlexCenter,
  ChakraSpaceY,
  ChakraContainerComponent,
  ChakraStackComponent
} from '../Layout/ChakraLayout';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * FlexBetween - Design System Abstraction
 */
export function FlexBetween(props) {
  // Chakra UI Layout is now the default (Phase 4)
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_layout');
  const Component = useLegacy ? LegacyFlexBetween : ChakraFlexBetween;
  return <Component {...props} />;
}
FlexBetween.displayName = 'FlexBetween';
FlexBetween.propTypes = {
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['start', 'center', 'end', 'stretch']),
  gap: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FlexCenter - Design System Abstraction
 */
export function FlexCenter(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_layout');
  const Component = useLegacy ? LegacyFlexCenter : ChakraFlexCenter;
  return <Component {...props} />;
}
FlexCenter.displayName = 'FlexCenter';
FlexCenter.propTypes = {
  children: PropTypes.node.isRequired,
  direction: PropTypes.oneOf(['row', 'column']),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * SpaceY - Design System Abstraction
 */
export function SpaceY(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_layout');
  const Component = useLegacy ? LegacySpaceY : ChakraSpaceY;
  return <Component {...props} />;
}
SpaceY.displayName = 'SpaceY';
SpaceY.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['1', '2', '3', '4', '5', '6']),
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Container - Design System Abstraction
 */
export function Container(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_layout');
  const Component = useLegacy ? LegacyContainer : ChakraContainerComponent;
  return <Component {...props} />;
}
Container.displayName = 'Container';
Container.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', 'full']),
  center: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * Stack - Design System Abstraction
 */
export function Stack(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_layout');
  const Component = useLegacy ? LegacyStack : ChakraStackComponent;
  return <Component {...props} />;
}
Stack.displayName = 'Stack';
Stack.propTypes = {
  children: PropTypes.node.isRequired,
  spacing: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  align: PropTypes.oneOf(['start', 'center', 'end']),
  className: PropTypes.string,
  style: PropTypes.object
};
