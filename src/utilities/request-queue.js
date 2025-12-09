/**
 * Request Queue with Token Bucket Rate Limiting
 *
 * Implements an elegant request management system to prevent backend overload
 * while maintaining swift user perception through:
 *
 * 1. Token Bucket Algorithm - Smooth rate limiting with burst allowance
 * 2. Priority Queue - Critical requests (auth, navigation) take precedence
 * 3. Request Coalescing - Duplicate requests within a window are merged
 * 4. Adaptive Concurrency - Adjusts based on backend response times (AIMD)
 * 5. UI Status Events - Components can subscribe to queue status for loading states
 *
 * @module request-queue
 */

import { logger } from './logger';

/**
 * Request priority levels (higher = more important)
 */
export const PRIORITY = Object.freeze({
  CRITICAL: 100,    // Auth, session, navigation - never queued
  HIGH: 80,         // User-initiated actions (save, delete)
  NORMAL: 50,       // Standard data fetches
  LOW: 20,          // Background sync, prefetch
  BACKGROUND: 10,   // Analytics, telemetry
});

/**
 * Configuration defaults
 */
const DEFAULT_CONFIG = Object.freeze({
  // Token bucket settings
  maxTokens: 20,              // Maximum burst capacity
  refillRate: 10,             // Tokens added per second
  refillInterval: 100,        // Refill check interval (ms)

  // Concurrency settings
  maxConcurrent: 6,           // Max parallel requests (browser limit)
  minConcurrent: 2,           // Minimum even under load

  // Adaptive settings
  targetLatency: 200,         // Target response time (ms)
  latencyWindow: 10,          // Samples for moving average
  adaptiveEnabled: true,      // Enable adaptive concurrency

  // Coalescing settings
  coalesceWindow: 50,         // Window for duplicate detection (ms)
  maxCoalesceWait: 200,       // Max wait for coalescence (ms)

  // Queue limits
  maxQueueSize: 100,          // Max pending requests
  queueTimeout: 30000,        // Request timeout in queue (ms)

  // Status notification throttling
  statusThrottleMs: 50,       // Min interval between status notifications
});

/**
 * Request states
 */
const STATE = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

/**
 * Generate unique request ID using crypto API
 */
function generateRequestId() {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return `req_${Date.now().toString(36)}_${Array.from(array, b => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Binary search to find insertion index in sorted array (descending by priority)
 * @param {Array} queue - Sorted queue array
 * @param {number} priority - Priority to insert
 * @returns {number} Insertion index
 */
function binarySearchInsertIndex(queue, priority) {
  let left = 0;
  let right = queue.length;

  while (left < right) {
    const mid = (left + right) >>> 1; // Unsigned right shift for floor division
    if (queue[mid].priority >= priority) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}

/**
 * Request Queue Manager
 * Manages all outgoing API requests with rate limiting and priority queuing
 */
class RequestQueue {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Token bucket state
    this.tokens = this.config.maxTokens;
    this.lastRefill = Date.now();

    // Queue state
    this.queue = [];              // Priority queue (sorted on insert)
    this.executing = new Map();   // Currently executing requests
    this.coalesceMap = new Map(); // Key -> pending request for coalescing
    this.timeoutIds = new Map();  // Request ID -> timeout ID for cleanup

    // Adaptive concurrency state
    this.latencyHistory = [];
    this.currentConcurrency = this.config.maxConcurrent;

    // Statistics
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      coalescedRequests: 0,
      queuedRequests: 0,
      avgLatency: 0,
      peakQueueSize: 0,
    };

    // Listeners for UI updates
    this.statusListeners = new Set();
    this.lastStatusNotify = 0;
    this.pendingStatusNotify = null;

    // Processing state - use event-driven processing instead of polling
    this.isProcessing = false;
    this.processScheduled = false;

    // Start token refill interval
    this.refillIntervalId = setInterval(
      () => this.refillTokens(),
      this.config.refillInterval
    );

    logger.debug('[RequestQueue] Initialized', {
      maxTokens: this.config.maxTokens,
      refillRate: this.config.refillRate,
      maxConcurrent: this.config.maxConcurrent,
    });
  }

  /**
   * Refill tokens based on elapsed time (token bucket algorithm)
   */
  refillTokens() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.config.refillRate;

    const hadNoTokens = this.tokens < 1;
    this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;

    // If we gained tokens and have pending requests, schedule processing
    if (hadNoTokens && this.tokens >= 1 && this.queue.length > 0) {
      this.scheduleProcessing();
    }
  }

  /**
   * Try to consume a token
   * @returns {boolean} True if token was consumed
   */
  consumeToken() {
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Schedule queue processing (event-driven, not polling)
   */
  scheduleProcessing() {
    if (this.processScheduled) return;
    this.processScheduled = true;

    // Use queueMicrotask for immediate but non-blocking execution
    queueMicrotask(() => {
      this.processScheduled = false;
      this.processQueue();
    });
  }

  /**
   * Generate coalesce key for duplicate detection
   */
  getCoalesceKey(url, method, payload) {
    if (method === 'GET') {
      return `GET:${url}`;
    }
    // For mutations, include a hash of the payload
    const payloadKey = payload ? JSON.stringify(payload).slice(0, 100) : '';
    return `${method}:${url}:${payloadKey}`;
  }

  /**
   * Enqueue a request
   *
   * @param {Function} requestFn - Function that returns a Promise (the actual fetch)
   * @param {Object} options - Request options
   * @param {number} options.priority - Priority level (use PRIORITY constants)
   * @param {string} options.url - URL for coalescing detection
   * @param {string} options.method - HTTP method
   * @param {Object} options.payload - Request payload
   * @param {boolean} options.coalesce - Enable request coalescing (default: true for GET)
   * @param {string} options.label - Human-readable label for debugging
   * @returns {Promise} Resolves with request result
   */
  enqueue(requestFn, options = {}) {
    const {
      priority = PRIORITY.NORMAL,
      url = '',
      method = 'GET',
      payload = null,
      coalesce = method === 'GET',
      label = url,
    } = options;

    this.stats.totalRequests++;

    // Critical priority bypasses queue entirely
    if (priority >= PRIORITY.CRITICAL) {
      logger.debug('[RequestQueue] Critical request - bypassing queue', { url, method });
      return this.executeImmediately(requestFn, { url, method, label, priority });
    }

    // Check for coalescing opportunity
    if (coalesce) {
      const coalesceKey = this.getCoalesceKey(url, method, payload);
      const existing = this.coalesceMap.get(coalesceKey);

      if (existing && (Date.now() - existing.createdAt) < this.config.coalesceWindow) {
        logger.debug('[RequestQueue] Coalescing request', { url, method });
        this.stats.coalescedRequests++;
        return existing.promise;
      }
    }

    // Create request entry
    const requestId = generateRequestId();
    let resolveRequest, rejectRequest;
    const promise = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });

    const request = {
      id: requestId,
      fn: requestFn,
      priority,
      url,
      method,
      label,
      state: STATE.PENDING,
      createdAt: Date.now(),
      resolve: resolveRequest,
      reject: rejectRequest,
      promise,
    };

    // Add to coalesce map with automatic cleanup
    if (coalesce) {
      const coalesceKey = this.getCoalesceKey(url, method, payload);
      this.coalesceMap.set(coalesceKey, request);

      setTimeout(() => {
        if (this.coalesceMap.get(coalesceKey) === request) {
          this.coalesceMap.delete(coalesceKey);
        }
      }, this.config.maxCoalesceWait);
    }

    // Check queue limits
    if (this.queue.length >= this.config.maxQueueSize) {
      const lowestPriority = this.queue[this.queue.length - 1];
      if (lowestPriority && priority > lowestPriority.priority) {
        const removed = this.queue.pop();
        this.cleanupRequest(removed, 'Request dropped due to queue overflow');
        logger.warn('[RequestQueue] Dropped low-priority request', {
          droppedUrl: removed.url,
          droppedPriority: removed.priority,
          newUrl: url,
          newPriority: priority,
        });
      } else {
        request.reject(new Error('Request queue full'));
        return promise;
      }
    }

    // Insert using binary search for O(log n) performance
    const insertIndex = binarySearchInsertIndex(this.queue, priority);
    this.queue.splice(insertIndex, 0, request);
    request.state = STATE.QUEUED;
    this.stats.queuedRequests++;
    this.stats.peakQueueSize = Math.max(this.stats.peakQueueSize, this.queue.length);

    // Set timeout with proper cleanup tracking
    const timeoutId = setTimeout(() => {
      if (request.state === STATE.QUEUED) {
        this.removeFromQueue(request);
        this.cleanupRequest(request, 'Request timed out in queue');
      }
    }, this.config.queueTimeout);
    this.timeoutIds.set(requestId, timeoutId);

    // Notify listeners (throttled)
    this.throttledNotifyStatusChange();

    logger.debug('[RequestQueue] Request queued', {
      id: requestId,
      url,
      method,
      priority,
      queueLength: this.queue.length,
      tokens: this.tokens.toFixed(1),
    });

    // Schedule processing
    this.scheduleProcessing();

    return promise;
  }

  /**
   * Clean up a request (clear timeout, update state, reject promise)
   */
  cleanupRequest(request, errorMessage) {
    const timeoutId = this.timeoutIds.get(request.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(request.id);
    }
    request.state = STATE.CANCELLED;
    request.reject(new Error(errorMessage));
  }

  /**
   * Remove request from queue
   */
  removeFromQueue(request) {
    const index = this.queue.indexOf(request);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  /**
   * Execute request immediately (for critical priority)
   */
  async executeImmediately(requestFn, meta) {
    const startTime = Date.now();
    try {
      const result = await requestFn();
      const latency = Date.now() - startTime;
      this.recordLatency(latency);
      this.stats.completedRequests++;
      return result;
    } catch (error) {
      this.stats.failedRequests++;
      throw error;
    }
  }

  /**
   * Process the queue - execute pending requests (event-driven)
   */
  processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (
        this.queue.length > 0 &&
        this.executing.size < this.currentConcurrency &&
        this.consumeToken()
      ) {
        const request = this.queue.shift();
        if (!request || request.state !== STATE.QUEUED) continue;

        // Clear the timeout since we're executing now
        const timeoutId = this.timeoutIds.get(request.id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.timeoutIds.delete(request.id);
        }

        this.executeRequest(request);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single request
   */
  async executeRequest(request) {
    request.state = STATE.EXECUTING;
    this.executing.set(request.id, request);
    this.throttledNotifyStatusChange();

    const startTime = Date.now();

    try {
      const result = await request.fn();
      const latency = Date.now() - startTime;

      request.state = STATE.COMPLETED;
      this.recordLatency(latency);
      this.stats.completedRequests++;

      logger.debug('[RequestQueue] Request completed', {
        id: request.id,
        url: request.url,
        latency,
        queueLength: this.queue.length,
      });

      request.resolve(result);
    } catch (error) {
      request.state = STATE.FAILED;
      this.stats.failedRequests++;

      logger.debug('[RequestQueue] Request failed', {
        id: request.id,
        url: request.url,
        error: error.message,
      });

      request.reject(error);
    } finally {
      this.executing.delete(request.id);
      this.throttledNotifyStatusChange();

      // Schedule more processing if there are pending requests
      if (this.queue.length > 0) {
        this.scheduleProcessing();
      }
    }
  }

  /**
   * Record latency for adaptive concurrency
   */
  recordLatency(latency) {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.config.latencyWindow) {
      this.latencyHistory.shift();
    }

    // Update average using efficient running calculation
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    this.stats.avgLatency = Math.round(sum / this.latencyHistory.length);

    // Adaptive concurrency adjustment
    if (this.config.adaptiveEnabled && this.latencyHistory.length >= 5) {
      this.adjustConcurrency();
    }
  }

  /**
   * Adjust concurrency based on observed latency
   * Uses AIMD (Additive Increase Multiplicative Decrease) algorithm
   */
  adjustConcurrency() {
    const avgLatency = this.stats.avgLatency;
    const target = this.config.targetLatency;
    const prevConcurrency = this.currentConcurrency;

    if (avgLatency > target * 1.5) {
      // High latency - multiplicative decrease (aggressive backoff)
      this.currentConcurrency = Math.max(
        this.config.minConcurrent,
        Math.floor(this.currentConcurrency * 0.75)
      );
    } else if (avgLatency < target * 0.5 && this.queue.length > 0) {
      // Low latency with pending requests - additive increase (cautious growth)
      this.currentConcurrency = Math.min(
        this.config.maxConcurrent,
        this.currentConcurrency + 1
      );
    }

    if (this.currentConcurrency !== prevConcurrency) {
      logger.debug('[RequestQueue] Concurrency adjusted', {
        avgLatency,
        from: prevConcurrency,
        to: this.currentConcurrency,
      });
    }
  }

  /**
   * Subscribe to queue status changes
   * @param {Function} listener - Callback receiving status object
   * @returns {Function} Unsubscribe function
   */
  onStatusChange(listener) {
    this.statusListeners.add(listener);
    // Immediately notify with current status
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Throttled status notification to prevent excessive updates
   */
  throttledNotifyStatusChange() {
    const now = Date.now();
    const elapsed = now - this.lastStatusNotify;

    if (elapsed >= this.config.statusThrottleMs) {
      this.lastStatusNotify = now;
      this.notifyStatusChange();
    } else if (!this.pendingStatusNotify) {
      // Schedule a notification after throttle period
      this.pendingStatusNotify = setTimeout(() => {
        this.pendingStatusNotify = null;
        this.lastStatusNotify = Date.now();
        this.notifyStatusChange();
      }, this.config.statusThrottleMs - elapsed);
    }
  }

  /**
   * Notify all status listeners
   */
  notifyStatusChange() {
    const status = this.getStatus();
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        logger.error('[RequestQueue] Status listener error', { error: error.message });
      }
    });
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      executingCount: this.executing.size,
      tokens: Math.floor(this.tokens),
      maxTokens: this.config.maxTokens,
      concurrency: this.currentConcurrency,
      maxConcurrency: this.config.maxConcurrent,
      avgLatency: this.stats.avgLatency,
      isIdle: this.queue.length === 0 && this.executing.size === 0,
      isPaused: this.tokens < 1 && this.queue.length > 0,
      pendingRequests: this.queue.slice(0, 10).map(r => ({ // Limit to 10 for performance
        id: r.id,
        url: r.url,
        method: r.method,
        label: r.label,
        priority: r.priority,
        waitTime: Date.now() - r.createdAt,
      })),
      stats: { ...this.stats },
    };
  }

  /**
   * Cancel a pending request
   * @param {string} requestId - Request ID to cancel
   * @returns {boolean} True if request was found and cancelled
   */
  cancel(requestId) {
    const index = this.queue.findIndex(r => r.id === requestId);
    if (index > -1) {
      const request = this.queue.splice(index, 1)[0];
      this.cleanupRequest(request, 'Request cancelled');
      this.throttledNotifyStatusChange();
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending requests matching a URL pattern
   * @param {string|RegExp} pattern - URL pattern to match
   * @returns {number} Number of cancelled requests
   */
  cancelMatching(pattern) {
    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    let cancelled = 0;

    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (regex.test(this.queue[i].url)) {
        const request = this.queue.splice(i, 1)[0];
        this.cleanupRequest(request, 'Request cancelled');
        cancelled++;
      }
    }

    if (cancelled > 0) {
      this.throttledNotifyStatusChange();
    }
    return cancelled;
  }

  /**
   * Pause the queue (stop processing)
   */
  pause() {
    this.tokens = 0;
    logger.info('[RequestQueue] Queue paused');
    this.throttledNotifyStatusChange();
  }

  /**
   * Resume the queue
   */
  resume() {
    this.tokens = this.config.maxTokens / 2;
    logger.info('[RequestQueue] Queue resumed');
    this.throttledNotifyStatusChange();
    this.scheduleProcessing();
  }

  /**
   * Clear all pending requests
   */
  clear() {
    const count = this.queue.length;
    this.queue.forEach(request => {
      this.cleanupRequest(request, 'Queue cleared');
    });
    this.queue = [];
    this.coalesceMap.clear();
    this.throttledNotifyStatusChange();
    logger.info('[RequestQueue] Queue cleared', { count });
    return count;
  }

  /**
   * Cleanup - call on app unmount
   */
  destroy() {
    clearInterval(this.refillIntervalId);
    if (this.pendingStatusNotify) {
      clearTimeout(this.pendingStatusNotify);
    }
    // Clear all request timeouts
    this.timeoutIds.forEach(timeoutId => clearTimeout(timeoutId));
    this.timeoutIds.clear();
    this.clear();
    this.statusListeners.clear();
    logger.info('[RequestQueue] Destroyed');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton request queue instance
 * @param {Object} config - Optional configuration (only used on first call)
 * @returns {RequestQueue}
 */
export function getRequestQueue(config) {
  if (!instance) {
    instance = new RequestQueue(config);
  }
  return instance;
}

/**
 * Wrap a fetch function with queue management
 *
 * @param {Function} fetchFn - Original fetch function
 * @param {Object} options - Queue options
 * @returns {Promise} Queued request result
 */
export function queuedRequest(fetchFn, options = {}) {
  return getRequestQueue().enqueue(fetchFn, options);
}

/**
 * Create a queued version of sendRequest
 * Use this for standard API calls that should be rate-limited
 */
export function createQueuedSendRequest(sendRequest) {
  return async function queuedSendRequest(url, method = 'GET', payload = null, requestOptions = {}) {
    const priority = requestOptions.priority ?? (
      method === 'GET' ? PRIORITY.NORMAL : PRIORITY.HIGH
    );

    const isCritical = url.includes('/auth/') ||
                       url.includes('/session') ||
                       requestOptions.critical === true;

    return queuedRequest(
      () => sendRequest(url, method, payload, requestOptions),
      {
        priority: isCritical ? PRIORITY.CRITICAL : priority,
        url,
        method,
        payload,
        label: requestOptions.label || url.split('/').pop() || url,
        coalesce: method === 'GET' && requestOptions.coalesce !== false,
      }
    );
  };
}

// Export singleton and classes
export { RequestQueue, STATE };
export default getRequestQueue;
