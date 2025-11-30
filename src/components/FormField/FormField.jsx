import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { FormTooltip } from '../Tooltip/Tooltip';
import PropTypes from 'prop-types';
import styles from './FormField.module.scss';
import TextareaAutosize from 'react-textarea-autosize';
import SearchableSelect from './SearchableSelect';

/**
 * FormField Component - Complete Bootstrap form field with label, validation, and tooltip
 *
 * Supports multiple input types including a searchable select dropdown:
 * - type="searchable-select" - Custom searchable dropdown with icon support
 *
 * @param {Object} props
 * @param {string} props.name - Field name (used for id and name attributes)
 * @param {string} [props.label] - Field label text
 * @param {string} [props.type='text'] - Input type ('text', 'textarea', 'searchable-select', etc.)
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
 * @param {string} [props.size] - Field size: 'sm', 'md', or 'lg'
 * @param {string} [props.autoComplete] - Autocomplete attribute
 * @param {React.ReactNode} [props.prepend] - InputGroup prepend element
 * @param {React.ReactNode} [props.append] - InputGroup append element
 * @param {string} [props.className] - Additional CSS class
 * @param {string} [props.as] - Render as different element (e.g., 'textarea', 'select')
 * @param {number} [props.rows] - Number of rows for textarea
 * @param {React.ReactNode} [props.children] - Children for select/custom inputs
 * @param {Array} [props.options] - Options for searchable-select [{value, label, icon?, suffix?}]
 * @param {boolean} [props.searchable] - Enable search for searchable-select (default: true)
 * @param {string} [props.searchPlaceholder] - Search input placeholder for searchable-select
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
  rounded = false,
  variant,
  showCounter = false,
  children,
  // SearchableSelect props
  options,
  searchable = true,
  searchPlaceholder,
  ...rest
}) {
  const hasInputGroup = prepend || append;

  // Determine input type variants
  const isTextarea = (as === 'textarea' || type === 'textarea');
  const isSearchableSelect = type === 'searchable-select';

  // Build class names for control
  const controlClasses = [className];
  if (isTextarea) controlClasses.push(styles.textareaControl);
  else if (type === 'text') controlClasses.push(styles.textControl);
  if (rounded) controlClasses.push(styles.rounded);
  if (variant === 'accent') controlClasses.push(styles.accent);
  if (variant === 'error' || isInvalid) controlClasses.push(styles.error);
  if (isValid) controlClasses.push(styles.valid);

  let formControl;
  if (isSearchableSelect) {
    // Searchable select with icon support
    formControl = (
      <SearchableSelect
        id={name}
        name={name}
        options={options || []}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        searchable={searchable}
        disabled={disabled}
        size={size || 'md'}
        isValid={isValid}
        isInvalid={isInvalid}
        className={className}
        {...rest}
      />
    );
  } else if (isTextarea) {
    // Use autosizing textarea for better UX
    const taClasses = controlClasses.join(' ');
    formControl = (
      <TextareaAutosize
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        minRows={rows || 3}
        maxRows={10}
        disabled={disabled}
        readOnly={readOnly}
        className={`${taClasses} ${isInvalid ? 'is-invalid' : ''} ${isValid ? 'is-valid' : ''}`}
        {...rest}
      />
    );
  } else {
    formControl = (
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
        className={controlClasses.join(' ')}
        as={as}
        rows={rows}
        {...rest}
      >
        {children}
      </Form.Control>
    );
  }

  return (
    <Form.Group className="mb-3">
      {label && (
        <Form.Label>
          {label}
          {required && <span className="text-danger ms-1">*</span>}
          {tooltip && <FormTooltip content={tooltip} placement={tooltipPlacement} />}
        </Form.Label>
      )}
      
      {isSearchableSelect ? (
        // SearchableSelect renders its own wrapper
        formControl
      ) : hasInputGroup ? (
        <InputGroup className={styles.inputGroupWrapper}>
          {prepend && (
            <InputGroup.Text className={styles.addon}>{prepend}</InputGroup.Text>
          )}
          {formControl}
          {append && (
            <InputGroup.Text className={styles.addon}>{append}</InputGroup.Text>
          )}
        </InputGroup>
      ) : (
        // For textarea or text inputs we wrap to allow overlayed counter/icon and unified style
        (isTextarea || type === 'text') ? (
          <div className={isTextarea ? styles.textareaWrapper : styles.textWrapper}>
            {formControl}
            {/* Inline overlay counter removed — keep helper counter below the field */}
            <div className={styles.editIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill="currentColor"/>
              </svg>
            </div>
          </div>
        ) : formControl
      )}

      {validFeedback && <Form.Control.Feedback type="valid">{validFeedback}</Form.Control.Feedback>}
      {invalidFeedback && <Form.Control.Feedback type="invalid">{invalidFeedback}</Form.Control.Feedback>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {helpText ? <Form.Text className="text-muted">{helpText}</Form.Text> : <div />}
        {isTextarea && showCounter && (
          <Form.Text className="text-muted">{(value && value.length) || 0}/{rest.maxLength || ''}</Form.Text>
        )}
      </div>
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
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  autoComplete: PropTypes.string,
  prepend: PropTypes.node,
  append: PropTypes.node,
  className: PropTypes.string,
  as: PropTypes.string,
  rows: PropTypes.number,
  children: PropTypes.node,
  rounded: PropTypes.bool,
  variant: PropTypes.string,
  showCounter: PropTypes.bool,
  // SearchableSelect props
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    suffix: PropTypes.string,
  })),
  searchable: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
};
