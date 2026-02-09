/**
 * Button Abstraction Layer
 *
 * This component provides a stable API for Button usage across the application.
 * It wraps either the current custom Button or the Chakra UI Button implementation,
 * controlled by the 'chakra_ui' feature flag.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All button consumers should import from design-system, NOT directly from Button.
 *
 * Implementation Status:
 * - Phase 1: Custom Button with CSS Modules (completed)
 * - Phase 2 (Current): Feature-flagged Chakra UI Button
 * - Phase 3: Chakra UI Button as default (pending validation)
 * - Phase 4: Remove legacy implementation (after validation period)
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { Button } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-558b
 * Related: biensperience-8dd6 (Phase 1), biensperience-6ba4 (umbrella)
 */

import { forwardRef } from 'react';
import PropTypes from 'prop-types';
import Button from '../Button/Button';
import ChakraButton from '../Button/ChakraButton';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

const BOOTSTRAP_VARIANTS = [
  'primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark',
  'outline-primary', 'outline-secondary', 'outline-success', 'outline-danger',
  'outline-warning', 'outline-info', 'outline-light', 'outline-dark'
];

/**
 * Button Component - Design System Abstraction
 *
 * Uses Chakra UI v3 Button implementation when 'chakra_ui' feature flag
 * is enabled, otherwise falls back to the custom CSS Modules Button.
 *
 * @param {Object} props - Button properties (see Button.jsx for full docs)
 * @param {React.Ref} ref - Forwarded ref to button element
 * @returns {React.ReactElement} Button component
 */
const ButtonWrapper = forwardRef((props, ref) => {
  // Feature-flagged: Use Chakra UI Button when 'chakra_ui' flag is enabled
  const { enabled: useChakra } = useFeatureFlag('chakra_ui');
  const ButtonComponent = useChakra ? ChakraButton : Button;
  return <ButtonComponent {...props} ref={ref} />;
});

// Display name for React DevTools
ButtonWrapper.displayName = 'Button';

// PropTypes definition (matches Button implementation exactly)
ButtonWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf([
    'gradient',
    'outline',
    'light',
    'tertiary',
    'link',
    'danger',
    'success',
    'bootstrap',
    'primary',
    ...BOOTSTRAP_VARIANTS,
  ]),
  bootstrapVariant: PropTypes.oneOf(BOOTSTRAP_VARIANTS),
  rounded: PropTypes.bool,
  shadow: PropTypes.bool,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  onClick: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object,
  as: PropTypes.oneOfType([PropTypes.string, PropTypes.elementType]),
  href: PropTypes.string,
  to: PropTypes.string,
  matchWidth: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
};

export default ButtonWrapper;
