/**
 * React hook for automatic form data persistence
 * Saves form state to localStorage and restores on mount
 * Supports encryption and user-specific storage
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
 * @param {string} options.userId - User ID for encryption and user-specific storage
 * @param {number} options.ttl - Time to live in milliseconds (default: 24 hours)
 * @param {number} options.debounceMs - Debounce save operations (default: 1000ms)
 * @param {Function} options.onRestore - Callback when data is restored
 * @param {Function} options.shouldSave - Function to determine if data should be saved
 * @param {Array<string>} options.excludeFields - Fields to exclude from persistence
 *
 * @returns {Object} Persistence utilities
 */
export function useFormPersistence(formId, formData, setFormData, options = {}) {
  const {
    enabled = true,
    userId = null,
    ttl = 24 * 60 * 60 * 1000, // 24 hours
    debounceMs = 1000,
    onRestore = null,
    shouldSave = null,
    excludeFields = []
  } = options;

  const saveTimerRef = useRef(null);
  const hasRestoredRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const [hasSavedDataState, setHasSavedDataState] = useState(false);

  /**
   * Filter out excluded fields from data
   * Also filters out non-serializable values (File objects, Blob objects)
   */
  const filterData = useCallback((data) => {
    if (!data) {
      return data;
    }

    const filtered = { ...data };

    // Remove explicitly excluded fields
    excludeFields.forEach(field => {
      delete filtered[field];
    });

    // Remove non-serializable objects (File, Blob, etc.)
    Object.keys(filtered).forEach(key => {
      const value = filtered[key];

      // Check if value is a File or Blob
      if (value instanceof File || value instanceof Blob) {
        delete filtered[key];
      }

      // Check if value is an array containing Files
      if (Array.isArray(value) && value.length > 0) {
        const hasFiles = value.some(item => item instanceof File || item instanceof Blob);
        if (hasFiles) {
          // Filter out File/Blob objects but keep serializable objects (like uploaded photo URLs)
          filtered[key] = value.filter(item => {
            return !(item instanceof File) && !(item instanceof Blob);
          });
        }
      }
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
    saveTimerRef.current = setTimeout(async () => {
      // Check if we should save
      if (shouldSave && !shouldSave(formData)) {
        logger.debug('Form persistence skipped by shouldSave predicate', { formId });
        return;
      }

      const dataToSave = filterData(formData);
      await saveFormData(formId, dataToSave, ttl, userId);
    }, debounceMs);
  }, [enabled, formId, formData, ttl, debounceMs, shouldSave, filterData, userId]);

  /**
   * Restore form data from storage
   */
  const restore = useCallback(async () => {
    if (!enabled || !formId || hasRestoredRef.current) {
      return false;
    }

    const savedData = await loadFormData(formId, true, userId);
    if (savedData) {
      const age = await getFormDataAge(formId, userId);

      // Check if saved data has substantial content
      // Filter out empty strings, empty arrays, null, undefined, and empty objects
      const hasSubstantialContent = Object.keys(savedData).some(key => {
        const value = savedData[key];
        
        // Check for meaningful values
        if (value === null || value === undefined || value === '') {
          return false;
        }
        
        // Empty arrays don't count as substantial
        if (Array.isArray(value) && value.length === 0) {
          return false;
        }
        
        // Empty objects don't count as substantial
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
          return false;
        }
        
        return true;
      });

      // Log with actual values for debugging
      const dataPreview = Object.keys(savedData).reduce((acc, key) => {
        const value = savedData[key];
        acc[key] = Array.isArray(value) ? `Array(${value.length})` : typeof value;
        return acc;
      }, {});

      logger.info('Restoring form data', {
        formId,
        userId: userId ? 'provided' : 'none',
        encrypted: true,
        ageMs: age,
        fields: dataPreview,
        hasSubstantialContent
      });

      // Call setFormData directly with the saved data
      // The parent component's setFormData will handle splitting it appropriately
      setFormData(savedData);

      hasRestoredRef.current = true;
      setHasSavedDataState(false);

      // Only call onRestore callback if there's substantial content
      if (onRestore && hasSubstantialContent) {
        onRestore(savedData, age);
      }

      return true;
    }

    return false;
  }, [enabled, formId, setFormData, onRestore, userId]);

  /**
   * Clear persisted data
   */
  const clear = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    if (formId) {
      void clearFormData(formId, userId);
      logger.debug('Form persistence cleared', { formId, userId: userId ? 'provided' : 'none' });
    }
  }, [formId, userId]);

  /**
   * Check if there's saved data available
   */
  const refreshHasSavedData = useCallback(async () => {
    if (!enabled || !formId) {
      setHasSavedDataState(false);
      return;
    }

    try {
      const exists = await hasFormData(formId, userId);
      setHasSavedDataState(exists);
    } catch {
      setHasSavedDataState(false);
    }
  }, [enabled, formId, userId]);

  // Restore data on mount
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      restore();
    }
  }, [restore]);

  // Keep a lightweight flag for UI that needs to know if a draft exists
  useEffect(() => {
    refreshHasSavedData();
  }, [refreshHasSavedData]);

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
    save: async () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      const dataToSave = filterData(formData);
      await saveFormData(formId, dataToSave, ttl, userId);
      await refreshHasSavedData();
    },
    restore,
    clear,
    hasSavedData: hasSavedDataState
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
    // Note: Cannot use async in useState initializer
    // Data will be loaded in useEffect via restore() instead
    return initialData;
  });

  const persistenceUtils = useFormPersistence(formId, formData, setFormData, options);

  return [formData, setFormData, persistenceUtils];
}
