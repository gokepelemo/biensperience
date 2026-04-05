/**
 * LocationAutocompleteInput
 *
 * Address input with Google Places Autocomplete.
 * On place selection it resolves a structured location object and calls onSelect:
 *   { address, geo: { type: 'Point', coordinates: [lng, lat] }, city, state, country, postalCode, placeId }
 *
 * Falls back to a plain text field when the Google Maps API key is unavailable or fails to load.
 */

import { useRef, useEffect, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { logger } from '../../utilities/logger';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const LIBRARIES = ['places'];

function extractComponents(placeResult) {
  const components = placeResult.address_components || [];
  const get = (...types) => {
    const c = components.find(c => types.every(t => c.types.includes(t)));
    return c ? c.long_name : null;
  };
  const getShort = (...types) => {
    const c = components.find(c => types.every(t => c.types.includes(t)));
    return c ? c.short_name : null;
  };

  return {
    city: get('locality') || get('postal_town') || get('sublocality_level_1') || null,
    state: get('administrative_area_level_1') || null,
    country: get('country') || null,
    postalCode: get('postal_code') || null,
    countryShort: getShort('country') || null,
  };
}

/**
 * @param {Object} props
 * @param {string}   props.name          - Input name attribute (used for plain-text fallback onChange)
 * @param {string}   props.label         - Field label visible to the user
 * @param {string}   props.value         - Controlled display value (address string)
 * @param {Function} props.onSelect      - Called with structured location object when a place is chosen
 * @param {Function} [props.onChange]    - Called with synthetic event for plain-text typing (same API as FormField)
 * @param {string}   [props.placeholder]
 * @param {string}   [props.tooltip]
 * @param {string}   [props.tooltipPlacement]
 * @param {Function} [props.onBlur]
 * @param {string}   [props.className]
 */
export default function LocationAutocompleteInput({
  name,
  label,
  value,
  onSelect,
  onChange,
  placeholder,
  onBlur,
  className,
}) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [displayValue, setDisplayValue] = useState(value || '');

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    id: 'google-map-script', // shared with InteractiveMap — loads SDK only once
    libraries: LIBRARIES,
  });

  // Keep display value in sync when parent updates the controlled value
  useEffect(() => {
    setDisplayValue(value || '');
  }, [value]);

  // Attach Autocomplete once the SDK is ready
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;
    if (!window.google?.maps?.places) return;

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'address_components', 'place_id', 'name'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) {
        logger.warn('[LocationAutocompleteInput] Place has no geometry', { name: place.name });
        return;
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const components = extractComponents(place);

      const location = {
        address: place.formatted_address || place.name || null,
        geo: { type: 'Point', coordinates: [lng, lat] },
        city: components.city,
        state: components.state,
        country: components.country,
        postalCode: components.postalCode,
        placeId: place.place_id || null,
      };

      setDisplayValue(location.address || '');
      onSelect(location);
    });

    autocompleteRef.current = ac;
  }, [isLoaded, onSelect, name]);

  function handleInputChange(e) {
    setDisplayValue(e.target.value);
    // If the user clears the field, clear the structured location too
    if (!e.target.value) {
      onSelect(null);
    }
    // Propagate as plain onChange if provided (keeps parent state in sync for typing)
    if (onChange) onChange(e);
  }

  if (loadError) {
    logger.warn('[LocationAutocompleteInput] Google Maps failed to load, using plain input', { error: loadError.message });
  }

  return (
    <div className={className}>
      {label && (
        <label htmlFor={`location-input-${name}`} className="form-label">
          {label}
        </label>
      )}
      <input
        id={`location-input-${name}`}
        ref={inputRef}
        name={name}
        type="text"
        className="form-control"
        value={displayValue}
        onChange={handleInputChange}
        onBlur={onBlur}
        placeholder={placeholder || 'Start typing an address…'}
        autoComplete="off"
      />
    </div>
  );
}
