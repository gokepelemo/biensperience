/**
 * BaseForm — Native Chakra UI v3 Form components
 *
 * Uses Chakra Field/Input components with native theme tokens.
 * No CSS Modules — pure Chakra tokens via input recipe and css prop.
 *
 * Components:
 *   BaseForm → native <form> with flex layout
 *   BaseFormGroup → Field.Root with native gap
 *   BaseFormLabel → Field.Label with native typography
 *   BaseFormControl → Input (input recipe) / Textarea / NativeSelect
 *   BaseFormCheck → Checkbox + native radio
 *   BaseFormText → Field.HelperText with native color
 *   BaseFormInputGroup → Flex row with grouped styling
 *
 * Task: biensperience-77cb — P2.5 Form → Chakra Field/Input
 */

import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { Field, Input, Box, Textarea } from '@chakra-ui/react';
import Checkbox from '../Checkbox/Checkbox';
import { lang } from '../../lang.constants';

/**
 * Shared input styles for select and textarea (matching input recipe tokens)
 */
const SHARED_INPUT_CSS = {
  width: '100%',
  minHeight: '44px',
  padding: '{spacing.3} {spacing.4}',
  border: '1px solid',
  borderColor: { _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' },
  borderRadius: '{radii.md}',
  fontSize: '{fontSizes.md}',
  lineHeight: '{lineHeights.normal}',
  color: 'fg',
  background: { _light: '#ffffff', _dark: '#2d2d2d' },
  transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  _placeholder: { color: 'fg.muted' },
  _focus: {
    outline: '2px solid',
    outlineColor: '{colors.brand.500}',
    outlineOffset: '2px',
  },
  _disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

/**
 * BaseForm — native <form> with flex column layout
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

  return (
    <Box
      as="form"
      display="flex"
      flexDirection="column"
      gap="4"
      onSubmit={handleSubmit}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
    </Box>
  );
}

BaseForm.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseFormGroup — Chakra Field.Root with native gap
 */
export function BaseFormGroup({
  children,
  className = '',
  style = {},
  invalid = false,
  ...props
}) {
  return (
    <Field.Root
      display="flex"
      flexDirection="column"
      alignItems="stretch"
      gap="2"
      invalid={invalid}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
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
 * BaseFormLabel — Chakra Field.Label with native typography
 */
export function BaseFormLabel({
  children,
  htmlFor,
  required = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Field.Label
      htmlFor={htmlFor}
      fontSize="sm"
      fontWeight="medium"
      color="fg"
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
      {required && (
        <Field.RequiredIndicator
          aria-label={lang.current.aria.required}
          fallback="*"
          color="fg.error"
          marginLeft="1"
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
 * BaseFormControl — Chakra Input (uses input recipe) for inputs,
 * native select/textarea with shared token-based styling
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
  // For input elements, use Chakra Input which picks up the input recipe
  if (Component === 'input') {
    return (
      <Input
        ref={ref}
        type={type}
        className={className || undefined}
        style={Object.keys(style).length ? style : undefined}
        {...props}
      />
    );
  }

  // For textarea, use Chakra Textarea
  if (Component === 'textarea') {
    return (
      <Textarea
        ref={ref}
        className={className || undefined}
        style={Object.keys(style).length ? style : undefined}
        css={{
          ...SHARED_INPUT_CSS,
          minHeight: 'unset',
          resize: 'vertical',
        }}
        {...props}
      />
    );
  }

  // For select, use native <select> with Chakra-compatible styling
  return (
    <Box
      as="select"
      ref={ref}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      css={{
        ...SHARED_INPUT_CSS,
        appearance: 'none',
        paddingRight: '{spacing.10}',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236c757d\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right {spacing.3} center',
        backgroundSize: '12px',
      }}
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
 * BaseFormCheck — Checkbox/Radio with Chakra integration
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

  // Radio inputs use native styling with Chakra tokens
  if (type === 'radio') {
    return (
      <Box
        display="flex"
        alignItems="center"
        gap="2"
        className={className || undefined}
        style={Object.keys(style).length ? style : undefined}
      >
        <Box
          as="input"
          type="radio"
          id={resolvedId}
          css={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
            accentColor: '{colors.brand.500}',
          }}
          {...props}
        />
        <Box
          as="label"
          htmlFor={resolvedId}
          fontSize="md"
          cursor="pointer"
        >
          {resolvedLabel}
        </Box>
      </Box>
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
 * BaseFormText — Helper text for forms
 *
 * Renders as a styled Box rather than Field.HelperText to avoid requiring
 * a Field.Root ancestor (which causes useFieldStyles errors when used standalone).
 */
export function BaseFormText({
  children,
  muted = false,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Box
      fontSize="sm"
      color={muted ? 'fg.muted' : 'fg.subtle'}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {children}
    </Box>
  );
}

BaseFormText.propTypes = {
  children: PropTypes.node.isRequired,
  muted: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object
};

/**
 * BaseFormInputGroup — Flex row with grouped input styling
 */
export function BaseFormInputGroup({
  children,
  prefix,
  suffix,
  className = '',
  style = {},
  ...props
}) {
  return (
    <Box
      display="flex"
      alignItems="stretch"
      borderRadius="md"
      border="1px solid"
      borderColor={{ _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' }}
      overflow="hidden"
      css={{
        _focusWithin: {
          borderColor: '{colors.brand.500}',
          boxShadow: '0 0 0 1px {colors.brand.500}',
        },
        '& input, & select, & textarea': {
          border: 'none',
          borderRadius: 0,
          _focus: { outline: 'none', boxShadow: 'none' },
        },
      }}
      className={className || undefined}
      style={Object.keys(style).length ? style : undefined}
      {...props}
    >
      {prefix !== undefined && prefix !== null && (
        <Box
          display="inline-flex"
          alignItems="center"
          px="3"
          bg={{ _light: '{colors.gray.100}', _dark: '{colors.gray.700}' }}
          color="fg.muted"
          fontSize="sm"
          fontWeight="medium"
          borderRight="1px solid"
          borderColor={{ _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' }}
          flexShrink={0}
          aria-hidden
        >
          {prefix}
        </Box>
      )}
      {children}
      {suffix !== undefined && suffix !== null && (
        <Box
          display="inline-flex"
          alignItems="center"
          px="3"
          bg={{ _light: '{colors.gray.100}', _dark: '{colors.gray.700}' }}
          color="fg.muted"
          fontSize="sm"
          fontWeight="medium"
          borderLeft="1px solid"
          borderColor={{ _light: 'rgba(0, 0, 0, 0.1)', _dark: 'rgba(255, 255, 255, 0.2)' }}
          flexShrink={0}
          aria-hidden
        >
          {suffix}
        </Box>
      )}
    </Box>
  );
}

BaseFormInputGroup.propTypes = {
  children: PropTypes.node.isRequired,
  prefix: PropTypes.node,
  suffix: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
};
