import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../utilities/logger';

/**
 * Per-entity revalidation configuration.
 * - staleAfterMs: how long before cached data is considered stale
 * - minIntervalMs: throttle — minimum time between revalidation attempts
 */
export const REVALIDATION_CONFIG = {
  destinations: { staleAfterMs: 5 * 60 * 1000, minIntervalMs: 30_000 },
  experiences:  { staleAfterMs: 2 * 60 * 1000, minIntervalMs: 15_000 },
  plans:        { staleAfterMs: 60 * 1000,      minIntervalMs: 10_000 },
};

const CHECK_INTERVAL_MS = 30_000; // How often the periodic check runs

/**
 * Unified stale-while-revalidate hook for DataContext.
 *
 * Replaces multiple overlapping staleness mechanisms (dataStale flags,
 * STALE_AFTER_MS effect, per-entity watcher effects) with a single
 * interval + visibility + network-based revalidation engine.
 *
 * @param {Object} config       - Per-entity config (REVALIDATION_CONFIG shape)
 * @param {Object} fetchers     - { destinations: fn, experiences: fn, plans: fn }
 * @param {Object} deps
 * @param {Object} deps.user         - Current user (null when logged out)
 * @param {Object} deps.lastUpdated  - { destinations: Date|null, experiences: Date|null, plans: Date|null }
 * @param {Object} deps.hasData      - { destinations: boolean, experiences: boolean, plans: boolean }
 * @returns {{ revalidationStatus: Object, markStale: Function, forceRevalidate: Function }}
 */
export function useRevalidation(config, fetchers, deps) {
  const [revalidationStatus, setRevalidationStatus] = useState(() => {
    const initial = {};
    for (const key of Object.keys(config)) {
      initial[key] = 'idle';
    }
    return initial;
  });

  // Refs to avoid stale closures and prevent callback recreation
  const inflightRef = useRef({});
  const lastRevalidatedRef = useRef({});
  const lastUpdatedRef = useRef(deps.lastUpdated);
  const hasDataRef = useRef(deps.hasData);
  const fetchersRef = useRef(fetchers);
  const userRef = useRef(deps.user);

  // Keep refs in sync
  useEffect(() => { lastUpdatedRef.current = deps.lastUpdated; }, [deps.lastUpdated]);
  useEffect(() => { hasDataRef.current = deps.hasData; }, [deps.hasData]);
  useEffect(() => { fetchersRef.current = fetchers; }, [fetchers]);
  useEffect(() => { userRef.current = deps.user; }, [deps.user]);

  /**
   * Revalidate a single entity type. Handles throttling, in-flight dedup,
   * and status tracking.
   */
  const revalidateEntity = useCallback(async (entityKey) => {
    const cfg = config[entityKey];
    if (!cfg) return;

    const fetcher = fetchersRef.current[entityKey];
    if (!fetcher || !userRef.current) return;

    // Throttle: skip if we revalidated too recently
    const now = Date.now();
    const lastTime = lastRevalidatedRef.current[entityKey] || 0;
    if (now - lastTime < cfg.minIntervalMs) {
      logger.debug(`[useRevalidation] ${entityKey} throttled`, {
        sinceLast: now - lastTime,
        minInterval: cfg.minIntervalMs,
      });
      return;
    }

    // Skip if already in-flight
    if (inflightRef.current[entityKey]) return;

    inflightRef.current[entityKey] = true;
    lastRevalidatedRef.current[entityKey] = now;
    setRevalidationStatus(prev => ({ ...prev, [entityKey]: 'revalidating' }));

    try {
      await fetcher();
      logger.debug(`[useRevalidation] ${entityKey} revalidated`);
    } catch (err) {
      logger.warn(`[useRevalidation] ${entityKey} revalidation failed`, { error: err?.message });
    } finally {
      inflightRef.current[entityKey] = false;
      setRevalidationStatus(prev => ({ ...prev, [entityKey]: 'idle' }));
    }
  }, [config]);

  /**
   * Check all entity types for staleness and revalidate as needed.
   * Only revalidates entities that already have data (stale-while-revalidate —
   * initial loads are handled by DataContext's mount effect).
   */
  const checkAndRevalidateAll = useCallback(() => {
    if (!userRef.current) return;

    const now = Date.now();

    for (const key of Object.keys(config)) {
      const cfg = config[key];

      // Only revalidate if we have data to show
      if (!hasDataRef.current[key]) continue;

      const lastUpdate = lastUpdatedRef.current[key];
      const lastUpdateMs = lastUpdate
        ? (typeof lastUpdate === 'number' ? lastUpdate : new Date(lastUpdate).getTime())
        : 0;

      if (now - lastUpdateMs > cfg.staleAfterMs) {
        revalidateEntity(key);
      }
    }
  }, [config, revalidateEntity]);

  /**
   * Mark an entity as stale for immediate revalidation.
   * Resets the throttle so the next revalidation fires right away.
   * Called by event-bus listeners when mutations occur.
   */
  const markStale = useCallback((entityKey) => {
    logger.debug(`[useRevalidation] ${entityKey} marked stale`);
    // Reset throttle to allow immediate revalidation
    lastRevalidatedRef.current[entityKey] = 0;
    revalidateEntity(entityKey);
  }, [revalidateEntity]);

  /**
   * Force revalidation of all entities, bypassing throttle.
   */
  const forceRevalidate = useCallback(() => {
    for (const key of Object.keys(config)) {
      lastRevalidatedRef.current[key] = 0;
    }
    checkAndRevalidateAll();
  }, [config, checkAndRevalidateAll]);

  // Periodic staleness check via setInterval (decoupled from render cycle)
  useEffect(() => {
    if (!deps.user) return;

    // Check immediately on mount
    checkAndRevalidateAll();

    const interval = setInterval(checkAndRevalidateAll, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [deps.user, checkAndRevalidateAll]);

  // Tab visibility: revalidate stale data when user returns to tab
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        logger.debug('[useRevalidation] Tab became visible, checking staleness');
        checkAndRevalidateAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkAndRevalidateAll]);

  // Network reconnect: revalidate when coming back online
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      logger.debug('[useRevalidation] Network online, checking staleness');
      checkAndRevalidateAll();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [checkAndRevalidateAll]);

  return { revalidationStatus, markStale, forceRevalidate };
}
