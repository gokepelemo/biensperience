/**
 * Trace ID Middleware
 * 
 * Manages trace IDs for distributed request tracking across microservices.
 * Each request gets a unique trace ID (bien-trace-id) for logging and debugging.
 * 
 * @module trace-middleware
 */

const { v4: uuidv4 } = require('uuid');
const backendLogger = require('../utilities/backend-logger');

// Constants
const TRACE_ID_HEADER = 'bien-trace-id';

/**
 * Generate a new trace ID
 * @returns {string} New trace ID in UUID format
 */
function generateTraceId() {
  return uuidv4();
}

/**
 * Extract trace ID from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} Trace ID or null
 */
function extractTraceId(req) {
  return req.headers[TRACE_ID_HEADER] || req.headers[TRACE_ID_HEADER.toLowerCase()] || null;
}

/**
 * Middleware: Extract or generate trace ID and attach to request
 * If trace ID not provided in headers, generates a new one
 * Always attaches trace ID to req.traceId for use in logging
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function attachTraceId(req, res, next) {
  let traceId = extractTraceId(req);
  
  if (!traceId) {
    // Generate new trace ID if not provided (backward compatibility)
    traceId = generateTraceId();
    backendLogger.debug('Generated new trace ID for request', {
      traceId,
      path: req.path
    });
  } else {
    backendLogger.debug('Extracted trace ID from request headers', {
      traceId,
      path: req.path
    });
  }

  // Attach to request for use in controllers and logging
  req.traceId = traceId;
  
  next();
}

/**
 * Middleware: Add trace ID to response headers
 * Ensures trace ID is returned to client for request correlation
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function addTraceIdToResponse(req, res, next) {
  if (req.traceId) {
    res.setHeader(TRACE_ID_HEADER, req.traceId);
  }
  
  // Intercept res.json to ensure headers are set before sending
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (req.traceId) {
      res.setHeader(TRACE_ID_HEADER, req.traceId);
    }
    return originalJson(data);
  };
  
  next();
}

module.exports = {
  attachTraceId,
  addTraceIdToResponse,
  generateTraceId,
  TRACE_ID_HEADER
};
