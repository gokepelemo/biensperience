/**
 * PlanItemModal Component
 * Unified modal for adding or editing plan items (experience or plan instance)
 * Handles form state, validation, and submission
 */

import { useState, useCallback, useEffect, useId } from 'react';
import { Form } from 'react-bootstrap';
import Modal from '../../../components/Modal/Modal';
import { getAddressSuggestions, getPlaceDetails } from '../../../utilities/address-utils';
import { logger } from '../../../utilities/logger';

const { Label: FormLabel, Control: FormControl } = Form;

// Activity type options matching the backend enum
const ACTIVITY_TYPES = [
  { value: '', label: 'Select activity type (optional)' },
  { value: 'food', label: '🍽️ Food & Dining' },
  { value: 'transport', label: '🚗 Transportation' },
  { value: 'accommodation', label: '🏨 Accommodation' },
  { value: 'activity', label: '🎯 Task' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'entertainment', label: '🎭 Entertainment' },
  { value: 'sightseeing', label: '📸 Sightseeing' },
  { value: 'custom', label: '✨ Custom Activity' }
];

export default function PlanItemModal({
  // Modal state
  show,
  onHide,

  // Form state
  editingPlanItem,
  setEditingPlanItem,
  planItemFormState, // 1 = add, 2 = edit

  // Context
  activeTab, // "experience" or "myplan"

  // Handlers
  onSaveExperiencePlanItem,
  onSavePlanInstanceItem,

  // UI state
  loading,

  // Language strings
  lang
}) {
  // Generate unique IDs for form elements
  const formId = useId();

  // Address autocomplete state
  const [addressInput, setAddressInput] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Initialize address input from editingPlanItem when modal opens
  useEffect(() => {
    if (show && editingPlanItem?.location?.address) {
      setAddressInput(editingPlanItem.location.address);
    } else if (show) {
      setAddressInput('');
    }
  }, [show, editingPlanItem?.location?.address]);

  // Debounced address search
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
      // Get full place details including coordinates
      const placeDetails = await getPlaceDetails(suggestion.placeId);

      if (placeDetails) {
        setAddressInput(placeDetails.formattedAddress);
        setEditingPlanItem(prev => ({
          ...prev,
          location: {
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
          }
        }));
        logger.debug('[PlanItemModal] Address selected', { address: placeDetails.formattedAddress });
      }
    } catch (error) {
      logger.error('[PlanItemModal] Error getting place details', { error: error.message });
    } finally {
      setAddressLoading(false);
    }
  }, [setEditingPlanItem]);

  // Clear address
  const handleClearAddress = useCallback(() => {
    setAddressInput('');
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setEditingPlanItem(prev => ({
      ...prev,
      location: null
    }));
  }, [setEditingPlanItem]);

  // Handle activity type change
  const handleActivityTypeChange = useCallback((value) => {
    setEditingPlanItem(prev => ({
      ...prev,
      activity_type: value || null
    }));
  }, [setEditingPlanItem]);

  const handleSubmit = activeTab === "experience"
    ? onSaveExperiencePlanItem
    : onSavePlanInstanceItem;

  const modalTitle = planItemFormState === 1
    ? (editingPlanItem.parent ? "Add Child Plan Item" : "Add Plan Item")
    : "Edit Plan Item";

  const submitText = loading
    ? "Saving..."
    : planItemFormState === 1
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
      cancelText={lang.current.button.cancel}
      loading={loading}
      disableSubmit={!editingPlanItem.text}
    >
      <form className="plan-item-modal-form">
        {/* Item Description */}
        <div className="mb-3">
          <FormLabel htmlFor="planItemText">
            {lang.current.label.itemDescription}{" "}
            <span style={{ color: 'var(--bs-danger)' }}>*</span>
          </FormLabel>
          <FormControl
            type="text"
            id="planItemText"
            value={editingPlanItem.text || ""}
            onChange={(e) =>
              setEditingPlanItem({
                ...editingPlanItem,
                text: e.target.value,
              })
            }
            placeholder={lang.current.placeholder.itemDescription}
            required
          />
        </div>

        {/* URL (Optional) */}
        <div className="mb-3">
          <FormLabel htmlFor="planItemUrl">
            {lang.current.label.urlOptional}
          </FormLabel>
          <FormControl
            type="url"
            id="planItemUrl"
            value={editingPlanItem.url || ""}
            onChange={(e) =>
              setEditingPlanItem({
                ...editingPlanItem,
                url: e.target.value,
              })
            }
            placeholder={lang.current.placeholder.urlPlaceholder}
          />
        </div>

        {/* Cost */}
        <div className="mb-3">
          <label htmlFor="planItemCost" className="form-label">
            {lang.current.label.cost}
          </label>
          <div className="input-group">
            <span className="input-group-text">$</span>
            <input
              type="number"
              className="form-control"
              id="planItemCost"
              value={editingPlanItem.cost || ""}
              onChange={(e) =>
                setEditingPlanItem({
                  ...editingPlanItem,
                  cost: parseFloat(e.target.value) || 0,
                })
              }
              onFocus={(e) => {
                if (e.target.value === "0" || e.target.value === 0) {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    cost: "",
                  });
                }
              }}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    cost: 0,
                  });
                }
              }}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Planning Days */}
        <div className="mb-3">
          <label htmlFor="planItemDays" className="form-label">
            {lang.current.label.planningTimeLabel}
          </label>
          <div className="input-group">
            <input
              type="number"
              className="form-control"
              id="planItemDays"
              value={editingPlanItem.planning_days || ""}
              onChange={(e) =>
                setEditingPlanItem({
                  ...editingPlanItem,
                  planning_days: parseInt(e.target.value) || 0,
                })
              }
              onFocus={(e) => {
                if (e.target.value === "0" || e.target.value === 0) {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    planning_days: "",
                  });
                }
              }}
              onBlur={(e) => {
                if (e.target.value === "") {
                  setEditingPlanItem({
                    ...editingPlanItem,
                    planning_days: 0,
                  });
                }
              }}
              min="0"
              placeholder="0"
            />
            <span className="input-group-text">days</span>
          </div>
        </div>

        {/* Activity Type */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-activityType`}>
            {lang.current.label.activityType || "Activity Type"}
          </FormLabel>
          <FormControl
            as="select"
            id={`${formId}-activityType`}
            value={editingPlanItem.activity_type || ""}
            onChange={(e) => handleActivityTypeChange(e.target.value)}
          >
            {ACTIVITY_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </FormControl>
        </div>

        {/* Address with Autocomplete */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-address`}>
            {lang.current.label.address || "Address"}
            <small className="text-muted ms-2">
              {lang.current.helper.addressOptional || "(optional)"}
            </small>
          </FormLabel>
          <div className="position-relative">
            <div className="input-group">
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
                placeholder={lang.current.placeholder.addressPlaceholder || "Enter address..."}
                autoComplete="off"
              />
              {addressLoading && (
                <span className="input-group-text">
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
            </div>

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
                    onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                  >
                    <div className="fw-medium">{suggestion.mainText}</div>
                    <small className="text-muted">{suggestion.secondaryText}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Show selected location info */}
          {editingPlanItem.location?.address && (
            <small className="text-success mt-1 d-block">
              ✓ Location saved: {editingPlanItem.location.city && `${editingPlanItem.location.city}, `}
              {editingPlanItem.location.country || editingPlanItem.location.address}
            </small>
          )}
        </div>
      </form>
    </Modal>
  );
}
