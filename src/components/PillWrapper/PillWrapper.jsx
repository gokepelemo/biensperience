/**
 * Pill Abstraction Layer
 *
 * This component provides a stable API for Pill usage across the application.
 * It wraps either the current custom Pill or the modern Badge implementation,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All pill consumers should import from design-system, NOT directly from Pill.
 *
 * Implementation Status:
 * - Phase 1: Custom Pill with CSS Modules (completed)
 * - Phase 2: Feature-flagged modern (completed) Badge
 * - Phase 3: modern Pill validation (completed)
 * - Phase 4 (Current): modern Pill is default; legacy available via 'bootstrap_pill' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-bbd4
 * Related: biensperience-8dd6 (Phase 1), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import Pill from '../Pill/Pill';
import BasePill from '../Pill/BasePill';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * Pill Component - Design System Abstraction
 *
 * Uses modern Badge implementation by default.
 * Legacy Pill available via feature flag.
 */
export default function PillWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_pill');
  const PillComponent = useLegacy ? Pill : BasePill;
  return <PillComponent {...props} />;
}

PillWrapper.displayName = 'Pill';

PillWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'neutral']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  rounded: PropTypes.bool,
  outline: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};
