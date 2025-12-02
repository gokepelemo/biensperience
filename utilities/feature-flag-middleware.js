/**
 * Feature Flag Middleware
 *
 * Express middleware for enforcing feature flags on API endpoints.
 * Provides route-level and controller-level access control.
 *
 * @module utilities/feature-flag-middleware
 */

const logger = require('./backend-logger');
const {
  hasFeatureFlag,
  getFeatureFlagConfig,
  hasGlobalFlag,
  createFlagDenialResponse,
  FEATURE_FLAGS
} = require('./feature-flags');

/**
 * Middleware to require a specific feature flag
 *
 * @param {string} flagKey - Feature flag key to require
 * @param {Object} options - Middleware options
 * @param {boolean} options.allowSuperAdmin - Super admins bypass check (default: true)
 * @param {string} options.message - Custom denial message
 * @param {Function} options.onDenied - Custom handler when access is denied
 * @returns {Function} Express middleware
 *
 * @example
 * router.post('/ai/complete', requireFeatureFlag('ai_features'), controller.complete);
 */
function requireFeatureFlag(flagKey, options = {}) {
  const { allowSuperAdmin = true, message, onDenied } = options;

  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        logger.warn('Feature flag check failed - no authenticated user', { flag: flagKey, path: req.path });
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check feature flag
      const hasFlag = hasFeatureFlag(req.user, flagKey, { allowSuperAdmin });

      if (!hasFlag) {
        logger.info('Feature flag access denied', {
          userId: req.user._id,
          flag: flagKey,
          path: req.path,
          method: req.method
        });

        // Call custom handler if provided
        if (typeof onDenied === 'function') {
          return onDenied(req, res, next, flagKey);
        }

        const response = createFlagDenialResponse(flagKey, { message });
        return res.status(403).json(response);
      }

      // Attach flag config to request for use in controller
      req.featureFlagConfig = getFeatureFlagConfig(req.user, flagKey);

      logger.debug('Feature flag access granted', {
        userId: req.user._id,
        flag: flagKey,
        path: req.path
      });

      next();
    } catch (error) {
      logger.error('Feature flag middleware error', { error: error.message, flag: flagKey });
      next(error);
    }
  };
}

/**
 * Middleware to require ANY of the specified feature flags
 *
 * @param {Array<string>} flagKeys - Array of feature flag keys (any must match)
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/insights', requireAnyFeatureFlag(['ai_features', 'advanced_analytics']), controller.insights);
 */
function requireAnyFeatureFlag(flagKeys, options = {}) {
  const { allowSuperAdmin = true, message } = options;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check if user has any of the required flags
      const hasAnyFlag = flagKeys.some(flagKey =>
        hasFeatureFlag(req.user, flagKey, { allowSuperAdmin })
      );

      if (!hasAnyFlag) {
        logger.info('Feature flag access denied (none matched)', {
          userId: req.user._id,
          flags: flagKeys,
          path: req.path
        });

        return res.status(403).json({
          success: false,
          error: 'Feature not available',
          code: 'FEATURE_FLAG_REQUIRED',
          flags: flagKeys,
          message: message || `This feature requires one of the following flags: ${flagKeys.join(', ')}`
        });
      }

      next();
    } catch (error) {
      logger.error('Feature flag middleware error', { error: error.message, flags: flagKeys });
      next(error);
    }
  };
}

/**
 * Middleware to require ALL of the specified feature flags
 *
 * @param {Array<string>} flagKeys - Array of feature flag keys (all must match)
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function requireAllFeatureFlags(flagKeys, options = {}) {
  const { allowSuperAdmin = true, message } = options;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Check if user has all required flags
      const missingFlags = flagKeys.filter(flagKey =>
        !hasFeatureFlag(req.user, flagKey, { allowSuperAdmin })
      );

      if (missingFlags.length > 0) {
        logger.info('Feature flag access denied (missing flags)', {
          userId: req.user._id,
          missingFlags,
          path: req.path
        });

        return res.status(403).json({
          success: false,
          error: 'Feature not available',
          code: 'FEATURE_FLAG_REQUIRED',
          missingFlags,
          message: message || `This feature requires the following flags: ${missingFlags.join(', ')}`
        });
      }

      next();
    } catch (error) {
      logger.error('Feature flag middleware error', { error: error.message, flags: flagKeys });
      next(error);
    }
  };
}

/**
 * Middleware to check global feature flag
 *
 * @param {string} flagKey - Global flag key
 * @param {Object} options - Options
 * @param {string} options.message - Custom message when flag is disabled
 * @returns {Function} Express middleware
 */
function requireGlobalFlag(flagKey, options = {}) {
  const { message } = options;

  return (req, res, next) => {
    if (!hasGlobalFlag(flagKey)) {
      logger.info('Global feature flag disabled', { flag: flagKey, path: req.path });

      return res.status(503).json({
        success: false,
        error: 'Feature temporarily unavailable',
        code: 'GLOBAL_FLAG_DISABLED',
        flag: flagKey,
        message: message || 'This feature is currently unavailable.'
      });
    }

    next();
  };
}

/**
 * Middleware that blocks requests when maintenance mode is enabled
 *
 * @param {Object} options - Options
 * @param {Array<string>} options.allowedPaths - Paths to allow during maintenance
 * @returns {Function} Express middleware
 */
function maintenanceMode(options = {}) {
  const { allowedPaths = ['/api/health-check', '/api/auth/logout'] } = options;

  return (req, res, next) => {
    if (hasGlobalFlag('MAINTENANCE_MODE')) {
      // Allow certain paths during maintenance
      if (allowedPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Allow super admins during maintenance
      if (req.user && (req.user.role === 'super_admin' || req.user.isSuperAdmin)) {
        return next();
      }

      logger.info('Request blocked - maintenance mode', { path: req.path, ip: req.ip });

      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable',
        code: 'MAINTENANCE_MODE',
        message: 'The service is currently undergoing maintenance. Please try again later.'
      });
    }

    next();
  };
}

/**
 * Utility to conditionally apply middleware based on feature flag
 *
 * @param {string} flagKey - Feature flag to check
 * @param {Function} middleware - Middleware to apply if flag is enabled
 * @param {Function} fallback - Optional fallback middleware if flag is disabled
 * @returns {Function} Express middleware
 *
 * @example
 * // Apply rate limiting only for users without premium flag
 * router.use(conditionalMiddleware('premium_user', bypassRateLimit, applyRateLimit));
 */
function conditionalMiddleware(flagKey, middleware, fallback = null) {
  return (req, res, next) => {
    const hasFlag = req.user && hasFeatureFlag(req.user, flagKey);

    if (hasFlag) {
      return middleware(req, res, next);
    }

    if (fallback) {
      return fallback(req, res, next);
    }

    next();
  };
}

/**
 * Helper to wrap async controller with feature flag check
 *
 * @param {string} flagKey - Feature flag key
 * @param {Function} controller - Async controller function
 * @param {Object} options - Options
 * @returns {Function} Wrapped controller
 *
 * @example
 * exports.aiComplete = withFeatureFlag('ai_features', async (req, res) => {
 *   // Controller logic here
 * });
 */
function withFeatureFlag(flagKey, controller, options = {}) {
  return async (req, res, next) => {
    const { allowSuperAdmin = true } = options;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!hasFeatureFlag(req.user, flagKey, { allowSuperAdmin })) {
      const response = createFlagDenialResponse(flagKey);
      return res.status(403).json(response);
    }

    // Attach config and proceed
    req.featureFlagConfig = getFeatureFlagConfig(req.user, flagKey);

    try {
      await controller(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Create a feature flag checker for use in controllers
 *
 * @returns {Object} Object with check methods
 */
function createFlagChecker() {
  return {
    /**
     * Check flag and return result object
     */
    check(user, flagKey, options = {}) {
      const hasFlag = hasFeatureFlag(user, flagKey, options);
      return {
        allowed: hasFlag,
        config: hasFlag ? getFeatureFlagConfig(user, flagKey) : null,
        denial: hasFlag ? null : createFlagDenialResponse(flagKey)
      };
    },

    /**
     * Throw error if flag not present
     */
    require(user, flagKey, options = {}) {
      if (!hasFeatureFlag(user, flagKey, options)) {
        const error = new Error(`Feature flag required: ${flagKey}`);
        error.code = 'FEATURE_FLAG_REQUIRED';
        error.status = 403;
        error.flag = flagKey;
        throw error;
      }
      return getFeatureFlagConfig(user, flagKey);
    }
  };
}

module.exports = {
  requireFeatureFlag,
  requireAnyFeatureFlag,
  requireAllFeatureFlags,
  requireGlobalFlag,
  maintenanceMode,
  conditionalMiddleware,
  withFeatureFlag,
  createFlagChecker
};
