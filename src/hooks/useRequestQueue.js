/**
 * React Hook for Request Queue Status
 *
 * Provides components with access to queue status for loading indicators.
 * Does not show toast notifications - only provides state for UI rendering.
 *
 * @module hooks/useRequestQueue
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getRequestQueue, PRIORITY } from '../utilities/request-queue';

/**
 * Hook to access request queue status
 *
 * @returns {Object} Queue status and controls
 *
 * @example
 * function MyComponent() {
 *   const { isLoading, queueLength, avgLatency } = useRequestQueue();
 *
 *   return (
 *     <div>
 *       {isLoading && <Spinner />}
 *       {queueLength > 0 && <span>{queueLength} requests pending</span>}
 *     </div>
 *   );
 * }
 */
export function useRequestQueue() {
  const [status, setStatus] = useState(() => getRequestQueue().getStatus());

  useEffect(() => {
    const queue = getRequestQueue();
    const unsubscribe = queue.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  // Computed values for convenience
  const isLoading = status.executingCount > 0;
  const isIdle = status.isIdle;
  const isPaused = status.isPaused;
  const queueLength = status.queueLength;
  const executingCount = status.executingCount;

  // Controls
  const pause = useCallback(() => getRequestQueue().pause(), []);
  const resume = useCallback(() => getRequestQueue().resume(), []);
  const clear = useCallback(() => getRequestQueue().clear(), []);
  const cancel = useCallback((id) => getRequestQueue().cancel(id), []);

  return {
    // Status
    status,
    isLoading,
    isIdle,
    isPaused,
    queueLength,
    executingCount,
    avgLatency: status.avgLatency,
    concurrency: status.concurrency,
    tokens: status.tokens,
    maxTokens: status.maxTokens,
    pendingRequests: status.pendingRequests,
    stats: status.stats,

    // Controls
    pause,
    resume,
    clear,
    cancel,
  };
}

/**
 * Hook to track loading state for specific URL patterns
 *
 * @param {string|RegExp} pattern - URL pattern to track
 * @returns {Object} Loading state for matched URLs
 *
 * @example
 * function ExperienceList() {
 *   const { isLoading } = useRequestLoading('/api/experiences');
 *
 *   if (isLoading) return <Skeleton />;
 *   return <List />;
 * }
 */
export function useRequestLoading(pattern) {
  const { status, cancel: cancelQueue } = useRequestQueue();

  const regex = useMemo(() => {
    return pattern instanceof RegExp ? pattern : new RegExp(pattern);
  }, [pattern]);

  const matchingPending = useMemo(() => {
    return status.pendingRequests.filter(r => regex.test(r.url));
  }, [status.pendingRequests, regex]);

  const isLoading = matchingPending.length > 0 ||
    Array.from(status.pendingRequests || []).some(r => regex.test(r.url));

  const cancel = useCallback(() => {
    return getRequestQueue().cancelMatching(pattern);
  }, [pattern]);

  return {
    isLoading,
    pendingCount: matchingPending.length,
    pendingRequests: matchingPending,
    cancel,
  };
}

/**
 * Hook for queueing requests with automatic cleanup
 *
 * @returns {Object} Queue function that's cleaned up on unmount
 *
 * @example
 * function MyComponent() {
 *   const { queueRequest } = useQueuedRequest();
 *
 *   const fetchData = async () => {
 *     const data = await queueRequest(
 *       () => fetch('/api/data').then(r => r.json()),
 *       { priority: PRIORITY.HIGH, url: '/api/data', method: 'GET' }
 *     );
 *   };
 * }
 */
export function useQueuedRequest() {
  const [requestIds, setRequestIds] = useState(new Set());

  // Cancel all pending requests on unmount
  useEffect(() => {
    return () => {
      const queue = getRequestQueue();
      requestIds.forEach(id => queue.cancel(id));
    };
  }, [requestIds]);

  const queueRequest = useCallback(async (fetchFn, options = {}) => {
    const queue = getRequestQueue();

    // Wrap to track the request ID
    const wrappedFn = () => fetchFn();

    try {
      const result = await queue.enqueue(wrappedFn, options);
      return result;
    } catch (error) {
      // Re-throw unless it was cancelled
      if (error.message !== 'Request cancelled') {
        throw error;
      }
    }
  }, []);

  return {
    queueRequest,
    PRIORITY,
  };
}

// Re-export priority constants for convenience
export { PRIORITY };

export default useRequestQueue;
