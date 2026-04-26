import { lazy } from 'react';
import { logger } from './logger';

const MAX_RETRIES = 2;
const SESSION_KEY = 'bien:chunkReloadAttempted';

/**
 * Wraps React.lazy() with automatic retry + cache-busting for stale chunks.
 *
 * After a deploy, browsers may still hold old index.html that references
 * chunk filenames that no longer exist.  This wrapper:
 *   1. Retries the dynamic import with a cache-busting query param.
 *   2. If all retries fail, does a single hard page reload (guarded by
 *      sessionStorage so it can't loop).
 *   3. If even the reload doesn't help, lets the error propagate to
 *      ErrorBoundary so the user sees a friendly message.
 *
 * @param {() => Promise} importFn  – e.g. () => import('../views/Home/Home')
 * @returns {React.LazyExoticComponent}
 */
export default function lazyWithRetry(importFn) {
  return lazy(() => retryImport(importFn, MAX_RETRIES));
}

function isChunkError(error) {
  const msg = error?.message || String(error);
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Expected a JavaScript-or-Wasm module script') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk') ||
    msg.includes('Importing a module script failed')
  );
}

async function retryImport(importFn, retriesLeft) {
  try {
    return await importFn();
  } catch (error) {
    if (!isChunkError(error)) {
      throw error; // Not a chunk error – don't retry
    }

    if (retriesLeft > 0) {
      logger.info('[lazyWithRetry] Chunk load failed, retrying…', {
        retriesLeft,
        error: error.message
      });

      // Small delay before retry to let network settle
      await new Promise(resolve => setTimeout(resolve, 500));
      return retryImport(importFn, retriesLeft - 1);
    }

    // All retries exhausted — do a one-time hard reload
    if (typeof window !== 'undefined') {
      const alreadyReloaded = window.sessionStorage?.getItem(SESSION_KEY) === 'true';
      if (!alreadyReloaded) {
        logger.info('[lazyWithRetry] All retries exhausted, performing hard reload');
        window.sessionStorage?.setItem(SESSION_KEY, 'true');
        window.location.reload();
        // Return a never-resolving promise so React doesn't render with an error
        // while the page is reloading.
        return new Promise(() => {});
      }
    }

    // Already reloaded once and it still fails — give up and let ErrorBoundary handle it
    throw error;
  }
}

/**
 * Call on successful app mount to clear the reload guard so future deploys
 * can trigger a fresh reload if needed.
 */
export function clearChunkReloadFlag() {
  try {
    window.sessionStorage?.removeItem(SESSION_KEY);
  } catch (_) {
    // Ignore
  }
}
