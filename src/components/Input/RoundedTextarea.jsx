import React, { useState, forwardRef } from 'react';
import PropTypes from 'prop-types';
import FormField from '../FormField/FormField';
import styles from './RoundedTextarea.module.scss';

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
  const fieldClass = [styles.roundedTextareaInput, rounded && `${styles.roundedTextareaInput}--rounded`, variant && `${styles.roundedTextarea}--${variant}`, className].filter(Boolean).join(' ');

  return (
    <div className={`${styles.roundedTextarea} ${className}`}>
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

      <div className={styles.roundedTextareaFooter}>
        <small className={styles.helper}>{helper}</small>
        <small className={styles.counter}>{text.length}/{maxLength}</small>
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
