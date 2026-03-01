/**
 * Alert Abstraction Layer
 *
 * This component provides a stable API for Alert usage across the application.
 * It wraps either the current custom Alert or the modern Alert implementation,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All alert consumers should import from design-system, NOT directly from Alert.
 *
 * Implementation Status:
 * - Phase 1: Custom Alert with CSS Modules (completed)
 * - Phase 2: Feature-flagged modern Alert (completed)
 * - Phase 3: modern Alert validation (completed)
 * - Phase 4 (Current): modern Alert is default; legacy available via 'bootstrap_alert' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { Alert } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-f047
 * Related: biensperience-7b90 (Phase 4), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import Alert from '../Alert/Alert';
import BaseAlert from '../Alert/BaseAlert';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * AlertWrapper - Design System Abstraction for Alert
 *
 * Uses modern Alert implementation by default.
 * Legacy Alert available via feature flag.
 */
export default function AlertWrapper(props) {
  // modern Alert is now the default implementation (Phase 4)
  // Users can opt into the legacy Alert via 'bootstrap_alert' flag
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_alert');
  const AlertComponent = useLegacy ? Alert : BaseAlert;
  return <AlertComponent {...props} />;
}

AlertWrapper.displayName = 'Alert';

AlertWrapper.propTypes = {
  /** Alert type/variant */
  type: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']),
  /** Whether alert can be dismissed */
  dismissible: PropTypes.bool,
  /** Callback when alert is dismissed */
  onDismiss: PropTypes.func,
  /** Alert title (optional) */
  title: PropTypes.node,
  /** Alert message (alternative to children) */
  message: PropTypes.node,
  /** Alert content */
  children: PropTypes.node,
  /** Additional CSS class */
  className: PropTypes.string,
  /** Inline styles */
  style: PropTypes.object,
  /** Icon element */
  icon: PropTypes.node,
  /** Whether to show icon */
  showIcon: PropTypes.bool,
  /** Alert size */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Whether to show a prominent border */
  bordered: PropTypes.bool,
  /** Styles for close button */
  closeButtonStyle: PropTypes.object,
  /** Action buttons to display */
  actions: PropTypes.node,
};
