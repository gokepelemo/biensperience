

import { useState, useEffect, useId, useRef, useCallback } from 'react';
import ActivityTypeSelect from '../../../components/ActivityTypeSelect';
import AddressAutocomplete from '../../../components/AddressAutocomplete';
import { lang } from '../../../lang.constants';
import { Modal, FormGroup, FormLabel, FormControl, FormInputGroup } from '../../../components/design-system';
import styles from './PlanItemModal.module.scss';

// Default form state for a plan item
const DEFAULT_FORM_STATE = {
  _id: null,
  plan_item_id: null,
  text: '',
  url: '',
  cost: 0,
  planning_days: 0,
  activity_type: null,
  location: null,
  parent: null,
  visibility: 'plan_only'
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

  // Whether this is for a plan instance (shows visibility option)
  isPlanInstance,

  // Language strings
  langStrings
}) {
  // Generate unique IDs for form elements
  const formId = useId();

  // Track if modal was just opened to initialize state
  const wasOpenRef = useRef(false);

  // INTERNAL form state - isolated from parent
  const [formState, setFormState] = useState(DEFAULT_FORM_STATE);

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
        parent: initial.parent || null,
        visibility: initial.visibility || 'plan_only'
      });
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
    : "Update Plan Item";

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
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Item Description */}
        <FormGroup>
          <FormLabel htmlFor={`${formId}-text`}>
            {l.current?.label?.itemDescription || "Item Description"}{" "}
            <span style={{ color: 'var(--color-danger)' }}>*</span>
          </FormLabel>
          <FormControl
            type="text"
            id={`${formId}-text`}
            value={formState.text}
            onChange={(e) => updateField('text', e.target.value)}
            placeholder={l.current?.placeholder?.itemDescription || "Enter item description..."}
            required
          />
        </FormGroup>

        {/* URL (Optional) */}
        <FormGroup>
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
        </FormGroup>

        {/* Cost + Planning Days - Side by Side */}
        <div className={styles.twoColumnRow}>
          {/* Cost */}
          <FormGroup>
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
          </FormGroup>

          {/* Planning Days */}
          <FormGroup>
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
          </FormGroup>
        </div>

        {/* Activity Type - Full Width for readable dropdown */}
        <FormGroup>
          <FormLabel htmlFor={`${formId}-activityType`}>
            {l.current?.label?.activityType || "Activity Type"}
          </FormLabel>
          <ActivityTypeSelect
            id={`${formId}-activityType`}
            value={formState.activity_type}
            onChange={(value) => updateField('activity_type', value)}
            placeholder={l.current?.placeholder?.activityTypePlaceholder || "Select type..."}
          />
        </FormGroup>

        {/* Visibility - Only for plan instance items */}
        {isPlanInstance && (
          <FormGroup>
            <FormLabel htmlFor={`${formId}-visibility`}>
              Visibility
            </FormLabel>
            <FormControl
              as="select"
              id={`${formId}-visibility`}
              value={formState.visibility}
              onChange={(e) => updateField('visibility', e.target.value)}
            >
              <option value="plan_only">Plan Only</option>
              <option value="public">Public &mdash; visible on experience feed</option>
            </FormControl>
          </FormGroup>
        )}

        {/* Address with Autocomplete - Full Width */}
        <FormGroup>
          <FormLabel htmlFor={`${formId}-address`}>
            {l.current?.label?.address || "Address"}
          </FormLabel>
          <AddressAutocomplete
            id={`${formId}-address`}
            value={formState.location}
            onChange={(location) => updateField('location', location)}
            placeholder={l.current?.placeholder?.addressPlaceholder || "Enter address..."}
          />
          {/* Show selected location info */}
          {formState.location?.address && (
            <small className={styles.locationConfirm}>
              ✓ {formState.location.city || formState.location.country || 'Saved'}
            </small>
          )}
        </FormGroup>
      </form>
    </Modal>
  );
}
