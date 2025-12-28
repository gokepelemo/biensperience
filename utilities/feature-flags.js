/**
 * Feature Flags Utility
 *
 * Centralized feature flag management for controlling access to experimental
 * or premium features. Supports user-level flags, global flags, and flag
 * configuration.
 *
 * @module utilities/feature-flags
 */

const logger = require('./backend-logger');

/**
 * Feature flag evaluation contexts.
 *
 * - ENTITY_CREATOR: check the user who created/owns the entity
 * - LOGGED_IN_USER: check the currently authenticated user
 */
const FEATURE_FLAG_CONTEXT = {
  ENTITY_CREATOR: 'entity_creator',
  LOGGED_IN_USER: 'logged_in_user'
};

function normalizeFeatureFlagContext(context) {
  const normalized = String(context || '').trim().toLowerCase();

  if (
    normalized === FEATURE_FLAG_CONTEXT.ENTITY_CREATOR ||
    normalized === 'creator' ||
    normalized === 'owner'
  ) {
    return FEATURE_FLAG_CONTEXT.ENTITY_CREATOR;
  }

  if (
    normalized === FEATURE_FLAG_CONTEXT.LOGGED_IN_USER ||
    normalized === 'user' ||
    normalized === 'actor' ||
    normalized === 'viewer'
  ) {
    return FEATURE_FLAG_CONTEXT.LOGGED_IN_USER;
  }

  // Default to creator-context for safety (fail-closed for entity-scoped features)
  return FEATURE_FLAG_CONTEXT.ENTITY_CREATOR;
}

/**
 * Check a feature flag in a specific context.
 *
 * This is useful for entity-scoped features where the flag should be evaluated
 * against the user who created the entity (Scenario 1), while still allowing
 * user-scoped features to be evaluated against the logged-in user (Scenario 2).
 *
 * Super admin bypass is evaluated on the logged-in user (the actor), regardless
 * of the selected context.
 *
 * @param {Object} params
 * @param {Object} params.loggedInUser - Currently authenticated user
 * @param {Object} params.entityCreatorUser - User who created/owns the entity
 * @param {string} params.flagKey - Feature flag key
 * @param {string} params.context - FEATURE_FLAG_CONTEXT.* or alias
 * @param {Object} params.options - Options forwarded to hasFeatureFlag
 * @returns {boolean}
 */
function hasFeatureFlagInContext(params = {}) {
  const {
    loggedInUser,
    entityCreatorUser,
    flagKey,
    context = FEATURE_FLAG_CONTEXT.ENTITY_CREATOR,
    options = {}
  } = params;

  // Super admins bypass checks regardless of which user-context is being evaluated.
  if (options.allowSuperAdmin !== false && loggedInUser && (loggedInUser.role === 'super_admin' || loggedInUser.isSuperAdmin)) {
    return true;
  }

  const normalizedContext = normalizeFeatureFlagContext(context);

  if (normalizedContext === FEATURE_FLAG_CONTEXT.LOGGED_IN_USER) {
    return hasFeatureFlag(loggedInUser, flagKey, options);
  }

  // Creator-context: if creator user not provided, fail closed.
  return hasFeatureFlag(entityCreatorUser, flagKey, options);
}

/**
 * Known feature flags registry
 * Add new flags here with their default configuration
 */
const FEATURE_FLAGS = {
  // AI Features - requires explicit enablement
  AI_FEATURES: {
    key: 'ai_features',
    description: 'Access to AI-powered features (autocomplete, improve, translate)',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'premium'
  },

  // Beta UI Features
  BETA_UI: {
    key: 'beta_ui',
    description: 'Access to beta user interface features',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'beta'
  },

  // Advanced Analytics
  ADVANCED_ANALYTICS: {
    key: 'advanced_analytics',
    description: 'Access to advanced analytics and insights',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'premium'
  },

  // Collaboration Features
  REAL_TIME_COLLABORATION: {
    key: 'real_time_collaboration',
    description: 'Real-time collaboration via WebSocket',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'premium'
  },

  // Document Processing
  DOCUMENT_AI_PARSING: {
    key: 'document_ai_parsing',
    description: 'AI-powered document parsing and extraction',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'premium'
  },

  // Export Features
  BULK_EXPORT: {
    key: 'bulk_export',
    description: 'Bulk export of plans and experiences',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'premium'
  },

  // Curator Features - Curated experience creators
  CURATOR: {
    key: 'curator',
    description: 'Curator designation for creating curated experiences',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'curator'
  },

  // Stream Chat (messaging)
  STREAM_CHAT: {
    key: 'stream_chat',
    description: 'In-app messaging powered by Stream Chat',
    defaultEnabled: false,
    requiresAuth: true,
    tier: 'beta'
  }
};

/**
 * Global feature flags (not user-specific)
 * These can be toggled via environment variables
 */
const GLOBAL_FLAGS = {
  MAINTENANCE_MODE: process.env.FEATURE_MAINTENANCE_MODE === 'true',
  NEW_USER_REGISTRATION: process.env.FEATURE_NEW_USER_REGISTRATION !== 'false',
  PUBLIC_API: process.env.FEATURE_PUBLIC_API === 'true'
};

/**
 * Check if a user has a specific feature flag enabled
 *
 * @param {Object} user - User object with feature_flags array
 * @param {string} flagKey - Feature flag key to check
 * @param {Object} options - Additional options
 * @param {boolean} options.checkExpiry - Whether to check flag expiration (default: true)
 * @param {boolean} options.allowSuperAdmin - Super admins bypass flag checks (default: true)
 * @returns {boolean} Whether the flag is enabled for the user
 */
function hasFeatureFlag(user, flagKey, options = {}) {
  const { checkExpiry = true, allowSuperAdmin = true } = options;

  // Super admins have access to all features by default
  if (allowSuperAdmin && user && (user.role === 'super_admin' || user.isSuperAdmin)) {
    return true;
  }

  if (!user || !user.feature_flags || !Array.isArray(user.feature_flags)) {
    return false;
  }

  const normalizedKey = flagKey.toLowerCase();
  const flag = user.feature_flags.find(f => f.flag === normalizedKey);

  if (!flag) {
    return false;
  }

  // Check if flag is enabled
  if (!flag.enabled) {
    return false;
  }

  // Check expiration if applicable
  if (checkExpiry && flag.expires_at) {
    if (new Date(flag.expires_at) < new Date()) {
      logger.debug('Feature flag expired', { userId: user._id, flag: flagKey });
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
 * @returns {Object|null} Flag configuration or null if not found
 */
function getFeatureFlagConfig(user, flagKey) {
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
 * @param {Object} options - Options
 * @param {boolean} options.includeExpired - Include expired flags (default: false)
 * @returns {Array<Object>} Array of active feature flags
 */
function getUserFeatureFlags(user, options = {}) {
  const { includeExpired = false } = options;

  if (!user || !user.feature_flags || !Array.isArray(user.feature_flags)) {
    return [];
  }

  const now = new Date();

  return user.feature_flags.filter(flag => {
    if (!flag.enabled) return false;
    if (!includeExpired && flag.expires_at && new Date(flag.expires_at) < now) {
      return false;
    }
    return true;
  }).map(flag => ({
    flag: flag.flag,
    enabled: flag.enabled,
    config: flag.config || {},
    expires_at: flag.expires_at,
    granted_at: flag.granted_at
  }));
}

/**
 * Add a feature flag to a user
 *
 * @param {Object} user - User document (mongoose)
 * @param {string} flagKey - Feature flag key
 * @param {Object} options - Flag options
 * @param {Object} options.config - Flag configuration
 * @param {Date} options.expires_at - Expiration date
 * @param {string} options.granted_by - Admin user ID who granted the flag
 * @param {string} options.reason - Reason for granting
 * @returns {Promise<Object>} Updated user
 */
async function addFeatureFlag(user, flagKey, options = {}) {
  const normalizedKey = flagKey.toLowerCase();

  // Check if flag already exists
  const existingIndex = user.feature_flags.findIndex(f => f.flag === normalizedKey);

  const flagData = {
    flag: normalizedKey,
    enabled: true,
    config: options.config || {},
    granted_at: new Date(),
    granted_by: options.granted_by || null,
    expires_at: options.expires_at || null,
    reason: options.reason || null
  };

  if (existingIndex >= 0) {
    // Update existing flag
    user.feature_flags[existingIndex] = {
      ...user.feature_flags[existingIndex],
      ...flagData,
      _id: user.feature_flags[existingIndex]._id
    };
  } else {
    // Add new flag
    user.feature_flags.push(flagData);
  }

  await user.save();

  logger.info('Feature flag added', {
    userId: user._id,
    flag: normalizedKey,
    grantedBy: options.granted_by
  });

  return user;
}

/**
 * Remove a feature flag from a user
 *
 * @param {Object} user - User document (mongoose)
 * @param {string} flagKey - Feature flag key
 * @param {Object} options - Options
 * @param {string} options.removed_by - Admin user ID who removed the flag
 * @param {string} options.reason - Reason for removal
 * @returns {Promise<Object>} Updated user
 */
async function removeFeatureFlag(user, flagKey, options = {}) {
  const normalizedKey = flagKey.toLowerCase();

  const initialLength = user.feature_flags.length;
  user.feature_flags = user.feature_flags.filter(f => f.flag !== normalizedKey);

  if (user.feature_flags.length < initialLength) {
    await user.save();

    logger.info('Feature flag removed', {
      userId: user._id,
      flag: normalizedKey,
      removedBy: options.removed_by,
      reason: options.reason
    });
  }

  return user;
}

/**
 * Disable a feature flag without removing it (preserves history)
 *
 * @param {Object} user - User document (mongoose)
 * @param {string} flagKey - Feature flag key
 * @returns {Promise<Object>} Updated user
 */
async function disableFeatureFlag(user, flagKey) {
  const normalizedKey = flagKey.toLowerCase();

  const flag = user.feature_flags.find(f => f.flag === normalizedKey);
  if (flag) {
    flag.enabled = false;
    await user.save();

    logger.info('Feature flag disabled', {
      userId: user._id,
      flag: normalizedKey
    });
  }

  return user;
}

/**
 * Check a global feature flag
 *
 * @param {string} flagKey - Global flag key
 * @returns {boolean} Whether the global flag is enabled
 */
function hasGlobalFlag(flagKey) {
  return GLOBAL_FLAGS[flagKey] === true;
}

/**
 * Get feature flag metadata from registry
 *
 * @param {string} flagKey - Feature flag key
 * @returns {Object|null} Flag metadata or null if not found
 */
function getFlagMetadata(flagKey) {
  const upperKey = flagKey.toUpperCase();
  return FEATURE_FLAGS[upperKey] || null;
}

/**
 * Get all registered feature flags
 *
 * @returns {Object} All feature flags metadata
 */
function getAllFlags() {
  return { ...FEATURE_FLAGS };
}

/**
 * Create a response object for feature flag denial
 *
 * @param {string} flagKey - Feature flag that was checked
 * @param {Object} options - Options
 * @param {string} options.message - Custom message
 * @returns {Object} Error response object
 */
function createFlagDenialResponse(flagKey, options = {}) {
  const metadata = getFlagMetadata(flagKey);
  const defaultMessage = metadata
    ? `This feature requires the "${metadata.description}" to be enabled for your account.`
    : `This feature requires the "${flagKey}" feature flag to be enabled.`;

  return {
    success: false,
    error: 'Feature not available',
    code: 'FEATURE_FLAG_REQUIRED',
    flag: flagKey,
    message: options.message || defaultMessage,
    tier: metadata?.tier || 'premium'
  };
}

// Export constants and functions
module.exports = {
  // Constants
  FEATURE_FLAGS,
  GLOBAL_FLAGS,
  FEATURE_FLAG_CONTEXT,

  // User flag functions
  hasFeatureFlag,
  hasFeatureFlagInContext,
  getFeatureFlagConfig,
  getUserFeatureFlags,
  addFeatureFlag,
  removeFeatureFlag,
  disableFeatureFlag,

  // Global flag functions
  hasGlobalFlag,

  // Utility functions
  getFlagMetadata,
  getAllFlags,
  createFlagDenialResponse
};
