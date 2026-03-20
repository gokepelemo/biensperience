/**
 * ProgressBar Abstraction Layer
 *
 * This component provides a stable API for ProgressBar usage across the application.
 * It wraps either the current custom ProgressBar or the modern Progress implementation,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All progress bar consumers should import from design-system, NOT directly from ProgressBar.
 *
 * Implementation Status:
 * - Phase 1: Custom ProgressBar with CSS Modules (completed)
 * - Phase 2: Feature-flagged modern Progress (completed)
 * - Phase 3: modern Progress validation (completed)
 * - Phase 4 (Current): modern Progress is default; legacy available via 'bootstrap_progress' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-20d0
 */

import PropTypes from 'prop-types';
import ProgressBar from '../ProgressBar/ProgressBar';
import BaseProgressBar from '../ProgressBar/BaseProgressBar';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * ProgressBarWrapper - Design System Abstraction for ProgressBar
 *
 * Uses modern Progress implementation by default.
 * Legacy ProgressBar available via feature flag.
 */
export default function ProgressBarWrapper(props) {
  // modern Progress is now the default implementation (Phase 4)
  // Users can opt into the legacy ProgressBar via 'bootstrap_progress' flag
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_progress');
  const Component = useLegacy ? ProgressBar : BaseProgressBar;
  return <Component {...props} />;
}

ProgressBarWrapper.displayName = 'ProgressBar';

ProgressBarWrapper.propTypes = {
  value: PropTypes.number.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'danger', 'warning']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showPercentage: PropTypes.bool,
  animated: PropTypes.bool,
  label: PropTypes.node,
  secondaryLabel: PropTypes.node,
};
