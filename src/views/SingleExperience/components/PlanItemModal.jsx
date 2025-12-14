/**
 * PlanItemModal Component
 * Unified modal for adding or editing plan items (experience or plan instance)
 * Handles form state, validation, and submission
 */

import { useState, useCallback, useEffect, useId, useMemo } from 'react';
import { Form } from 'react-bootstrap';
import Modal from '../../../components/Modal/Modal';
import ActivityTypeSelect from '../../../components/ActivityTypeSelect';
import { getAddressSuggestions, getPlaceDetails } from '../../../utilities/address-utils';
import { logger } from '../../../utilities/logger';
import { useFormPersistence } from '../../../hooks/useFormPersistence';
import { formatRestorationMessage } from '../../../utilities/time-utils';
import { useToast } from '../../../contexts/ToastContext';
import { useUser } from '../../../contexts/UserContext';

const { Label: FormLabel, Control: FormControl } = Form;

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
  experienceId = null, // For form persistence unique key

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
  const { user } = useUser();
  const { success } = useToast();

  // Determine if we're in add mode (planItemFormState === 1)
  const isAddMode = planItemFormState === 1;

  // Form persistence - only for add mode
  const formData = useMemo(() => {
    if (!isAddMode) return null;
    return {
      text: editingPlanItem.text || '',
      url: editingPlanItem.url || '',
      cost: editingPlanItem.cost || 0,
      planning_days: editingPlanItem.planning_days || 0,
      activity_type: editingPlanItem.activity_type || null,
      location: editingPlanItem.location || null,
      parent: editingPlanItem.parent || null
    };
  }, [isAddMode, editingPlanItem.text, editingPlanItem.url, editingPlanItem.cost,
      editingPlanItem.planning_days, editingPlanItem.activity_type,
      editingPlanItem.location, editingPlanItem.parent]);

  const setFormData = useCallback((data) => {
    if (!data || !isAddMode) return;
    setEditingPlanItem(prev => ({
      ...prev,
      text: data.text !== undefined ? data.text : prev.text,
      url: data.url !== undefined ? data.url : prev.url,
      cost: data.cost !== undefined ? data.cost : prev.cost,
      planning_days: data.planning_days !== undefined ? data.planning_days : prev.planning_days,
      activity_type: data.activity_type !== undefined ? data.activity_type : prev.activity_type,
      location: data.location !== undefined ? data.location : prev.location,
      parent: data.parent !== undefined ? data.parent : prev.parent
    }));
  }, [isAddMode, setEditingPlanItem]);

  const persistence = useFormPersistence(
    experienceId && isAddMode ? `plan-item-form-${experienceId}-${activeTab}` : null,
    formData,
    setFormData,
    {
      enabled: !!experienceId && isAddMode && !!user?._id,
      userId: user?._id,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      debounceMs: 1000,
      shouldSave: (data) => data?.text?.trim()?.length > 0,
      onRestore: (savedData, age) => {
        if (savedData?.text?.trim()) {
          const message = formatRestorationMessage(age, 'create');
          success(message, {
            duration: 15000,
            actions: [{
              label: 'Clear',
              onClick: () => {
                setEditingPlanItem(prev => ({
                  ...prev,
                  text: '',
                  url: '',
                  cost: 0,
                  planning_days: 0,
                  activity_type: null,
                  location: null
                }));
                persistence.clear();
              },
              variant: 'link'
            }]
          });
        }
      }
    }
  );

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

  // Wrap submit handlers to clear persistence on success
  const handleSubmit = useCallback(async () => {
    const submitFn = activeTab === "experience"
      ? onSaveExperiencePlanItem
      : onSavePlanInstanceItem;

    try {
      await submitFn();
      // Clear persistence after successful save (only in add mode)
      if (isAddMode && persistence) {
        persistence.clear();
      }
    } catch (error) {
      // Let parent handle error - don't clear persistence
      throw error;
    }
  }, [activeTab, onSaveExperiencePlanItem, onSavePlanInstanceItem, isAddMode, persistence]);

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

        {/* Activity Type - Full autocomplete with all activity types */}
        <div className="mb-3">
          <FormLabel htmlFor={`${formId}-activityType`}>
            {lang.current.label.activityType || "Activity Type"}
            <small className="text-muted ms-2">(optional)</small>
          </FormLabel>
          <ActivityTypeSelect
            value={editingPlanItem.activity_type || null}
            onChange={handleActivityTypeChange}
            placeholder={lang.current.placeholder.activityTypePlaceholder || "Select or search activity type..."}
            showClear={true}
            groupByCategory={true}
          />
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
