/**
 * ProgressBar Abstraction Layer
 *
 * This component provides a stable API for ProgressBar usage across the application.
 * It wraps either the current custom ProgressBar or the Chakra UI Progress implementation,
 * controlled by the 'chakra_ui' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All progress bar consumers should import from design-system, NOT directly from ProgressBar.
 *
 * Implementation Status:
 * - Phase 1: Custom ProgressBar with CSS Modules (completed)
 * - Phase 2: Feature-flagged Chakra UI Progress (completed)
 * - Phase 3: Chakra UI Progress validation (completed)
 * - Phase 4 (Current): Chakra UI Progress is default; legacy available via 'bootstrap_progress' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-20d0
 */

import PropTypes from 'prop-types';
import ProgressBar from '../ProgressBar/ProgressBar';
import ChakraProgressBar from '../ProgressBar/ChakraProgressBar';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * ProgressBarWrapper - Design System Abstraction for ProgressBar
 *
 * Uses Chakra UI v3 Progress implementation when 'chakra_ui' feature flag
 * is enabled, otherwise falls back to the custom CSS Modules ProgressBar.
 */
export default function ProgressBarWrapper(props) {
  // Chakra UI Progress is now the default implementation (Phase 4)
  // Users can opt into the legacy ProgressBar via 'bootstrap_progress' flag
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_progress');
  const Component = useLegacy ? ProgressBar : ChakraProgressBar;
  return <Component {...props} />;
}

ProgressBarWrapper.displayName = 'ProgressBar';

ProgressBarWrapper.propTypes = {
  value: PropTypes.number.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'danger', 'warning']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showPercentage: PropTypes.bool,
  animated: PropTypes.bool,
};
