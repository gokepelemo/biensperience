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
import Modal from '../Modal/Modal';
import { lang } from '../../lang.constants';
import { getCurrencySymbol, getCurrencyDropdownOptions } from '../../utilities/currency-utils';
import { Button, Form, FormGroup, FormLabel, FormControl, FormText } from '../../components/design-system';
import {
  ACTIVITY_TYPES,
  ACTIVITY_CATEGORIES,
  getCostCategoryIcon
} from '../../constants/activity-types';
import styles from './CostEntry.module.scss';

// Get currency options from centralized utility (sorted by popularity)
const CURRENCIES = getCurrencyDropdownOptions({ format: 'codeAndName' });

// Pre-compute category order once at module level (stable, no side effects)
const CATEGORY_ORDER = Object.keys(ACTIVITY_CATEGORIES)
  .sort((a, b) => ACTIVITY_CATEGORIES[a].order - ACTIVITY_CATEGORIES[b].order);

// Pre-group activity types by category for cost category dropdown
const GROUPED_COST_CATEGORIES = CATEGORY_ORDER.reduce((acc, category) => {
  const items = ACTIVITY_TYPES.filter(t => t.category === category);
  if (items.length > 0) {
    acc[category] = items;
  }
  return acc;
}, {});

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
 * Get default empty cost entry
 * @param {string} defaultCurrency - Default currency to use
 */
const getDefaultCost = (defaultCurrency = 'USD') => ({
  title: '',
  description: '',
  cost: '',
  currency: defaultCurrency,
  category: '',
  date: getTodayForInput(),
  collaborator: '',
  plan_item: '',
});

export default function CostEntry({
  // Modal state
  show,
  onHide,

  // Edit mode
  editingCost = null, // If provided, we're editing

  // Available options for dropdowns
  collaborators = [], // Array of { _id, name } for "paid by" dropdown
  planItems = [], // Array of { _id, text } for plan item dropdown

  // Currency defaults
  defaultCurrency = 'USD', // Default currency (should be user preference)

  // Callbacks
  onSave, // Called with cost data when saving

  // UI state
  loading = false,
}) {
  const formId = useId();
  const [costData, setCostData] = useState(() => getDefaultCost(defaultCurrency));
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
          currency: editingCost.currency || defaultCurrency,
          category: editingCost.category || '',
          date: formatDateForInput(editingCost.date || editingCost.created_at) || getTodayForInput(),
          collaborator: editingCost.collaborator?._id || editingCost.collaborator || '',
          plan_item: editingCost.plan_item?._id || editingCost.plan_item || '',
        });
      } else {
        setCostData({
          ...getDefaultCost(defaultCurrency),
          date: getTodayForInput(), // Always reset to today for new costs
        });
      }
      setErrors({});
    }
  }, [show, editingCost, defaultCurrency]);

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

  const modalFooter = (
    <div className={styles.modalFooter}>
      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={loading || !costData.title.trim()}
      >
        {submitText}
      </Button>
    </div>
  );

  return (
    <Modal
      show={show}
      onClose={onHide}
      title={modalTitle}
      dialogClassName="responsive-modal-dialog"
      footer={modalFooter}
      showSubmitButton={false}
      loading={loading}
      scrollable
    >
      <Form className={styles.costEntryForm} id={formId} onSubmit={handleSubmit}>
        {/* Cost Title */}
        <FormGroup className={styles.formGroup}>
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
            required
          />
          {errors.title && (
            <FormText className={styles.fieldError}>
              {errors.title}
            </FormText>
          )}
        </FormGroup>

        {/* Cost Amount with Currency */}
        <FormGroup className={styles.formGroup}>
          <FormLabel htmlFor={`${formId}-cost`} className={styles.formLabel}>
            {costStrings.costAmount}
          </FormLabel>
          <div className={styles.costInputRow}>
            <div className={styles.currencySelect}>
              <FormControl
                as="select"
                id={`${formId}-currency`}
                value={costData.currency}
                onChange={handleChange('currency')}
                aria-label={costStrings.currency}
              >
                {CURRENCIES.map(curr => (
                  <option key={curr.value} value={curr.value}>
                    {curr.label}
                  </option>
                ))}
              </FormControl>
            </div>
            <div className={styles.amountInputWrapper}>
              <span className={styles.amountPrefix} aria-hidden="true">{currencySymbol}</span>
              <FormControl
                type="text"
                inputMode="decimal"
                id={`${formId}-cost`}
                value={costData.cost}
                onChange={handleCostChange}
                onFocus={handleCostFocus}
                onBlur={handleCostBlur}
                placeholder={costStrings.costAmountPlaceholder}
              />
            </div>
          </div>
          {errors.cost && (
            <FormText className={styles.fieldError}>
              {errors.cost}
            </FormText>
          )}
        </FormGroup>

        {/* Description (optional) */}
        <FormGroup className={styles.formGroup}>
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
            style={{ resize: 'vertical', minHeight: '60px' }}
          />
        </FormGroup>

        {/* Category and Date Row */}
        <div className={styles.categoryDateRow}>
          {/* Category */}
          <FormGroup className={styles.formGroup}>
            <FormLabel htmlFor={`${formId}-category`} className={styles.formLabel}>
              {costStrings.category}
            </FormLabel>
            <FormControl
              as="select"
              id={`${formId}-category`}
              value={costData.category}
              onChange={handleChange('category')}
              aria-label={costStrings.category}
            >
              <option value="">{costStrings.categoryPlaceholder}</option>
              {CATEGORY_ORDER.map(categoryKey => {
                const categoryInfo = ACTIVITY_CATEGORIES[categoryKey];
                const types = GROUPED_COST_CATEGORIES[categoryKey];
                if (!types || types.length === 0) return null;
                return (
                  <optgroup key={categoryKey} label={`${categoryInfo.icon} ${categoryInfo.label}`}>
                    {types.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </FormControl>
          </FormGroup>

          {/* Date */}
          <FormGroup className={styles.formGroup}>
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
            <FormText className={styles.formHelp} muted>
              {costStrings.costDateHelp}
            </FormText>
          </FormGroup>
        </div>

        {/* Paid for (Collaborator) */}
        {collaborators.length > 0 && (
          <FormGroup className={styles.formGroup}>
            <FormLabel htmlFor={`${formId}-collaborator`} className={styles.formLabel}>
              {costStrings.paidFor || 'Paid for'}
            </FormLabel>
            <FormControl
              as="select"
              id={`${formId}-collaborator`}
              value={costData.collaborator}
              onChange={handleChange('collaborator')}
            >
              <option value="">{costStrings.selectCollaboratorOptional || 'Select Collaborator (optional)'}</option>
              {collaborators.map(collab => (
                <option key={collab._id} value={collab._id}>
                  {collab.name || collab.email}
                </option>
              ))}
            </FormControl>
            {/* Only show "Shared cost" helper when no collaborator is selected */}
            {!costData.collaborator && (
              <FormText className={styles.formHelp} muted>
                {costStrings.sharedCost}
              </FormText>
            )}
          </FormGroup>
        )}

        {/* For Plan Item */}
        {planItems.length > 0 && (
          <FormGroup className={styles.formGroup}>
            <FormLabel htmlFor={`${formId}-planItem`} className={styles.formLabel}>
              {costStrings.assignedToPlanItem}
            </FormLabel>
            <FormControl
              as="select"
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
            </FormControl>
            {!costData.plan_item && (
              <FormText className={styles.formHelp} muted>
                {costStrings.generalCost}
              </FormText>
            )}
          </FormGroup>
        )}
      </Form>
    </Modal>
  );
}
