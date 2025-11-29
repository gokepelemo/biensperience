/**
 * WebSocket Client with Connection Management
 *
 * Provides a robust WebSocket client with:
 * - Automatic reconnection with exponential backoff
 * - Connection state tracking
 * - Event buffering during disconnection
 * - JWT authentication via query parameter
 * - Heartbeat/ping-pong for connection health
 * - Graceful fallback notification
 *
 * Works with the server-side websocket-server.js.
 * Used by WebSocketTransport in event-transport.js.
 *
 * Configuration via environment variables:
 * - REACT_APP_WEBSOCKET_URL: WebSocket server URL (required)
 * - REACT_APP_WEBSOCKET_RECONNECT_INTERVAL: Base reconnection interval in ms (default: 3000)
 * - REACT_APP_WEBSOCKET_MAX_RECONNECT_ATTEMPTS: Max reconnection attempts (default: 10)
 *
 * @module websocket-client
 */

import { logger } from './logger';

/**
 * Connection states
 */
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed'
};

/**
 * WebSocket Client class
 */
export class WebSocketClient {
  constructor(options = {}) {
    this.url = options.url || process.env.REACT_APP_WEBSOCKET_URL;
    this.authToken = options.authToken;
    this.sessionId = options.sessionId;

    // Reconnection settings
    this.reconnectInterval = options.reconnectInterval ||
      parseInt(process.env.REACT_APP_WEBSOCKET_RECONNECT_INTERVAL, 10) || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ||
      parseInt(process.env.REACT_APP_WEBSOCKET_MAX_RECONNECT_ATTEMPTS, 10) || 10;

    // State
    this.socket = null;
    this.state = ConnectionState.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.lastPongReceived = null;

    // Event buffering
    this.pendingMessages = [];
    this.maxPendingMessages = options.maxPendingMessages || 100;

    // Listeners
    this.onMessageHandlers = new Set();
    this.onStateChangeHandlers = new Set();

    // Heartbeat settings
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.heartbeatTimeout = options.heartbeatTimeout || 10000;

    // Bind methods
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<void>}
   */
  async connect() {
    if (!this.url) {
      logger.error('[WebSocketClient] No WebSocket URL configured');
      this.setState(ConnectionState.FAILED);
      throw new Error('WebSocket URL not configured. Set REACT_APP_WEBSOCKET_URL environment variable.');
    }

    if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.CONNECTING) {
      logger.debug('[WebSocketClient] Already connected or connecting');
      return;
    }

    this.setState(ConnectionState.CONNECTING);

    return new Promise((resolve, reject) => {
      try {
        // Build URL with auth token and session ID
        const params = new URLSearchParams();
        if (this.authToken) {
          params.set('token', this.authToken);
        }
        if (this.sessionId) {
          params.set('sessionId', this.sessionId);
        }

        const urlWithParams = params.toString()
          ? `${this.url}?${params.toString()}`
          : this.url;

        logger.info('[WebSocketClient] Connecting', { url: this.url });
        this.socket = new WebSocket(urlWithParams);

        // Store resolve/reject for handlers
        this._connectResolve = resolve;
        this._connectReject = reject;

        this.socket.onopen = this.handleOpen;
        this.socket.onclose = this.handleClose;
        this.socket.onerror = this.handleError;
        this.socket.onmessage = this.handleMessage;
      } catch (error) {
        logger.error('[WebSocketClient] Failed to create WebSocket', {
          error: error.message
        }, error);
        this.setState(ConnectionState.FAILED);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   * @param {number} code - Close code (default: 1000 normal closure)
   * @param {string} reason - Close reason
   */
  disconnect(code = 1000, reason = 'Client disconnect') {
    this.clearTimers();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect

    if (this.socket) {
      try {
        this.socket.close(code, reason);
      } catch (error) {
        logger.debug('[WebSocketClient] Error closing socket', { error: error.message });
      }
      this.socket = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
    logger.info('[WebSocketClient] Disconnected', { code, reason });
  }

  /**
   * Send a message through the WebSocket
   * @param {object} message - Message to send
   * @returns {boolean} True if sent immediately, false if queued
   */
  send(message) {
    if (this.state === ConnectionState.CONNECTED && this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
        logger.debug('[WebSocketClient] Message sent', { type: message.type });
        return true;
      } catch (error) {
        logger.error('[WebSocketClient] Failed to send message', {
          error: error.message,
          type: message.type
        }, error);
        this.queueMessage(message);
        return false;
      }
    } else {
      this.queueMessage(message);
      return false;
    }
  }

  /**
   * Queue a message for later delivery
   * @param {object} message - Message to queue
   */
  queueMessage(message) {
    // Add timestamp to track age
    const timestampedMessage = {
      ...message,
      _queuedAt: Date.now()
    };

    this.pendingMessages.push(timestampedMessage);

    // Trim queue if too large (FIFO)
    while (this.pendingMessages.length > this.maxPendingMessages) {
      const dropped = this.pendingMessages.shift();
      logger.warn('[WebSocketClient] Dropped oldest queued message', {
        type: dropped.type,
        age: Date.now() - dropped._queuedAt
      });
    }

    logger.debug('[WebSocketClient] Message queued', {
      type: message.type,
      queueSize: this.pendingMessages.length
    });
  }

  /**
   * Flush pending messages queue
   */
  flushPendingMessages() {
    if (this.pendingMessages.length === 0) return;

    logger.info('[WebSocketClient] Flushing pending messages', {
      count: this.pendingMessages.length
    });

    // Process messages (remove _queuedAt before sending)
    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      delete message._queuedAt;

      if (this.socket?.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify(message));
        } catch (error) {
          // Re-queue failed messages at the front
          this.pendingMessages.unshift(message);
          logger.error('[WebSocketClient] Failed to flush message', {
            error: error.message
          });
          break;
        }
      } else {
        // Re-queue if socket closed
        this.pendingMessages.unshift(message);
        break;
      }
    }
  }

  /**
   * Subscribe to incoming messages
   * @param {function} handler - Message handler
   * @returns {function} Unsubscribe function
   */
  onMessage(handler) {
    this.onMessageHandlers.add(handler);
    return () => this.onMessageHandlers.delete(handler);
  }

  /**
   * Subscribe to connection state changes
   * @param {function} handler - State change handler (receives new state, old state)
   * @returns {function} Unsubscribe function
   */
  onStateChange(handler) {
    this.onStateChangeHandlers.add(handler);
    return () => this.onStateChangeHandlers.delete(handler);
  }

  /**
   * Get current connection state
   * @returns {string} Connection state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.state === ConnectionState.CONNECTED &&
      this.socket?.readyState === WebSocket.OPEN;
  }

  /**
   * Get pending message count
   * @returns {number}
   */
  getPendingCount() {
    return this.pendingMessages.length;
  }

  /**
   * Update auth token (for token refresh)
   * @param {string} token - New auth token
   */
  updateAuthToken(token) {
    this.authToken = token;
    logger.debug('[WebSocketClient] Auth token updated');
  }

  // === Private Methods ===

  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    this.setState(ConnectionState.CONNECTED);
    this.reconnectAttempts = 0;
    this.lastPongReceived = Date.now();

    logger.info('[WebSocketClient] Connected', { url: this.url });

    // Start heartbeat
    this.startHeartbeat();

    // Flush pending messages
    this.flushPendingMessages();

    // Resolve connection promise
    if (this._connectResolve) {
      this._connectResolve();
      this._connectResolve = null;
      this._connectReject = null;
    }
  }

  /**
   * Handle WebSocket close event
   * @param {CloseEvent} event - Close event
   */
  handleClose(event) {
    this.clearTimers();

    const wasConnected = this.state === ConnectionState.CONNECTED;

    logger.warn('[WebSocketClient] Connection closed', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      wasConnected
    });

    // Don't reconnect for intentional closures or auth failures
    const shouldReconnect = event.code !== 1000 && // Normal closure
      event.code !== 1008 && // Policy violation (auth)
      event.code !== 4001 && // Custom: Auth failure
      this.reconnectAttempts < this.maxReconnectAttempts;

    if (shouldReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState(
        this.reconnectAttempts >= this.maxReconnectAttempts
          ? ConnectionState.FAILED
          : ConnectionState.DISCONNECTED
      );
    }

    // Reject connection promise if still pending
    if (this._connectReject) {
      this._connectReject(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
      this._connectResolve = null;
      this._connectReject = null;
    }
  }

  /**
   * Handle WebSocket error event
   * @param {Event} error - Error event
   */
  handleError(error) {
    logger.error('[WebSocketClient] WebSocket error', {
      message: error.message || 'Unknown error'
    });

    // Error is usually followed by close, so let close handler manage state
  }

  /**
   * Handle WebSocket message event
   * @param {MessageEvent} event - Message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);

      // Handle pong for heartbeat
      if (message.type === 'pong') {
        this.lastPongReceived = Date.now();
        return;
      }

      logger.debug('[WebSocketClient] Message received', {
        type: message.type
      });

      // Notify all handlers
      this.onMessageHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (err) {
          logger.error('[WebSocketClient] Error in message handler', {
            error: err.message
          }, err);
        }
      });
    } catch (error) {
      logger.error('[WebSocketClient] Failed to parse message', {
        error: error.message
      }, error);
    }
  }

  /**
   * Set connection state and notify handlers
   * @param {string} newState - New state
   */
  setState(newState) {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;
    logger.debug('[WebSocketClient] State changed', { from: oldState, to: newState });

    // Notify handlers
    this.onStateChangeHandlers.forEach(handler => {
      try {
        handler(newState, oldState);
      } catch (err) {
        logger.error('[WebSocketClient] Error in state change handler', {
          error: err.message
        }, err);
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    this.setState(ConnectionState.RECONNECTING);

    // Exponential backoff with jitter
    const baseDelay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
    const delay = Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds

    logger.info('[WebSocketClient] Scheduling reconnect', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay: Math.round(delay)
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        logger.error('[WebSocketClient] Reconnect failed', {
          error: error.message,
          attempt: this.reconnectAttempts
        });
        // Close handler will schedule next attempt if under max
      }
    }, delay);
  }

  /**
   * Start heartbeat interval
   */
  startHeartbeat() {
    this.clearTimers();

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;

      // Check if we received a pong recently
      const now = Date.now();
      if (this.lastPongReceived && (now - this.lastPongReceived) > this.heartbeatInterval + this.heartbeatTimeout) {
        logger.warn('[WebSocketClient] Heartbeat timeout, reconnecting');
        this.socket.close(4000, 'Heartbeat timeout');
        return;
      }

      // Send ping
      try {
        this.socket.send(JSON.stringify({ type: 'ping', timestamp: now }));
      } catch (error) {
        logger.error('[WebSocketClient] Failed to send ping', { error: error.message });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Clear all timers
   */
  clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

/**
 * Create a new WebSocket client
 * @param {object} options - Client options
 * @returns {WebSocketClient}
 */
export function createWebSocketClient(options = {}) {
  return new WebSocketClient(options);
}

export default WebSocketClient;
