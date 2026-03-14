/**
 * BaseCheckbox – Native Chakra UI v3 Checkbox
 *
 * Drop-in replacement using Chakra Checkbox primitives.
 * No CSS Module import — all styling driven by the Chakra recipe/theme.
 *
 * API compatibility:
 * - Accepts legacy `onChange(e)` pattern (e.target.checked) AND
 *   native Chakra `onCheckedChange(details)`. Both are forwarded.
 * - `indeterminate` prop maps to Chakra checked="indeterminate".
 * - `colorScheme` mapped to Chakra `colorPalette` (primary→brand, etc.).
 *
 * Migrated: biensperience-049a
 */

import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Checkbox } from '@chakra-ui/react';

const COLOR_PALETTE_MAP = {
  primary: 'brand',
  success: 'green',
  warning: 'yellow',
  danger: 'red',
};

const BaseCheckbox = forwardRef(function BaseCheckbox(
  {
    id,
    label,
    checked,
    defaultChecked,
    onChange,
    onCheckedChange,
    disabled = false,
    size = 'md',
    variant = 'solid',
    colorScheme = 'primary',
    indeterminate = false,
    className = '',
    ...rest
  },
  ref,
) {
  const colorPalette = COLOR_PALETTE_MAP[colorScheme] || colorScheme || 'brand';

  // Chakra uses a "CheckedState" which can be true|false|"indeterminate"
  const chakraChecked = indeterminate ? 'indeterminate' : checked;

  const handleCheckedChange = (details) => {
    // Forward native Chakra callback when provided
    if (typeof onCheckedChange === 'function') {
      onCheckedChange(details);
    }
    // Emit synthetic event for backward-compatible `onChange(e)` callers
    if (typeof onChange === 'function') {
      onChange({ target: { checked: !!details.checked } });
    }
  };

  return (
    <Checkbox.Root
      id={id}
      checked={chakraChecked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      size={size}
      variant={variant}
      colorPalette={colorPalette}
      onCheckedChange={handleCheckedChange}
      className={className}
      {...rest}
    >
      <Checkbox.HiddenInput ref={ref} />
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      {label != null && <Checkbox.Label>{label}</Checkbox.Label>}
    </Checkbox.Root>
  );
});

BaseCheckbox.displayName = 'BaseCheckbox';

BaseCheckbox.propTypes = {
  id: PropTypes.string,
  label: PropTypes.node,
  checked: PropTypes.bool,
  defaultChecked: PropTypes.bool,
  /** Legacy React onChange(e) handler — e.target.checked provided */
  onChange: PropTypes.func,
  /** Native Chakra onCheckedChange(details) handler */
  onCheckedChange: PropTypes.func,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg']),
  variant: PropTypes.oneOf(['outline', 'subtle', 'solid']),
  colorScheme: PropTypes.oneOf(['primary', 'success', 'warning', 'danger']),
  indeterminate: PropTypes.bool,
  className: PropTypes.string,
};

export default BaseCheckbox;
