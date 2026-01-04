/**
 * PlanItemModal Component
 *
 * REFACTORED: Modal now owns its form state internally to prevent
 * parent re-renders on every field change. This fixes Chrome crashes
 * caused by rapid state updates propagating to the 3000+ line parent.
 *
 * State Flow:
 * 1. Parent opens modal with initialData
 * 2. Modal copies initialData to internal formState
 * 3. All field changes update internal formState only (no parent re-renders)
 * 4. On save, modal calls onSave(formState) to parent
 * 5. Parent handles API call and closes modal
 */

import { useState, useEffect, useId, useRef, useCallback } from 'react';
import Modal from '../../../components/Modal/Modal';
import ActivityTypeSelect from '../../../components/ActivityTypeSelect';
import { lang } from '../../../lang.constants';
import { FormLabel, FormControl, FormInputGroup } from '../../../components/design-system';
import { getAddressSuggestions, getPlaceDetails } from '../../../utilities/address-utils';
import { logger } from '../../../utilities/logger';

// Default empty form state
const DEFAULT_FORM_STATE = {
  _id: null,
  plan_item_id: null,
  text: '',
  url: '',
  cost: 0,
  planning_days: 0,
  activity_type: null,
  location: null,
  parent: null
};

export default function PlanItemModal({
  // Modal state
  show,
  onHide,

  // Initial data (only read on open, not on every render)
  initialData,

  // Mode: 'add' or 'edit'
  mode = 'add',

  // Save handler - receives the complete form data
  onSave,

  // UI state
  loading,

  // Language strings
  langStrings
}) {
  // Generate unique IDs for form elements
  const formId = useId();

  // Track if modal was just opened to initialize state
  const wasOpenRef = useRef(false);

  // INTERNAL form state - isolated from parent
  const [formState, setFormState] = useState(DEFAULT_FORM_STATE);

  // Address autocomplete state (also internal)
  const [addressInput, setAddressInput] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Initialize form state when modal opens
  useEffect(() => {
    if (show && !wasOpenRef.current) {
      // Modal just opened - initialize form state from initialData
      wasOpenRef.current = true;

      const initial = initialData || {};
      setFormState({
        _id: initial._id || null,
        plan_item_id: initial.plan_item_id || null,
        text: initial.text || '',
        url: initial.url || '',
        cost: initial.cost || 0,
        planning_days: initial.planning_days || 0,
        activity_type: initial.activity_type || null,
        location: initial.location || null,
        parent: initial.parent || null
      });

      // Initialize address input
      setAddressInput(initial.location?.address || '');
      setAddressSuggestions([]);
      setAddressLoading(false);
      setShowSuggestions(false);
    } else if (!show && wasOpenRef.current) {
      // Modal just closed - reset tracking ref
      wasOpenRef.current = false;
    }
  }, [show, initialData]);

  // Update a single form field (internal state only)
  const updateField = useCallback((field, value) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Address search handler
  const handleAddressSearch = useCallback(async (input) => {
    setAddressInput(input);

    if (!input || input.trim().length < 2) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setAddressLoading(true);
    try {
      const suggestions = await getAddressSuggestions(input, { types: 'address', limit: 5 });
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      logger.error('[PlanItemModal] Address search error', { error: error.message });
      setAddressSuggestions([]);
    } finally {
      setAddressLoading(false);
    }
  }, []);

  // Handle address selection from suggestions
  const handleAddressSelect = useCallback(async (suggestion) => {
    setAddressLoading(true);
    setShowSuggestions(false);

    try {
      const placeDetails = await getPlaceDetails(suggestion.placeId);

      if (placeDetails) {
        setAddressInput(placeDetails.formattedAddress);
        updateField('location', {
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
        logger.debug('[PlanItemModal] Address selected', { address: placeDetails.formattedAddress });
      }
    } catch (error) {
      logger.error('[PlanItemModal] Error getting place details', { error: error.message });
    } finally {
      setAddressLoading(false);
    }
  }, [updateField]);

  // Clear address
  const handleClearAddress = useCallback(() => {
    setAddressInput('');
    setAddressSuggestions([]);
    setShowSuggestions(false);
    updateField('location', null);
  }, [updateField]);

  // Submit handler - sends form data to parent
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.();
    if (onSave) {
      await onSave(formState);
    }
  }, [onSave, formState]);

  // Use langStrings prop or fall back to global lang
  const l = langStrings || lang;

  const modalTitle = mode === 'add'
    ? (formState.parent ? "Add Child Plan Item" : "Add Plan Item")
    : "Edit Plan Item";

  const submitText = loading
    ? "Saving..."
    : mode === 'add'
    ? "Add Item"
    : "Update Item";

  return (
    <Modal
      show={show}
      onClose={onHide}
      title={modalTitle}
      dialogClassName="responsive-modal-dialog"
      onSubmit={handleSubmit}
      submitText={submitText}
      cancelText={l.current?.button?.cancel || "Cancel"}
      loading={loading}
      disableSubmit={!formState.text}
    >
      <form className="plan-item-modal-form" onSubmit={handleSubmit}>
        {/* Item Description */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-text`}>
            {l.current?.label?.itemDescription || "Item Description"}{" "}
            <span style={{ color: 'var(--bs-danger)' }}>*</span>
          </FormLabel>
          <FormControl
            type="text"
            id={`${formId}-text`}
            value={formState.text}
            onChange={(e) => updateField('text', e.target.value)}
            placeholder={l.current?.placeholder?.itemDescription || "Enter item description..."}
            required
          />
        </div>

        {/* URL (Optional) */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-url`}>
            {l.current?.label?.urlOptional || "URL (Optional)"}
          </FormLabel>
          <FormControl
            type="url"
            id={`${formId}-url`}
            value={formState.url}
            onChange={(e) => updateField('url', e.target.value)}
            placeholder={l.current?.placeholder?.urlPlaceholder || "https://..."}
          />
        </div>

        {/* Cost */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-cost`}>
            {l.current?.label?.cost || "Cost"}
          </FormLabel>
          <FormInputGroup prefix="$">
            <FormControl
              type="number"
              id={`${formId}-cost`}
              value={formState.cost || ''}
              onChange={(e) => updateField('cost', parseFloat(e.target.value) || 0)}
              onFocus={(e) => {
                if (e.target.value === '0') {
                  updateField('cost', '');
                }
              }}
              onBlur={(e) => {
                if (e.target.value === '') {
                  updateField('cost', 0);
                }
              }}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </FormInputGroup>
        </div>

        {/* Planning Days */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-days`}>
            {l.current?.label?.planningTimeLabel || "Planning Time"}
          </FormLabel>
          <FormInputGroup suffix="days">
            <FormControl
              type="number"
              id={`${formId}-days`}
              value={formState.planning_days || ''}
              onChange={(e) => updateField('planning_days', parseInt(e.target.value) || 0)}
              onFocus={(e) => {
                if (e.target.value === '0') {
                  updateField('planning_days', '');
                }
              }}
              onBlur={(e) => {
                if (e.target.value === '') {
                  updateField('planning_days', 0);
                }
              }}
              min="0"
              placeholder="0"
            />
          </FormInputGroup>
        </div>

        {/* Activity Type */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-activityType`}>
            {l.current?.label?.activityType || "Activity Type"}
            <small className="text-muted ms-2">(optional)</small>
          </FormLabel>
          <ActivityTypeSelect
            id={`${formId}-activityType`}
            value={formState.activity_type}
            onChange={(value) => updateField('activity_type', value)}
            placeholder={l.current?.placeholder?.activityTypePlaceholder || "Select activity type..."}
          />
        </div>

        {/* Address with Autocomplete */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-address`}>
            {l.current?.label?.address || "Address"}
            <small className="text-muted ms-2">
              {l.current?.helper?.addressOptional || "(optional)"}
            </small>
          </FormLabel>
          <div className="position-relative">
            <FormInputGroup>
              <FormControl
                type="text"
                id={`${formId}-address`}
                value={addressInput}
                onChange={(e) => handleAddressSearch(e.target.value)}
                onFocus={() => {
                  if (addressSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click on suggestion
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder={l.current?.placeholder?.addressPlaceholder || "Enter address..."}
                autoComplete="off"
              />
              {addressLoading && (
                <span>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                </span>
              )}
              {addressInput && !addressLoading && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleClearAddress}
                  aria-label="Clear address"
                >
                  ×
                </button>
              )}
            </FormInputGroup>

            {/* Address Suggestions Dropdown */}
            {showSuggestions && addressSuggestions.length > 0 && (
              <ul
                className="list-group position-absolute w-100 shadow-sm"
                style={{ zIndex: 1050, maxHeight: '200px', overflowY: 'auto' }}
              >
                {addressSuggestions.map((suggestion) => (
                  <li
                    key={suggestion.placeId}
                    className="list-group-item list-group-item-action"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleAddressSelect(suggestion)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <div className="fw-medium">{suggestion.mainText}</div>
                    <small className="text-muted">{suggestion.secondaryText}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Show selected location info */}
          {formState.location?.address && (
            <small className="text-success mt-1 d-block">
              ✓ Location saved: {formState.location.city && `${formState.location.city}, `}
              {formState.location.country || formState.location.address}
            </small>
          )}
        </div>
      </form>
    </Modal>
  );
}
