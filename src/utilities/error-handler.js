/**
 * Error handling utilities for consistent error management across the application
 */

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
