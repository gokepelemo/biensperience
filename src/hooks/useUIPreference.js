/**
 * useUIPreference Hook
 *
 * React hook for managing UI preferences with encrypted localStorage persistence.
 * Provides a useState-like API that automatically persists changes.
 *
 * Supports both:
 * - Encrypted storage (when userId is provided via UserContext)
 * - Fallback to unencrypted storage (for non-authenticated users)
 *
 * @module hooks/useUIPreference
 */

import { useState, useCallback, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  getUIPreference,
  setUIPreference,
  getViewMode,
  setViewMode as persistViewMode,
  getSortPreference,
  setSortPreference as persistSortPreference,
  getFilterPreference,
  setFilterPreference as persistFilterPreference,
  VIEW_MODES,
  // Encrypted preferences API
  storePreference,
  retrievePreference,
  PREFERENCE_KEYS,
  PREFERENCE_CATEGORIES,
  migrateToEncryptedPreferences,
  invalidatePreferencesCache
} from '../utilities/preferences-utils';

/**
 * Hook to manage a single UI preference with encrypted localStorage persistence
 *
 * @param {string} key - Preference key (e.g., 'viewMode.myPlans', 'sortPreferences.experiences')
 * @param {*} defaultValue - Default value if preference is not set
 * @param {Object} [options] - Additional options
 * @param {number} [options.ttl] - Time-to-live in milliseconds for temporary preferences
 * @returns {[*, Function, boolean]} Tuple of [value, setValue, isLoading]
 *
 * @example
 * const [viewMode, setViewMode] = useUIPreference('viewMode.myPlans', 'list');
 * // viewMode is persisted to encrypted localStorage automatically
 *
 * @example
 * // With TTL (expires after 1 hour)
 * const [sessionTab, setSessionTab] = useUIPreference('session.lastTab', 'home', { ttl: 3600000 });
 */
export function useUIPreference(key, defaultValue, options = {}) {
  let user = null;
  try {
    const userContext = useUser();
    user = userContext?.user;
  } catch {
    // useUser throws if not within UserProvider - fallback to no user
  }
  const userId = user?._id;
  const { ttl } = options;

  const [value, setValueState] = useState(defaultValue);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial value from storage
  useEffect(() => {
    let isMounted = true;

    async function loadPreference() {
      try {
        if (userId) {
          // Use encrypted storage
          const stored = await retrievePreference(key, defaultValue, { userId });
          if (isMounted) {
            setValueState(stored);
            setIsLoading(false);
          }
        } else {
          // Fallback to legacy unencrypted storage
          const stored = getUIPreference(key);
          if (isMounted) {
            setValueState(stored !== undefined && stored !== null ? stored : defaultValue);
            setIsLoading(false);
          }
        }
      } catch (e) {
        if (isMounted) {
          setValueState(defaultValue);
          setIsLoading(false);
        }
      }
    }

    loadPreference();

    return () => {
      isMounted = false;
    };
  }, [key, defaultValue, userId]);

  // Persist value changes to storage
  const setValue = useCallback(async (newValue) => {
    // Support functional updates like useState
    const valueToSet = typeof newValue === 'function' ? newValue(value) : newValue;
    setValueState(valueToSet);

    if (userId) {
      // Use encrypted storage
      await storePreference(key, valueToSet, { userId, ttl });
    } else {
      // Fallback to legacy storage
      setUIPreference(key, valueToSet);
    }
  }, [key, value, userId, ttl]);

  return [value, setValue, isLoading];
}

/**
 * Legacy hook for backward compatibility
 * @deprecated Use useUIPreference with new key format instead
 */
export function useLegacyUIPreference(key, defaultValue) {
  // Initialize state from localStorage
  const [value, setValueState] = useState(() => {
    const stored = getUIPreference(key);
    return stored !== undefined && stored !== null ? stored : defaultValue;
  });

  // Persist value changes to localStorage
  const setValue = useCallback((newValue) => {
    // Support functional updates like useState
    const valueToSet = typeof newValue === 'function' ? newValue(value) : newValue;
    setValueState(valueToSet);
    setUIPreference(key, valueToSet);
  }, [key, value]);

  return [value, setValue];
}

/**
 * Hook to manage view mode preference for a specific context
 * Uses encrypted storage when user is authenticated
 *
 * @param {string} context - Context key (e.g., 'myPlans', 'experiences', 'destinations')
 * @param {string} [defaultMode] - Default view mode
 * @returns {{ viewMode: string, setViewMode: Function, VIEW_MODES: Object, isLoading: boolean }}
 *
 * @example
 * const { viewMode, setViewMode, VIEW_MODES } = useViewModePreference('myPlans');
 * // <button onClick={() => setViewMode(VIEW_MODES.CALENDAR)}>Calendar</button>
 */
export function useViewModePreference(context, defaultMode) {
  let user = null;
  try {
    const userContext = useUser();
    user = userContext?.user;
  } catch {
    // useUser throws if not within UserProvider - fallback to no user
  }
  const userId = user?._id;

  // Map context to standardized preference key
  const preferenceKey = `viewMode.${context}`;

  const [viewMode, setViewModeState] = useState(() => {
    // Initial sync load from legacy storage
    const stored = getViewMode(context);
    return stored || defaultMode || VIEW_MODES.LIST;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load from encrypted storage when user is available
  useEffect(() => {
    let isMounted = true;

    async function loadViewMode() {
      try {
        if (userId) {
          const stored = await retrievePreference(preferenceKey, defaultMode || VIEW_MODES.LIST, { userId });
          if (isMounted) {
            setViewModeState(stored);
            setIsLoading(false);
          }
        } else {
          // Use legacy storage for non-authenticated users
          const stored = getViewMode(context);
          if (isMounted) {
            setViewModeState(stored || defaultMode || VIEW_MODES.LIST);
            setIsLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadViewMode();

    return () => {
      isMounted = false;
    };
  }, [context, defaultMode, userId, preferenceKey]);

  const setViewMode = useCallback(async (mode) => {
    setViewModeState(mode);

    if (userId) {
      // Use encrypted storage
      await storePreference(preferenceKey, mode, { userId });
    } else {
      // Fallback to legacy storage
      persistViewMode(context, mode);
    }
  }, [context, userId, preferenceKey]);

  return {
    viewMode,
    setViewMode,
    VIEW_MODES,
    isLoading
  };
}

/**
 * Hook to manage sort preference for a specific context
 * Uses encrypted storage when user is authenticated
 *
 * @param {string} context - Context key (e.g., 'experiences', 'destinations', 'plans')
 * @param {{ field: string, direction: 'asc' | 'desc' }} [defaultSort] - Default sort config
 * @returns {{ sortConfig: Object, setSortConfig: Function, toggleSortDirection: Function, isLoading: boolean }}
 *
 * @example
 * const { sortConfig, setSortConfig, toggleSortDirection } = useSortPreference('experiences');
 * // sortConfig = { field: 'updatedAt', direction: 'desc' }
 */
export function useSortPreference(context, defaultSort = { field: 'updatedAt', direction: 'desc' }) {
  let user = null;
  try {
    const userContext = useUser();
    user = userContext?.user;
  } catch {
    // useUser throws if not within UserProvider - fallback to no user
  }
  const userId = user?._id;
  const preferenceKey = `sort.${context}`;

  const [sortConfig, setSortConfigState] = useState(() => {
    return getSortPreference(context) || defaultSort;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load from encrypted storage when user is available
  useEffect(() => {
    let isMounted = true;

    async function loadSortConfig() {
      try {
        if (userId) {
          const stored = await retrievePreference(preferenceKey, defaultSort, { userId });
          if (isMounted) {
            setSortConfigState(stored);
            setIsLoading(false);
          }
        } else {
          const stored = getSortPreference(context);
          if (isMounted) {
            setSortConfigState(stored || defaultSort);
            setIsLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadSortConfig();

    return () => {
      isMounted = false;
    };
  }, [context, defaultSort, userId, preferenceKey]);

  const setSortConfig = useCallback(async (field, direction = 'desc') => {
    const newConfig = { field, direction };
    setSortConfigState(newConfig);

    if (userId) {
      await storePreference(preferenceKey, newConfig, { userId });
    } else {
      persistSortPreference(context, field, direction);
    }
  }, [context, userId, preferenceKey]);

  const toggleSortDirection = useCallback(() => {
    const newDirection = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig(sortConfig.field, newDirection);
  }, [sortConfig, setSortConfig]);

  return {
    sortConfig,
    setSortConfig,
    toggleSortDirection,
    isLoading
  };
}

/**
 * Hook to manage filter preference for a specific context
 * Uses encrypted storage when user is authenticated
 *
 * @param {string} context - Context key
 * @param {Object} [defaultFilters] - Default filter configuration
 * @returns {{ filters: Object, setFilters: Function, clearFilters: Function, updateFilter: Function, isLoading: boolean }}
 *
 * @example
 * const { filters, updateFilter, clearFilters } = useFilterPreference('experiences');
 * updateFilter('visibility', 'public');
 */
export function useFilterPreference(context, defaultFilters = {}) {
  let user = null;
  try {
    const userContext = useUser();
    user = userContext?.user;
  } catch {
    // useUser throws if not within UserProvider - fallback to no user
  }
  const userId = user?._id;
  const preferenceKey = `filter.${context}`;

  const [filters, setFiltersState] = useState(() => {
    return getFilterPreference(context) || defaultFilters;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load from encrypted storage when user is available
  useEffect(() => {
    let isMounted = true;

    async function loadFilters() {
      try {
        if (userId) {
          const stored = await retrievePreference(preferenceKey, defaultFilters, { userId });
          if (isMounted) {
            setFiltersState(stored);
            setIsLoading(false);
          }
        } else {
          const stored = getFilterPreference(context);
          if (isMounted) {
            setFiltersState(stored || defaultFilters);
            setIsLoading(false);
          }
        }
      } catch {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadFilters();

    return () => {
      isMounted = false;
    };
  }, [context, defaultFilters, userId, preferenceKey]);

  const setFilters = useCallback(async (newFilters) => {
    setFiltersState(newFilters);

    if (userId) {
      await storePreference(preferenceKey, newFilters, { userId });
    } else {
      persistFilterPreference(context, newFilters);
    }
  }, [context, userId, preferenceKey]);

  const updateFilter = useCallback((key, value) => {
    const newFilters = { ...filters, [key]: value };
    // Remove filter if value is empty/null/undefined
    if (value === null || value === undefined || value === '') {
      delete newFilters[key];
    }
    setFilters(newFilters);
  }, [filters, setFilters]);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, [setFilters]);

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    isLoading
  };
}

/**
 * Hook to sync a component state with localStorage preference on mount
 * Useful when you have existing useState but want to persist it
 *
 * @param {string} key - Preference key
 * @param {*} value - Current value
 * @param {Function} setValue - State setter function
 *
 * @example
 * const [viewMode, setViewMode] = useState('list');
 * useSyncPreference('myPlansViewMode', viewMode, setViewMode);
 */
export function useSyncPreference(key, value, setValue) {
  // Restore from localStorage on mount
  useEffect(() => {
    const stored = getUIPreference(key);
    if (stored !== undefined && stored !== null && stored !== value) {
      setValue(stored);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist changes to localStorage
  useEffect(() => {
    if (value !== undefined && value !== null) {
      setUIPreference(key, value);
    }
  }, [key, value]);
}

// Re-export VIEW_MODES and other constants for convenience
export { VIEW_MODES, PREFERENCE_KEYS, PREFERENCE_CATEGORIES };

// Export migration and cache utilities
export { migrateToEncryptedPreferences, invalidatePreferencesCache };
