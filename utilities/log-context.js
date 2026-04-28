/**
 * Log Context Utility
 *
 * Returns a logger bound to a request's correlation id + key request fields.
 *
 * Usage:
 *   const { withRequest } = require('../utilities/log-context');
 *   const log = withRequest(req);
 *   log.info('msg', { extraField: 'value' });
 *
 * Auto-includes `requestId`, `userId`, `path`, `method` on every log line so
 * a single HTTP request can be reconstructed end-to-end (controller → AI gateway
 * → WebSocket broadcast) by filtering on `requestId`.
 *
 * Why an explicit-threading helper instead of AsyncLocalStorage?
 * --------------------------------------------------------------
 * AsyncLocalStorage (ALS) provides automatic context propagation across async
 * boundaries, but it has real costs:
 *   - Subtle bugs when context is lost across `await` chains that escape an
 *     ALS run (worker pools, EventEmitters that re-emit on tick boundaries).
 *   - Non-trivial CPU overhead on Node's async hooks layer.
 *   - Implicit dependency that's hard to reason about — call sites look like
 *     plain function calls but pull state from a hidden ambient.
 *
 * The codebase only has a handful of hot controllers + the AI gateway. Threading
 * `req` (or `requestId`) explicitly is one extra parameter that makes the data
 * flow visible and avoids the async-context risk. If the call-site count ever
 * explodes, revisit ALS — but the current trade-off favours simplicity.
 *
 * @module utilities/log-context
 */

const backendLogger = require('./backend-logger');

/**
 * Extract the request id from an Express `req` object, falling back to
 * `req.traceId` (set by `utilities/trace-middleware.js`) for back-compat with
 * any pre-existing instrumentation.
 *
 * Returns `null` when called without a request — handy for non-HTTP callers
 * (background jobs, the seed scripts) that want a logger with the same shape.
 *
 * @param {Object} [req] - Express request object
 * @returns {string|null}
 */
function extractRequestId(req) {
  if (!req) return null;
  return req.id || req.traceId || null;
}

/**
 * Build the auto-included context fields for a request.
 *
 * @param {Object} [req] - Express request object
 * @returns {Object} Field bag suitable for spreading into a log meta object.
 */
function buildRequestContext(req) {
  if (!req) return {};
  const userId = req.user?._id?.toString?.();
  return {
    requestId: extractRequestId(req),
    userId: userId || null,
    path: req.path || null,
    method: req.method || null
  };
}

/**
 * Returns a logger bound to a request's correlation id + key request fields.
 *
 * Each log method merges the auto-context with caller-supplied fields, with the
 * caller's fields winning on conflict so a controller can override e.g. `userId`
 * if it's logging on behalf of someone else.
 *
 * @param {Object} [req] - Express request object (omit for non-HTTP callers)
 * @returns {{ error: Function, warn: Function, info: Function, debug: Function, requestId: string|null }}
 */
function withRequest(req) {
  const ctx = buildRequestContext(req);
  return {
    requestId: ctx.requestId,
    error: (msg, fields = {}, error = null) => backendLogger.error(msg, { ...ctx, ...fields }, error),
    warn:  (msg, fields = {}) => backendLogger.warn(msg, { ...ctx, ...fields }),
    info:  (msg, fields = {}) => backendLogger.info(msg, { ...ctx, ...fields }),
    debug: (msg, fields = {}) => backendLogger.debug(msg, { ...ctx, ...fields })
  };
}

module.exports = {
  withRequest,
  extractRequestId,
  buildRequestContext
};
