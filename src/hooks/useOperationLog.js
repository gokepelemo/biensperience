/**
 * useOperationLog Hook
 *
 * React hook for managing operation log persistence in IndexedDB.
 * Handles logging, replay, and offline operation queue management.
 *
 * Features:
 * - Automatic initialization on mount
 * - Logging operations with plan context
 * - Retrieving pending operations for replay
 * - Cleanup on unmount
 *
 * @module useOperationLog
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  initOperationLog,
  logOperation,
  markOperationApplied,
  getUnappliedOperations,
  getAllOperations,
  clearPlanOperations,
  garbageCollect,
  replayOperations,
  getStats,
  closeOperationLog
} from '../utilities/operation-log';
import { logger } from '../utilities/logger';

/**
 * Hook for managing operation log for a specific plan
 *
 * @param {string} planId - Plan ID to track operations for
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether logging is enabled (default: true)
 * @param {Function} options.onReplayComplete - Callback when replay finishes
 * @returns {Object} Operation log functions and state
 */
export default function useOperationLog(planId, options = {}) {
  const {
    enabled = true,
    onReplayComplete
  } = options;

  const [initialized, setInitialized] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);

  // Track if we've initialized to avoid double init
  const initRef = useRef(false);

  /**
   * Initialize operation log on mount
   */
  useEffect(() => {
    if (!enabled || initRef.current) return;

    const init = async () => {
      try {
        await initOperationLog();
        initRef.current = true;
        setInitialized(true);

        // Run initial garbage collection
        await garbageCollect();

        // Get initial pending count
        if (planId) {
          const pending = await getUnappliedOperations(planId);
          setPendingCount(pending.length);
        }

        logger.debug('[useOperationLog] Initialized', { planId });
      } catch (err) {
        logger.error('[useOperationLog] Failed to initialize', {
          error: err.message
        });
      }
    };

    init();

    return () => {
      // Don't close DB on unmount - other components may need it
      // closeOperationLog();
    };
  }, [enabled, planId]);

  /**
   * Log an operation for the current plan
   *
   * @param {Object} operation - Operation to log
   * @returns {Promise<Object>} Logged operation record
   */
  const log = useCallback(async (operation) => {
    if (!enabled || !initialized) {
      logger.debug('[useOperationLog] Skipping log - not initialized');
      return null;
    }

    try {
      const record = await logOperation({
        ...operation,
        planId: planId || operation.planId || operation.payload?.planId
      });

      // Update pending count
      setPendingCount(prev => prev + 1);

      return record;
    } catch (err) {
      logger.error('[useOperationLog] Failed to log operation', {
        operationId: operation.id,
        error: err.message
      });
      return null;
    }
  }, [enabled, initialized, planId]);

  /**
   * Mark an operation as applied (server acknowledged)
   *
   * @param {string} operationId - Operation ID to mark
   * @returns {Promise<boolean>} Success status
   */
  const markApplied = useCallback(async (operationId) => {
    if (!enabled || !initialized) return false;

    try {
      const result = await markOperationApplied(operationId);
      if (result) {
        // Update pending count
        setPendingCount(prev => Math.max(0, prev - 1));
      }
      return !!result;
    } catch (err) {
      logger.error('[useOperationLog] Failed to mark applied', {
        operationId,
        error: err.message
      });
      return false;
    }
  }, [enabled, initialized]);

  /**
   * Get all pending (unapplied) operations for replay
   *
   * @returns {Promise<Array>} Array of pending operations
   */
  const getPending = useCallback(async () => {
    if (!enabled || !initialized || !planId) return [];

    try {
      const pending = await getUnappliedOperations(planId);
      setPendingCount(pending.length);
      return pending;
    } catch (err) {
      logger.error('[useOperationLog] Failed to get pending', {
        planId,
        error: err.message
      });
      return [];
    }
  }, [enabled, initialized, planId]);

  /**
   * Get all operations for the plan
   *
   * @returns {Promise<Array>} Array of all operations
   */
  const getAll = useCallback(async () => {
    if (!enabled || !initialized || !planId) return [];

    try {
      return await getAllOperations(planId);
    } catch (err) {
      logger.error('[useOperationLog] Failed to get all', {
        planId,
        error: err.message
      });
      return [];
    }
  }, [enabled, initialized, planId]);

  /**
   * Replay operations to rebuild state
   *
   * @param {Object} initialState - Starting state
   * @param {Function} applyFn - Function to apply operation
   * @returns {Promise<Object>} Final state after replay
   */
  const replay = useCallback(async (initialState, applyFn) => {
    if (!enabled || !initialized || !planId) return initialState;

    try {
      setIsReplaying(true);
      const finalState = await replayOperations(planId, initialState, applyFn);

      if (onReplayComplete) {
        onReplayComplete(finalState);
      }

      return finalState;
    } catch (err) {
      logger.error('[useOperationLog] Replay failed', {
        planId,
        error: err.message
      });
      return initialState;
    } finally {
      setIsReplaying(false);
    }
  }, [enabled, initialized, planId, onReplayComplete]);

  /**
   * Clear all operations for the current plan
   *
   * @returns {Promise<number>} Number of operations cleared
   */
  const clear = useCallback(async () => {
    if (!enabled || !initialized || !planId) return 0;

    try {
      const count = await clearPlanOperations(planId);
      setPendingCount(0);
      return count;
    } catch (err) {
      logger.error('[useOperationLog] Failed to clear', {
        planId,
        error: err.message
      });
      return 0;
    }
  }, [enabled, initialized, planId]);

  /**
   * Get operation log statistics
   *
   * @returns {Promise<Object>} Stats object
   */
  const stats = useCallback(async () => {
    if (!enabled || !initialized) {
      return { total: 0, applied: 0, pending: 0 };
    }

    try {
      return await getStats();
    } catch (err) {
      logger.error('[useOperationLog] Failed to get stats', {
        error: err.message
      });
      return { total: 0, applied: 0, pending: 0 };
    }
  }, [enabled, initialized]);

  return {
    // State
    initialized,
    pendingCount,
    isReplaying,

    // Functions
    log,
    markApplied,
    getPending,
    getAll,
    replay,
    clear,
    stats
  };
}

/**
 * Global operation log hook - not tied to specific plan
 * Useful for app-level initialization and cleanup
 *
 * @returns {Object} Global operation log functions
 */
export function useGlobalOperationLog() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initOperationLog();
        setInitialized(true);
        logger.debug('[useGlobalOperationLog] Initialized');
      } catch (err) {
        logger.error('[useGlobalOperationLog] Failed to initialize', {
          error: err.message
        });
      }
    };

    init();

    return () => {
      closeOperationLog();
    };
  }, []);

  const gc = useCallback(async () => {
    try {
      return await garbageCollect();
    } catch (err) {
      logger.error('[useGlobalOperationLog] GC failed', { error: err.message });
      return 0;
    }
  }, []);

  const stats = useCallback(async () => {
    try {
      return await getStats();
    } catch (err) {
      return { total: 0, applied: 0, pending: 0 };
    }
  }, []);

  return {
    initialized,
    gc,
    stats
  };
}
