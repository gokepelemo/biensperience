/**
 * API logging middleware for Biensperience
 * Logs API events asynchronously and non-blockingly
 *
 * @module api-logger-middleware
 */

const backendLogger = require('../utilities/backend-logger');

/**
 * Middleware to log API events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function apiLogger(req, res, next) {
  const startTime = Date.now();

  // Store original end method
  const originalEnd = res.end;

  // Override end method to log after response is sent
  res.end = function(...args) {
    const duration = Date.now() - startTime;

    // Log API event asynchronously (fire-and-forget)
    // NOTE: Request body intentionally NOT logged to prevent password/token exposure
    backendLogger.apiEvent(req, res, duration);

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
}

module.exports = apiLogger;