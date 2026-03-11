/**
 * Toggle Component - Native Chakra UI v3 Switch Implementation
 *
 * Drop-in replacement for the custom CSS-based toggle.
 * Uses Chakra Switch compound components for accessibility and styling.
 *
 * Features:
 * - Built-in ARIA attributes and keyboard support
 * - Size variants: xs, sm, md, lg, xl
 * - Color variants mapped to Chakra colorPalette
 * - Optional check/x icons via ThumbIndicator
 * - Label and description support
 *
 * Migration: biensperience-6f17 (P3.10)
 */

import { useId } from 'react';
import PropTypes from 'prop-types';
import { Switch } from '@chakra-ui/react';
import { FaCheck, FaTimes } from 'react-icons/fa';

/**
 * Map our variant names to Chakra Switch colorPalette values.
 */
const VARIANT_MAP = {
  default: { colorPalette: 'blue' },
  primary: { colorPalette: 'blue' },
  success: { colorPalette: 'green' },
  outline: { colorPalette: 'blue', variant: 'raised' },
  filled: { colorPalette: 'blue' },
  minimal: { colorPalette: 'gray', variant: 'raised' },
};

/**
 * Map our size names to Chakra Switch size values.
 * Chakra supports: xs, sm, md, lg. Our xl maps to lg.
 */
const SIZE_MAP = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'lg',
};

/**
 * Toggle component using Chakra UI Switch
 */
export default function Toggle({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  variant = 'default',
  showIcons = false,
  label,
  labelPosition = 'right',
  description,
  name,
  className = '',
  ...props
}) {
  const id = useId();
  const toggleId = name || id;

  const handleCheckedChange = (details) => {
    if (!disabled && onChange) {
      onChange(details.checked, details);
    }
  };

  // Resolve Chakra props from our variant/size
  const variantProps = VARIANT_MAP[variant] || VARIANT_MAP.default;
  const chakraSize = SIZE_MAP[size] || 'md';

  const switchElement = (
    <Switch.Root
      checked={checked}
      onCheckedChange={handleCheckedChange}
      disabled={disabled}
      name={toggleId}
      size={chakraSize}
      colorPalette={variantProps.colorPalette}
      variant={variantProps.variant}
      className={(!label && !description) ? className || undefined : undefined}
      {...props}
    >
      <Switch.HiddenInput />
      <Switch.Control>
        <Switch.Thumb>
          {showIcons && (
            <Switch.ThumbIndicator
              fallback={<FaTimes style={{ fontSize: '0.6em' }} />}
            >
              <FaCheck style={{ fontSize: '0.6em' }} />
            </Switch.ThumbIndicator>
          )}
        </Switch.Thumb>
      </Switch.Control>
      {/* Inline label (when no separate label wrapper is needed) */}
      {label && !description && labelPosition === 'right' && (
        <Switch.Label>{label}</Switch.Label>
      )}
    </Switch.Root>
  );

  // If no label or description, just return the switch
  if (!label && !description) {
    return switchElement;
  }

  // With label on left, or with description, use wrapper layout
  const labelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {label && labelPosition === 'right' && description && (
        <span style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-primary)',
          lineHeight: 1.4,
        }}>
          {label}
        </span>
      )}
      {label && labelPosition === 'left' && (
        <span style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-primary)',
          lineHeight: 1.4,
        }}>
          {label}
        </span>
      )}
      {description && (
        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-muted)',
          lineHeight: 1.4,
        }}>
          {description}
        </span>
      )}
    </div>
  );

  // Simple right label without description is handled inline above
  if (labelPosition === 'right' && !description) {
    return switchElement;
  }

  return (
    <div
      className={className || undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        flexDirection: labelPosition === 'left' ? 'row-reverse' : 'row',
      }}
    >
      <Switch.Root
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        name={toggleId}
        size={chakraSize}
        colorPalette={variantProps.colorPalette}
        variant={variantProps.variant}
        {...props}
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb>
            {showIcons && (
              <Switch.ThumbIndicator
                fallback={<FaTimes style={{ fontSize: '0.6em' }} />}
              >
                <FaCheck style={{ fontSize: '0.6em' }} />
              </Switch.ThumbIndicator>
            )}
          </Switch.Thumb>
        </Switch.Control>
      </Switch.Root>
      {labelContent}
    </div>
  );
}

Toggle.propTypes = {
  /** Whether the toggle is checked */
  checked: PropTypes.bool,
  /** Callback when toggle state changes */
  onChange: PropTypes.func,
  /** Whether the toggle is disabled */
  disabled: PropTypes.bool,
  /** Size of the toggle */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  /** Visual variant of the toggle */
  variant: PropTypes.oneOf(['default', 'primary', 'success', 'outline', 'filled', 'minimal']),
  /** Whether to show check/x icons inside the toggle */
  showIcons: PropTypes.bool,
  /** Label text for the toggle */
  label: PropTypes.node,
  /** Position of the label relative to toggle */
  labelPosition: PropTypes.oneOf(['left', 'right']),
  /** Description text below the label */
  description: PropTypes.string,
  /** Name attribute for the input */
  name: PropTypes.string,
  /** Additional CSS class */
  className: PropTypes.string,
};

/**
 * ToggleGroup - A group of toggles with consistent styling
 */
export function ToggleGroup({ children, className = '' }) {
  return (
    <div
      className={className || undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      {children}
    </div>
  );
}

ToggleGroup.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
};
