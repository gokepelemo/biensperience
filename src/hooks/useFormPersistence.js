/**
 * React hook for automatic form data persistence
 * Saves form state to localStorage and restores on mount
 *
 * @module useFormPersistence
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { saveFormData, loadFormData, clearFormData, hasFormData, getFormDataAge } from '../utilities/form-persistence';
import { logger } from '../utilities/logger';

/**
 * Custom hook for form data persistence
 *
 * @param {string} formId - Unique identifier for the form
 * @param {Object} formData - Current form data object
 * @param {Function} setFormData - State setter function for form data
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Enable/disable persistence (default: true)
 * @param {number} options.ttl - Time to live in milliseconds (default: 24 hours)
 * @param {number} options.debounceMs - Debounce save operations (default: 500ms)
 * @param {Function} options.onRestore - Callback when data is restored
 * @param {Function} options.shouldSave - Function to determine if data should be saved
 * @param {Array<string>} options.excludeFields - Fields to exclude from persistence
 *
 * @returns {Object} Persistence utilities
 */
export function useFormPersistence(formId, formData, setFormData, options = {}) {
  const {
    enabled = true,
    ttl = 24 * 60 * 60 * 1000, // 24 hours
    debounceMs = 500,
    onRestore = null,
    shouldSave = null,
    excludeFields = []
  } = options;

  const saveTimerRef = useRef(null);
  const hasRestoredRef = useRef(false);
  const isInitialMountRef = useRef(true);

  /**
   * Filter out excluded fields from data
   */
  const filterData = useCallback((data) => {
    if (!data || excludeFields.length === 0) {
      return data;
    }

    const filtered = { ...data };
    excludeFields.forEach(field => {
      delete filtered[field];
    });

    return filtered;
  }, [excludeFields]);

  /**
   * Save form data with debouncing
   */
  const save = useCallback(() => {
    if (!enabled || !formId) {
      return;
    }

    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Set new timer
    saveTimerRef.current = setTimeout(() => {
      // Check if we should save
      if (shouldSave && !shouldSave(formData)) {
        logger.debug('Form persistence skipped by shouldSave predicate', { formId });
        return;
      }

      const dataToSave = filterData(formData);
      saveFormData(formId, dataToSave, ttl);
    }, debounceMs);
  }, [enabled, formId, formData, ttl, debounceMs, shouldSave, filterData]);

  /**
   * Restore form data from storage
   */
  const restore = useCallback(() => {
    if (!enabled || !formId || hasRestoredRef.current) {
      return false;
    }

    const savedData = loadFormData(formId);
    if (savedData) {
      const age = getFormDataAge(formId);
      logger.info('Restoring form data', {
        formId,
        ageMs: age,
        fields: Object.keys(savedData)
      });

      // Merge saved data with current form data
      // This preserves any fields that weren't saved
      setFormData(prevData => ({
        ...prevData,
        ...savedData
      }));

      hasRestoredRef.current = true;

      // Call onRestore callback if provided
      if (onRestore) {
        onRestore(savedData, age);
      }

      return true;
    }

    return false;
  }, [enabled, formId, setFormData, onRestore]);

  /**
   * Clear persisted data
   */
  const clear = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    if (formId) {
      clearFormData(formId);
      logger.debug('Form persistence cleared', { formId });
    }
  }, [formId]);

  /**
   * Check if there's saved data available
   */
  const hasSavedData = useCallback(() => {
    if (!formId) {
      return false;
    }
    return hasFormData(formId);
  }, [formId]);

  // Restore data on mount
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      restore();
    }
  }, [restore]);

  // Save data when form data changes (with debouncing)
  useEffect(() => {
    // Skip saving on initial mount or if we just restored
    if (isInitialMountRef.current) {
      return;
    }

    save();

    // Cleanup timer on unmount
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [formData, save]);

  // Cleanup on unmount - optionally clear data
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    save: () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      const dataToSave = filterData(formData);
      saveFormData(formId, dataToSave, ttl);
    },
    restore,
    clear,
    hasSavedData: hasSavedData()
  };
}

/**
 * Hook variant for simple form state with automatic persistence
 * Combines useState with persistence
 *
 * @param {string} formId - Unique identifier for the form
 * @param {Object} initialData - Initial form data
 * @param {Object} options - Configuration options (same as useFormPersistence)
 *
 * @returns {Array} [formData, setFormData, persistenceUtils]
 */
export function usePersistedFormState(formId, initialData, options = {}) {
  const [formData, setFormData] = useState(() => {
    // Try to load saved data on initialization
    const saved = loadFormData(formId);
    if (saved) {
      logger.info('Initializing form with saved data', { formId });
      return { ...initialData, ...saved };
    }
    return initialData;
  });

  const persistenceUtils = useFormPersistence(formId, formData, setFormData, options);

  return [formData, setFormData, persistenceUtils];
}
