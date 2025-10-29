/**
 * Custom hook for standardized form error handling
 * Provides consistent error handling patterns across forms
 */

import { useCallback } from 'react';
import { handleError } from '../utilities/error-handler';

/**
 * Hook for handling form submission errors
 * @param {Function} setError - State setter for error message
 * @param {Object} options - Configuration options
 * @param {Function} options.onEmailNotVerified - Callback for email verification errors
 * @param {Function} options.onValidationError - Callback for validation errors
 * @param {Function} options.onDuplicateError - Callback for duplicate entry errors
 * @returns {Function} Error handler function
 */
export function useFormErrorHandling(setError, options = {}) {
  const {
    onEmailNotVerified,
    onValidationError,
    onDuplicateError
  } = options;

  const handleFormError = useCallback((err, context = {}) => {
    // Get formatted error message
    const errorMsg = handleError(err, context);

    // Handle specific error codes
    if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
      const message = err.response.data.error || 'Please verify your email before creating content.';
      setError(message);

      if (onEmailNotVerified) {
        onEmailNotVerified(err.response.data);
      }
    }
    // Handle duplicate entries
    else if (err.message?.includes('already exists') || err.response?.status === 409) {
      const message = err.message || err.response?.data?.error || 'This entry already exists.';
      setError(message);

      if (onDuplicateError) {
        onDuplicateError(err);
      }
    }
    // Handle validation errors
    else if (err.response?.status === 400) {
      const message = err.response.data?.error || errorMsg;
      setError(message);

      if (onValidationError) {
        onValidationError(err.response.data);
      }
    }
    // Handle all other errors
    else {
      setError(errorMsg);
    }

    return errorMsg;
  }, [setError, onEmailNotVerified, onValidationError, onDuplicateError]);

  return handleFormError;
}

/**
 * Hook for clearing errors with timeout
 * @param {Function} setError - State setter for error message
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Function} Clear error function
 */
export function useErrorTimeout(setError, timeout = 5000) {
  const clearError = useCallback(() => {
    setTimeout(() => {
      setError('');
    }, timeout);
  }, [setError, timeout]);

  return clearError;
}

export default useFormErrorHandling;
