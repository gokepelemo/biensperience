/**
 * Navigation Cleanup Hook
 *
 * Cancels stale queued requests when the user navigates to a new route.
 * This ensures navigation is instant — low-priority API calls from the
 * previous view are discarded so the new view's requests aren't blocked.
 *
 * Only cancels requests that are still queued (not yet executing).
 * HIGH and CRITICAL priority requests are preserved.
 *
 * @module hooks/useNavigationCleanup
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getRequestQueue, PRIORITY } from '../utilities/request-queue';
import { logger } from '../utilities/logger';

/**
 * Hook that cancels low-priority queued requests on route change.
 * Should be called once in the app, inside the Router context.
 */
export function useNavigationCleanup() {
  const location = useLocation();
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousPathRef.current;

    // Skip on initial mount (no previous navigation)
    if (previousPath === currentPath) return;

    previousPathRef.current = currentPath;

    const queue = getRequestQueue();
    const cancelled = queue.cancelBelowPriority(PRIORITY.HIGH);

    if (cancelled > 0) {
      logger.debug('[useNavigationCleanup] Cancelled stale requests on navigation', {
        from: previousPath,
        to: currentPath,
        cancelled,
      });
    }
  }, [location.pathname]);
}

export default useNavigationCleanup;
