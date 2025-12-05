/**
 * Frontend Feature Flags Utility
 *
 * Client-side feature flag checking for React components.
 * Works with user feature_flags from UserContext.
 *
 * @module utilities/feature-flags
 */

import { logger } from './logger';
import { lang } from '../lang.constants';

/**
 * Known feature flags registry (mirrors backend)
 * Used for metadata and documentation
 */
export const FEATURE_FLAGS = {
  AI_FEATURES: {
    key: 'ai_features',
    description: 'Access to AI-powered features',
    tier: 'premium'
  },
  BETA_UI: {
    key: 'beta_ui',
    description: 'Access to beta user interface features',
    tier: 'beta'
  },
  ADVANCED_ANALYTICS: {
    key: 'advanced_analytics',
    description: 'Access to advanced analytics and insights',
    tier: 'premium'
  },
  REAL_TIME_COLLABORATION: {
    key: 'real_time_collaboration',
    description: 'Real-time collaboration via WebSocket',
    tier: 'premium'
  },
  DOCUMENT_AI_PARSING: {
    key: 'document_ai_parsing',
    description: 'AI-powered document parsing and extraction',
    tier: 'premium'
  },
  BULK_EXPORT: {
    key: 'bulk_export',
    description: 'Bulk export of plans and experiences',
    tier: 'premium'
  },
  CURATOR: {
    key: 'curator',
    description: 'Curator designation for creating curated experiences',
    tier: 'curator'
  }
};

/**
 * Check if a user has a specific feature flag enabled
 *
 * @param {Object} user - User object with feature_flags array
 * @param {string} flagKey - Feature flag key to check
 * @param {Object} options - Options
 * @param {boolean} options.checkExpiry - Check flag expiration (default: true)
 * @param {boolean} options.allowSuperAdmin - Super admins bypass check (default: true)
 * @returns {boolean} Whether the flag is enabled
 */
export function hasFeatureFlag(user, flagKey, options = {}) {
  const { checkExpiry = true, allowSuperAdmin = true } = options;

  // Super admins have access to all features
  if (allowSuperAdmin && user && (user.role === 'super_admin' || user.isSuperAdmin)) {
    return true;
  }

  if (!user || !user.feature_flags || !Array.isArray(user.feature_flags)) {
    return false;
  }

  const normalizedKey = flagKey.toLowerCase();
  const flag = user.feature_flags.find(f => f.flag === normalizedKey);

  if (!flag || !flag.enabled) {
    return false;
  }

  // Check expiration
  if (checkExpiry && flag.expires_at) {
    if (new Date(flag.expires_at) < new Date()) {
      logger.debug('Feature flag expired', { flag: flagKey });
      return false;
    }
  }

  return true;
}

/**
 * Get feature flag configuration for a user
 *
 * @param {Object} user - User object
 * @param {string} flagKey - Feature flag key
 * @returns {Object|null} Flag configuration or null
 */
export function getFeatureFlagConfig(user, flagKey) {
  if (!user || !user.feature_flags || !Array.isArray(user.feature_flags)) {
    return null;
  }

  const normalizedKey = flagKey.toLowerCase();
  const flag = user.feature_flags.find(f => f.flag === normalizedKey);

  if (!flag || !flag.enabled) {
    return null;
  }

  return flag.config || {};
}

/**
 * Get all active feature flags for a user
 *
 * @param {Object} user - User object
 * @returns {Array<string>} Array of active flag keys
 */
export function getUserFeatureFlags(user) {
  if (!user || !user.feature_flags || !Array.isArray(user.feature_flags)) {
    return [];
  }

  const now = new Date();

  return user.feature_flags
    .filter(flag => {
      if (!flag.enabled) return false;
      if (flag.expires_at && new Date(flag.expires_at) < now) return false;
      return true;
    })
    .map(flag => flag.flag);
}

/**
 * Check if user has ANY of the specified feature flags
 *
 * @param {Object} user - User object
 * @param {Array<string>} flagKeys - Array of flag keys
 * @returns {boolean} True if user has any of the flags
 */
export function hasAnyFeatureFlag(user, flagKeys) {
  return flagKeys.some(flagKey => hasFeatureFlag(user, flagKey));
}

/**
 * Check if user has ALL of the specified feature flags
 *
 * @param {Object} user - User object
 * @param {Array<string>} flagKeys - Array of flag keys
 * @returns {boolean} True if user has all of the flags
 */
export function hasAllFeatureFlags(user, flagKeys) {
  return flagKeys.every(flagKey => hasFeatureFlag(user, flagKey));
}

/**
 * Get feature flag metadata
 *
 * @param {string} flagKey - Feature flag key
 * @returns {Object|null} Flag metadata or null
 */
export function getFlagMetadata(flagKey) {
  const upperKey = flagKey.toUpperCase();
  return FEATURE_FLAGS[upperKey] || null;
}

/**
 * Get detailed feature flag messages from lang.constants
 *
 * @param {string} flagKey - Feature flag key
 * @returns {Object} Detailed messages for the feature flag
 */
export function getFeatureFlagMessages(flagKey) {
  const normalizedKey = flagKey.toLowerCase();
  const featureFlagLang = lang.current?.featureFlags || {};
  const flagLang = featureFlagLang[normalizedKey];

  if (flagLang) {
    return {
      name: flagLang.name || flagKey,
      description: flagLang.description || '',
      title: flagLang.deniedTitle || featureFlagLang.accessDenied || 'Feature Access Denied',
      message: flagLang.deniedMessage || featureFlagLang.featureNotAvailable || 'This feature is not available.',
      upgradeMessage: flagLang.upgradeMessage || featureFlagLang.upgradeToPremium || 'Upgrade your account.',
      tier: flagLang.tier || 'premium'
    };
  }

  // Fallback to FEATURE_FLAGS registry
  const metadata = getFlagMetadata(flagKey);
  if (metadata) {
    return {
      name: flagKey,
      description: metadata.description || '',
      title: featureFlagLang.accessDenied || 'Feature Access Denied',
      message: `This feature (${metadata.description}) is not available for your account.`,
      upgradeMessage: metadata.tier === 'beta'
        ? (featureFlagLang.joinBeta || 'Join the beta program.')
        : (featureFlagLang.upgradeToPremium || 'Upgrade to premium.'),
      tier: metadata.tier || 'premium'
    };
  }

  return {
    name: flagKey,
    description: '',
    title: featureFlagLang.accessDenied || 'Feature Access Denied',
    message: featureFlagLang.featureNotAvailable || 'This feature is not available for your account.',
    upgradeMessage: featureFlagLang.contactSupport || 'Contact support for more information.',
    tier: 'unknown'
  };
}

/**
 * Create a user-friendly message for a denied feature
 *
 * @param {string} flagKey - Feature flag key
 * @returns {string} User-friendly message
 */
export function getFeatureDenialMessage(flagKey) {
  const messages = getFeatureFlagMessages(flagKey);
  return messages.message;
}

/**
 * Get detailed denial info for toast notifications
 *
 * @param {string} flagKey - Feature flag key
 * @param {Object} options - Options
 * @param {boolean} options.includeUpgrade - Include upgrade message (default: true)
 * @returns {Object} Detailed denial information
 */
export function getDetailedDenialInfo(flagKey, options = {}) {
  const { includeUpgrade = true } = options;
  const messages = getFeatureFlagMessages(flagKey);

  return {
    title: messages.title,
    message: includeUpgrade
      ? `${messages.message} ${messages.upgradeMessage}`
      : messages.message,
    featureName: messages.name,
    tier: messages.tier
  };
}

/**
 * Check feature flag and emit notification if denied
 *
 * @param {Object} user - User object
 * @param {string} flagKey - Feature flag key
 * @param {Object} options - Options
 * @param {Function} options.onDenied - Callback when access is denied
 * @param {boolean} options.silent - Don't emit notification (default: false)
 * @returns {boolean} Whether access is granted
 */
export function checkFeatureAccess(user, flagKey, options = {}) {
  const { onDenied, silent = false } = options;

  const hasAccess = hasFeatureFlag(user, flagKey);

  if (!hasAccess) {
    logger.debug('Feature access denied', { flag: flagKey, userId: user?._id });

    if (!silent && typeof onDenied === 'function') {
      const message = getFeatureDenialMessage(flagKey);
      onDenied(message, flagKey);
    }
  }

  return hasAccess;
}

/**
 * Utility to create a feature-gated function
 * Returns a no-op function if flag is not enabled
 *
 * @param {Object} user - User object
 * @param {string} flagKey - Feature flag key
 * @param {Function} fn - Function to gate
 * @param {Function} fallback - Optional fallback function
 * @returns {Function} Gated function
 *
 * @example
 * const aiAutocomplete = gatedFunction(user, 'ai_features', actualAutocomplete, () => null);
 */
export function gatedFunction(user, flagKey, fn, fallback = () => null) {
  if (hasFeatureFlag(user, flagKey)) {
    return fn;
  }
  return fallback;
}
