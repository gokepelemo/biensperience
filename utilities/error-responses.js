/**
 * Standardized Error Response Utilities
 *
 * Provides consistent error response formatting across API endpoints
 * with human-readable messages and actionable suggestions for the frontend.
 */

/**
 * Error Codes - Standardized error identifiers
 */
const ERROR_CODES = {
  // Authentication & Authorization
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  NOT_OWNER: 'NOT_OWNER',
  NOT_COLLABORATOR: 'NOT_COLLABORATOR',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  API_ACCESS_DISABLED: 'API_ACCESS_DISABLED',

  // Resource Errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_DELETED: 'RESOURCE_DELETED',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',

  // Validation Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
};

/**
 * Action Types - Types of actions users can take
 */
const ACTION_TYPES = {
  RESEND_VERIFICATION: 'resend_verification',
  REQUEST_ACCESS: 'request_access',
  CONTACT_SUPPORT: 'contact_support',
  LOGIN: 'login',
  RETRY: 'retry',
  GO_BACK: 'go_back',
  NAVIGATE: 'navigate',
};

/**
 * Create a standardized error response
 *
 * @param {Object} options - Error response options
 * @param {string} options.code - Error code from ERROR_CODES
 * @param {string} options.message - Technical error message (for logging)
 * @param {string} options.userMessage - User-friendly error message
 * @param {number} options.status - HTTP status code (default: 500)
 * @param {Object} [options.action] - Optional action suggestion
 * @param {string} options.action.type - Action type from ACTION_TYPES
 * @param {string} options.action.label - Button label for action
 * @param {string} [options.action.url] - URL for action (if applicable)
 * @param {Object} [options.metadata] - Additional error metadata
 * @returns {Object} - Standardized error response
 */
function createErrorResponse({
  code,
  message,
  userMessage,
  status = 500,
  action = null,
  metadata = {}
}) {
  return {
    success: false,
    error: {
      code,
      message,
      userMessage,
      action,
      metadata,
      timestamp: new Date().toISOString()
    },
    status
  };
}

/**
 * Common Error Response Generators
 */

/**
 * Email not verified error
 */
function emailNotVerifiedError(email) {
  return createErrorResponse({
    code: ERROR_CODES.EMAIL_NOT_VERIFIED,
    message: `Email verification required for ${email}`,
    userMessage: 'Please verify your email address to create content',
    status: 403,
    action: {
      type: ACTION_TYPES.RESEND_VERIFICATION,
      label: 'Resend Verification Email',
      url: '/resend-confirmation'
    },
    metadata: { email }
  });
}

/**
 * Insufficient permissions error
 *
 * @param {string} required - Required permission level (owner, collaborator, etc.)
 * @param {string} current - Current user's permission level
 */
function insufficientPermissionsError(required, current = 'none', context = {}) {
  const actionMetadata = {};
  if (context.resourceType) actionMetadata.resourceType = context.resourceType;
  if (context.resourceId) actionMetadata.resourceId = context.resourceId;

  return createErrorResponse({
    code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    message: `Insufficient permissions: required ${required}, have ${current}`,
    userMessage: `You need ${required} permissions to perform this action`,
    status: 403,
    action: {
      type: ACTION_TYPES.REQUEST_ACCESS,
      label: 'Request Access',
      ...(Object.keys(actionMetadata).length > 0 ? { metadata: actionMetadata } : {})
    },
    metadata: { required, current, ...context }
  });
}

/**
 * Not owner error
 *
 * @param {string} resourceType - Type of resource (experience, destination, plan)
 * @param {string} resourceId - ID of the resource
 */
function notOwnerError(resourceType, resourceId) {
  return createErrorResponse({
    code: ERROR_CODES.NOT_OWNER,
    message: `User is not the owner of ${resourceType} ${resourceId}`,
    userMessage: `Only the ${resourceType} owner can perform this action`,
    status: 403,
    action: {
      type: ACTION_TYPES.REQUEST_ACCESS,
      label: 'Request Owner Access'
    },
    metadata: { resourceType, resourceId }
  });
}

/**
 * Not collaborator error
 *
 * @param {string} resourceType - Type of resource (experience, destination, plan)
 * @param {string} resourceId - ID of the resource
 */
function notCollaboratorError(resourceType, resourceId) {
  return createErrorResponse({
    code: ERROR_CODES.NOT_COLLABORATOR,
    message: `User is not a collaborator on ${resourceType} ${resourceId}`,
    userMessage: `You must be a collaborator to edit this ${resourceType}`,
    status: 403,
    action: {
      type: ACTION_TYPES.REQUEST_ACCESS,
      label: 'Request Collaborator Access'
    },
    metadata: { resourceType, resourceId }
  });
}

/**
 * Not authenticated error
 */
function notAuthenticatedError() {
  return createErrorResponse({
    code: ERROR_CODES.NOT_AUTHENTICATED,
    message: 'Authentication required',
    userMessage: 'Please log in to continue',
    status: 401,
    action: {
      type: ACTION_TYPES.LOGIN,
      label: 'Log In',
      url: '/login'
    }
  });
}

/**
 * Invalid or expired token error
 */
function invalidTokenError() {
  return createErrorResponse({
    code: ERROR_CODES.INVALID_TOKEN,
    message: 'Invalid or expired authentication token',
    userMessage: 'Your session has expired. Please log in again.',
    status: 401,
    action: {
      type: ACTION_TYPES.LOGIN,
      label: 'Log In',
      url: '/login'
    }
  });
}

/**
 * Account locked error
 */
function accountLockedError(reason = 'Security violation') {
  return createErrorResponse({
    code: ERROR_CODES.ACCOUNT_LOCKED,
    message: `Account locked: ${reason}`,
    userMessage: 'Your account has been locked. Please contact support.',
    status: 403,
    action: {
      type: ACTION_TYPES.CONTACT_SUPPORT,
      label: 'Contact Support',
      url: '/support'
    },
    metadata: { reason }
  });
}

/**
 * API access disabled error
 */
function apiAccessDisabledError() {
  return createErrorResponse({
    code: ERROR_CODES.API_ACCESS_DISABLED,
    message: 'API access is disabled for this account',
    userMessage: 'API access is disabled for your account. Please enable it in your profile settings.',
    status: 403,
    action: {
      type: ACTION_TYPES.NAVIGATE,
      label: 'Open Settings',
      url: '/profile'
    }
  });
}

/**
 * Resource not found error
 *
 * @param {string} resourceType - Type of resource (experience, destination, plan, user)
 * @param {string} resourceId - ID of the resource
 */
function resourceNotFoundError(resourceType, resourceId) {
  return createErrorResponse({
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message: `${resourceType} not found: ${resourceId}`,
    userMessage: `The ${resourceType} you're looking for doesn't exist`,
    status: 404,
    action: {
      type: ACTION_TYPES.GO_BACK,
      label: 'Go Back'
    },
    metadata: { resourceType, resourceId }
  });
}

/**
 * Validation error
 *
 * @param {Object} validationErrors - Object containing field-level validation errors
 */
function validationError(validationErrors) {
  return createErrorResponse({
    code: ERROR_CODES.VALIDATION_ERROR,
    message: 'Validation failed',
    userMessage: 'Please check your input and try again',
    status: 422,
    metadata: { validationErrors }
  });
}

/**
 * Rate limit exceeded error
 *
 * @param {number} retryAfter - Seconds until retry is allowed
 */
function rateLimitError(retryAfter) {
  return createErrorResponse({
    code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    message: `Rate limit exceeded. Retry after ${retryAfter}s`,
    userMessage: 'Too many requests. Please try again in a moment.',
    status: 429,
    action: {
      type: ACTION_TYPES.RETRY,
      label: 'Retry'
    },
    metadata: { retryAfter }
  });
}

/**
 * Internal server error
 */
function internalServerError() {
  return createErrorResponse({
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Internal server error',
    userMessage: 'Something went wrong. Please try again later.',
    status: 500,
    action: {
      type: ACTION_TYPES.RETRY,
      label: 'Try Again'
    }
  });
}

/**
 * Send error response to client
 *
 * @param {Object} res - Express response object
 * @param {Object} errorResponse - Error response from createErrorResponse
 */
function sendErrorResponse(res, errorResponse) {
  res.status(errorResponse.status).json(errorResponse);
}

module.exports = {
  ERROR_CODES,
  ACTION_TYPES,
  createErrorResponse,

  // Common error generators
  emailNotVerifiedError,
  insufficientPermissionsError,
  notOwnerError,
  notCollaboratorError,
  notAuthenticatedError,
  invalidTokenError,
  accountLockedError,
  apiAccessDisabledError,
  resourceNotFoundError,
  validationError,
  rateLimitError,
  internalServerError,

  // Utility
  sendErrorResponse
};
