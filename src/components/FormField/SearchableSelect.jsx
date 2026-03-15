/**
 * SearchableSelect Component
 *
 * A styled searchable combobox built on Chakra UI's Combobox primitive.
 * Filters options using the trie algorithm for fast, fuzzy-matched results.
 * Can be used standalone or integrated with FormField.
 *
 * @example
 * <SearchableSelect
 *   options={[
 *     { value: 'us', label: 'United States', icon: FaFlag, suffix: 'USD' },
 *     { value: 'uk', label: 'United Kingdom', icon: FaFlag, suffix: 'GBP' },
 *   ]}
 *   value={selected}
 *   onChange={setSelected}
 *   placeholder="Select country..."
 * />
 */

import React, { useState, useCallback, useId, useMemo } from 'react';
import {
  ComboboxRoot,
  ComboboxControl,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxPositioner,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxItemText,
  ComboboxItemIndicator,
  ComboboxEmpty,
  createListCollection,
} from '@chakra-ui/react';
import PropTypes from 'prop-types';
import { FaChevronDown, FaCheck } from 'react-icons/fa';
import { createFilter } from '../../utilities/trie';
import { lang } from '../../lang.constants';
import styles from './SearchableSelect.module.css';

export default function SearchableSelect({
  options = [],
  value,
  onChange,
  multiple = false,
  placeholder = lang.current.searchableSelect.defaultPlaceholder,
  searchPlaceholder = lang.current.searchableSelect.searchPlaceholder,
  searchable = true,
  portal = false,
  disabled = false,
  className = '',
  size = 'md',
  isValid,
  isInvalid,
  name,
  id: providedId,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) {
  const generatedId = useId();
  const selectId = providedId || generatedId;

  // Search query state - drives trie filtering
  const [inputValue, setInputValue] = useState('');

  const isMobileOrTabletViewport = typeof window !== 'undefined' && window.innerWidth <= 767;
  const shouldPortal = portal || isMobileOrTabletViewport;

  // Normalize value to array for ComboboxRoot (always expects string[])
  const selectedValues = useMemo(() => {
    if (!multiple) return value ? [value] : [];
    if (Array.isArray(value)) return value;
    return [];
  }, [multiple, value]);

  // For multi-select display overlay
  const selectedOptions = useMemo(() => {
    if (!multiple) return [];
    const valueSet = new Set(selectedValues);
    return options.filter(opt => valueSet.has(opt.value));
  }, [multiple, options, selectedValues]);

  // For single-select icon/suffix display in the control
  const selectedOption = useMemo(() => {
    if (multiple) return null;
    return options.find(opt => opt.value === value) || null;
  }, [multiple, options, value]);

  // Build trie filter index when options change
  const trieFilter = useMemo(() => {
    const filter = createFilter({
      fields: [
        { path: 'label', score: 100 },
        { path: 'suffix', score: 50 },
      ],
    });
    filter.buildIndex(options);
    return filter;
  }, [options]);

  // Filter options via trie when user is typing; show full list when input is empty
  const filteredOptions = useMemo(() => {
    if (!inputValue) return options;
    return trieFilter.filter(inputValue, { rankResults: true });
  }, [inputValue, options, trieFilter]);

  // Chakra collection built from filtered options
  const collection = useMemo(() => createListCollection({
    items: filteredOptions,
    itemToValue: item => item.value,
    itemToString: item => item.label,
  }), [filteredOptions]);

  // Handler: item selected/deselected
  const handleValueChange = useCallback(({ value: newValues }) => {
    if (!multiple) {
      onChange(newValues[0] ?? '');
    } else {
      onChange(newValues);
    }
    setInputValue('');
  }, [multiple, onChange]);

  // Handler: user typed in the input
  const handleInputValueChange = useCallback(({ inputValue: iv }) => {
    setInputValue(iv);
  }, []);

  // Handler: reset filter on open so the full list is always shown initially
  const handleOpenChange = useCallback(({ open }) => {
    if (open) setInputValue('');
  }, []);

  // Multi-select display overlay: shown when not actively filtering
  const showMultiValueDisplay = multiple && selectedOptions.length > 0 && inputValue === '';
  const multiValueText = showMultiValueDisplay
    ? (selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions[0].label} +${selectedOptions.length - 1}`)
    : null;

  // CSS class composition for the control element
  const sizeClass = `size${size.charAt(0).toUpperCase() + size.slice(1)}`;
  const controlClasses = [
    styles.comboboxControl,
    styles[sizeClass],
    disabled && styles.disabled,
    isValid && styles.valid,
    isInvalid && styles.invalid,
    className,
  ].filter(Boolean).join(' ');

  return (
    <ComboboxRoot
      collection={collection}
      value={selectedValues}
      onValueChange={handleValueChange}
      inputValue={inputValue}
      onInputValueChange={handleInputValueChange}
      onOpenChange={handleOpenChange}
      ids={{ input: selectId }}
      multiple={multiple}
      disabled={disabled}
      closeOnSelect={!multiple}
      openOnClick
      readOnly={!searchable}
      positioning={{
        strategy: shouldPortal ? 'fixed' : 'absolute',
        placement: 'bottom-start',
        sameWidth: true,
        flip: true,
        offset: { mainAxis: 4 },
      }}
      className={styles.container}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      {/* Hidden native inputs for form submission */}
      {name && (
        multiple
          ? (Array.isArray(selectedValues) ? selectedValues : []).map(v => (
              <input
                key={v}
                type="hidden"
                name={name.endsWith('[]') ? name : `${name}[]`}
                value={v}
              />
            ))
          : <input type="hidden" name={name} value={value || ''} />
      )}

      <ComboboxControl className={controlClasses}>
        {/* Leading icon for single-select when an option has been selected and user is not filtering */}
        {!multiple && selectedOption?.icon && !inputValue && (
          <span className={styles.leadingIcon} aria-hidden="true">
            {React.createElement(selectedOption.icon)}
          </span>
        )}

        {/* Multi-select value summary — shown as overlay over the transparent input */}
        {showMultiValueDisplay && (
          <span className={styles.multiValueDisplay} aria-hidden="true">
            {multiValueText}
          </span>
        )}

        <ComboboxInput
          placeholder={showMultiValueDisplay ? searchPlaceholder : placeholder}
          className={[
            styles.comboboxInput,
            showMultiValueDisplay ? styles.comboboxInputHidden : '',
          ].filter(Boolean).join(' ')}
        />

        {/* Suffix label for single-select selected option */}
        {!multiple && selectedOption?.suffix && !inputValue && (
          <span className={styles.optionSuffix}>{selectedOption.suffix}</span>
        )}

        <ComboboxTrigger className={styles.comboboxTrigger}>
          <FaChevronDown className={styles.chevron} />
        </ComboboxTrigger>
      </ComboboxControl>

      <ComboboxPositioner>
        <ComboboxContent className={styles.dropdown}>
          <ComboboxEmpty className={styles.noResults}>
            {lang.current.searchableSelect.noResultsFound}
          </ComboboxEmpty>
          <ComboboxList className={styles.optionsList}>
            {filteredOptions.map(option => (
              <ComboboxItem
                key={option.value}
                item={option}
                className={styles.option}
              >
                {option.icon && (
                  <span className={styles.optionIcon} aria-hidden="true">
                    {React.createElement(option.icon)}
                  </span>
                )}
                <ComboboxItemText className={styles.optionLabel}>
                  {option.label}
                </ComboboxItemText>
                {option.suffix && (
                  <span className={styles.optionSuffix}>{option.suffix}</span>
                )}
                <ComboboxItemIndicator className={styles.checkIcon}>
                  <FaCheck aria-hidden="true" />
                </ComboboxItemIndicator>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </ComboboxPositioner>
    </ComboboxRoot>
  );
}

SearchableSelect.propTypes = {
  /** Array of options with value, label, optional icon component, and optional suffix */
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    suffix: PropTypes.string,
  })).isRequired,
  /** Currently selected value (string) or selected values (array) when multiple */
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
  /** Enable multi-select behavior */
  multiple: PropTypes.bool,
  /** Change handler - receives the selected value (string) or values (array) */
  onChange: PropTypes.func.isRequired,
  /** Placeholder text when no option selected */
  placeholder: PropTypes.string,
  /** Placeholder for search input */
  searchPlaceholder: PropTypes.string,
  /** Enable search functionality */
  searchable: PropTypes.bool,
  /** Portal dropdown to document.body with fixed positioning (recommended in modals) */
  portal: PropTypes.bool,
  /** Disable the select */
  disabled: PropTypes.bool,
  /** Additional CSS class */
  className: PropTypes.string,
  /** Size variant: 'sm', 'md', 'lg' */
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  /** Valid state styling */
  isValid: PropTypes.bool,
  /** Invalid state styling */
  isInvalid: PropTypes.bool,
  /** Form field name for native form submission */
  name: PropTypes.string,
  /** Element ID */
  id: PropTypes.string,
  /** Aria label */
  'aria-label': PropTypes.string,
  /** Aria described by */
  'aria-describedby': PropTypes.string,
};
