import React, { useState, forwardRef } from 'react';
import PropTypes from 'prop-types';
import FormField from '../FormField/FormField';
import './RoundedTextarea.css';

/**
 * RoundedTextarea now implemented as a variation of FormField.
 * It forwards props to FormField (as='textarea') and adds a helper + counter footer.
 */
const RoundedTextarea = forwardRef(function RoundedTextarea(
  { label, helper, maxLength = 300, value = '', onChange, className = '', placeholder = '', rows = 4, rounded = true, variant, ...props }, ref
) {
  const [text, setText] = useState(value);

  const handleChange = (e) => {
    setText(e.target.value);
    onChange && onChange(e);
  };

  // Provide a class to FormField so the underlying Form.Control can receive rounded styling
  const fieldClass = ['rounded-textarea-input', rounded && 'rounded-textarea-input--rounded', variant && `rounded-textarea--${variant}`, className].filter(Boolean).join(' ');

  return (
    <div className={`rounded-textarea ${className}`}>
      <FormField
        name={props.name}
        label={label}
        as="textarea"
        rows={rows}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={fieldClass}
        {...props}
        ref={ref}
      />

      <div className="rounded-textarea-footer">
        <small className="helper">{helper}</small>
        <small className="counter">{text.length}/{maxLength}</small>
      </div>
    </div>
  );
});

RoundedTextarea.propTypes = {
  label: PropTypes.node,
  helper: PropTypes.node,
  maxLength: PropTypes.number,
  value: PropTypes.string,
  onChange: PropTypes.func,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  rows: PropTypes.number,
  rounded: PropTypes.bool,
  variant: PropTypes.string
};

export default RoundedTextarea;
