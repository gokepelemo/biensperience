/**
 * Express middleware for automatic API event logging
 * Logs all API requests with timing, status codes, and user context
 *
 * @module api-logging-middleware
 */

const backendLogger = require('../utilities/backend-logger');

/**
 * Middleware to log API events
 * Records request start time and logs completion on response finish
 */
function apiLoggingMiddleware(req, res, next) {
  const startTime = Date.now();

  // Store start time on request for access in error handlers
  req.startTime = startTime;

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    backendLogger.apiEvent(req, res, duration);
  });

  // Log when response has an error
  res.on('error', (error) => {
    const duration = Date.now() - startTime;
    backendLogger.apiEvent(req, res, duration, error);
  });

  next();
}

module.exports = apiLoggingMiddleware;