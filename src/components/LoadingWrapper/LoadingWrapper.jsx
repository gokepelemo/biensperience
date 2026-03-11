/**
 * Loading Abstraction Layer
 *
 * This component provides a stable API for Loading usage across the application.
 * It wraps either the legacy CSS-Modules Loading or the modern Chakra BaseLoading,
 * controlled by the 'bootstrap_loading' feature flag.
 *
 * CRITICAL: All Loading consumers should import from design-system, NOT directly.
 *
 * Implementation Status:
 * - Phase 1-3: Legacy CSS Modules Loading (completed)
 * - Phase 4 (Current): Chakra BaseLoading is default; legacy via 'bootstrap_loading' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-dd5f — P4.1 App view & global layout → Chakra
 */

import PropTypes from 'prop-types';
import Loading from '../Loading/Loading';
import BaseLoading from '../Loading/BaseLoading';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * LoadingWrapper - Design System Abstraction for Loading
 *
 * Uses modern Chakra BaseLoading by default.
 * Legacy CSS Modules Loading available via 'bootstrap_loading' feature flag.
 */
export default function LoadingWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_loading');
  const Component = useLegacy ? Loading : BaseLoading;
  return <Component {...props} />;
}

LoadingWrapper.displayName = 'Loading';

LoadingWrapper.propTypes = {
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  variant: PropTypes.oneOf(['inline', 'fullscreen', 'centered']),
  animation: PropTypes.oneOf(['pulse', 'spin', 'fan', 'orbit', 'breathe', 'bounce', 'shake', 'wave', 'engine']),
  className: PropTypes.string,
  message: PropTypes.string,
  showMessage: PropTypes.bool,
  overlay: PropTypes.oneOf(['none', 'light', 'dark']),
  allowCustomMessage: PropTypes.bool,
};
