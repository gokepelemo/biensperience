/**
 * AddressAutocomplete Component
 *
 * A searchable address input with Google Places Autocomplete integration.
 * Uses portal rendering for proper z-index handling in modals.
 */

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import { Portal } from '@chakra-ui/react';
import PropTypes from 'prop-types';
import { FaMapMarkerAlt, FaTimes } from 'react-icons/fa';
import { getAddressSuggestions, getPlaceDetails } from '../../utilities/address-utils';
import { logger } from '../../utilities/logger';
import Loading from '../../components/Loading/Loading';
import styles from './AddressAutocomplete.module.scss';

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Enter address...',
  disabled = false,
  className = '',
  id: providedId,
  name,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) {
  const generatedId = useId();
  const inputId = providedId || generatedId;

  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Determine if we should use portal (always for consistency with ActivityTypeSelect)
  const shouldPortal = true;

  // Initialize input value from prop
  useEffect(() => {
    if (value?.address) {
      setInputValue(value.address);
    } else if (typeof value === 'string') {
      setInputValue(value);
    } else {
      setInputValue('');
    }
  }, [value]);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const results = await getAddressSuggestions(query, {
        types: 'address',
        limit: 5
      });
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setHighlightedIndex(0);
    } catch (error) {
      logger.error('[AddressAutocomplete] Failed to fetch suggestions', { error: error.message });
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce API calls
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  }, [fetchSuggestions]);

  // Handle suggestion selection
  const handleSelect = useCallback(async (suggestion) => {
    setIsLoading(true);
    setIsOpen(false);

    try {
      const placeDetails = await getPlaceDetails(suggestion.placeId);

      if (placeDetails) {
        setInputValue(placeDetails.formattedAddress);
        onChange({
          address: placeDetails.formattedAddress,
          geo: placeDetails.location ? {
            type: 'Point',
            coordinates: [placeDetails.location.lng, placeDetails.location.lat]
          } : null,
          city: placeDetails.components?.city || null,
          state: placeDetails.components?.state || null,
          country: placeDetails.components?.country || null,
          postalCode: placeDetails.components?.postalCode || null,
          placeId: placeDetails.placeId || null
        });
        logger.debug('[AddressAutocomplete] Address selected', { address: placeDetails.formattedAddress });
      }
    } catch (error) {
      logger.error('[AddressAutocomplete] Failed to get place details', { error: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [onChange]);

  // Clear the input
  const handleClear = useCallback(() => {
    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
    onChange(null);
    inputRef.current?.focus();
  }, [onChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      const escapedId = CSS.escape(inputId);
      const dropdownRef = document.querySelector(`[data-address-autocomplete="${escapedId}"]`);

      const clickedOutsideContainer = containerRef.current && !containerRef.current.contains(e.target);
      const clickedOutsideDropdown = shouldPortal && dropdownRef && !dropdownRef.contains(e.target);

      if (clickedOutsideContainer && (!shouldPortal || clickedOutsideDropdown)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, inputId, shouldPortal]);

  // Position dropdown when portaled
  const positionDropdown = useCallback(() => {
    if (!isOpen || !shouldPortal) return;

    const escapedId = CSS.escape(inputId);
    const dropdown = document.querySelector(`[data-address-autocomplete="${escapedId}"]`);
    const input = inputRef.current;

    if (!dropdown || !input) return;

    dropdown.style.position = 'fixed';
    dropdown.style.visibility = 'hidden';

    const applyPosition = () => {
      const inputRect = input.getBoundingClientRect();
      const dropdownHeight = dropdown.offsetHeight || 300;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - inputRect.bottom - 8;
      const spaceAbove = inputRect.top - 8;

      if (spaceBelow >= dropdownHeight || spaceBelow > spaceAbove) {
        dropdown.style.top = `${Math.min(viewportHeight - dropdownHeight - 8, inputRect.bottom + 4)}px`;
        dropdown.style.bottom = 'auto';
        dropdown.style.maxHeight = `${Math.min(240, spaceBelow)}px`;
      } else {
        dropdown.style.top = 'auto';
        dropdown.style.bottom = `${Math.min(viewportHeight - 8, viewportHeight - inputRect.top + 4)}px`;
        dropdown.style.maxHeight = `${Math.min(240, spaceAbove)}px`;
      }

      dropdown.style.left = `${Math.max(0, inputRect.left)}px`;
      dropdown.style.width = `${inputRect.width}px`;
      dropdown.style.right = 'auto';
      dropdown.style.visibility = 'visible';
    };

    window.requestAnimationFrame(() => {
      applyPosition();
      setTimeout(applyPosition, 20);
    });
  }, [isOpen, inputId, shouldPortal]);

  // Reposition on scroll and resize
  useEffect(() => {
    if (!isOpen || !shouldPortal) return;

    const handleScroll = () => positionDropdown();
    const handleResize = () => positionDropdown();

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, shouldPortal, positionDropdown]);

  // Reposition when dropdown opens or suggestions change
  useEffect(() => {
    if (!isOpen) return;
    positionDropdown();
    const t = setTimeout(() => positionDropdown(), 30);
    return () => clearTimeout(t);
  }, [isOpen, suggestions.length, positionDropdown]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  }, [isOpen, suggestions, highlightedIndex, handleSelect]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const inputClasses = [
    styles.input,
    disabled && styles.disabled,
    className
  ].filter(Boolean).join(' ');

  const dropdown = isOpen && suggestions.length > 0 && (
    <div
      className={styles.dropdown}
      data-address-autocomplete={inputId}
      style={shouldPortal ? { visibility: 'hidden', zIndex: 9999 } : undefined}
    >
      <ul className={styles.suggestionsList} role="listbox">
        {suggestions.map((suggestion, index) => (
          <li
            key={suggestion.placeId}
            className={`${styles.suggestion} ${index === highlightedIndex ? styles.highlighted : ''}`}
            role="option"
            aria-selected={index === highlightedIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelect(suggestion);
            }}
            onMouseEnter={() => setHighlightedIndex(index)}
          >
            <FaMapMarkerAlt className={styles.suggestionIcon} aria-hidden="true" />
            <div className={styles.suggestionText}>
              <span className={styles.mainText}>{suggestion.mainText}</span>
              {suggestion.secondaryText && (
                <span className={styles.secondaryText}>{suggestion.secondaryText}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div ref={containerRef} className={styles.container}>
      {name && <input type="hidden" name={name} value={inputValue} />}

      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          id={inputId}
          className={inputClasses}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        />

        {isLoading && (
          <div className={styles.spinner}>
            <Loading
              size="xs"
              variant="inline"
              animation="engine"
              showMessage={false}
              aria-label="Loading address suggestions"
            />
          </div>
        )}

        {inputValue && !isLoading && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Clear address"
          >
            <FaTimes />
          </button>
        )}
      </div>

      {shouldPortal ? <Portal>{dropdown}</Portal> : dropdown}
    </div>
  );
}

AddressAutocomplete.propTypes = {
  /** Current location value (object with address field or string) */
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      address: PropTypes.string,
      city: PropTypes.string,
      state: PropTypes.string,
      country: PropTypes.string,
      postalCode: PropTypes.string,
      geo: PropTypes.shape({
        type: PropTypes.string,
        coordinates: PropTypes.arrayOf(PropTypes.number)
      }),
      placeId: PropTypes.string
    })
  ]),
  /** Change handler - receives location object or null */
  onChange: PropTypes.func.isRequired,
  /** Placeholder text */
  placeholder: PropTypes.string,
  /** Disable the input */
  disabled: PropTypes.bool,
  /** Additional CSS class */
  className: PropTypes.string,
  /** Element ID */
  id: PropTypes.string,
  /** Form field name */
  name: PropTypes.string,
  /** Aria label */
  'aria-label': PropTypes.string,
  /** Aria described by */
  'aria-describedby': PropTypes.string,
};
