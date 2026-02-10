/**
 * Pill Abstraction Layer
 *
 * This component provides a stable API for Pill usage across the application.
 * It wraps either the current custom Pill or the Chakra UI Badge implementation,
 * controlled by the 'chakra_ui' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All pill consumers should import from design-system, NOT directly from Pill.
 *
 * Implementation Status:
 * - Phase 1: Custom Pill with CSS Modules (completed)
 * - Phase 2: Feature-flagged Chakra UI (completed) Badge
 * - Phase 3: Chakra UI Pill validation (completed)
 * - Phase 4 (Current): Chakra UI Pill is default; legacy available via 'bootstrap_pill' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-bbd4
 * Related: biensperience-8dd6 (Phase 1), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import Pill from '../Pill/Pill';
import ChakraPill from '../Pill/ChakraPill';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * Pill Component - Design System Abstraction
 *
 * Uses Chakra UI v3 Badge implementation when 'chakra_ui' feature flag
 * is enabled, otherwise falls back to the custom CSS Modules Pill.
 */
export default function PillWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_pill');
  const PillComponent = useLegacy ? Pill : ChakraPill;
  return <PillComponent {...props} />;
}

PillWrapper.displayName = 'Pill';

PillWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info', 'neutral']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  rounded: PropTypes.bool,
  outline: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};
