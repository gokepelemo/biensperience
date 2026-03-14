/**
 * Checkbox Abstraction Layer
 *
 * Provides a stable API for Checkbox usage across the application.
 * Wraps either the modern Chakra-based BaseCheckbox or the legacy CSS-module
 * Checkbox implementation, controlled by a feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between
 * implementations. All checkbox consumers should import from design-system,
 * NOT from ../Checkbox/Checkbox.
 *
 * Implementation Status:
 * - Phase 1: Custom Checkbox with CSS Modules (completed)
 * - Phase 2: Feature-flagged modern Checkbox (completed)
 * - Phase 3: modern Checkbox validation (completed)
 * - Phase 4 (Current): modern Checkbox is default; legacy available via
 *                       'bootstrap_checkbox' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * Task: biensperience-049a
 */

import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import Checkbox from '../Checkbox/Checkbox';
import BaseCheckbox from '../Checkbox/BaseCheckbox';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * CheckboxWrapper — Design System Checkbox
 *
 * Uses modern Chakra Checkbox by default.
 * Legacy CSS-module Checkbox available via 'bootstrap_checkbox' feature flag.
 */
const CheckboxWrapper = forwardRef(function CheckboxWrapper(props, ref) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_checkbox');
  const CheckboxComponent = useLegacy ? Checkbox : BaseCheckbox;
  return <CheckboxComponent {...props} ref={ref} />;
});

CheckboxWrapper.displayName = 'Checkbox';

CheckboxWrapper.propTypes = {
  id: PropTypes.string,
  label: PropTypes.node,
  checked: PropTypes.bool,
  defaultChecked: PropTypes.bool,
  onChange: PropTypes.func,
  onCheckedChange: PropTypes.func,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  variant: PropTypes.oneOf(['outline', 'subtle', 'solid']),
  colorScheme: PropTypes.oneOf(['primary', 'success', 'warning', 'danger']),
  indeterminate: PropTypes.bool,
  className: PropTypes.string,
};

export default CheckboxWrapper;
