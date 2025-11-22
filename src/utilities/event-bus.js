/**
 * Enhanced Event Bus with Version-Based Reconciliation
 *
 * Replaces timeout-based race condition prevention with version comparison.
 * Supports optimistic UI with automatic ID reconciliation.
 * Enables cross-tab synchronization via localStorage.
 */

import { logger } from './logger';
import { getUser } from './users-service';

class EventBus {
  constructor() {
    this.listeners = new Map(); // eventType -> Set<handler>
    this.eventLog = [];         // Recent events for debugging (max 100)
    this.sessionId = this.generateSessionId();
    this.initStorageListener();

    logger.info('[EventBus] Initialized', {
      sessionId: this.sessionId
    });
  }

  /**
   * Generate unique session ID to prevent duplicate processing
   * of own events in cross-tab scenarios
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
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
   * Emit event locally and broadcast to other tabs
   *
   * @param {string} eventType - Event type
   * @param {object} detail - Event payload
   * @param {object} options - Emit options (localOnly, etc.)
   */
  emit(eventType, detail, options = {}) {
    const user = getUser();

    const event = {
      type: eventType,
      version: detail.version || Date.now(),
      timestamp: Date.now(),
      userId: detail.userId || user?._id,
      sessionId: this.sessionId,
      ...detail
    };

    // Log for debugging (keep last 100 events)
    this.eventLog.push(event);
    if (this.eventLog.length > 100) {
      this.eventLog.shift();
    }

    logger.debug('[EventBus] Emitting event', {
      eventType,
      version: event.version,
      sessionId: event.sessionId,
      localOnly: options.localOnly
    });

    // Dispatch locally
    this.dispatchLocal(eventType, event);

    // Broadcast to other tabs (unless local-only)
    if (!options.localOnly) {
      this.broadcastToOtherTabs(event);
    }
  }

  /**
   * Dispatch event to local listeners
   */
  dispatchLocal(eventType, event) {
    const handlers = this.listeners.get(eventType);
    const handlerCount = handlers?.size || 0;

    if (handlers && handlers.size > 0) {
      logger.debug('[EventBus] Dispatching to local listeners', {
        eventType,
        handlerCount
      });

      handlers.forEach(handler => {
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

    // Also dispatch as CustomEvent for backward compatibility
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

  /**
   * Broadcast event to other browser tabs via localStorage
   */
  broadcastToOtherTabs(event) {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      // Use original key for backward compatibility
      localStorage.setItem('bien:event', JSON.stringify(event));

      logger.debug('[EventBus] Broadcast to other tabs', {
        eventType: event.type,
        version: event.version
      });
    } catch (error) {
      // Quota exceeded - clear and retry
      logger.warn('[EventBus] localStorage quota exceeded, clearing old events', {
        error: error.message
      });

      try {
        localStorage.removeItem('bien:event');
        localStorage.setItem('bien:event', JSON.stringify(event));
      } catch (retryError) {
        logger.error('[EventBus] Failed to broadcast event after clearing', {
          error: retryError.message
        }, retryError);
      }
    }
  }

  /**
   * Initialize storage listener for cross-tab synchronization
   */
  initStorageListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (e) => {
      // Handle both old and new event keys
      if (e.key !== 'bien:event' && e.key !== 'bien:plan_event') return;
      if (!e.newValue) return;

      try {
        const event = JSON.parse(e.newValue);

        // Ignore events from this session (already handled locally)
        if (event.sessionId === this.sessionId) {
          logger.debug('[EventBus] Ignoring own event from localStorage', {
            eventType: event.type || event.event,
            sessionId: event.sessionId
          });
          return;
        }

        // Handle new format (with type field)
        if (event.type) {
          logger.debug('[EventBus] Received event from other tab', {
            eventType: event.type,
            version: event.version,
            sessionId: event.sessionId
          });

          this.dispatchLocal(event.type, event);
        }
        // Handle old format (with event field) - backward compatibility
        else if (event.event) {
          logger.debug('[EventBus] Received legacy event from other tab', {
            eventType: event.event
          });

          this.dispatchLocal(event.event, event.detail || event);
        }
      } catch (error) {
        logger.error('[EventBus] Error parsing storage event', {
          error: error.message
        }, error);
      }
    });

    logger.info('[EventBus] Storage listener initialized');
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
   * Get current session ID
   */
  getSessionId() {
    return this.sessionId;
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
 */
export function generateOptimisticId(prefix = 'temp') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Check if an ID is optimistic (temporary)
 */
export function isOptimisticId(id) {
  return typeof id === 'string' && id.startsWith('temp_');
}

/**
 * Reconcile state with incoming event based on version
 *
 * @param {object} currentState - Current state object
 * @param {object} event - Incoming event
 * @returns {object|null} New state or null if should ignore
 */
export function reconcileState(currentState, event) {
  if (!event || !event.data) return null;

  const { data, version, optimisticId } = event;

  // No current state - accept event
  if (!currentState) {
    logger.debug('[EventBus] No current state, accepting event', {
      version,
      optimisticId
    });
    return { ...data, _version: version };
  }

  // Optimistic ID matches - replace with canonical
  if (optimisticId && currentState._id === optimisticId) {
    logger.debug('[EventBus] Optimistic ID match, replacing with canonical', {
      optimisticId,
      canonicalId: data._id,
      version
    });
    return { ...data, _version: version };
  }

  // Version comparison - accept if newer
  const currentVersion = currentState._version || 0;
  if (version > currentVersion) {
    logger.debug('[EventBus] Newer version, accepting event', {
      currentVersion,
      newVersion: version
    });
    return { ...data, _version: version };
  }

  // Stale event - ignore
  logger.debug('[EventBus] Stale event, ignoring', {
    currentVersion,
    eventVersion: version
  });
  return null;
}

export default eventBus;
