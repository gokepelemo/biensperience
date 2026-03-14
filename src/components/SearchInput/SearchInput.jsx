/**
 * SearchInput - Design System Search Input Component
 *
 * Reusable search input with properly positioned start/end elements,
 * following the Chakra UI InputGroup pattern. Replaces duplicated
 * search input implementations across the application.
 *
 * Features:
 * - Start element (search icon by default)
 * - End element (clear button by default when value is non-empty)
 * - Size variants (sm, md, lg)
 * - Consistent spacing that prevents icon/placeholder overlap
 * - Dark mode support via CSS custom properties
 * - WCAG-compliant focus states and touch targets
 *
 * @example
 * // Basic usage - icon and clear button handled automatically
 * <SearchInput
 *   value={query}
 *   onChange={e => setQuery(e.target.value)}
 *   onClear={() => setQuery('')}
 *   placeholder="Search..."
 * />
 *
 * @example
 * // Custom end element
 * <SearchInput
 *   value={query}
 *   onChange={e => setQuery(e.target.value)}
 *   endElement={<Kbd>⌘K</Kbd>}
 * />
 *
 * @example
 * // No icon (startElement={null})
 * <SearchInput
 *   value={query}
 *   onChange={e => setQuery(e.target.value)}
 *   startElement={null}
 * />
 */

import React, { useRef, useCallback, useId } from 'react';
import PropTypes from 'prop-types';
import { FaSearch, FaTimes } from 'react-icons/fa';
import styles from './SearchInput.module.css';

/**
 * @param {Object} props
 * @param {string} [props.value] - Current input value
 * @param {function} [props.onChange] - Change handler
 * @param {function} [props.onClear] - Clear button handler (shows clear button when value is non-empty)
 * @param {string} [props.placeholder] - Placeholder text
 * @param {React.ReactNode} [props.startElement] - Start element (defaults to search icon). Pass null to hide.
 * @param {React.ReactNode} [props.endElement] - End element (defaults to clear button when value is non-empty)
 * @param {'sm'|'md'|'lg'} [props.size] - Size variant
 * @param {boolean} [props.disabled] - Disabled state
 * @param {string} [props.className] - Additional wrapper class
 * @param {string} [props.inputClassName] - Additional input class
 * @param {string} [props.ariaLabel] - Accessible label for the input
 * @param {Object} [props.style] - Inline styles for wrapper
 */
const SearchInput = React.forwardRef(function SearchInput({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  startElement,
  endElement,
  size = 'md',
  disabled = false,
  className = '',
  inputClassName = '',
  ariaLabel,
  style = {},
  ...inputProps
}, ref) {
  const internalRef = useRef(null);
  const inputRefToUse = ref || internalRef;
  const id = useId();

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    }
    // Re-focus input after clearing
    const el = typeof inputRefToUse === 'function' ? null : inputRefToUse?.current;
    el?.focus();
  }, [onClear, inputRefToUse]);

  // Determine if we should show the default start element (search icon)
  const hasStartElement = startElement !== null && startElement !== false;
  const resolvedStartElement = startElement === undefined
    ? <FaSearch aria-hidden="true" />
    : startElement;

  // Determine if we should show the default end element (clear button)
  const hasEndElement = endElement !== undefined
    ? endElement !== null && endElement !== false
    : Boolean(value && onClear);

  const resolvedEndElement = endElement !== undefined
    ? endElement
    : (value && onClear) ? (
      <button
        type="button"
        className={styles.clearButton}
        onClick={handleClear}
        aria-label="Clear search"
        tabIndex={-1}
      >
        <FaTimes />
      </button>
    ) : null;

  // Size class
  const sizeClass = styles[`size${size.charAt(0).toUpperCase()}${size.slice(1)}`] || styles.sizeMd;

  const wrapperClasses = [
    styles.searchInputWrapper,
    sizeClass,
    hasStartElement && styles.hasStart,
    hasEndElement && styles.hasEnd,
    disabled && styles.disabled,
    className,
  ].filter(Boolean).join(' ');

  const inputClasses = [
    styles.input,
    inputClassName,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses} style={style}>
      {hasStartElement && resolvedStartElement && (
        <span className={styles.startElement}>
          {resolvedStartElement}
        </span>
      )}
      <input
        ref={inputRefToUse}
        id={`search-input-${id}`}
        type="text"
        className={inputClasses}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        role="searchbox"
        {...inputProps}
      />
      {hasEndElement && resolvedEndElement && (
        <span className={styles.endElement}>
          {resolvedEndElement}
        </span>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

SearchInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  onClear: PropTypes.func,
  placeholder: PropTypes.string,
  startElement: PropTypes.node,
  endElement: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  ariaLabel: PropTypes.string,
  style: PropTypes.object,
};

export default SearchInput;
