/**
 * BaseForm - Design System Form Components Implementation
 *
 * Drop-in replacements for the custom Form components.
 * Uses Field and Input primitives for built-in accessibility,
 * keyboard handling, and ARIA support while preserving the existing
 * Form.module.scss styling via CSS Module class names.
 *
 * IMPORTANT: This implementation completely resets default styling
 * and applies the existing CSS Module classes, ensuring pixel-perfect
 * visual parity with the original Form components.
 *
 * Benefits:
 * - Built-in ARIA attributes and field validation state management
 * - Consistent focus management
 * - Label association with inputs via Field context
 * - Error and helper text accessibility
 *
 * Task: biensperience-a8d1 - Migrate Form components
 */

import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { Field, Input } from '@chakra-ui/react';
import Checkbox from '../Checkbox/Checkbox';
import { lang } from '../../lang.constants';
import styles from './Form.module.scss';

/**
 * Reset styles to completely override Chakra's default form styling.
 * This ensures the CSS Module classes from Form.module.scss are the
 * sole source of visual styling — pixel-perfect match with the original.
 */
const RESET_STYLES = {
  bg: 'transparent',
  color: 'inherit',
  border: 'none',
  borderRadius: 'unset',
  fontWeight: 'unset',
  fontSize: 'unset',
  lineHeight: 'unset',
  height: 'auto',
  minHeight: 'unset',
  paddingInline: 'unset',
  paddingBlock: 'unset',
  _hover: {
    bg: 'transparent',
    border: 'none',
  },
  _focusVisible: {
    boxShadow: 'none',
    outline: 'none',
  },
};

/**
 * BaseForm component - wrapper for form elements with unified styling
 *
 * Uses native form element (no Chakra equivalent needed) but maintains
 * API parity with the original Form component.
 */
export default function BaseForm({
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

BaseForm.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseFormGroup - Chakra Field.Root with CSS Module styling
 *
 * Uses Chakra Field.Root for form field context (validation, labels),
 * with reset styling to use CSS Modules.
 */
export function BaseFormGroup({
  children,
  className = '',
  style = {},
  invalid = false,
  ...props
}) {
  const classes = [styles.formGroup, className].filter(Boolean).join(' ');

  return (
    <Field.Root
      className={classes}
      style={style}
      invalid={invalid}
      css={RESET_STYLES}
      {...props}
    >
      {children}
    </Field.Root>
  );
}

BaseFormGroup.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  invalid: PropTypes.bool,
};

/**
 * BaseFormLabel - Chakra Field.Label with CSS Module styling
 *
 * Uses Chakra Field.Label for proper label-input association,
 * with optional required indicator.
 */
export function BaseFormLabel({
  children,
  htmlFor,
  required = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [styles.formLabel, className].filter(Boolean).join(' ');

  return (
    <Field.Label
      className={classes}
      htmlFor={htmlFor}
      style={style}
      css={RESET_STYLES}
      {...props}
    >
      {children}
      {required && (
        <Field.RequiredIndicator
          className={styles.formRequired}
          aria-label={lang.current.aria.required}
          fallback="*"
          css={{
            color: 'var(--color-danger)',
            marginLeft: 'var(--space-1)',
          }}
        />
      )}
    </Field.Label>
  );
}

BaseFormLabel.propTypes = {
  children: PropTypes.node.isRequired,
  htmlFor: PropTypes.string,
  required: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseFormControl - Chakra Input with CSS Module styling
 *
 * Uses Chakra Input primitive for accessibility benefits,
 * with reset styling to use CSS Modules.
 */
export const BaseFormControl = React.forwardRef(function BaseFormControl({
  as: Component = 'input',
  type = 'text',
  className = '',
  style = {},
  isValid,
  isInvalid,
  ...props
}, ref) {
  const classes = [styles.formControl, className].filter(Boolean).join(' ');

  // For input elements, use Chakra Input primitive
  if (Component === 'input') {
    return (
      <Input
        ref={ref}
        type={type}
        className={classes}
        style={style}
        variant="unstyled"
        css={{
          // Reset Chakra Input styles completely
          ...RESET_STYLES,
          // Ensure CSS Module styles take precedence
          '&': {
            bg: 'transparent',
            border: 'none',
          },
        }}
        {...props}
      />
    );
  }

  // For select and textarea, use native elements (no Chakra equivalent needed)
  return (
    <Component
      ref={ref}
      type={type}
      className={classes}
      style={style}
      {...props}
    />
  );
});

BaseFormControl.displayName = 'BaseFormControl';

BaseFormControl.propTypes = {
  as: PropTypes.oneOf(['input', 'select', 'textarea']),
  type: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseFormCheck - Checkbox/Radio with Chakra integration
 *
 * For checkboxes, delegates to the design-system Checkbox.
 * For radios, uses native radio with CSS Module styling.
 */
export function BaseFormCheck({
  children,
  label,
  type = 'checkbox',
  id,
  className = '',
  style = {},
  variant = 'outline',
  size = 'md',
  colorScheme,
  ...props
}) {
  const autoId = useId();
  const resolvedId = id || autoId;
  const resolvedLabel = children || label || undefined;

  // Radio inputs still use the legacy FormCheck markup
  if (type === 'radio') {
    const classes = [styles.formCheck, className].filter(Boolean).join(' ');
    return (
      <div className={classes} style={style}>
        <input
          type="radio"
          className={styles.formCheckInput}
          id={resolvedId}
          {...props}
        />
        <label className={styles.formCheckLabel} htmlFor={resolvedId}>
          {resolvedLabel}
        </label>
      </div>
    );
  }

  // Checkbox delegates to the Checkbox design-system component
  return (
    <Checkbox
      id={resolvedId}
      label={resolvedLabel}
      className={className}
      variant={variant}
      size={size}
      colorScheme={colorScheme}
      {...props}
    />
  );
}

BaseFormCheck.propTypes = {
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
 * BaseFormText - Chakra Field.HelperText with CSS Module styling
 *
 * Uses Chakra Field.HelperText for proper accessibility,
 * with CSS Module styling.
 */
export function BaseFormText({
  children,
  muted = false,
  className = '',
  style = {},
  ...props
}) {
  const classes = [
    styles.formText,
    muted && styles.formTextMuted,
    className
  ].filter(Boolean).join(' ');

  return (
    <Field.HelperText
      className={classes}
      style={style}
      css={RESET_STYLES}
      {...props}
    >
      {children}
    </Field.HelperText>
  );
}

BaseFormText.propTypes = {
  children: PropTypes.node.isRequired,
  muted: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseFormInputGroup - Input group with prefix/suffix
 *
 * Uses native elements with CSS Module styling.
 * No Chakra equivalent needed as InputGroup in v3 works differently.
 */
export function BaseFormInputGroup({
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

BaseFormInputGroup.propTypes = {
  children: PropTypes.node.isRequired,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};
