/**
 * SkeletonLoader Abstraction Layer
 *
 * This component provides a stable API for SkeletonLoader usage across the application.
 * It wraps either the current custom SkeletonLoader or the Chakra UI Skeleton implementation,
 * controlled by the 'chakra_ui' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All skeleton consumers should import from design-system, NOT directly from SkeletonLoader.
 *
 * Implementation Status:
 * - Phase 1: Custom SkeletonLoader with react-loading-skeleton (completed)
 * - Phase 2: Feature-flagged Chakra UI Skeleton (completed)
 * - Phase 3: Chakra UI Skeleton validation (completed)
 * - Phase 4 (Current): Chakra UI Skeleton is default; legacy available via 'bootstrap_skeleton' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { SkeletonLoader } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-20d0
 */

import PropTypes from 'prop-types';
import SkeletonLoader from '../SkeletonLoader/SkeletonLoader';
import ChakraSkeletonLoader from '../SkeletonLoader/ChakraSkeletonLoader';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * SkeletonLoaderWrapper - Design System Abstraction for SkeletonLoader
 *
 * Uses Chakra UI v3 Skeleton implementation when 'chakra_ui' feature flag
 * is enabled, otherwise falls back to the react-loading-skeleton implementation.
 */
export default function SkeletonLoaderWrapper(props) {
  // Chakra UI Skeleton is now the default implementation (Phase 4)
  // Users can opt into the legacy SkeletonLoader via 'bootstrap_skeleton' flag
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_skeleton');
  const Component = useLegacy ? SkeletonLoader : ChakraSkeletonLoader;
  return <Component {...props} />;
}

SkeletonLoaderWrapper.displayName = 'SkeletonLoader';

SkeletonLoaderWrapper.propTypes = {
  variant: PropTypes.oneOf(['text', 'circle', 'rectangle']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  lines: PropTypes.number,
  animate: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};
