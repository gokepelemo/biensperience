import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { FormTooltip } from '../Tooltip/Tooltip';
import PropTypes from 'prop-types';

/**
 * FormField Component - Complete Bootstrap form field with label, validation, and tooltip
 * 
 * @param {Object} props
 * @param {string} props.name - Field name (used for id and name attributes)
 * @param {string} [props.label] - Field label text
 * @param {string} [props.type='text'] - Input type
 * @param {string} [props.value] - Current value
 * @param {Function} props.onChange - Change handler
 * @param {Function} [props.onBlur] - Blur handler
 * @param {string} [props.placeholder] - Placeholder text
 * @param {boolean} [props.required=false] - Is field required
 * @param {boolean} [props.disabled=false] - Is field disabled
 * @param {boolean} [props.readOnly=false] - Is field read-only
 * @param {boolean} [props.isValid] - Valid state (shows green border)
 * @param {boolean} [props.isInvalid] - Invalid state (shows red border)
 * @param {string} [props.validFeedback] - Valid feedback message
 * @param {string} [props.invalidFeedback] - Invalid feedback message (error message)
 * @param {string} [props.helpText] - Help text below field
 * @param {string|React.ReactNode} [props.tooltip] - Tooltip content
 * @param {string} [props.tooltipPlacement='top'] - Tooltip placement
 * @param {string} [props.size] - Field size: 'sm' or 'lg'
 * @param {string} [props.autoComplete] - Autocomplete attribute
 * @param {React.ReactNode} [props.prepend] - InputGroup prepend element
 * @param {React.ReactNode} [props.append] - InputGroup append element
 * @param {string} [props.className] - Additional CSS class
 * @param {string} [props.as] - Render as different element (e.g., 'textarea', 'select')
 * @param {number} [props.rows] - Number of rows for textarea
 * @param {React.ReactNode} [props.children] - Children for select/custom inputs
 */
export default function FormField({
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  disabled = false,
  readOnly = false,
  isValid,
  isInvalid,
  validFeedback,
  invalidFeedback,
  helpText,
  tooltip,
  tooltipPlacement = 'top',
  size,
  autoComplete,
  prepend,
  append,
  className = '',
  as,
  rows,
  children,
  ...rest
}) {
  const hasInputGroup = prepend || append;

  const formControl = (
    <Form.Control
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      isValid={isValid}
      isInvalid={isInvalid}
      size={size}
      autoComplete={autoComplete}
      className={className}
      as={as}
      rows={rows}
      {...rest}
    >
      {children}
    </Form.Control>
  );

  return (
    <Form.Group className="mb-3" controlId={name}>
      {label && (
        <Form.Label>
          {label}
          {required && <span className="text-danger ms-1">*</span>}
          {tooltip && <FormTooltip content={tooltip} placement={tooltipPlacement} />}
        </Form.Label>
      )}
      
      {hasInputGroup ? (
        <InputGroup>
          {prepend && <InputGroup.Text>{prepend}</InputGroup.Text>}
          {formControl}
          {append && <InputGroup.Text>{append}</InputGroup.Text>}
        </InputGroup>
      ) : (
        formControl
      )}

      {validFeedback && <Form.Control.Feedback type="valid">{validFeedback}</Form.Control.Feedback>}
      {invalidFeedback && <Form.Control.Feedback type="invalid">{invalidFeedback}</Form.Control.Feedback>}
      {helpText && <Form.Text className="text-muted">{helpText}</Form.Text>}
    </Form.Group>
  );
}

FormField.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  isValid: PropTypes.bool,
  isInvalid: PropTypes.bool,
  validFeedback: PropTypes.string,
  invalidFeedback: PropTypes.string,
  helpText: PropTypes.string,
  tooltip: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  tooltipPlacement: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'lg']),
  autoComplete: PropTypes.string,
  prepend: PropTypes.node,
  append: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.string,
  rows: PropTypes.number,
  children: PropTypes.node,
};
