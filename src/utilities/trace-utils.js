/**
 * Trace ID Utility Functions
 * 
 * Manages trace IDs for API request tracking across microservices.
 * Each API request gets a unique trace ID for distributed tracing.
 * 
 * @module trace-utils
 */

/**
 * Generate a new trace ID
 * Uses crypto.randomUUID() for cryptographically strong random IDs
 * 
 * @returns {string} New trace ID in UUID format
 */
export function generateTraceId() {
  return crypto.randomUUID();
}

/**
 * Get or generate trace ID for current request
 * Generates a new trace ID each time (stateless per-request)
 * 
 * @returns {string} Trace ID
 */
export function getTraceId() {
  return generateTraceId();
}

/**
 * Create trace context for request
 * Returns object with trace ID and timestamp for logging
 * 
 * @returns {Object} Trace context object
 */
export function createTraceContext() {
  return {
    traceId: generateTraceId(),
    timestamp: Date.now()
  };
}
