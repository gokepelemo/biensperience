/**
 * useFeatureFlag Hook
 *
 * React hook for checking feature flags in components.
 * Integrates with UserContext and provides reactive flag checking.
 *
 * @module hooks/useFeatureFlag
 */

import { useMemo, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  hasFeatureFlag,
  hasAnyFeatureFlag,
  hasAllFeatureFlags,
  getFeatureFlagConfig,
  getUserFeatureFlags,
  getFeatureDenialMessage,
  getDetailedDenialInfo,
  getFeatureFlagMessages,
  FEATURE_FLAGS
} from '../utilities/feature-flags';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../utilities/logger';

/**
 * Hook to check a single feature flag
 *
 * @param {string} flagKey - Feature flag key to check
 * @param {Object} options - Options
 * @param {boolean} options.showToast - Show toast on denied access (default: false)
 * @param {boolean} options.detailedToast - Show detailed toast with title (default: true)
 * @returns {Object} Feature flag state and utilities
 *
 * @example
 * const { enabled, config, checkAndNotify } = useFeatureFlag('ai_features');
 *
 * if (!enabled) {
 *   return <FeatureLockedMessage />;
 * }
 */
export function useFeatureFlag(flagKey, options = {}) {
  const { showToast = false, detailedToast = true } = options;
  const { user } = useUser();
  const toast = useToast();

  // Memoize the flag check
  const enabled = useMemo(() => {
    return hasFeatureFlag(user, flagKey);
  }, [user, flagKey]);

  // Memoize the config
  const config = useMemo(() => {
    return getFeatureFlagConfig(user, flagKey);
  }, [user, flagKey]);

  // Get detailed messages
  const messages = useMemo(() => {
    return getFeatureFlagMessages(flagKey);
  }, [flagKey]);

  // Check and notify function with detailed toast
  const checkAndNotify = useCallback(() => {
    const hasAccess = hasFeatureFlag(user, flagKey);

    if (!hasAccess) {
      if (showToast && toast?.showToast) {
        if (detailedToast) {
          const info = getDetailedDenialInfo(flagKey);
          // Show detailed toast with title and message
          toast.showToast(info.message, 'warning', {
            title: info.title,
            duration: 6000 // Show longer for detailed messages
          });
        } else {
          const message = getFeatureDenialMessage(flagKey);
          toast.showToast(message, 'warning');
        }
      }

      logger.debug('Feature flag check failed with notification', {
        flag: flagKey,
        featureName: messages.name,
        tier: messages.tier
      });
    }

    return hasAccess;
  }, [user, flagKey, showToast, detailedToast, toast, messages]);

  // Get denial info for custom rendering
  const denialInfo = useMemo(() => {
    if (enabled) return null;
    return getDetailedDenialInfo(flagKey);
  }, [enabled, flagKey]);

  // Get denial message (simple string)
  const denialMessage = useMemo(() => {
    if (enabled) return null;
    return getFeatureDenialMessage(flagKey);
  }, [enabled, flagKey]);

  return {
    enabled,
    config,
    checkAndNotify,
    denialMessage,
    denialInfo,
    messages,
    flagKey
  };
}

/**
 * Hook to check multiple feature flags
 *
 * @param {Array<string>} flagKeys - Array of flag keys to check
 * @param {Object} options - Options
 * @param {string} options.mode - 'any' or 'all' (default: 'any')
 * @returns {Object} Feature flags state
 *
 * @example
 * const { enabled, enabledFlags, missingFlags } = useFeatureFlags(['ai_features', 'beta_ui'], { mode: 'any' });
 */
export function useFeatureFlags(flagKeys, options = {}) {
  const { mode = 'any' } = options;
  const { user } = useUser();

  // Check which flags are enabled
  const flagStates = useMemo(() => {
    return flagKeys.reduce((acc, key) => {
      acc[key] = hasFeatureFlag(user, key);
      return acc;
    }, {});
  }, [user, flagKeys]);

  // Calculate enabled state based on mode
  const enabled = useMemo(() => {
    if (mode === 'all') {
      return hasAllFeatureFlags(user, flagKeys);
    }
    return hasAnyFeatureFlag(user, flagKeys);
  }, [user, flagKeys, mode]);

  // Get enabled and missing flags
  const enabledFlags = useMemo(() => {
    return flagKeys.filter(key => flagStates[key]);
  }, [flagKeys, flagStates]);

  const missingFlags = useMemo(() => {
    return flagKeys.filter(key => !flagStates[key]);
  }, [flagKeys, flagStates]);

  return {
    enabled,
    flagStates,
    enabledFlags,
    missingFlags,
    mode
  };
}

/**
 * Hook to get all user's feature flags
 *
 * @returns {Object} All user flags and utilities
 *
 * @example
 * const { flags, hasFlag, isSuperAdmin } = useUserFeatureFlags();
 */
export function useUserFeatureFlags() {
  const { user } = useUser();

  const flags = useMemo(() => {
    return getUserFeatureFlags(user);
  }, [user]);

  const hasFlag = useCallback((flagKey) => {
    return hasFeatureFlag(user, flagKey);
  }, [user]);

  const getConfig = useCallback((flagKey) => {
    return getFeatureFlagConfig(user, flagKey);
  }, [user]);

  const isSuperAdmin = useMemo(() => {
    return user && (user.role === 'super_admin' || user.isSuperAdmin);
  }, [user]);

  return {
    flags,
    hasFlag,
    getConfig,
    isSuperAdmin,
    allFlags: FEATURE_FLAGS
  };
}

/**
 * Hook for feature-gated actions
 *
 * Returns a wrapped function that checks the flag before executing.
 * Shows a detailed toast notification if access is denied.
 *
 * @param {string} flagKey - Feature flag to check
 * @param {Function} action - Action to execute if flag is enabled
 * @param {Object} options - Options
 * @param {Function} options.fallback - Fallback action if flag is disabled
 * @param {boolean} options.showToast - Show toast on denial (default: true)
 * @param {boolean} options.detailedToast - Show detailed toast with title (default: true)
 * @returns {Function} Gated action function
 *
 * @example
 * const handleAIAutocomplete = useGatedAction('ai_features', async (text) => {
 *   const result = await aiAutocomplete(text);
 *   return result;
 * });
 */
export function useGatedAction(flagKey, action, options = {}) {
  const { fallback = null, showToast = true, detailedToast = true } = options;
  const { user } = useUser();
  const toast = useToast();

  return useCallback(async (...args) => {
    const hasAccess = hasFeatureFlag(user, flagKey);

    if (!hasAccess) {
      const info = getDetailedDenialInfo(flagKey);

      logger.debug('Gated action blocked', {
        flag: flagKey,
        featureName: info.featureName,
        tier: info.tier
      });

      if (showToast && toast?.showToast) {
        if (detailedToast) {
          toast.showToast(info.message, 'warning', {
            title: info.title,
            duration: 6000
          });
        } else {
          toast.showToast(getFeatureDenialMessage(flagKey), 'warning');
        }
      }

      if (typeof fallback === 'function') {
        return fallback(...args);
      }

      return null;
    }

    return action(...args);
  }, [user, flagKey, action, fallback, showToast, detailedToast, toast]);
}

export default useFeatureFlag;
