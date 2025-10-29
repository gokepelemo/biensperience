/**
 * Custom hook for handling form field changes
 * Provides a standardized handleChange function for form inputs
 */

import { useCallback } from 'react';

/**
 * Creates a form change handler
 * @param {Object} formData - Current form data state
 * @param {Function} setFormData - State setter for form data
 * @param {Object} options - Optional configuration
 * @param {Function} options.onFieldChange - Callback when specific field changes
 * @returns {Function} handleChange function
 */
export function useFormChangeHandler(formData, setFormData, options = {}) {
  const { onFieldChange } = options;

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: fieldValue
    }));

    // Call optional field-specific handler
    if (onFieldChange) {
      onFieldChange(name, fieldValue);
    }
  }, [setFormData, onFieldChange]);

  return handleChange;
}

/**
 * Creates a form change handler with change tracking
 * Tracks what fields have changed from original values
 * @param {Object} formData - Current form data state
 * @param {Function} setFormData - State setter for form data
 * @param {Object} originalData - Original data to compare against
 * @param {Object} changes - Current changes object
 * @param {Function} setChanges - State setter for changes
 * @returns {Function} handleChange function
 */
export function useChangeTrackingHandler(formData, setFormData, originalData, changes, setChanges) {
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;

    // Update form data
    setFormData(prev => ({
      ...prev,
      [name]: fieldValue
    }));

    // Track changes
    if (!originalData) return;

    const newChanges = { ...changes };

    if (originalData[name] !== fieldValue) {
      newChanges[name] = {
        from: originalData[name],
        to: fieldValue
      };
    } else {
      delete newChanges[name];
    }

    setChanges(newChanges);
  }, [formData, setFormData, originalData, changes, setChanges]);

  return handleChange;
}

export default useFormChangeHandler;
