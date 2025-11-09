import React from 'react';
import PropTypes from 'prop-types';
import './Form.css';

/**
 * Form component with unified styling for form elements
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Form content
 * @param {function} props.onSubmit - Form submit handler
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Inline styles
 * @param {Object} props... - Other props passed to form element
 */
export default function Form({
  children,
  onSubmit,
  className = '',
  style = {},
  ...props
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  const classes = ['form-unified', className].filter(Boolean).join(' ');

  return (
    <form
      className={classes}
      style={style}
      onSubmit={handleSubmit}
      {...props}
    >
      {children}
    </form>
  );
}

Form.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormGroup component for grouping form elements with labels
 */
export function FormGroup({ children, className = '', style = {}, ...props }) {
  const classes = ['form-group', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}

FormGroup.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormLabel component for form labels
 */
export function FormLabel({ children, htmlFor, required = false, className = '', style = {}, ...props }) {
  const classes = ['form-label', className].filter(Boolean).join(' ');

  return (
    <label
      className={classes}
      htmlFor={htmlFor}
      style={style}
      {...props}
    >
      {children}
      {required && <span className="form-required" aria-label="required">*</span>}
    </label>
  );
}

FormLabel.propTypes = {
  children: PropTypes.node.isRequired,
  htmlFor: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormControl component for input, select, and textarea elements
 */
export function FormControl({
  as: Component = 'input',
  type = 'text',
  className = '',
  style = {},
  ...props
}) {
  const classes = ['form-control', className].filter(Boolean).join(' ');

  return (
    <Component
      type={type}
      className={classes}
      style={style}
      {...props}
    />
  );
}

FormControl.propTypes = {
  as: PropTypes.oneOf(['input', 'select', 'textarea']),
  type: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormCheck component for checkboxes and radio buttons
 */
export function FormCheck({
  children,
  type = 'checkbox',
  id,
  className = '',
  style = {},
  ...props
}) {
  const classes = ['form-check', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      <input
        type={type}
        className="form-check-input"
        id={id}
        {...props}
      />
      <label className="form-check-label" htmlFor={id}>
        {children}
      </label>
    </div>
  );
}

FormCheck.propTypes = {
  children: PropTypes.node.isRequired,
  type: PropTypes.oneOf(['checkbox', 'radio']),
  id: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * FormText component for help text under form controls
 */
export function FormText({ children, muted = false, className = '', style = {}, ...props }) {
  const classes = [
    'form-text',
    muted && 'form-text-muted',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {children}
    </div>
  );
}

FormText.propTypes = {
  children: PropTypes.node.isRequired,
  muted: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};