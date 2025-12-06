/**
 * CostEntry Component
 *
 * Modal form for adding or editing cost entries in a plan.
 * Costs can be assigned to a specific collaborator (who paid),
 * linked to a specific plan item, or be shared/general costs.
 *
 * Designed mobile-first with responsive layout using design system tokens.
 */

import { useState, useEffect, useMemo, useId } from 'react';
import { Form } from 'react-bootstrap';
import Modal from '../Modal/Modal';
import { lang } from '../../lang.constants';
import { getCurrencySymbol } from '../../utilities/currency-utils';
import styles from './CostEntry.module.scss';

const { Label: FormLabel, Control: FormControl, Select: FormSelect } = Form;

// Common currencies
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
];

// Cost categories
const CATEGORIES = [
  { value: 'accommodation', labelKey: 'categoryAccommodation' },
  { value: 'transport', labelKey: 'categoryTransport' },
  { value: 'food', labelKey: 'categoryFood' },
  { value: 'activities', labelKey: 'categoryActivities' },
  { value: 'equipment', labelKey: 'categoryEquipment' },
  { value: 'other', labelKey: 'categoryOther' },
];

/**
 * Format date for input[type="date"]
 * @param {Date|string} date
 * @returns {string} YYYY-MM-DD format
 */
function formatDateForInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayForInput() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Default empty cost entry
 */
const DEFAULT_COST = {
  title: '',
  description: '',
  cost: '',
  currency: 'USD',
  category: '',
  date: getTodayForInput(),
  collaborator: '',
  plan_item: '',
};

export default function CostEntry({
  // Modal state
  show,
  onHide,

  // Edit mode
  editingCost = null, // If provided, we're editing

  // Available options for dropdowns
  collaborators = [], // Array of { _id, name } for "paid by" dropdown
  planItems = [], // Array of { _id, text } for plan item dropdown

  // Callbacks
  onSave, // Called with cost data when saving

  // UI state
  loading = false,
}) {
  const formId = useId();
  const [costData, setCostData] = useState(DEFAULT_COST);
  const [errors, setErrors] = useState({});

  const isEditing = !!editingCost;
  const costStrings = lang.current.cost;

  // Initialize form when editing
  useEffect(() => {
    if (show) {
      if (editingCost) {
        setCostData({
          title: editingCost.title || '',
          description: editingCost.description || '',
          cost: editingCost.cost || '',
          currency: editingCost.currency || 'USD',
          category: editingCost.category || '',
          date: formatDateForInput(editingCost.date || editingCost.created_at) || getTodayForInput(),
          collaborator: editingCost.collaborator?._id || editingCost.collaborator || '',
          plan_item: editingCost.plan_item?._id || editingCost.plan_item || '',
        });
      } else {
        setCostData({
          ...DEFAULT_COST,
          date: getTodayForInput(), // Always reset to today for new costs
        });
      }
      setErrors({});
    }
  }, [show, editingCost]);

  // Get currency symbol for display
  const currencySymbol = useMemo(() => {
    return getCurrencySymbol(costData.currency);
  }, [costData.currency]);

  // Handle input changes
  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setCostData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Handle numeric input with proper parsing
  const handleCostChange = (e) => {
    const value = e.target.value;
    // Allow empty string for clearing, or valid number
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setCostData(prev => ({ ...prev, cost: value }));
      if (errors.cost) {
        setErrors(prev => ({ ...prev, cost: null }));
      }
    }
  };

  // Clear cost field on focus if it's 0
  const handleCostFocus = (e) => {
    if (e.target.value === '0' || e.target.value === 0) {
      setCostData(prev => ({ ...prev, cost: '' }));
    }
  };

  // Set to 0 on blur if empty
  const handleCostBlur = (e) => {
    if (e.target.value === '') {
      setCostData(prev => ({ ...prev, cost: 0 }));
    }
  };

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!costData.title.trim()) {
      newErrors.title = costStrings.costTitleRequired;
    }

    const costNum = parseFloat(costData.cost);
    if (isNaN(costNum) || costNum < 0) {
      newErrors.cost = 'Please enter a valid amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!validate()) return;

    const submitData = {
      title: costData.title.trim(),
      description: costData.description.trim(),
      cost: parseFloat(costData.cost) || 0,
      currency: costData.currency,
    };

    // Only include category if selected
    if (costData.category) {
      submitData.category = costData.category;
    }

    // Include date (convert to ISO string for API)
    if (costData.date) {
      submitData.date = new Date(costData.date).toISOString();
    }

    // Only include collaborator if selected
    if (costData.collaborator) {
      submitData.collaborator = costData.collaborator;
    }

    // Only include plan_item if selected
    if (costData.plan_item) {
      submitData.plan_item = costData.plan_item;
    }

    // If editing, include the cost ID
    if (editingCost?._id) {
      submitData._id = editingCost._id;
    }

    onSave(submitData);
  };

  const modalTitle = isEditing ? costStrings.editCost : costStrings.addCost;
  const submitText = loading
    ? lang.current.button.saving
    : isEditing
    ? lang.current.button.saveChanges
    : lang.current.button.add;

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
      disableSubmit={!costData.title.trim()}
      scrollable
    >
      <form className={styles.costEntryForm} id={formId}>
        {/* Cost Title */}
        <div className={styles.formGroup}>
          <FormLabel htmlFor={`${formId}-title`} className={styles.formLabel}>
            {costStrings.costTitle}
            <span className={styles.formRequired}>*</span>
          </FormLabel>
          <FormControl
            type="text"
            id={`${formId}-title`}
            value={costData.title}
            onChange={handleChange('title')}
            placeholder={costStrings.costTitlePlaceholder}
            isInvalid={!!errors.title}
            required
          />
          {errors.title && (
            <Form.Control.Feedback type="invalid">
              {errors.title}
            </Form.Control.Feedback>
          )}
        </div>

        {/* Cost Amount with Currency */}
        <div className={styles.formGroup}>
          <FormLabel htmlFor={`${formId}-cost`} className={styles.formLabel}>
            {costStrings.costAmount}
          </FormLabel>
          <div className={styles.costInputRow}>
            <div className={styles.currencySelect}>
              <FormSelect
                id={`${formId}-currency`}
                value={costData.currency}
                onChange={handleChange('currency')}
                aria-label={costStrings.currency}
              >
                {CURRENCIES.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code}
                  </option>
                ))}
              </FormSelect>
            </div>
            <div className={`input-group ${styles.amountInputWrapper}`}>
              <span className="input-group-text">{currencySymbol}</span>
              <FormControl
                type="text"
                inputMode="decimal"
                id={`${formId}-cost`}
                value={costData.cost}
                onChange={handleCostChange}
                onFocus={handleCostFocus}
                onBlur={handleCostBlur}
                placeholder={costStrings.costAmountPlaceholder}
                isInvalid={!!errors.cost}
              />
            </div>
          </div>
          {errors.cost && (
            <div className="invalid-feedback d-block">
              {errors.cost}
            </div>
          )}
        </div>

        {/* Description (optional) */}
        <div className={styles.formGroup}>
          <FormLabel htmlFor={`${formId}-description`} className={styles.formLabel}>
            {costStrings.costDescription}
          </FormLabel>
          <FormControl
            as="textarea"
            rows={2}
            id={`${formId}-description`}
            value={costData.description}
            onChange={handleChange('description')}
            placeholder={costStrings.costDescriptionPlaceholder}
          />
        </div>

        {/* Category and Date Row */}
        <div className={styles.categoryDateRow}>
          {/* Category */}
          <div className={styles.formGroup}>
            <FormLabel htmlFor={`${formId}-category`} className={styles.formLabel}>
              {costStrings.category}
            </FormLabel>
            <FormSelect
              id={`${formId}-category`}
              value={costData.category}
              onChange={handleChange('category')}
              aria-label={costStrings.category}
            >
              <option value="">{costStrings.categoryPlaceholder}</option>
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {costStrings[cat.labelKey]}
                </option>
              ))}
            </FormSelect>
          </div>

          {/* Date */}
          <div className={styles.formGroup}>
            <FormLabel htmlFor={`${formId}-date`} className={styles.formLabel}>
              {costStrings.costDate}
            </FormLabel>
            <FormControl
              type="date"
              id={`${formId}-date`}
              value={costData.date}
              onChange={handleChange('date')}
              aria-label={costStrings.costDate}
            />
            <span className={styles.formHelp}>
              {costStrings.costDateHelp}
            </span>
          </div>
        </div>

        {/* Paid by (Collaborator) */}
        {collaborators.length > 0 && (
          <div className={styles.formGroup}>
            <FormLabel htmlFor={`${formId}-collaborator`} className={styles.formLabel}>
              {costStrings.assignedTo}
            </FormLabel>
            <FormSelect
              id={`${formId}-collaborator`}
              value={costData.collaborator}
              onChange={handleChange('collaborator')}
            >
              <option value="">{costStrings.assignedToPlaceholder}</option>
              {collaborators.map(collab => (
                <option key={collab._id} value={collab._id}>
                  {collab.name || collab.email}
                </option>
              ))}
            </FormSelect>
            <span className={styles.formHelp}>
              {costStrings.sharedCost}
            </span>
          </div>
        )}

        {/* For Plan Item */}
        {planItems.length > 0 && (
          <div className={styles.formGroup}>
            <FormLabel htmlFor={`${formId}-planItem`} className={styles.formLabel}>
              {costStrings.assignedToPlanItem}
            </FormLabel>
            <FormSelect
              id={`${formId}-planItem`}
              value={costData.plan_item}
              onChange={handleChange('plan_item')}
            >
              <option value="">{costStrings.assignedToPlanItemPlaceholder}</option>
              {planItems.map(item => (
                <option key={item._id} value={item._id}>
                  {item.text}
                </option>
              ))}
            </FormSelect>
            <span className={styles.formHelp}>
              {costStrings.generalCost}
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
}
