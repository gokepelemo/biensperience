/**
 * Event Transport Abstraction Layer
 *
 * Provides pluggable transport mechanisms for the EventBus.
 * Supports localStorage (default) and WebSocket transports.
 *
 * Features:
 * - Encrypted localStorage storage to prevent data leakage
 * - Consolidated storage key (single `bien:events` key)
 * - WebSocket with automatic reconnection via websocket-client.js
 * - Hybrid mode for maximum reliability
 *
 * Configuration via environment variables:
 * - REACT_APP_EVENT_TRANSPORT: 'localStorage' | 'websocket' | 'hybrid' (default: 'localStorage')
 * - REACT_APP_WEBSOCKET_URL: WebSocket server URL (required for 'websocket' or 'hybrid' transport)
 * - REACT_APP_WEBSOCKET_RECONNECT_INTERVAL: Reconnection interval in ms (default: 3000)
 * - REACT_APP_WEBSOCKET_MAX_RECONNECT_ATTEMPTS: Max reconnection attempts (default: 10)
 *
 * Storage Key Consolidation:
 * - All events stored under single `bien:events` key
 * - Encrypted using user's ID (AES-GCM 256-bit) when userId provided
 * - Automatic cleanup of events older than 5 minutes
 *
 * @module event-transport
 */

import { logger } from './logger';
import { encryptData, decryptData } from './crypto-utils';
import { STORAGE_KEYS } from './storage-keys';
import { WebSocketClient, ConnectionState } from './websocket-client';

/**
 * Abstract Transport interface
 * All transports must implement these methods
 */
class EventTransport {
  constructor(options = {}) {
    this.options = options;
    this.listeners = new Set();
    this.connected = false;
  }

  /**
   * Initialize the transport
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Close the transport connection
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Send an event through the transport
   * @param {object} event - Event object to send
   * @returns {Promise<void>}
   */
  async send(event) {
    throw new Error('send() must be implemented by subclass');
  }

  /**
   * Subscribe to incoming events
   * @param {function} handler - Callback for incoming events
   * @returns {function} Unsubscribe function
   */
  onMessage(handler) {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /**
   * Notify all listeners of an incoming event
   * @param {object} event - Received event
   */
  notifyListeners(event) {
    this.listeners.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        logger.error('[EventTransport] Error in message handler', { error: error.message }, error);
      }
    });
  }

  /**
   * Check if transport is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get transport type
   * @returns {string}
   */
  getType() {
    return 'abstract';
  }
}

/**
 * LocalStorage Transport
 * Uses localStorage and storage events for cross-tab communication
 * This is the default transport and requires no additional configuration
 *
 * Features:
 * - Consolidated storage key (single `bien:events` key)
 * - Optional AES-GCM 256-bit encryption when userId provided
 * - Automatic cleanup of events older than 5 minutes
 * - Session ID deduplication for own events
 */
export class LocalStorageTransport extends EventTransport {
  constructor(options = {}) {
    super(options);
    // Consolidated storage key - all events under one key
    this.storageKey = options.storageKey || STORAGE_KEYS.events;
    this.sessionId = options.sessionId;
    this.userId = options.userId; // For encryption key derivation
    this.eventTTL = options.eventTTL || 5 * 60 * 1000; // 5 minutes default
    this.maxEvents = options.maxEvents || 50; // Max events to store
    this.handleStorageEvent = this.handleStorageEvent.bind(this);
    this.processedEventIds = new Set(); // Deduplication
    this.maxProcessedIds = 100; // Max IDs to track for deduplication

    // Write batching to reduce repeated read/encrypt/write cycles during bursts
    this._pendingSends = [];
    this._flushPromise = null;
  }

  _getStorage() {
    if (typeof window === 'undefined') return null;
    // If no userId (anonymous), avoid writing plaintext events to localStorage.
    // Use sessionStorage (tab-scoped) instead.
    return this.userId ? window.localStorage : window.sessionStorage;
  }

  _isCrossTabEnabled() {
    return !!this.userId;
  }

  /**
   * Trim processedEventIds set to prevent unbounded growth
   * Uses efficient LRU-style cleanup
   */
  trimProcessedIds() {
    if (this.processedEventIds.size <= this.maxProcessedIds) return;

    // Remove oldest entries (Set preserves insertion order)
    const toRemove = this.processedEventIds.size - this.maxProcessedIds;
    let removed = 0;
    for (const id of this.processedEventIds) {
      if (removed >= toRemove) break;
      this.processedEventIds.delete(id);
      removed++;
    }
  }

  async connect() {
    if (typeof window === 'undefined') {
      logger.warn('[LocalStorageTransport] Not in browser environment');
      return;
    }

    // Only localStorage emits cross-tab storage events.
    if (this._isCrossTabEnabled()) {
      window.addEventListener('storage', this.handleStorageEvent);
    }
    this.connected = true;

    // Perform initial cleanup of old events
    await this.cleanupOldEvents();

    logger.info('[LocalStorageTransport] Connected', {
      encrypted: !!this.userId,
      storageKey: this.storageKey,
      crossTab: this._isCrossTabEnabled()
    });
  }

  async disconnect() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
    this.connected = false;
    this.processedEventIds.clear();
    logger.info('[LocalStorageTransport] Disconnected');
  }

  /**
   * Read and decrypt the events list from localStorage
   * @returns {Promise<Array>} Array of stored events
   */
  async readEventsList() {
    const storage = this._getStorage();
    if (!storage) {
      return [];
    }

    try {
      const stored = storage.getItem(this.storageKey);
      if (!stored) return [];

      // Always attempt decryption first. When no userId is available, crypto-utils
      // uses deterministic anon key material so we never persist plaintext at rest.
      try {
        const decrypted = await decryptData(stored, this.userId);
        return Array.isArray(decrypted) ? decrypted : [];
      } catch (decryptError) {
        // May be unencrypted legacy data, try parsing directly
        logger.debug('[LocalStorageTransport] Decryption failed, trying plain JSON', {
          error: decryptError.message
        });
      }

      // Fallback to plain JSON parsing
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.warn('[LocalStorageTransport] Error reading events list - clearing corrupted data', {
        error: error.message
      });
      // Clear corrupted data to prevent persistent errors
      try {
        storage.removeItem(this.storageKey);
      } catch (clearError) {
        // Ignore clear errors
      }
      return [];
    }
  }

  /**
   * Write and encrypt the events list to localStorage
   * @param {Array} events - Array of events to store
   */
  async writeEventsList(events) {
    const storage = this._getStorage();
    if (!storage) {
      return;
    }

    try {
      // Always encrypt (user-scoped when userId is present, anon-scoped otherwise).
      const dataToStore = await encryptData(events, this.userId);

      storage.setItem(this.storageKey, dataToStore);
    } catch (error) {
      logger.error('[LocalStorageTransport] Error writing events list', {
        error: error.message
      }, error);

      // On quota exceeded, clear and retry
      if (error.name === 'QuotaExceededError') {
        try {
          storage.removeItem(this.storageKey);
          const dataToStore = await encryptData(events.slice(-10), this.userId); // Keep only last 10
          storage.setItem(this.storageKey, dataToStore);
        } catch (retryError) {
          logger.error('[LocalStorageTransport] Failed to write after clearing', {
            error: retryError.message
          }, retryError);
        }
      }
    }
  }

  /**
   * Remove events older than TTL
   */
  async cleanupOldEvents() {
    const events = await this.readEventsList();
    const now = Date.now();
    const validEvents = events.filter(event => {
      const eventTime = event.timestamp || event.version || 0;
      return (now - eventTime) < this.eventTTL;
    });

    if (validEvents.length !== events.length) {
      logger.debug('[LocalStorageTransport] Cleaned up old events', {
        removed: events.length - validEvents.length,
        remaining: validEvents.length
      });
      await this.writeEventsList(validEvents);
    }
  }

  async send(event) {
    const storage = this._getStorage();
    if (!storage) {
      logger.warn('[LocalStorageTransport] Storage not available');
      return;
    }

    try {
      // Generate unique event ID if not present
      const eventWithId = {
        ...event,
        _eventId: event._eventId || `${this.sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: event.timestamp || Date.now()
      };

      // Queue the event and flush in a single write.
      this._pendingSends.push(eventWithId);

      // Flush queued sends (coalesces multiple send() calls into one read/write)
      await this.flushPendingSends();

      // Track as processed to avoid self-notification
      this.processedEventIds.add(eventWithId._eventId);
      this.trimProcessedIds();

      logger.debug('[LocalStorageTransport] Event sent', {
        eventType: event.type,
        version: event.version,
        encrypted: !!this.userId
      });
    } catch (error) {
      logger.error('[LocalStorageTransport] Failed to send event', {
        error: error.message
      }, error);
    }
  }

  /**
   * Flush queued events to localStorage with a single read/write.
   * Ensures flushes run sequentially.
   */
  async flushPendingSends() {
    if (this._flushPromise) {
      return this._flushPromise;
    }

    this._flushPromise = (async () => {
      // If multiple batches arrive while flushing, loop until drained.
      while (this._pendingSends.length > 0) {
        const batch = this._pendingSends.splice(0, this._pendingSends.length);

        // Read current events list
        const events = await this.readEventsList();

        // Add queued events
        events.push(...batch);

        // Trim to max events (keep most recent)
        const trimmedEvents = events.slice(-this.maxEvents);

        // Write back (encrypted if userId available)
        await this.writeEventsList(trimmedEvents);

        // Track as processed to avoid self-notification
        for (const ev of batch) {
          if (ev?._eventId) this.processedEventIds.add(ev._eventId);
        }
        this.trimProcessedIds();
      }
    })().finally(() => {
      this._flushPromise = null;
    });

    return this._flushPromise;
  }

  async handleStorageEvent(e) {
    if (!this._isCrossTabEnabled()) return;
    if (e.key !== this.storageKey) return;
    if (!e.newValue) return;

    try {
      // Read and decrypt the events list
      const events = await this.readEventsList();

      // Process only new events we haven't seen
      for (const event of events) {
        // Skip if already processed
        if (event._eventId && this.processedEventIds.has(event._eventId)) {
          continue;
        }

        // Skip own events by session ID
        if (event.sessionId === this.sessionId) {
          logger.debug('[LocalStorageTransport] Ignoring own event');
          continue;
        }

        // Track as processed
        if (event._eventId) {
          this.processedEventIds.add(event._eventId);
        }

        logger.debug('[LocalStorageTransport] Received event', {
          eventType: event.type,
          version: event.version
        });

        this.notifyListeners(event);
      }

      // Cleanup processed IDs set
      this.trimProcessedIds();
    } catch (error) {
      logger.error('[LocalStorageTransport] Error processing storage event', {
        error: error.message
      }, error);
    }
  }

  getType() {
    return 'localStorage';
  }

  /**
   * Check if encryption is enabled
   * @returns {boolean}
   */
  isEncrypted() {
    return true;
  }

  /**
   * Update user ID for encryption (e.g., after login)
   * @param {string} userId - User ID for key derivation
   */
  setUserId(userId) {
    const wasEncrypted = !!this.userId;
    this.userId = userId;

    // If we become authenticated while connected, start listening for cross-tab events.
    if (typeof window !== 'undefined' && this.connected) {
      try {
        if (!wasEncrypted && this._isCrossTabEnabled()) {
          window.addEventListener('storage', this.handleStorageEvent);
        }
        if (wasEncrypted && !this._isCrossTabEnabled()) {
          window.removeEventListener('storage', this.handleStorageEvent);
        }
      } catch (e) {
        // ignore listener failures
      }
    }

    // Migrate any anonymous (sessionStorage) events into encrypted localStorage when we gain a userId.
    if (!wasEncrypted && this._isCrossTabEnabled() && typeof window !== 'undefined') {
      (async () => {
        try {
          const raw = window.sessionStorage?.getItem(this.storageKey);
          if (!raw) return;

          let events;
          try {
            // Anonymous events are also encrypted (anon-scoped) to avoid plaintext at rest.
            const decrypted = await decryptData(raw, null);
            events = Array.isArray(decrypted) ? decrypted : [];
          } catch (decryptError) {
            // Legacy fallback: plaintext JSON array
            try {
              const parsed = JSON.parse(raw);
              events = Array.isArray(parsed) ? parsed : [];
            } catch {
              events = [];
            }
          }

          if (events.length > 0) {
            await this.writeEventsList(events);
          }

          try { window.sessionStorage?.removeItem(this.storageKey); } catch (e) {}
        } catch (e) {
          // ignore migration failures
        }
      })().catch(() => {});
    }

    logger.info('[LocalStorageTransport] Encryption key updated', {
      encrypted: !!userId
    });
  }
}

/**
 * WebSocket Transport
 * Uses WebSocket connection for real-time event synchronization
 * Requires REACT_APP_WEBSOCKET_URL environment variable
 *
 * Features:
 * - Uses WebSocketClient for connection lifecycle management
 * - Automatic reconnection with exponential backoff + jitter
 * - Connection state tracking with notifications
 * - Message buffering during disconnection
 * - Heartbeat/ping-pong for connection health
 */
export class WebSocketTransport extends EventTransport {
  constructor(options = {}) {
    super(options);
    this.sessionId = options.sessionId;
    this.stateListeners = new Set();
    this.connectionState = ConnectionState.DISCONNECTED;

    // Create WebSocketClient with options
    this.client = new WebSocketClient({
      url: options.url,
      authToken: options.authToken,
      sessionId: options.sessionId,
      reconnectInterval: options.reconnectInterval,
      maxReconnectAttempts: options.maxReconnectAttempts,
      heartbeatInterval: options.heartbeatInterval || 30000,
      heartbeatTimeout: options.heartbeatTimeout || 10000
    });

    // Subscribe to client state changes
    this.client.onStateChange((state) => {
      this.connectionState = state;
      this.connected = state === ConnectionState.CONNECTED;
      this.notifyStateListeners(state);

      logger.debug('[WebSocketTransport] Connection state changed', { state });
    });

    // Subscribe to client messages
    this.client.onMessage((data) => {
      try {
        const event = typeof data === 'string' ? JSON.parse(data) : data;

        // Ignore own events
        if (event.sessionId === this.sessionId) {
          logger.debug('[WebSocketTransport] Ignoring own event');
          return;
        }

        logger.debug('[WebSocketTransport] Received event', {
          eventType: event.type,
          version: event.version
        });

        this.notifyListeners(event);
      } catch (error) {
        logger.error('[WebSocketTransport] Error parsing message', {
          error: error.message
        }, error);
      }
    });
  }

  async connect() {
    try {
      await this.client.connect();
      logger.info('[WebSocketTransport] Connected');
    } catch (error) {
      logger.error('[WebSocketTransport] Failed to connect', {
        error: error.message
      }, error);
      throw error;
    }
  }

  async disconnect() {
    this.client.disconnect();
    logger.info('[WebSocketTransport] Disconnected');
  }

  async send(event) {
    // WebSocketClient handles queuing if not connected
    this.client.send(event);

    logger.debug('[WebSocketTransport] Event sent', {
      eventType: event.type,
      version: event.version,
      connected: this.connected
    });
  }

  /**
   * Subscribe to connection state changes
   * @param {function} handler - Callback receiving ConnectionState
   * @returns {function} Unsubscribe function
   */
  onStateChange(handler) {
    this.stateListeners.add(handler);
    // Immediately notify of current state
    handler(this.connectionState);
    return () => this.stateListeners.delete(handler);
  }

  /**
   * Notify all state listeners
   * @param {string} state - Current ConnectionState
   */
  notifyStateListeners(state) {
    this.stateListeners.forEach(handler => {
      try {
        handler(state);
      } catch (error) {
        logger.error('[WebSocketTransport] Error in state handler', {
          error: error.message
        }, error);
      }
    });
  }

  /**
   * Get current connection state
   * @returns {string} ConnectionState value
   */
  getConnectionState() {
    return this.connectionState;
  }

  /**
   * Check if currently reconnecting
   * @returns {boolean}
   */
  isReconnecting() {
    return this.connectionState === ConnectionState.RECONNECTING;
  }

  /**
   * Check if connection has permanently failed
   * @returns {boolean}
   */
  hasFailed() {
    return this.connectionState === ConnectionState.FAILED;
  }

  /**
   * Update auth token and reconnect WebSocket
   * Called after user logs in to establish authenticated connection.
   * @param {string} authToken - JWT token for authentication
   * @returns {Promise<void>}
   */
  async setAuthToken(authToken) {
    logger.info('[WebSocketTransport] Updating auth token and reconnecting');
    
    // Update the client's auth token
    this.client.updateAuthToken(authToken);
    
    // Disconnect current connection (if any)
    await this.disconnect();
    
    // Reset reconnect attempts to allow fresh connection
    this.client.reconnectAttempts = 0;
    
    // Reconnect with new auth token
    try {
      await this.connect();
      logger.info('[WebSocketTransport] Reconnected with new auth token');
    } catch (error) {
      logger.error('[WebSocketTransport] Failed to reconnect with new auth token', {
        error: error.message
      }, error);
      throw error;
    }
  }

  getType() {
    return 'websocket';
  }
}

/**
 * Hybrid Transport
 * Uses both localStorage and WebSocket transports simultaneously
 * WebSocket for real-time updates, localStorage as fallback for cross-tab
 *
 * Features:
 * - Dual transport for maximum reliability
 * - Automatic fallback when WebSocket unavailable
 * - Deduplication handled by EventBus via _eventId
 * - Connection state tracking from WebSocket
 * - Encryption support via userId (passed to localStorage)
 */
export class HybridTransport extends EventTransport {
  constructor(options = {}) {
    super(options);
    this.stateListeners = new Set();
    this.connectionState = ConnectionState.DISCONNECTED;

    // Create both transports with shared options
    this.localStorage = new LocalStorageTransport(options);
    this.webSocket = new WebSocketTransport(options);
    this.preferWebSocket = options.preferWebSocket !== false;

    // Forward WebSocket state changes
    this.webSocket.onStateChange((state) => {
      this.connectionState = state;
      this.notifyStateListeners(state);
    });
  }

  async connect() {
    // Always connect localStorage (reliable fallback)
    await this.localStorage.connect();

    // Try to connect WebSocket (optional, may fail)
    try {
      await this.webSocket.connect();
    } catch (error) {
      logger.warn('[HybridTransport] WebSocket connection failed, using localStorage only', {
        error: error.message
      });
    }

    // Forward WebSocket messages to listeners
    this.webSocket.onMessage((event) => {
      this.notifyListeners(event);
    });

    // Forward localStorage messages to listeners (deduplication handled by EventBus)
    this.localStorage.onMessage((event) => {
      this.notifyListeners(event);
    });

    this.connected = true;
    logger.info('[HybridTransport] Connected', {
      webSocketConnected: this.webSocket.isConnected(),
      encrypted: this.localStorage.isEncrypted()
    });
  }

  async disconnect() {
    await Promise.all([
      this.localStorage.disconnect(),
      this.webSocket.disconnect()
    ]);
    this.connected = false;
    logger.info('[HybridTransport] Disconnected');
  }

  async send(event) {
    // Send via both transports for maximum reliability
    const promises = [this.localStorage.send(event)];

    if (this.webSocket.isConnected()) {
      promises.push(this.webSocket.send(event));
    }

    await Promise.allSettled(promises);
  }

  isConnected() {
    // Connected if at least localStorage is working
    return this.localStorage.isConnected();
  }

  isWebSocketConnected() {
    return this.webSocket.isConnected();
  }

  /**
   * Subscribe to WebSocket connection state changes
   * @param {function} handler - Callback receiving ConnectionState
   * @returns {function} Unsubscribe function
   */
  onStateChange(handler) {
    this.stateListeners.add(handler);
    // Immediately notify of current state
    handler(this.connectionState);
    return () => this.stateListeners.delete(handler);
  }

  /**
   * Notify all state listeners
   * @param {string} state - Current ConnectionState
   */
  notifyStateListeners(state) {
    this.stateListeners.forEach(handler => {
      try {
        handler(state);
      } catch (error) {
        logger.error('[HybridTransport] Error in state handler', {
          error: error.message
        }, error);
      }
    });
  }

  /**
   * Get current WebSocket connection state
   * @returns {string} ConnectionState value
   */
  getConnectionState() {
    return this.connectionState;
  }

  /**
   * Update user ID for encryption (passed to localStorage transport)
   * @param {string} userId - User ID for key derivation
   */
  setUserId(userId) {
    this.localStorage.setUserId(userId);
  }

  /**
   * Update auth token and reconnect WebSocket
   * Called after user logs in to establish authenticated connection.
   * @param {string} authToken - JWT token for authentication
   * @returns {Promise<void>}
   */
  async setAuthToken(authToken) {
    // Delegate to WebSocket transport
    await this.webSocket.setAuthToken(authToken);
  }

  /**
   * Check if localStorage encryption is enabled
   * @returns {boolean}
   */
  isEncrypted() {
    return this.localStorage.isEncrypted();
  }

  getType() {
    return 'hybrid';
  }
}

/**
 * Create transport based on environment configuration
 *
 * @param {object} options - Transport options
 * @param {string} options.sessionId - Unique session ID for deduplication
 * @param {string} options.authToken - Auth token for WebSocket authentication
 * @param {string} options.userId - User ID for localStorage encryption
 * @param {string} options.url - WebSocket URL (overrides env var)
 * @param {number} options.reconnectInterval - WebSocket reconnect interval
 * @param {number} options.maxReconnectAttempts - Max WebSocket reconnect attempts
 * @param {number} options.eventTTL - localStorage event TTL in ms (default: 5 min)
 * @param {number} options.maxEvents - Max events to store in localStorage (default: 50)
 * @returns {EventTransport} Configured transport instance
 */
export function createTransport(options = {}) {
  const transportType = process.env.REACT_APP_EVENT_TRANSPORT || 'localStorage';

  logger.info('[EventTransport] Creating transport', {
    type: transportType,
    hasWebSocketUrl: !!process.env.REACT_APP_WEBSOCKET_URL,
    encrypted: !!options.userId
  });

  switch (transportType) {
    case 'websocket':
      return new WebSocketTransport(options);

    case 'hybrid':
      return new HybridTransport(options);

    case 'localStorage':
    default:
      return new LocalStorageTransport(options);
  }
}

// Re-export ConnectionState for consumers
export { ConnectionState } from './websocket-client';

export default {
  EventTransport,
  LocalStorageTransport,
  WebSocketTransport,
  HybridTransport,
  createTransport,
  ConnectionState
};
