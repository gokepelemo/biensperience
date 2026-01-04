import React from 'react';
import PropTypes from 'prop-types';
import { lang } from '../../lang.constants';
import styles from './Form.module.scss';

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

  const classes = [styles.formUnified, className].filter(Boolean).join(' ');

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
  const classes = [styles.formGroup, className].filter(Boolean).join(' ');

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
  const classes = [styles.formLabel, className].filter(Boolean).join(' ');

  return (
    <label
      className={classes}
      htmlFor={htmlFor}
      style={style}
      {...props}
    >
      {children}
      {required && <span className={styles.formRequired} aria-label={lang.current.aria.required}>*</span>}
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
  const classes = [styles.formControl, className].filter(Boolean).join(' ');

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
  const classes = [styles.formCheck, className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      <input
        type={type}
        className={styles.formCheckInput}
        id={id}
        {...props}
      />
      <label className={styles.formCheckLabel} htmlFor={id}>
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
    styles.formText,
    muted && styles.formTextMuted,
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

/**
 * FormInputGroup component for prefix/suffix fields (e.g., "$" or "days")
 * Renders a single continuous border around the whole group.
 */
export function FormInputGroup({
  children,
  prefix,
  suffix,
  className = '',
  style = {},
  ...props
}) {
  const classes = [styles.inputGroup, className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} {...props}>
      {prefix !== undefined && prefix !== null && (
        <span className={styles.inputGroupAddon} aria-hidden>
          {prefix}
        </span>
      )}
      {children}
      {suffix !== undefined && suffix !== null && (
        <span className={styles.inputGroupAddon} aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  );
}

FormInputGroup.propTypes = {
  children: PropTypes.node.isRequired,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};
