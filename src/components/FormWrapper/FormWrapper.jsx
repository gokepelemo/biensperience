/**
 * Form Abstraction Layer
 *
 * Provides stable APIs for Form component usage across the application.
 * All form consumers should import from design-system, NOT directly from Form.
 *
 * Implementation: Chakra UI Form (BaseForm) — Phase 5 complete.
 *
 * Task: biensperience-a8d1
 * Related: biensperience-8dd6 (Phase 1), biensperience-6ba4 (umbrella)
 */

import React from 'react';
import PropTypes from 'prop-types';
import BaseForm, {
  BaseFormGroup,
  BaseFormLabel,
  BaseFormControl,
  BaseFormCheck,
  BaseFormText,
  BaseFormInputGroup
} from '../Form/BaseForm';

/**
 * FormWrapper - Design System Form
 */
export function FormWrapper(props) {
  return <BaseForm {...props} />;
}

FormWrapper.displayName = 'Form';

FormWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormGroupWrapper
 */
export function FormGroupWrapper(props) {
  return <BaseFormGroup {...props} />;
}

FormGroupWrapper.displayName = 'FormGroup';

FormGroupWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  invalid: PropTypes.bool,
};

/**
 * FormLabelWrapper
 */
export function FormLabelWrapper(props) {
  return <BaseFormLabel {...props} />;
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
 * FormControlWrapper
 */
export const FormControlWrapper = React.forwardRef(function FormControlWrapper(props, ref) {
  return <BaseFormControl ref={ref} {...props} />;
});

FormControlWrapper.displayName = 'FormControl';

FormControlWrapper.propTypes = {
  as: PropTypes.oneOf(['input', 'select', 'textarea']),
  type: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormCheckWrapper
 */
export function FormCheckWrapper(props) {
  return <BaseFormCheck {...props} />;
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
 * FormTextWrapper
 */
export function FormTextWrapper(props) {
  return <BaseFormText {...props} />;
}

FormTextWrapper.displayName = 'FormText';

FormTextWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  muted: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormInputGroupWrapper
 */
export function FormInputGroupWrapper(props) {
  return <BaseFormInputGroup {...props} />;
}

FormInputGroupWrapper.displayName = 'FormInputGroup';

FormInputGroupWrapper.propTypes = {
  children: PropTypes.node.isRequired,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};

// Attach sub-components to FormWrapper so Form.Group, Form.Label, etc. work
FormWrapper.Group = FormGroupWrapper;
FormWrapper.Label = FormLabelWrapper;
FormWrapper.Control = FormControlWrapper;
FormWrapper.Check = FormCheckWrapper;
FormWrapper.Text = FormTextWrapper;
FormWrapper.InputGroup = FormInputGroupWrapper;

// Default export for Form
export default FormWrapper;
