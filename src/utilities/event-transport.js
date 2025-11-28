/**
 * Event Transport Abstraction Layer
 *
 * Provides pluggable transport mechanisms for the EventBus.
 * Supports localStorage (default) and WebSocket transports.
 *
 * Configuration via environment variables:
 * - REACT_APP_EVENT_TRANSPORT: 'localStorage' | 'websocket' | 'hybrid' (default: 'localStorage')
 * - REACT_APP_WEBSOCKET_URL: WebSocket server URL (required for 'websocket' or 'hybrid' transport)
 * - REACT_APP_WEBSOCKET_RECONNECT_INTERVAL: Reconnection interval in ms (default: 3000)
 * - REACT_APP_WEBSOCKET_MAX_RECONNECT_ATTEMPTS: Max reconnection attempts (default: 10)
 *
 * @module event-transport
 */

import { logger } from './logger';

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
 */
export class LocalStorageTransport extends EventTransport {
  constructor(options = {}) {
    super(options);
    this.storageKey = options.storageKey || 'bien:event';
    this.sessionId = options.sessionId;
    this.handleStorageEvent = this.handleStorageEvent.bind(this);
  }

  async connect() {
    if (typeof window === 'undefined') {
      logger.warn('[LocalStorageTransport] Not in browser environment');
      return;
    }

    window.addEventListener('storage', this.handleStorageEvent);
    this.connected = true;
    logger.info('[LocalStorageTransport] Connected');
  }

  async disconnect() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
    this.connected = false;
    logger.info('[LocalStorageTransport] Disconnected');
  }

  async send(event) {
    if (typeof window === 'undefined' || !window.localStorage) {
      logger.warn('[LocalStorageTransport] localStorage not available');
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(event));
      logger.debug('[LocalStorageTransport] Event sent', {
        eventType: event.type,
        version: event.version
      });
    } catch (error) {
      // Quota exceeded - clear and retry
      logger.warn('[LocalStorageTransport] Quota exceeded, clearing old events');
      try {
        localStorage.removeItem(this.storageKey);
        localStorage.setItem(this.storageKey, JSON.stringify(event));
      } catch (retryError) {
        logger.error('[LocalStorageTransport] Failed to send after clearing', {
          error: retryError.message
        }, retryError);
      }
    }
  }

  handleStorageEvent(e) {
    if (e.key !== this.storageKey) return;
    if (!e.newValue) return;

    try {
      const event = JSON.parse(e.newValue);

      // Ignore own events
      if (event.sessionId === this.sessionId) {
        logger.debug('[LocalStorageTransport] Ignoring own event');
        return;
      }

      logger.debug('[LocalStorageTransport] Received event', {
        eventType: event.type,
        version: event.version
      });

      this.notifyListeners(event);
    } catch (error) {
      logger.error('[LocalStorageTransport] Error parsing event', {
        error: error.message
      }, error);
    }
  }

  getType() {
    return 'localStorage';
  }
}

/**
 * WebSocket Transport
 * Uses WebSocket connection for real-time event synchronization
 * Requires REACT_APP_WEBSOCKET_URL environment variable
 */
export class WebSocketTransport extends EventTransport {
  constructor(options = {}) {
    super(options);
    this.url = options.url || process.env.REACT_APP_WEBSOCKET_URL;
    this.reconnectInterval = options.reconnectInterval ||
      parseInt(process.env.REACT_APP_WEBSOCKET_RECONNECT_INTERVAL, 10) || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ||
      parseInt(process.env.REACT_APP_WEBSOCKET_MAX_RECONNECT_ATTEMPTS, 10) || 10;
    this.reconnectAttempts = 0;
    this.socket = null;
    this.reconnectTimer = null;
    this.pendingMessages = [];
    this.sessionId = options.sessionId;
    this.authToken = options.authToken;
  }

  async connect() {
    if (!this.url) {
      logger.error('[WebSocketTransport] No WebSocket URL configured');
      throw new Error('WebSocket URL not configured. Set REACT_APP_WEBSOCKET_URL environment variable.');
    }

    return new Promise((resolve, reject) => {
      try {
        // Add auth token to URL if available
        const url = this.authToken
          ? `${this.url}?token=${encodeURIComponent(this.authToken)}`
          : this.url;

        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          logger.info('[WebSocketTransport] Connected', { url: this.url });

          // Send any pending messages
          while (this.pendingMessages.length > 0) {
            const msg = this.pendingMessages.shift();
            this.sendRaw(msg);
          }

          resolve();
        };

        this.socket.onclose = (e) => {
          this.connected = false;
          logger.warn('[WebSocketTransport] Disconnected', {
            code: e.code,
            reason: e.reason,
            wasClean: e.wasClean
          });

          // Auto-reconnect if not intentionally closed
          if (e.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.socket.onerror = (error) => {
          logger.error('[WebSocketTransport] Error', { error: error.message });
          if (!this.connected) {
            reject(error);
          }
        };

        this.socket.onmessage = (e) => {
          try {
            const event = JSON.parse(e.data);

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
        };
      } catch (error) {
        logger.error('[WebSocketTransport] Failed to connect', {
          error: error.message
        }, error);
        reject(error);
      }
    });
  }

  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.connected = false;
    logger.info('[WebSocketTransport] Disconnected');
  }

  async send(event) {
    if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Queue message for when connection is restored
      logger.debug('[WebSocketTransport] Queuing message (not connected)');
      this.pendingMessages.push(event);

      // If pending queue gets too large, drop oldest messages
      if (this.pendingMessages.length > 100) {
        this.pendingMessages.shift();
        logger.warn('[WebSocketTransport] Pending queue full, dropping oldest message');
      }
      return;
    }

    this.sendRaw(event);
  }

  sendRaw(event) {
    try {
      this.socket.send(JSON.stringify(event));
      logger.debug('[WebSocketTransport] Event sent', {
        eventType: event.type,
        version: event.version
      });
    } catch (error) {
      logger.error('[WebSocketTransport] Failed to send', {
        error: error.message
      }, error);
      // Queue for retry
      this.pendingMessages.push(event);
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    const maxDelay = 30000; // Cap at 30 seconds
    const actualDelay = Math.min(delay, maxDelay);

    logger.info('[WebSocketTransport] Scheduling reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay: actualDelay
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        logger.error('[WebSocketTransport] Reconnect failed', {
          error: error.message,
          attempt: this.reconnectAttempts
        });
        // Will retry again via onclose handler
      }
    }, actualDelay);
  }

  getType() {
    return 'websocket';
  }
}

/**
 * Hybrid Transport
 * Uses both localStorage and WebSocket transports simultaneously
 * WebSocket for real-time updates, localStorage as fallback for cross-tab
 */
export class HybridTransport extends EventTransport {
  constructor(options = {}) {
    super(options);
    this.localStorage = new LocalStorageTransport(options);
    this.webSocket = new WebSocketTransport(options);
    this.preferWebSocket = options.preferWebSocket !== false;
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
      webSocketConnected: this.webSocket.isConnected()
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

  getType() {
    return 'hybrid';
  }
}

/**
 * Create transport based on environment configuration
 *
 * @param {object} options - Transport options
 * @returns {EventTransport} Configured transport instance
 */
export function createTransport(options = {}) {
  const transportType = process.env.REACT_APP_EVENT_TRANSPORT || 'localStorage';

  logger.info('[EventTransport] Creating transport', {
    type: transportType,
    hasWebSocketUrl: !!process.env.REACT_APP_WEBSOCKET_URL
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

export default {
  EventTransport,
  LocalStorageTransport,
  WebSocketTransport,
  HybridTransport,
  createTransport
};
