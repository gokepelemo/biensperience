/**
 * Layout Abstraction Layer
 *
 * Provides stable API for Layout components (FlexBetween, FlexCenter, SpaceY, Container, Stack).
 * Wraps either custom CSS Modules or modern implementations,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All layout consumers should import from design-system, NOT directly from Layout.
 *
 * Implementation Status:
 * - Phase 1: Custom Layout with CSS Modules (completed)
 * - Phase 2: Feature-flagged modern Layout (completed)
 * - Phase 3: modern Layout validation (completed)
 * - Phase 4 (Current): modern Layout is default; legacy available via 'bootstrap_layout' flag
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
  FlexBetweenImpl,
  FlexCenterImpl,
  SpaceYImpl,
  ContainerImpl,
  StackImpl
} from '../Layout/FlexLayout';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * FlexBetween - Design System Abstraction
 */
export function FlexBetween(props) {
  // modern Layout is now the default (Phase 4)
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_layout');
  const Component = useLegacy ? LegacyFlexBetween : FlexBetweenImpl;
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
  const Component = useLegacy ? LegacyFlexCenter : FlexCenterImpl;
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
  const Component = useLegacy ? LegacySpaceY : SpaceYImpl;
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
  const Component = useLegacy ? LegacyContainer : ContainerImpl;
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
  const Component = useLegacy ? LegacyStack : StackImpl;
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
