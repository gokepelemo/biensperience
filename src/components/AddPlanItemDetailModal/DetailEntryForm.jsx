/**
 * DetailEntryForm Component
 * Step 2 of AddPlanItemDetailModal - Enter key/value pairs for the detail
 * Provides schema-based fields with dropdown selection and custom field option
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './AddPlanItemDetailModal.module.scss';
import { DETAIL_TYPES } from './constants';
import Tooltip from '../Tooltip/Tooltip';
import Checkbox from '../Checkbox/Checkbox';
import { lang } from '../../lang.constants';

/**
 * Available currencies for cost fields
 */
const CURRENCIES = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
  { value: 'CAD', label: 'CAD ($)', symbol: 'C$' },
  { value: 'AUD', label: 'AUD ($)', symbol: 'A$' },
  { value: 'CHF', label: 'CHF', symbol: 'CHF' },
  { value: 'CNY', label: 'CNY (¥)', symbol: '¥' },
  { value: 'MXN', label: 'MXN ($)', symbol: 'MX$' },
  { value: 'BRL', label: 'BRL (R$)', symbol: 'R$' }
];

/**
 * Cost categories
 */
const COST_CATEGORIES = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'transport', label: 'Transportation' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'activities', label: 'Activities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' }
];

/**
 * Schema definitions for each detail type
 * Each field has: key, label, type, required, options (for select), placeholder
 */
const DETAIL_SCHEMAS = {
  [DETAIL_TYPES.COST]: {
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g., Dinner at restaurant' },
      { key: 'cost', label: 'Amount', type: 'currency', required: true, placeholder: '0.00' },
      { key: 'category', label: 'Category', type: 'select', options: COST_CATEGORIES },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'description', label: 'Notes', type: 'textarea', placeholder: 'Additional notes...' }
    ]
  },
  [DETAIL_TYPES.FLIGHT]: {
    fields: [
      { key: 'vendor', label: 'Airline', type: 'text', placeholder: 'e.g., United Airlines' },
      { key: 'trackingNumber', label: 'Flight Number', type: 'text', required: true, placeholder: 'e.g., UA1234' },
      { key: 'departureLocation', label: 'From (Airport)', type: 'text', placeholder: 'e.g., LAX' },
      { key: 'arrivalLocation', label: 'To (Airport)', type: 'text', placeholder: 'e.g., JFK' },
      { key: 'departureTime', label: 'Departure Time', type: 'datetime-local' },
      { key: 'arrivalTime', label: 'Arrival Time', type: 'datetime-local' },
      { key: 'terminal', label: 'Departure Terminal', type: 'text', placeholder: 'e.g., Terminal 7' },
      { key: 'gate', label: 'Departure Gate', type: 'text', placeholder: 'e.g., Gate 42' },
      { key: 'arrivalTerminal', label: 'Arrival Terminal', type: 'text' },
      { key: 'arrivalGate', label: 'Arrival Gate', type: 'text' },
      { key: 'transportNotes', label: 'Notes', type: 'textarea', placeholder: 'Seat number, meal preferences, etc.' }
    ]
  },
  [DETAIL_TYPES.TRAIN]: {
    fields: [
      { key: 'vendor', label: 'Train Company', type: 'text', placeholder: 'e.g., Amtrak' },
      { key: 'trackingNumber', label: 'Reservation Number', type: 'text', placeholder: 'e.g., ABC123' },
      { key: 'departureLocation', label: 'From (Station)', type: 'text', placeholder: 'e.g., Penn Station' },
      { key: 'arrivalLocation', label: 'To (Station)', type: 'text', placeholder: 'e.g., Union Station' },
      { key: 'departureTime', label: 'Departure Time', type: 'datetime-local' },
      { key: 'arrivalTime', label: 'Arrival Time', type: 'datetime-local' },
      { key: 'platform', label: 'Platform', type: 'text', placeholder: 'e.g., Platform 5' },
      { key: 'carriageNumber', label: 'Car/Carriage', type: 'text', placeholder: 'e.g., Car 4' },
      { key: 'transportNotes', label: 'Notes', type: 'textarea', placeholder: 'Seat number, etc.' }
    ]
  },
  [DETAIL_TYPES.CRUISE]: {
    fields: [
      { key: 'vendor', label: 'Cruise Line', type: 'text', placeholder: 'e.g., Royal Caribbean' },
      { key: 'trackingNumber', label: 'Booking Number', type: 'text', placeholder: 'e.g., ABC123456' },
      { key: 'shipName', label: 'Ship Name', type: 'text', placeholder: 'e.g., Symphony of the Seas' },
      { key: 'embarkationPort', label: 'Embarkation Port', type: 'text', placeholder: 'e.g., Miami' },
      { key: 'disembarkationPort', label: 'Disembarkation Port', type: 'text' },
      { key: 'departureTime', label: 'Departure Date/Time', type: 'datetime-local' },
      { key: 'arrivalTime', label: 'Return Date/Time', type: 'datetime-local' },
      { key: 'deck', label: 'Deck', type: 'text', placeholder: 'e.g., Deck 10' },
      { key: 'transportNotes', label: 'Cabin/Notes', type: 'textarea', placeholder: 'Cabin number, dining preferences, etc.' }
    ]
  },
  [DETAIL_TYPES.FERRY]: {
    fields: [
      { key: 'vendor', label: 'Ferry Company', type: 'text', placeholder: 'e.g., Washington State Ferries' },
      { key: 'trackingNumber', label: 'Reservation Number', type: 'text' },
      { key: 'shipName', label: 'Ferry Name', type: 'text' },
      { key: 'embarkationPort', label: 'From (Port)', type: 'text', placeholder: 'e.g., Seattle' },
      { key: 'disembarkationPort', label: 'To (Port)', type: 'text', placeholder: 'e.g., Bainbridge Island' },
      { key: 'departureTime', label: 'Departure Time', type: 'datetime-local' },
      { key: 'arrivalTime', label: 'Arrival Time', type: 'datetime-local' },
      { key: 'deck', label: 'Deck', type: 'text' },
      { key: 'transportNotes', label: 'Notes', type: 'textarea', placeholder: 'Vehicle info, etc.' }
    ]
  },
  [DETAIL_TYPES.BUS]: {
    fields: [
      { key: 'vendor', label: 'Bus Company', type: 'text', placeholder: 'e.g., Greyhound' },
      { key: 'trackingNumber', label: 'Reservation Number', type: 'text' },
      { key: 'departureLocation', label: 'From (Station)', type: 'text' },
      { key: 'arrivalLocation', label: 'To (Station)', type: 'text' },
      { key: 'departureTime', label: 'Departure Time', type: 'datetime-local' },
      { key: 'arrivalTime', label: 'Arrival Time', type: 'datetime-local' },
      { key: 'stopName', label: 'Stop/Platform', type: 'text' },
      { key: 'transportNotes', label: 'Notes', type: 'textarea', placeholder: 'Seat number, etc.' }
    ]
  },
  [DETAIL_TYPES.HOTEL]: {
    fields: [
      { key: 'name', label: 'Hotel Name', type: 'text', required: true, placeholder: 'e.g., Marriott Downtown' },
      { key: 'confirmationNumber', label: 'Confirmation Number', type: 'text', placeholder: 'e.g., ABC123456' },
      { key: 'address', label: 'Address', type: 'text', placeholder: 'Hotel address' },
      { key: 'checkIn', label: 'Check-in Date/Time', type: 'datetime-local' },
      { key: 'checkOut', label: 'Check-out Date/Time', type: 'datetime-local' },
      { key: 'roomType', label: 'Room Type', type: 'text', placeholder: 'e.g., King Suite' },
      { key: 'cost', label: 'Total Cost', type: 'currency' },
      { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Special requests, amenities, etc.' }
    ]
  },
  [DETAIL_TYPES.PARKING]: {
    fields: [
      { key: 'facilityName', label: 'Parking Facility', type: 'text', placeholder: 'e.g., Airport Long-Term Parking' },
      { key: 'address', label: 'Address', type: 'text' },
      { key: 'confirmationNumber', label: 'Confirmation Number', type: 'text' },
      { key: 'parkingType', label: 'Type', type: 'select', options: [
        { value: 'street', label: 'Street Parking' },
        { value: 'garage', label: 'Parking Garage' },
        { value: 'lot', label: 'Parking Lot' },
        { value: 'valet', label: 'Valet' },
        { value: 'hotel', label: 'Hotel Parking' },
        { value: 'airport', label: 'Airport Parking' },
        { value: 'other', label: 'Other' }
      ]},
      { key: 'startTime', label: 'Start Date/Time', type: 'datetime-local' },
      { key: 'endTime', label: 'End Date/Time', type: 'datetime-local' },
      { key: 'spotNumber', label: 'Spot/Space Number', type: 'text' },
      { key: 'level', label: 'Level/Floor', type: 'text' },
      { key: 'cost', label: 'Cost', type: 'currency' },
      { key: 'accessCode', label: 'Access Code', type: 'text', placeholder: 'Gate code if applicable' },
      { key: 'parkingNotes', label: 'Notes', type: 'textarea' }
    ]
  },
  [DETAIL_TYPES.DISCOUNT]: {
    fields: [
      { key: 'code', label: 'Promo/Discount Code', type: 'text', required: true, placeholder: 'e.g., SAVE20' },
      { key: 'description', label: 'Description', type: 'text', placeholder: 'e.g., 20% off hotel bookings' },
      { key: 'discountType', label: 'Type', type: 'select', options: [
        { value: 'promo_code', label: 'Promo Code' },
        { value: 'coupon', label: 'Coupon' },
        { value: 'loyalty', label: 'Loyalty Reward' },
        { value: 'member', label: 'Member Discount' },
        { value: 'early_bird', label: 'Early Bird' },
        { value: 'group', label: 'Group Discount' },
        { value: 'referral', label: 'Referral' },
        { value: 'other', label: 'Other' }
      ]},
      { key: 'discountValue', label: 'Discount Amount', type: 'number', placeholder: 'e.g., 20' },
      { key: 'isPercentage', label: 'Is Percentage?', type: 'checkbox' },
      { key: 'expiresAt', label: 'Expiration Date', type: 'date' },
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Where you got the code' },
      { key: 'discountNotes', label: 'Notes', type: 'textarea', placeholder: 'Usage restrictions, etc.' }
    ]
  }
};

export default function DetailEntryForm({
  detailType,
  value = {},
  onChange,
  defaultCurrency = 'USD',
  planItem
}) {
  const [formData, setFormData] = useState(value);
  const [customFields, setCustomFields] = useState([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState(value.currency || defaultCurrency);

  // Get schema for this detail type
  const schema = useMemo(() => DETAIL_SCHEMAS[detailType] || { fields: [] }, [detailType]);

  // Sync form data with parent
  useEffect(() => {
    const dataWithCurrency = {
      ...formData,
      currency: selectedCurrency,
      customFields: customFields.length > 0 ? customFields : undefined
    };
    onChange(dataWithCurrency);
  }, [formData, customFields, selectedCurrency, onChange]);

  // Handle field change
  const handleFieldChange = useCallback((key, fieldValue) => {
    setFormData(prev => ({
      ...prev,
      [key]: fieldValue
    }));
  }, []);

  // Handle custom field change
  const handleCustomFieldChange = useCallback((index, fieldValue) => {
    setCustomFields(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: fieldValue };
      return updated;
    });
  }, []);

  // Add custom field
  const handleAddCustomField = useCallback(() => {
    if (!newCustomKey.trim()) return;

    setCustomFields(prev => [...prev, { key: newCustomKey.trim(), value: '' }]);
    setNewCustomKey('');
    setShowAddCustom(false);
  }, [newCustomKey]);

  // Remove custom field
  const handleRemoveCustomField = useCallback((index) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Render a form field based on its type
  const renderField = useCallback((field) => {
    const fieldValue = formData[field.key] || '';

    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            id={field.key}
            className={styles.formInput}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            id={field.key}
            className={styles.formInput}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            step="any"
          />
        );

      case 'currency':
        return (
          <div className={styles.currencyInputGroup}>
            <select
              className={styles.currencySelect}
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              aria-label="Select currency"
            >
              {CURRENCIES.map(curr => (
                <option key={curr.value} value={curr.value}>
                  {curr.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              id={field.key}
              className={styles.formInput}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              placeholder={field.placeholder || '0.00'}
              step="0.01"
              min="0"
              required={field.required}
            />
          </div>
        );

      case 'select':
        return (
          <select
            id={field.key}
            className={styles.formSelect}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          >
            <option value="">Select...</option>
            {(field.options || []).map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            id={field.key}
            className={styles.formTextarea}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            id={field.key}
            className={styles.formInput}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );

      case 'datetime-local':
        return (
          <input
            type="datetime-local"
            id={field.key}
            className={styles.formInput}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            id={field.key}
            checked={!!fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.checked)}
            label={field.checkboxLabel || 'Yes'}
            size="md"
          />
        );

      default:
        return (
          <input
            type="text"
            id={field.key}
            className={styles.formInput}
            value={fieldValue}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
          />
        );
    }
  }, [formData, selectedCurrency, handleFieldChange]);

  return (
    <div className={styles.detailEntryForm}>
      {/* Plan item context */}
      {planItem && (
        <div className={styles.planItemContext}>
          <span className={styles.contextLabel}>Adding to:</span>
          <span className={styles.contextValue}>{planItem.text || 'Plan Item'}</span>
        </div>
      )}

      {/* Schema-based fields */}
      <div className={styles.formFields}>
        {schema.fields.map((field) => (
          <div key={field.key} className={styles.formGroup}>
            <label htmlFor={field.key} className={styles.formLabel}>
              {field.label}
              {field.required && <span className={styles.requiredMark}>*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}
      </div>

      {/* Custom fields section */}
      <div className={styles.customFieldsSection}>
        <div className={styles.customFieldsHeader}>
          <span className={styles.customFieldsLabel}>Custom Fields</span>
          <Tooltip content="Add your own custom fields to track additional information">
            <span className={styles.infoIcon}>ⓘ</span>
          </Tooltip>
        </div>

        {/* Existing custom fields */}
        {customFields.map((field, index) => (
          <div key={index} className={styles.customFieldRow}>
            <span className={styles.customFieldKey}>{field.key}:</span>
            <input
              type="text"
              className={styles.formInput}
              value={field.value}
              onChange={(e) => handleCustomFieldChange(index, e.target.value)}
              placeholder="Enter value..."
            />
            <button
              type="button"
              className={styles.removeCustomButton}
              onClick={() => handleRemoveCustomField(index)}
              aria-label="Remove custom field"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add custom field form */}
        {showAddCustom ? (
          <div className={styles.addCustomFieldForm}>
            <input
              type="text"
              className={styles.formInput}
              value={newCustomKey}
              onChange={(e) => setNewCustomKey(e.target.value)}
              placeholder="Field name (e.g., Seat Number)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomField();
                }
                if (e.key === 'Escape') {
                  setShowAddCustom(false);
                  setNewCustomKey('');
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className={styles.addCustomConfirmButton}
              onClick={handleAddCustomField}
              disabled={!newCustomKey.trim()}
            >
              Add
            </button>
            <button
              type="button"
              className={styles.addCustomCancelButton}
              onClick={() => {
                setShowAddCustom(false);
                setNewCustomKey('');
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.addCustomFieldButton}
            onClick={() => setShowAddCustom(true)}
          >
            + Add Custom Field
          </button>
        )}
      </div>
    </div>
  );
}

DetailEntryForm.propTypes = {
  detailType: PropTypes.string.isRequired,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  defaultCurrency: PropTypes.string,
  planItem: PropTypes.object
};
