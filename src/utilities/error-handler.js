/**
 * Error handling utilities for consistent error management across the application
 *
 * Enhanced to support structured error responses from backend with actionable
 * toast notifications and user-friendly messaging.
 */

import { logger } from './logger';

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Error code to user message mapping
 * Maps backend ERROR_CODES to frontend display messages
 */
const ERROR_MESSAGES = {
  // Authentication & Authorization
  EMAIL_NOT_VERIFIED: 'Please verify your email address to continue',
  INSUFFICIENT_PERMISSIONS: 'You don\'t have permission to perform this action',
  NOT_OWNER: 'Only the owner can perform this action',
  NOT_COLLABORATOR: 'You must be a collaborator to edit this resource',
  NOT_AUTHENTICATED: 'Please log in to continue',
  INVALID_TOKEN: 'Your session has expired. Please log in again.',
  EXPIRED_TOKEN: 'Your session has expired. Please log in again.',
  ACCOUNT_LOCKED: 'Your account has been locked. Please contact support.',
  API_ACCESS_DISABLED: 'API access is disabled. Please enable it in your profile settings.',

  // Resource Errors
  RESOURCE_NOT_FOUND: 'The requested resource was not found',
  RESOURCE_DELETED: 'This resource has been deleted',
  DUPLICATE_RESOURCE: 'This resource already exists',

  // Validation Errors
  VALIDATION_ERROR: 'Please check your input and try again',
  INVALID_INPUT: 'The provided input is invalid',
  MISSING_REQUIRED_FIELD: 'Please fill in all required fields',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again in a moment.',

  // Server Errors
  INTERNAL_ERROR: 'Something went wrong. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
};

/**
 * Handles API errors and returns a user-friendly error message
 * @param {Error} error - The error object
 * @param {string} defaultMessage - Default message if error is unknown
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(error, defaultMessage = 'An unexpected error occurred') {
  if (error instanceof APIError) {
    return error.message;
  }

  if (error.message === 'Bad Request') {
    return 'The request could not be processed. Please check your input and try again.';
  }

  if (error.message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  return defaultMessage;
}

/**
 * Wraps an async function with error handling
 * @param {Function} fn - The async function to wrap
 * @param {Function} onError - Error callback (optional)
 * @returns {Function} Wrapped function
 */
export function withErrorHandling(fn, onError) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      if (onError) {
        onError(errorMessage, error);
      }

      throw error;
    }
  };
}

/**
 * Handles errors with optional toast/alert notification
 * @param {Error} error - The error object
 * @param {Object} options - Options for error handling
 * @param {string} options.context - Context of where the error occurred
 * @param {Function} options.onError - Callback to handle the error
 * @param {boolean} options.silent - If true, don't show any UI feedback
 */
export function handleError(error, options = {}) {
  const { context = 'Operation', onError, silent = false } = options;

  // If server returned EMAIL_NOT_VERIFIED, return a structured object so callers
  // (and the toast system) can display a resend button
  if (error && error.response && error.response.data && error.response.data.code === 'EMAIL_NOT_VERIFIED') {
    const message = error.response.data.error || `${context} failed: Please verify your email address.`;
    const email = error.response.data.email || null;
    const payload = { __emailNotVerified: true, message, email };

    if (!silent && onError) {
      onError(message, error);
    }

    return payload;
  }

  const errorMessage = getErrorMessage(error, `${context} failed`);

  if (!silent && onError) {
    onError(errorMessage, error);
  }

  // Return the error message for use in components
  return errorMessage;
}

/**
 * Creates a safe async handler that catches errors and prevents unhandled rejections
 * @param {Function} handler - Async function to make safe
 * @param {Function} errorCallback - Optional error callback
 * @returns {Function} Safe handler function
 */
export function createSafeHandler(handler, errorCallback) {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      if (errorCallback) {
        errorCallback(error);
      }
      // Error is caught and handled, preventing unhandled rejection
    }
  };
}

/**
 * Get user-friendly message from error code
 * @param {string} code - Error code from backend
 * @returns {string} - User-friendly message
 */
export function getMessageFromCode(code) {
  return ERROR_MESSAGES[code] || 'An error occurred. Please try again.';
}

/**
 * Create toast configuration from structured error response
 *
 * @param {Object} error - Error object from API response
 * @param {string} error.code - Error code
 * @param {string} error.userMessage - User-friendly message from backend
 * @param {Object} error.action - Optional action configuration
 * @param {string} error.action.type - Action type
 * @param {string} error.action.label - Button label
 * @param {string} error.action.url - Action URL (if applicable)
 * @returns {Object} - Toast configuration object
 */
export function createToastConfig(error) {
  // Default to error type toast
  const config = {
    type: 'error',
    message: error.userMessage || getMessageFromCode(error.code),
    duration: 8000, // 8 seconds for error messages
    showCloseButton: true
  };

  // Add action buttons if available
  if (error.action) {
    config.actions = [createActionButton(error.action)];
  }

  return config;
}

/**
 * Create action button configuration from error action
 *
 * @param {Object} action - Action configuration from error response
 * @param {string} action.type - Action type (resend_verification, login, etc.)
 * @param {string} action.label - Button label
 * @param {string} action.url - Action URL (if applicable)
 * @returns {Object} - Action button configuration for Toast component
 */
export function createActionButton(action) {
  return {
    label: action.label,
    variant: 'light',
    onClick: () => handleActionClick(action)
  };
}

/**
 * Handle action button click
 *
 * @param {Object} action - Action configuration
 * @param {string} action.type - Action type
 * @param {string} action.url - Action URL (if applicable)
 */
export function handleActionClick(action) {
  switch (action.type) {
    case 'resend_verification':
      // Navigate to resend confirmation page
      if (action.url) {
        window.location.href = action.url;
      }
      break;

    case 'login':
      // Navigate to login page
      if (action.url) {
        window.location.href = action.url;
      } else {
        window.location.href = '/login';
      }
      break;

    case 'request_access':
      // Future: Open request access modal
      console.info('Request access clicked - future implementation');
      break;

    case 'contact_support':
      // Navigate to support page
      if (action.url) {
        window.location.href = action.url;
      } else {
        window.location.href = '/support';
      }
      break;

    case 'retry':
      // Reload the page to retry
      window.location.reload();
      break;

    case 'go_back':
      // Go back in browser history
      window.history.back();
      break;

    case 'navigate':
      // Navigate to specified URL
      if (action.url) {
        window.location.href = action.url;
      }
      break;

    default:
      logger.warn('Unknown action type:', { actionType: action.type });
  }
}

/**
 * Handle structured API error response and show toast
 *
 * @param {Object} errorResponse - Error response from API
 * @param {Function} showToast - Toast notification function (from ToastContext)
 * @returns {Object} - Toast configuration that was shown
 */
export function handleApiError(errorResponse, showToast) {
  // Extract error from response
  const error = errorResponse?.error || errorResponse;

  // Create toast configuration
  const toastConfig = createToastConfig(error);

  // Show toast notification
  if (showToast) {
    showToast(toastConfig.message, {
      type: toastConfig.type,
      duration: toastConfig.duration,
      actions: toastConfig.actions
    });
  }

  return toastConfig;
}

/**
 * Handle network error (no response from server)
 *
 * @param {Error} error - Network error
 * @param {Function} showToast - Toast notification function
 */
export function handleNetworkError(error, showToast) {
  const message = 'Network error. Please check your connection and try again.';

  if (showToast) {
    showToast(message, {
      type: 'error',
      duration: 8000,
      actions: [
        {
          label: 'Retry',
          variant: 'light',
          onClick: () => window.location.reload()
        }
      ]
    });
  }
}

/**
 * Handle validation errors (422 responses)
 *
 * @param {Object} validationErrors - Field-level validation errors
 * @param {Function} showToast - Toast notification function
 * @returns {Object} - Validation errors for form display
 */
export function handleValidationErrors(validationErrors, showToast) {
  // Create a summary message
  const fieldCount = Object.keys(validationErrors || {}).length;
  const message = `Please fix ${fieldCount} validation error${fieldCount > 1 ? 's' : ''}`;

  if (showToast) {
    showToast(message, {
      type: 'warning',
      duration: 6000
    });
  }

  // Return validation errors for form display
  return validationErrors;
}

/**
 * Check if response is an error
 *
 * @param {Object} response - API response
 * @returns {boolean} - True if response contains an error
 */
export function isErrorResponse(response) {
  return response && (
    response.success === false ||
    response.error !== undefined ||
    response.status >= 400
  );
}

/**
 * Extract error from various response formats
 *
 * @param {Object} response - API response
 * @returns {Object|null} - Extracted error object or null
 */
export function extractError(response) {
  if (!response) return null;

  // Check for structured error response
  if (response.error) {
    return response.error;
  }

  // Check for error in data property
  if (response.data?.error) {
    return response.data.error;
  }

  // Check for message property (legacy format)
  if (response.message) {
    return {
      code: 'INTERNAL_ERROR',
      userMessage: response.message,
      message: response.message
    };
  }

  return null;
}
