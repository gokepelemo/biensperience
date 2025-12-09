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
/**
 * Factory that returns a run() function which executes an optimistic UI
 * change, performs the async API call, rolls back on error, and calls
 * optional success/error callbacks.
 *
 * This is intentionally NOT a React hook so callers may create the run
 * function inline (e.g., inside event handlers or callbacks) without
 * violating the Rules of Hooks.
 *
 * The apply() function is wrapped in queueMicrotask to prevent React error #300
 * ("Cannot update a component while rendering a different component") which
 * can occur if apply() triggers a state update during the render phase of
 * another component.
 */
export default function useOptimisticAction({ apply, apiCall, rollback, onSuccess, onError, context = 'Action' }) {
  return async function run() {
    try {
      // Apply optimistic change in a microtask to avoid React error #300
      // This ensures state updates don't happen during another component's render
      if (apply) {
        await new Promise(resolve => {
          queueMicrotask(() => {
            apply();
            resolve();
          });
        });
      }
      await apiCall?.();
      onSuccess?.();
    } catch (err) {
      logger.error(`[Optimistic] ${context} failed`, { error: err?.message }, err);
      try {
        rollback?.();
      } catch (rollbackErr) {
        logger.error('[Optimistic] rollback failed', { error: rollbackErr?.message }, rollbackErr);
      }
      try {
        onError?.(err, `${context} failed. Please try again.`);
      } catch (onErrorErr) {
        logger.error('[Optimistic] onError handler threw', { error: onErrorErr?.message }, onErrorErr);
      }
    }
  };
}
