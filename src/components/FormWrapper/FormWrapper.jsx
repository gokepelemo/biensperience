/**
 * Form Abstraction Layer
 *
 * This module provides stable APIs for Form component usage across the application.
 * It wraps either the current custom Form components or the modern Form implementations,
 * controlled by component-specific feature flags.
 *
 * CRITICAL: This abstraction enables zero-regression migration between implementations.
 * All form consumers should import from design-system, NOT directly from Form.
 *
 * Implementation Status:
 * - Phase 1: Custom Form with CSS Modules (completed)
 * - Phase 2: Feature-flagged modern (completed) Form
 * - Phase 3: modern Form validation (completed)
 * - Phase 4 (Current): modern Form is default; legacy available via 'bootstrap_form' flag
 * - Phase 5: Remove legacy implementation (after validation period)
 *
 * API Stability Guarantee:
 * - Props interface is stable and will not change
 * - All consumers can import { Form, FormGroup, etc. } from 'design-system'
 * - Implementation swap is transparent to consumers
 *
 * Task: biensperience-a8d1
 * Related: biensperience-8dd6 (Phase 1), biensperience-6ba4 (umbrella)
 */

import PropTypes from 'prop-types';
import Form, {
  FormGroup,
  FormLabel,
  FormControl,
  FormCheck,
  FormText,
  FormInputGroup
} from '../Form/Form';
import BaseForm, {
  BaseFormGroup,
  BaseFormLabel,
  BaseFormControl,
  BaseFormCheck,
  BaseFormText,
  BaseFormInputGroup
} from '../Form/BaseForm';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';

/**
 * FormWrapper - Design System Abstraction for Form
 *
 * Uses modern Form implementation by default.
 * Legacy Form available via feature flag.
 */
export function FormWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_form');
  const FormComponent = useLegacy ? Form : BaseForm;
  return <FormComponent {...props} />;
}

FormWrapper.displayName = 'Form';

FormWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormGroupWrapper - Design System Abstraction for FormGroup
 */
export function FormGroupWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_form');
  const Component = useLegacy ? FormGroup : BaseFormGroup;
  return <Component {...props} />;
}

FormGroupWrapper.displayName = 'FormGroup';

FormGroupWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  invalid: PropTypes.bool,
};

/**
 * FormLabelWrapper - Design System Abstraction for FormLabel
 */
export function FormLabelWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_form');
  const Component = useLegacy ? FormLabel : BaseFormLabel;
  return <Component {...props} />;
}

FormLabelWrapper.displayName = 'FormLabel';

FormLabelWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  htmlFor: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormControlWrapper - Design System Abstraction for FormControl
 */
export function FormControlWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_form');
  const Component = useLegacy ? FormControl : BaseFormControl;
  return <Component {...props} />;
}

FormControlWrapper.displayName = 'FormControl';

FormControlWrapper.propTypes = {
  as: PropTypes.oneOf(['input', 'select', 'textarea']),
  type: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormCheckWrapper - Design System Abstraction for FormCheck
 */
export function FormCheckWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_form');
  const Component = useLegacy ? FormCheck : BaseFormCheck;
  return <Component {...props} />;
}

FormCheckWrapper.displayName = 'FormCheck';

FormCheckWrapper.propTypes = {
  children: PropTypes.node,
  label: PropTypes.node,
  type: PropTypes.oneOf(['checkbox', 'radio']),
  id: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
  variant: PropTypes.oneOf(['outline', 'subtle', 'solid']),
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  colorScheme: PropTypes.oneOf(['primary', 'success', 'warning', 'danger']),
};

/**
 * FormTextWrapper - Design System Abstraction for FormText
 */
export function FormTextWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_form');
  const Component = useLegacy ? FormText : BaseFormText;
  return <Component {...props} />;
}

FormTextWrapper.displayName = 'FormText';

FormTextWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  muted: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormInputGroupWrapper - Design System Abstraction for FormInputGroup
 */
export function FormInputGroupWrapper(props) {
  const { enabled: useLegacy } = useFeatureFlag('bootstrap_form');
  const Component = useLegacy ? FormInputGroup : BaseFormInputGroup;
  return <Component {...props} />;
}

FormInputGroupWrapper.displayName = 'FormInputGroup';

FormInputGroupWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

// Default export for Form
export default FormWrapper;
