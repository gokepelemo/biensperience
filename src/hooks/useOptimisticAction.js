import { useCallback } from 'react';
import { logger } from '../utilities/logger';

/**
 * useOptimisticAction
 * Small helper to standardize optimistic UI updates with background API calls.
 *
 * @param {Object} options
 * @param {Function} options.apply - Apply optimistic UI change (sync)
 * @param {Function} options.apiCall - Async function returning a Promise for the server mutation
 * @param {Function} [options.rollback] - Revert optimistic change on error (sync)
 * @param {Function} [options.onSuccess] - Called after apiCall resolves
 * @param {Function} [options.onError] - Called with (error, message)
 * @param {string} [options.context] - Context string for logging and error messages
 * @returns {Function} run - Call to execute the optimistic action
 */
export default function useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context = 'Action' }) {
  return useCallback(async () => {
    try {
      // Apply optimistic change immediately
      apply?.();
      await apiCall?.();
      onSuccess?.();
    } catch (err) {
      logger.error(`[Optimistic] ${context} failed`, { error: err?.message }, err);
      rollback?.();
      onError?.(err, `${context} failed. Please try again.`);
    }
  }, [apply, apiCall, rollback, onSuccess, onError, context]);
}
