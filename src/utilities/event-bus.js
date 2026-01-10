/**
 * Enhanced Event Bus with Version-Based Reconciliation and Vector Clocks
 *
 * Replaces timeout-based race condition prevention with version comparison.
 * Supports optimistic UI with automatic ID reconciliation.
 * Uses pluggable transports for cross-tab/real-time synchronization.
 * Uses vector clocks for causal event ordering across distributed clients.
 *
 * Transport Configuration (via environment variables):
 * - REACT_APP_EVENT_TRANSPORT: 'localStorage' | 'websocket' | 'hybrid' (default: 'localStorage')
 * - REACT_APP_WEBSOCKET_URL: WebSocket server URL (required for 'websocket' or 'hybrid')
 * - REACT_APP_WEBSOCKET_RECONNECT_INTERVAL: Reconnection interval in ms (default: 3000)
 * - REACT_APP_WEBSOCKET_MAX_RECONNECT_ATTEMPTS: Max reconnection attempts (default: 10)
 *
 * @module event-bus
 */

import { logger } from './logger';
import { getStoredToken } from './token-storage';
import { getUser } from './users-service'; // Only import getUser (used in other methods)
import * as VectorClock from './vector-clock';
import { createTransport } from './event-transport';
import { runStorageMigrations } from './storage-migration';

// Obtain a safe `batchedUpdates` function at runtime to avoid bundler
// static import errors. Prefer React's `unstable_batchedUpdates` when
// available (CommonJS `require` or global `ReactDOM`), otherwise
// fall back to a no-op wrapper that invokes the callback directly.
let batchedUpdates = (fn) => fn();
try {
  // CommonJS environment (Node / some bundlers provide require)
  if (typeof require === 'function') {
    // eslint-disable-next-line global-require
    const rd = require('react-dom');
    if (rd && typeof rd.unstable_batchedUpdates === 'function') {
      batchedUpdates = rd.unstable_batchedUpdates;
    }
  }
} catch (e) {
  // ignore
}

try {
  // Browser UMD builds may expose ReactDOM globally
  if (typeof globalThis !== 'undefined' && globalThis.ReactDOM && typeof globalThis.ReactDOM.unstable_batchedUpdates === 'function') {
    batchedUpdates = globalThis.ReactDOM.unstable_batchedUpdates;
  }
} catch (e) {
  // ignore
}

// Attempt a dynamic import using an async IIFE. This avoids using
// `typeof import` (invalid syntax) while remaining non-blocking.
try {
  (async () => {
    const mod = await import('react-dom');
    if (mod && typeof mod.unstable_batchedUpdates === 'function') {
      batchedUpdates = mod.unstable_batchedUpdates;
    }
  })().catch(() => {});
} catch (e) {
  // ignore
}

class EventBus {
  constructor() {
    this.listeners = new Map(); // eventType -> Set<handler>
    this.eventLog = [];         // Recent events for debugging (max 100)
    this.sessionId = this.generateSessionId();
    this.vectorClock = VectorClock.createVectorClock(); // Causal ordering
    this.transport = null;
    this.transportReady = false;

    // Local dispatch batching (smooth UI updates by reducing render churn)
    this._pendingDispatches = []; // Array<{ eventType, event }>
    this._flushScheduled = false;

    // Lightweight de-dupe across transports (guards against accidental server echoes)
    this._processedEventIds = new Set();
    this._maxProcessedEventIds = 500;

    // Run storage migrations before initializing transport
    this.runMigrations();

    // Initialize transport asynchronously
    this.initTransport();

    logger.info('[EventBus] Initialized', {
      sessionId: this.sessionId,
      vectorClock: VectorClock.format(this.vectorClock)
    });
  }

  /**
   * Backwards-compatible sessionId accessor.
   * Some older code/tests call eventBus.getSessionId().
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Run storage migrations to clean up deprecated keys
   */
  runMigrations() {
    try {
      const result = runStorageMigrations();
      if (result.migrated) {
        logger.info('[EventBus] Storage migrations applied', {
          version: result.version,
          changes: result.changes
        });
      }
    } catch (error) {
      logger.warn('[EventBus] Storage migration failed', { error: error.message });
    }
  }

  /**
   * Initialize the transport layer
   */
  async initTransport() {
    try {
      // Get token directly from localStorage to avoid circular dependency
      // users-service imports event-bus, so we can't import getToken at module level
      let token = null;
      try {
        token = getStoredToken();
        if (token) {
          // Validate token format
          const parts = token.split('.');
          if (parts.length !== 3) {
            logger.warn('[EventBus] Invalid token format in localStorage');
            token = null;
          } else {
            // Check if expired
            try {
              const payload = JSON.parse(atob(parts[1]));
              if (payload.exp < Date.now() / 1000) {
                logger.debug('[EventBus] Token expired');
                token = null;
              }
            } catch (e) {
              logger.warn('[EventBus] Failed to decode token');
              token = null;
            }
          }
        }
      } catch (e) {
        logger.warn('[EventBus] Failed to read token from localStorage', { error: e.message });
      }
      
      const user = getUser();
      
      logger.debug('[EventBus] Initializing transport', { 
        hasUser: !!user, 
        hasToken: !!token,
        tokenLength: token?.length || 0
      });
      
      this.transport = createTransport({
        sessionId: this.sessionId,
        authToken: token, // Pass auth token for WebSocket authentication
        userId: user?._id // Pass userId for localStorage encryption
      });

      // Subscribe to incoming messages from transport
      this.transport.onMessage((event) => {
        this.handleTransportMessage(event);
      });

      await this.transport.connect();
      this.transportReady = true;

      logger.info('[EventBus] Transport initialized', {
        type: this.transport.getType(),
        connected: this.transport.isConnected(),
        encrypted: this.transport.isEncrypted?.() || false
      });
    } catch (error) {
      logger.error('[EventBus] Failed to initialize transport', {
        error: error.message
      }, error);
      // Transport failed - events will only work locally within this tab
      // This is acceptable as the transport layer handles its own retries
      this.transportReady = false;
    }
  }

  /**
   * Update user ID for encryption (call after login)
   * @param {string} userId - User ID for encryption key derivation
   */
  setUserId(userId) {
    if (this.transport?.setUserId) {
      this.transport.setUserId(userId);
      logger.info('[EventBus] User ID updated for encryption', { hasUserId: !!userId });
    }
  }

  /**
   * Update auth token and reconnect WebSocket (call after login)
   * This is necessary because the EventBus initializes before user logs in.
   * @param {string} authToken - JWT token for WebSocket authentication
   * @returns {Promise<void>}
   */
  async setAuthToken(authToken) {
    if (this.transport?.setAuthToken) {
      await this.transport.setAuthToken(authToken);
      logger.info('[EventBus] Auth token updated, WebSocket reconnecting');
    }
  }

  /**
   * Handle incoming message from transport
   */
  handleTransportMessage(event) {
    // Ignore events from this session
    if (event.sessionId === this.sessionId) {
      logger.debug('[EventBus] Ignoring own event from transport');
      return;
    }

    // Merge remote vector clock for causal consistency
    if (event.vectorClock) {
      const oldClock = VectorClock.format(this.vectorClock);
      this.vectorClock = VectorClock.merge(this.vectorClock, event.vectorClock);
      logger.debug('[EventBus] Merged remote vector clock', {
        oldClock,
        remoteClock: VectorClock.format(event.vectorClock),
        newClock: VectorClock.format(this.vectorClock)
      });
    }

    // Dispatch event locally
    const eventType = event.type || event.event;
    if (eventType) {
      logger.debug('[EventBus] Received event from transport', {
        eventType,
        version: event.version,
        transportType: this.transport?.getType() || 'fallback'
      });
      // Unwrap payload from WebSocket server messages (server sends { type, payload })
      // Also handle localStorage events which may have { type, detail } or be flat
      const eventData = event.payload || event.detail || event;
      this.dispatchLocal(eventType, eventData);
    }
  }

  /**
   * Ensure each event has a stable ID for de-duping.
   *
   * @param {object} event
   * @returns {object}
   */
  ensureEventId(event) {
    if (!event || typeof event !== 'object') return event;
    if (event._eventId) return event;

    // Avoid Math.random() for ID generation; use crypto when available.
    let random = '';
    try {
      const bytes = new Uint8Array(8);
      crypto.getRandomValues(bytes);
      random = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      random = `${Date.now()}`;
    }

    return {
      ...event,
      _eventId: `${this.sessionId}-${event.version || event.timestamp || Date.now()}-${random}`
    };
  }

  /**
   * Track processed event IDs for cross-transport de-dupe.
   */
  trackProcessedEventId(eventId) {
    if (!eventId) return;
    this._processedEventIds.add(eventId);
    if (this._processedEventIds.size <= this._maxProcessedEventIds) return;

    const toRemove = this._processedEventIds.size - this._maxProcessedEventIds;
    let removed = 0;
    for (const id of this._processedEventIds) {
      if (removed >= toRemove) break;
      this._processedEventIds.delete(id);
      removed++;
    }
  }

  /**
   * Schedule a batched flush of pending dispatches.
   */
  scheduleDispatchFlush() {
    if (this._flushScheduled) return;
    this._flushScheduled = true;

    // Microtask flush groups multiple events emitted in the same tick.
    queueMicrotask(() => {
      this._flushScheduled = false;
      const pending = this._pendingDispatches;
      if (!pending || pending.length === 0) return;
      this._pendingDispatches = [];

      batchedUpdates(() => {
        for (const { eventType, event } of pending) {
          const handlers = this.listeners.get(eventType);
          if (handlers && handlers.size > 0) {
            handlers.forEach((handler) => {
              try {
                handler(event);
              } catch (error) {
                logger.error('[EventBus] Error in event handler', {
                  eventType,
                  error: error.message
                }, error);
              }
            });
          }

          // Backward compatibility: dispatch a DOM CustomEvent
          if (typeof window !== 'undefined') {
            try {
              window.dispatchEvent(new CustomEvent(eventType, { detail: event }));
            } catch (error) {
              logger.error('[EventBus] Error dispatching CustomEvent', {
                eventType,
                error: error.message
              }, error);
            }
          }
        }
      });
    });
  }

  /**
   * Generate unique session ID to prevent duplicate processing
   * of own events in cross-tab scenarios
   */
  generateSessionId() {
    const timestamp = Date.now();
    // Use cryptographically secure random values instead of Math.random()
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    const random = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return `session_${timestamp}_${random}`;
  }

  /**
   * Subscribe to events with automatic cleanup
   *
   * @param {string} eventType - Event type to listen for
   * @param {function} handler - Event handler function
   * @param {object} options - Subscription options
   * @returns {function} Unsubscribe function
   */
  subscribe(eventType, handler, options = {}) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(handler);

    logger.debug('[EventBus] Subscribed to event', {
      eventType,
      listenerCount: this.listeners.get(eventType).size
    });

    // Return unsubscribe function for cleanup
    return () => {
      const handlers = this.listeners.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        logger.debug('[EventBus] Unsubscribed from event', {
          eventType,
          listenerCount: handlers.size
        });
      }
    };
  }

  /**
   * Emit event locally and broadcast to other clients
   *
   * @param {string} eventType - Event type
   * @param {object} detail - Event payload
   * @param {object} options - Emit options (localOnly, etc.)
   */
  emit(eventType, detail, options = {}) {
    const user = getUser();

    // Increment vector clock before emitting (captures causal ordering)
    this.vectorClock = VectorClock.increment(this.vectorClock, this.sessionId);

    const event = this.ensureEventId({
      type: eventType,
      version: detail.version || Date.now(),
      vectorClock: VectorClock.clone(this.vectorClock), // Include causal clock
      timestamp: Date.now(),
      userId: detail.userId || user?._id,
      sessionId: this.sessionId,
      ...detail
    });

    // Track locally to prevent accidental duplicates if the transport echoes.
    this.trackProcessedEventId(event._eventId);

    // Log for debugging (keep last 100 events)
    // Use a higher threshold and slice to avoid O(n) shift on every emit
    this.eventLog.push(event);
    if (this.eventLog.length > 150) {
      this.eventLog = this.eventLog.slice(-100);
    }

    logger.debug('[EventBus] Emitting event', {
      eventType,
      version: event.version,
      vectorClock: VectorClock.format(event.vectorClock),
      sessionId: event.sessionId,
      localOnly: options.localOnly,
      transportType: this.transport?.getType() || 'fallback'
    });

    // Dispatch locally
    this.dispatchLocal(eventType, event);

    // Broadcast to other clients (unless local-only)
    if (!options.localOnly) {
      this.broadcastToOtherClients(event);
    }
  }

  /**
   * Dispatch event to local listeners
   */
  dispatchLocal(eventType, event) {
    const normalized = this.ensureEventId(event);

    // De-dupe if already processed.
    if (normalized?._eventId && this._processedEventIds.has(normalized._eventId)) {
      return;
    }
    if (normalized?._eventId) {
      this.trackProcessedEventId(normalized._eventId);
    }

    this._pendingDispatches.push({ eventType, event: normalized });
    this.scheduleDispatchFlush();
  }

  /**
   * Broadcast event to other clients via transport
   */
  async broadcastToOtherClients(event) {
    // Use transport if available
    if (this.transport && this.transportReady) {
      try {
        await this.transport.send(event);
      } catch (error) {
        logger.warn('[EventBus] Transport send failed', {
          error: error.message,
          transportType: this.transport?.getType()
        });
        // No fallback - transport layer handles its own retries and buffering
      }
    } else {
      logger.debug('[EventBus] Transport not ready, event not broadcast to other clients', {
        hasTransport: !!this.transport,
        transportReady: this.transportReady
      });
    }
  }

  /**
   * Get recent events for debugging
   */
  getEventLog() {
    return [...this.eventLog];
  }

  /**
   * Clear event log
   */
  clearEventLog() {
    const count = this.eventLog.length;
    this.eventLog = [];
    logger.debug('[EventBus] Event log cleared', { count });
  }

  /**
   * Get current vector clock (clone to prevent external mutation)
   */
  getVectorClock() {
    return VectorClock.clone(this.vectorClock);
  }

  /**
   * Compare local vector clock with an event's clock
   * @param {Object} eventClock - Vector clock from an event
   * @returns {'before' | 'after' | 'concurrent' | 'equal'} Ordering relationship
   */
  compareVectorClock(eventClock) {
    return VectorClock.compare(this.vectorClock, eventClock);
  }

  /**
   * Check if an event's clock indicates a concurrent edit
   * @param {Object} eventClock - Vector clock from an event
   * @returns {boolean} True if clocks are concurrent (potential conflict)
   */
  isConcurrentEdit(eventClock) {
    return VectorClock.isConcurrent(this.vectorClock, eventClock);
  }

  /**
   * Get transport type
   * @returns {string} Current transport type
   */
  getTransportType() {
    return this.transport?.getType() || 'fallback';
  }

  /**
   * Check if transport is connected
   * @returns {boolean}
   */
  isTransportConnected() {
    return this.transport?.isConnected() || false;
  }

  /**
   * Check if WebSocket is connected (for hybrid transport)
   * @returns {boolean}
   */
  isWebSocketConnected() {
    if (this.transport?.getType() === 'hybrid') {
      return this.transport.isWebSocketConnected?.() || false;
    }
    return this.transport?.getType() === 'websocket' && this.transport.isConnected();
  }
}

// Singleton instance
export const eventBus = new EventBus();

/**
 * Helper: Broadcast event
 */
export function broadcastEvent(eventName, detail) {
  eventBus.emit(eventName, detail);
}

/**
 * Helper: Subscribe to event
 */
export function subscribeToEvent(eventName, handler) {
  return eventBus.subscribe(eventName, handler);
}

/**
 * Generate optimistic ID for client-side temporary IDs
 * Uses cryptographically secure random values
 */
export function generateOptimisticId(prefix = 'temp') {
  const timestamp = Date.now();
  // Use cryptographically secure random values instead of Math.random()
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  const random = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Check if an ID is optimistic (temporary)
 * Optimistic IDs follow the pattern: prefix_timestamp_random
 * Common prefixes: temp_, plan_, item_, etc.
 */
export function isOptimisticId(id) {
  if (typeof id !== 'string') return false;
  // Match pattern: word_timestamp_hexstring (e.g., plan_1767574804381_0cad0b87066456e6)
  const optimisticPattern = /^[a-z]+_\d{13,}_[0-9a-f]{16}$/;
  return optimisticPattern.test(id);
}

/**
 * Local change protection window (in milliseconds)
 * Recent local changes within this window will NOT be overwritten by remote events
 */
export const LOCAL_CHANGE_PROTECTION_MS = 5000; // 5 seconds

/**
 * Check if a field is protected from remote updates
 *
 * @param {object} localModifications - Map of field -> lastModifiedTimestamp
 * @param {string} field - Field name to check
 * @returns {boolean} True if field is protected
 */
export function isFieldProtected(localModifications, field) {
  if (!localModifications || !field) return false;
  const lastModified = localModifications[field];
  if (!lastModified) return false;
  return (Date.now() - lastModified) < LOCAL_CHANGE_PROTECTION_MS;
}

/**
 * Get list of currently protected fields
 *
 * @param {object} localModifications - Map of field -> lastModifiedTimestamp
 * @returns {string[]} Array of protected field names
 */
export function getProtectedFields(localModifications) {
  if (!localModifications) return [];
  const now = Date.now();
  return Object.entries(localModifications)
    .filter(([_, timestamp]) => (now - timestamp) < LOCAL_CHANGE_PROTECTION_MS)
    .map(([field]) => field);
}

/**
 * Reconcile state with incoming event based on version and vector clock
 * Supports local change protection via options.protectedFields
 * Detects concurrent edits via vector clock comparison
 *
 * @param {object} currentState - Current state object
 * @param {object} event - Incoming event
 * @param {object} options - Reconciliation options
 * @param {string[]} options.protectedFields - Fields to exclude from remote updates
 * @param {Object} options.localVectorClock - Local vector clock for causal comparison
 * @param {function} options.onConflict - Callback for conflict resolution (concurrent edits)
 * @returns {object|null} New state or null if should ignore
 */
export function reconcileState(currentState, event, options = {}) {
  if (!event || !event.data) return null;

  const { data, version, optimisticId, vectorClock: eventClock } = event;
  const { protectedFields = [], localVectorClock, onConflict } = options;

  // No current state - accept event (but still filter protected fields if any)
  if (!currentState) {
    logger.debug('[EventBus] No current state, accepting event', {
      version,
      optimisticId,
      protectedFields: protectedFields.length,
      hasVectorClock: !!eventClock
    });

    // If we have protected fields and somehow no current state,
    // just accept the data as-is (edge case)
    return { ...data, _version: version, _vectorClock: eventClock };
  }

  // Optimistic ID matches - replace with canonical
  // But preserve protected fields from current state
  if (optimisticId && currentState._id === optimisticId) {
    logger.debug('[EventBus] Optimistic ID match, replacing with canonical', {
      optimisticId,
      canonicalId: data._id,
      version,
      protectedFields: protectedFields.length
    });

    // Merge: use canonical data but preserve protected fields from current state
    const mergedData = { ...data };
    if (protectedFields.length > 0) {
      protectedFields.forEach(field => {
        if (currentState[field] !== undefined) {
          mergedData[field] = currentState[field];
          logger.debug('[EventBus] Preserving protected field during optimistic reconciliation', {
            field,
            preservedValue: currentState[field]
          });
        }
      });
    }

    return { ...mergedData, _version: version, _vectorClock: eventClock };
  }

  // Vector clock comparison (if available) for causal ordering
  if (eventClock && localVectorClock) {
    const clockComparison = VectorClock.compare(localVectorClock, eventClock);

    logger.debug('[EventBus] Vector clock comparison', {
      comparison: clockComparison,
      localClock: VectorClock.format(localVectorClock),
      eventClock: VectorClock.format(eventClock)
    });

    // Concurrent edit detected - need conflict resolution
    if (clockComparison === 'concurrent') {
      logger.warn('[EventBus] Concurrent edit detected', {
        localClock: VectorClock.format(localVectorClock),
        eventClock: VectorClock.format(eventClock),
        protectedFields: protectedFields.length
      });

      // If we have a conflict handler, use it
      if (typeof onConflict === 'function') {
        const resolved = onConflict(currentState, data, {
          localClock: localVectorClock,
          eventClock,
          version,
          protectedFields
        });
        if (resolved) {
          return { ...resolved, _version: version, _vectorClock: VectorClock.merge(localVectorClock, eventClock) };
        }
      }

      // Default: preserve protected fields, accept non-protected from event
      const mergedData = { ...currentState, ...data };
      if (protectedFields.length > 0) {
        protectedFields.forEach(field => {
          if (currentState[field] !== undefined) {
            mergedData[field] = currentState[field];
          }
        });
      }
      return { ...mergedData, _version: version, _vectorClock: VectorClock.merge(localVectorClock, eventClock) };
    }

    // Event happened after us - accept it (preserving protected fields)
    if (clockComparison === 'before') {
      logger.debug('[EventBus] Event is causally newer (vector clock), accepting', {
        protectedFields: protectedFields.length
      });

      const mergedData = { ...data };
      if (protectedFields.length > 0) {
        protectedFields.forEach(field => {
          if (currentState[field] !== undefined) {
            mergedData[field] = currentState[field];
          }
        });
      }
      return { ...mergedData, _version: version, _vectorClock: eventClock };
    }

    // Event happened before us - ignore (stale)
    if (clockComparison === 'after') {
      logger.debug('[EventBus] Event is causally older (vector clock), ignoring');
      return null;
    }
  }

  // Fallback to version comparison - accept if newer
  const currentVersion = currentState._version || 0;
  if (version > currentVersion) {
    logger.debug('[EventBus] Newer version (timestamp), accepting event', {
      currentVersion,
      newVersion: version,
      protectedFields: protectedFields.length
    });

    // Merge: use new data but preserve protected fields from current state
    const mergedData = { ...data };
    if (protectedFields.length > 0) {
      protectedFields.forEach(field => {
        if (currentState[field] !== undefined) {
          mergedData[field] = currentState[field];
          logger.debug('[EventBus] Preserving protected field during version reconciliation', {
            field,
            preservedValue: currentState[field],
            discardedValue: data[field]
          });
        }
      });
    }

    return { ...mergedData, _version: version, _vectorClock: eventClock };
  }

  // Stale event - ignore
  logger.debug('[EventBus] Stale event, ignoring', {
    currentVersion,
    eventVersion: version
  });
  return null;
}

// Re-export VectorClock utilities for use in components
export { VectorClock };

export default eventBus;
