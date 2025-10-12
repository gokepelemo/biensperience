/**
 * Shared utility functions for API controllers
 * Provides validation, authorization, and error handling helpers
 * @module controller-helpers
 */

const mongoose = require('mongoose');

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
  return {
    valid: true,
    error: null,
    objectId: new mongoose.Types.ObjectId(id)
  };
}

/**
 * Check if the authenticated user is authorized to modify a resource
 * @param {Object} user - The authenticated user (from req.user)
 * @param {Object} resource - The resource with a user field
 * @returns {boolean} - True if authorized
 */
function isAuthorized(user, resource) {
  if (!user || !resource || !resource.user) {
    return false;
  }
  return user._id.toString() === resource.user._id.toString();
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string' || email.length > 254 || email.length < 3) {
    return { valid: false, error: 'Invalid email format' };
  }

  const hasAt = email.includes('@');
  const hasDot = email.includes('.');
  const atPosition = email.indexOf('@');
  const lastDotPosition = email.lastIndexOf('.');

  if (!hasAt || !hasDot || atPosition < 1 || lastDotPosition < atPosition + 2 || lastDotPosition >= email.length - 1) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true, error: null };
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {number} minLength - Minimum password length (default: 3)
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validatePassword(password, minLength = 3) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < minLength) {
    return { valid: false, error: `Password must be at least ${minLength} characters long` };
  }

  return { valid: true, error: null };
}

/**
 * Sanitize user data by removing sensitive fields
 * @param {Object} user - User object
 * @returns {Object} - Sanitized user object
 */
function sanitizeUser(user) {
  if (!user) return null;
  
  const sanitized = { ...user };
  delete sanitized.password;
  
  // If it's a Mongoose document, convert to object first
  if (user.toObject) {
    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
  }
  
  return sanitized;
}

/**
 * Validate array index for splice operations
 * @param {number} index - Index to validate
 * @param {Array} array - Array to check against
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateArrayIndex(index, array) {
  const parsedIndex = parseInt(index);
  
  if (isNaN(parsedIndex)) {
    return { valid: false, error: 'Invalid index format' };
  }
  
  if (parsedIndex < 0 || parsedIndex >= array.length) {
    return { valid: false, error: 'Index out of bounds' };
  }
  
  return { valid: true, error: null, index: parsedIndex };
}

/**
 * Create consistent error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @returns {Object} - Error response object
 */
function createErrorResponse(message, statusCode = 400) {
  return {
    statusCode,
    error: message
  };
}

/**
 * Async wrapper for controller functions with automatic error handling
 * @param {Function} fn - Async controller function
 * @returns {Function} - Wrapped function with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('Controller error:', err);
      
      // Handle specific error types
      if (err.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid ID format' });
      }
      
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'Validation failed', details: err.message });
      }
      
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Duplicate entry' });
      }
      
      // Default error response
      res.status(500).json({ error: 'Internal server error' });
    });
  };
}

/**
 * Find item by ID with validation and error handling
 * @param {Object} Model - Mongoose model
 * @param {string} id - Document ID
 * @param {string} resourceName - Name of resource (for error messages)
 * @returns {Promise<Object>} - { success: boolean, data: Object|null, error: Object|null }
 */
async function findByIdWithValidation(Model, id, resourceName = 'Resource') {
  const validation = validateObjectId(id, `${resourceName} ID`);
  
  if (!validation.valid) {
    return {
      success: false,
      data: null,
      error: { statusCode: 400, message: validation.error }
    };
  }
  
  try {
    const document = await Model.findById(validation.objectId);
    
    if (!document) {
      return {
        success: false,
        data: null,
        error: { statusCode: 404, message: `${resourceName} not found` }
      };
    }
    
    return {
      success: true,
      data: document,
      error: null
    };
  } catch (err) {
    console.error(`Error finding ${resourceName}:`, err);
    return {
      success: false,
      data: null,
      error: { statusCode: 500, message: `Failed to fetch ${resourceName}` }
    };
  }
}

/**
 * Check authorization and return standardized response
 * @param {Object} req - Express request object
 * @param {Object} resource - Resource to check authorization for
 * @returns {Object|null} - Error response if not authorized, null if authorized
 */
function checkAuthorization(req, resource) {
  if (!isAuthorized(req.user, resource)) {
    return {
      statusCode: 401,
      error: 'Not authorized to access this resource'
    };
  }
  return null;
}

module.exports = {
  isValidObjectId,
  validateObjectId,
  isAuthorized,
  validateEmail,
  validatePassword,
  sanitizeUser,
  validateArrayIndex,
  createErrorResponse,
  asyncHandler,
  findByIdWithValidation,
  checkAuthorization
};
