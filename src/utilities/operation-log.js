/**
 * Operation Log - Persistent Storage for Offline Support
 *
 * Uses IndexedDB to store plan operations for:
 * - Offline support (edits persist without network)
 * - Reconnection replay (pending ops sent on reconnect)
 * - Audit trail (operation history for debugging)
 *
 * Storage strategy:
 * - Each operation stored with unique ID
 * - Indexed by planId and timestamp for efficient querying
 * - Applied flag tracks server acknowledgment
 * - Automatic garbage collection keeps storage bounded
 *
 * @module operation-log
 */

import { logger } from './logger';

const DB_NAME = 'bien_operations';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const MAX_OPERATIONS = 1000; // Keep last 1000 applied operations per plan
const GC_INTERVAL_MS = 5 * 60 * 1000; // Run GC every 5 minutes

let db = null;
let initPromise = null;
let gcIntervalId = null;

/**
 * Initialize IndexedDB database
 * Creates object store and indexes on first run
 *
 * @returns {Promise<IDBDatabase>} Database instance
 */
export async function initOperationLog() {
  // Return existing promise if initialization in progress
  if (initPromise) {
    return initPromise;
  }

  // Return existing db if already initialized
  if (db) {
    return db;
  }

  initPromise = new Promise((resolve, reject) => {
    // Check for IndexedDB support
    if (!window.indexedDB) {
      logger.warn('[OperationLog] IndexedDB not supported');
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('[OperationLog] Failed to open database', {
        error: request.error?.message
      });
      initPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      logger.debug('[OperationLog] Database opened successfully');

      // Set up error handler for the database
      db.onerror = (event) => {
        logger.error('[OperationLog] Database error', {
          error: event.target?.error?.message
        });
      };

      // Start periodic garbage collection
      startGarbageCollection();

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      logger.info('[OperationLog] Upgrading database', {
        oldVersion: event.oldVersion,
        newVersion: event.newVersion
      });

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Index for querying by plan
        store.createIndex('planId', 'planId', { unique: false });

        // Index for time-based queries
        store.createIndex('timestamp', 'timestamp', { unique: false });

        // Index for finding unapplied operations
        store.createIndex('applied', 'applied', { unique: false });

        // Compound index for plan + applied status
        store.createIndex('planId_applied', ['planId', 'applied'], { unique: false });

        logger.info('[OperationLog] Created object store with indexes');
      }
    };

    request.onblocked = () => {
      logger.warn('[OperationLog] Database blocked - close other tabs');
    };
  });

  return initPromise;
}

/**
 * Start periodic garbage collection
 */
function startGarbageCollection() {
  if (gcIntervalId) return;

  gcIntervalId = setInterval(async () => {
    try {
      const deleted = await garbageCollect();
      if (deleted > 0) {
        logger.debug('[OperationLog] GC completed', { deleted });
      }
    } catch (err) {
      logger.warn('[OperationLog] GC failed', { error: err.message });
    }
  }, GC_INTERVAL_MS);
}

/**
 * Stop garbage collection (for cleanup)
 */
export function stopGarbageCollection() {
  if (gcIntervalId) {
    clearInterval(gcIntervalId);
    gcIntervalId = null;
  }
}

/**
 * Log an operation to IndexedDB
 *
 * @param {Object} operation - Operation to log
 * @param {string} operation.id - Unique operation ID
 * @param {string} operation.type - Operation type
 * @param {Object} operation.payload - Operation payload
 * @param {string} operation.planId - Associated plan ID
 * @param {number} operation.timestamp - Operation timestamp
 * @returns {Promise<Object>} Logged operation record
 */
export async function logOperation(operation) {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Create record with metadata
      const record = {
        id: operation.id,
        type: operation.type,
        payload: operation.payload,
        planId: operation.planId || operation.payload?.planId,
        sessionId: operation.sessionId,
        vectorClock: operation.vectorClock,
        timestamp: operation.timestamp || Date.now(),
        applied: false,
        loggedAt: Date.now()
      };

      const request = store.put(record);

      request.onsuccess = () => {
        logger.debug('[OperationLog] Operation logged', {
          operationId: record.id,
          type: record.type,
          planId: record.planId
        });
        resolve(record);
      };

      request.onerror = () => {
        logger.error('[OperationLog] Failed to log operation', {
          operationId: operation.id,
          error: request.error?.message
        });
        reject(request.error);
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Mark an operation as applied (server acknowledged)
 *
 * @param {string} operationId - Operation ID to mark
 * @returns {Promise<Object|null>} Updated record or null if not found
 */
export async function markOperationApplied(operationId) {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const getRequest = store.get(operationId);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (record) {
          record.applied = true;
          record.appliedAt = Date.now();

          const putRequest = store.put(record);
          putRequest.onsuccess = () => {
            logger.debug('[OperationLog] Operation marked applied', {
              operationId
            });
            resolve(record);
          };
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get unapplied (pending) operations for a plan
 *
 * @param {string} planId - Plan ID to query
 * @returns {Promise<Array>} Array of pending operations, sorted by timestamp
 */
export async function getUnappliedOperations(planId) {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('planId_applied');

      // Query for planId with applied=false
      const request = index.getAll([planId, false]);

      request.onsuccess = () => {
        const operations = request.result
          .sort((a, b) => a.timestamp - b.timestamp);

        logger.debug('[OperationLog] Got unapplied operations', {
          planId,
          count: operations.length
        });

        resolve(operations);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get all operations for a plan (for replay/debugging)
 *
 * @param {string} planId - Plan ID to query
 * @returns {Promise<Array>} Array of all operations, sorted by timestamp
 */
export async function getAllOperations(planId) {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('planId');

      const request = index.getAll(planId);

      request.onsuccess = () => {
        const operations = request.result
          .sort((a, b) => a.timestamp - b.timestamp);

        logger.debug('[OperationLog] Got all operations', {
          planId,
          count: operations.length
        });

        resolve(operations);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get operation by ID
 *
 * @param {string} operationId - Operation ID
 * @returns {Promise<Object|null>} Operation record or null
 */
export async function getOperation(operationId) {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const request = store.get(operationId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Delete a specific operation
 *
 * @param {string} operationId - Operation ID to delete
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteOperation(operationId) {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.delete(operationId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clear all operations for a plan
 *
 * @param {string} planId - Plan ID to clear
 * @returns {Promise<number>} Number of operations deleted
 */
export async function clearPlanOperations(planId) {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('planId');

      const request = index.getAllKeys(planId);

      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => store.delete(key));

        tx.oncomplete = () => {
          logger.info('[OperationLog] Cleared plan operations', {
            planId,
            count: keys.length
          });
          resolve(keys.length);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Garbage collect old applied operations
 * Keeps last MAX_OPERATIONS per plan to prevent unbounded growth
 *
 * @returns {Promise<number>} Number of operations deleted
 */
export async function garbageCollect() {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('applied');

      // Get all applied operations
      const request = index.getAll(true);

      request.onsuccess = () => {
        const applied = request.result;

        // Group by planId
        const byPlan = {};
        applied.forEach(op => {
          const planId = op.planId;
          if (!byPlan[planId]) {
            byPlan[planId] = [];
          }
          byPlan[planId].push(op);
        });

        // Delete excess operations per plan
        const toDelete = [];
        Object.values(byPlan).forEach(ops => {
          // Sort by timestamp descending (newest first)
          ops.sort((a, b) => b.timestamp - a.timestamp);

          // Mark operations beyond limit for deletion
          if (ops.length > MAX_OPERATIONS) {
            ops.slice(MAX_OPERATIONS).forEach(op => {
              toDelete.push(op.id);
            });
          }
        });

        // Delete marked operations
        toDelete.forEach(id => store.delete(id));

        tx.oncomplete = () => {
          if (toDelete.length > 0) {
            logger.info('[OperationLog] Garbage collected operations', {
              deleted: toDelete.length
            });
          }
          resolve(toDelete.length);
        };

        tx.onerror = () => {
          reject(tx.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Replay operations to rebuild state from history
 * Useful for recovering state after reconnection
 *
 * @param {string} planId - Plan ID to replay
 * @param {Object} initialState - Starting state
 * @param {Function} applyFn - Function to apply operation: (state, operation) => newState
 * @returns {Promise<Object>} Final state after replay
 */
export async function replayOperations(planId, initialState, applyFn) {
  const operations = await getAllOperations(planId);

  let state = initialState;
  for (const operation of operations) {
    try {
      state = applyFn(state, operation);
    } catch (err) {
      logger.warn('[OperationLog] Failed to apply operation during replay', {
        operationId: operation.id,
        type: operation.type,
        error: err.message
      });
    }
  }

  logger.info('[OperationLog] Replay completed', {
    planId,
    operationCount: operations.length
  });

  return state;
}

/**
 * Get database statistics
 *
 * @returns {Promise<Object>} Stats object
 */
export async function getStats() {
  if (!db) {
    await initOperationLog();
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const countRequest = store.count();
      const appliedIndex = store.index('applied');
      const appliedRequest = appliedIndex.count(true);
      const pendingRequest = appliedIndex.count(false);

      tx.oncomplete = () => {
        resolve({
          total: countRequest.result,
          applied: appliedRequest.result,
          pending: pendingRequest.result
        });
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Close database connection
 * Call when unmounting app or cleaning up
 */
export function closeOperationLog() {
  stopGarbageCollection();
  if (db) {
    db.close();
    db = null;
    initPromise = null;
    logger.debug('[OperationLog] Database closed');
  }
}

// Default export
const OperationLog = {
  initOperationLog,
  logOperation,
  markOperationApplied,
  getUnappliedOperations,
  getAllOperations,
  getOperation,
  deleteOperation,
  clearPlanOperations,
  garbageCollect,
  replayOperations,
  getStats,
  closeOperationLog,
  stopGarbageCollection
};

export default OperationLog;
