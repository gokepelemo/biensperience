/**
 * Shared utility functions for API controllers
 * Provides validation, authorization, and error handling helpers
 * @module controller-helpers
 */

const mongoose = require('mongoose');
const backendLogger = require('./backend-logger');

/**
 * Validate if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Validate and convert ObjectId with error response
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field (for error message)
 * @returns {Object} - { valid: boolean, error: string|null, objectId: ObjectId|null }
 */
function validateObjectId(id, fieldName = 'ID') {
  if (!isValidObjectId(id)) {
    return {
      valid: false,
      error: `Invalid ${fieldName} format`,
      objectId: null
    };
  }
  // If the provided id is already an ObjectId instance, preserve it
  // Construct a new ObjectId only when we receive a string. Passing
  // an existing ObjectId into the constructor can trigger runtime
  // errors in some environments ("Class constructor ObjectId cannot
  // be invoked without 'new'").
  const objectId = (typeof id === 'string') ? new mongoose.Types.ObjectId(id) : id;

  return {
    valid: true,
    error: null,
    objectId
  };
}

/**
 * Standard success response for API controllers
 * @param {Object} res - Express response
 * @param {any} data - Payload data
 * @param {string} [message] - Optional human message
 * @param {number} [statusCode=200]
 */
function successResponse(res, data = {}, message = null, statusCode = 200, meta = null) {
  const payload = { success: true, data };
  if (message) payload.message = message;
  if (meta && typeof meta === 'object') payload.meta = meta;

  // Safely serialize payload to prevent runtime JSON errors (e.g., circular refs)
  try {
    // Use a cycle-safe replacer
    const cache = new Set();
    const json = JSON.stringify(payload, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return undefined;
        cache.add(value);
      }
      return value;
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(statusCode).send(json);
  } catch (err) {
    backendLogger.error('Failed to serialize success response', { error: err.message });
    // Fallback: send minimal response
    return res.status(500).json({ success: false, error: 'Failed to serialize response' });
  }
}

/**
 * Standard error response for API controllers
 * @param {Object} res - Express response
 * @param {Error|null} err - Error object (optional)
 * @param {string} [message] - Optional message to expose
 * @param {number} [statusCode=400]
 */
function errorResponse(res, err = null, message = 'An error occurred', statusCode = 400) {
  // Prefer explicit message, fall back to error.message
  const errorMessage = message || (err && err.message) || 'An error occurred';
  const payload = { success: false, error: errorMessage };
  // In development include sanitized details (never expose stack traces or sensitive info)
  if (process.env.NODE_ENV !== 'production' && err) {
    // Sanitize error message to prevent information leakage
    let sanitizedDetails = err.message || String(err);
    // Remove potential stack trace information and sensitive data
    sanitizedDetails = sanitizedDetails.split('\n')[0]; // Only first line
    sanitizedDetails = sanitizedDetails.replace(/\/[^\s]+/g, '[REDACTED]'); // Remove file paths
    sanitizedDetails = sanitizedDetails.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED]'); // Remove IPs
    payload.details = sanitizedDetails;
  }
  try {
    const cache = new Set();
    const json = JSON.stringify(payload, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return undefined;
        cache.add(value);
      }
      return value;
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(statusCode).send(json);
  } catch (serializeErr) {
    backendLogger.error('Failed to serialize error response', { error: serializeErr.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * Async wrapper for controller functions with automatic error handling
 * @param {Function} fn - Async controller function
 * @returns {Function} - Wrapped function with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      backendLogger.error('Controller error', { error: err.message, method: req.method, url: req.url, userId: req.user?._id });

      // Handle specific error types with standardized format
      if (err.name === 'CastError') {
        return res.status(400).json({ success: false, error: 'Invalid ID format' });
      }

      if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, error: 'Validation failed', details: err.message });
      }

      if (err.code === 11000) {
        return res.status(409).json({ success: false, error: 'Duplicate entry' });
      }

      // Default error response with standardized format
      res.status(500).json({ success: false, error: 'Internal server error' });
    });
  };
}

/**
 * Standard paginated response for API controllers
 * @param {Object} res - Express response
 * @param {Array} data - Array of items
 * @param {Object} meta - Pagination metadata { page, limit, total, totalPages, hasMore }
 * @param {string} [message] - Optional message
 * @param {number} [statusCode=200]
 */
function paginatedResponse(res, data, meta, message = null, statusCode = 200) {
  const payload = { success: true, data, meta };
  if (message) payload.message = message;
  return res.status(statusCode).json(payload);
}

module.exports = {
  isValidObjectId,
  validateObjectId,
  successResponse,
  errorResponse,
  paginatedResponse,
  asyncHandler
};
