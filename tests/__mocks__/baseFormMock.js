/**
 * Mock for BaseForm components used in integration tests.
 * Replaces Chakra Field primitives with plain HTML to avoid
 * Field.Root context requirements in test environments.
 */

const React = require('react');

function BaseForm({ children, onSubmit, className, ...props }) {
  return React.createElement('form', {
    className,
    onSubmit: (e) => { e.preventDefault(); onSubmit && onSubmit(e); },
    ...props
  }, children);
}

function BaseFormGroup({ children, className, invalid, ...props }) {
  return React.createElement('div', { className, ...props }, children);
}

function BaseFormLabel({ children, htmlFor, required, className, ...props }) {
  return React.createElement('label', { className, htmlFor, ...props },
    children,
    required && React.createElement('span', { 'aria-label': 'required' }, '*')
  );
}

const BaseFormControl = React.forwardRef(function BaseFormControl(
  { as: Component = 'input', type = 'text', className, ...props },
  ref
) {
  return React.createElement(Component, { ref, type, className, ...props });
});

function BaseFormCheck({ children, label, type = 'checkbox', id, className, ...props }) {
  const resolvedLabel = children || label;
  return React.createElement('div', { className },
    React.createElement('input', { type, id, ...props }),
    resolvedLabel && React.createElement('label', { htmlFor: id }, resolvedLabel)
  );
}

function BaseFormText({ children, muted, className, ...props }) {
  return React.createElement('small', { className, ...props }, children);
}

function BaseFormInputGroup({ children, prefix, suffix, className, ...props }) {
  return React.createElement('div', { className, ...props },
    prefix && React.createElement('span', null, prefix),
    children,
    suffix && React.createElement('span', null, suffix)
  );
}

BaseForm.Group = BaseFormGroup;
BaseForm.Label = BaseFormLabel;
BaseForm.Control = BaseFormControl;
BaseForm.Check = BaseFormCheck;
BaseForm.Text = BaseFormText;
BaseForm.InputGroup = BaseFormInputGroup;

module.exports = BaseForm;
module.exports.default = BaseForm;
module.exports.BaseFormGroup = BaseFormGroup;
module.exports.BaseFormLabel = BaseFormLabel;
module.exports.BaseFormControl = BaseFormControl;
module.exports.BaseFormCheck = BaseFormCheck;
module.exports.BaseFormText = BaseFormText;
module.exports.BaseFormInputGroup = BaseFormInputGroup;
