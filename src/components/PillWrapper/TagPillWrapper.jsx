/**
 * TagPill Abstraction Layer
 *
 * This component provides a stable API for TagPill usage across the application.
 * It wraps either the current custom TagPill or the modern Tag implementation,
 * controlled by component-specific feature flags.
 *
 * Task: biensperience-bbd4
 * Related: biensperience-8dd6 (Phase 1), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import TagPill from '../Pill/TagPill';
import BaseTagPill from '../Pill/BaseTagPill';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * TagPill Component - Design System Abstraction
 *
 * Uses modern Tag implementation by default.
 * Legacy TagPill available via feature flag.
 */
export default function TagPillWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_tagpill');
  const TagPillComponent = useLegacy ? TagPill : BaseTagPill;
  return <TagPillComponent {...props} />;
}

TagPillWrapper.displayName = 'TagPill';

TagPillWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info', 'neutral', 'light']),
  gradient: PropTypes.bool,
  rounded: PropTypes.bool,
  removable: PropTypes.bool,
  onRemove: PropTypes.func,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
  to: PropTypes.string,
  as: PropTypes.string,
  href: PropTypes.string,
};
