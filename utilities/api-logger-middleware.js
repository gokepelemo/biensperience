/**
 * API logging middleware for Biensperience
 * Logs API events asynchronously and non-blockingly
 *
 * @module api-logger-middleware
 */

const logger = require('../utilities/logger');

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
    logger.apiEvent(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      {
        userId: req.user?._id,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
      }
    );

    // Call original end method
    originalEnd.apply(this, args);
  };

  next();
}

module.exports = apiLogger;