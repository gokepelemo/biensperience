/**
 * APIError — operational error marker used by the centralized API error handler
 * to distinguish errors safe to surface to clients (validation failures, missing
 * resources, permission denials) from internal failures (DB driver errors,
 * library bugs, programmer mistakes).
 *
 * In production, only `isOperational: true` errors have their `message` returned
 * to the client; all others are replaced with a generic message + correlation id.
 *
 * Usage:
 *   throw new APIError('Email already exists', 409, 'DUPLICATE_RESOURCE');
 *   throw new APIError('Plan not found', 404);
 *
 * Plain Errors thrown elsewhere in the codebase remain non-operational by
 * default — they get the generic-message treatment in production.
 */
class APIError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    if (code) this.code = code;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Decide whether a thrown error's `message` is safe to surface to a client.
 * - APIError instances (or anything else with isOperational:true) → safe.
 * - 4xx status codes → safe (client-error semantics).
 * - Everything else (including 5xx and untyped errors) → unsafe.
 */
function isSafeToExpose(err) {
  if (!err) return false;
  if (err.isOperational === true) return true;
  const status = err.statusCode || err.status;
  if (typeof status === 'number' && status >= 400 && status < 500) return true;
  return false;
}

/**
 * Build the centralized API error handler. Factored as a factory so it can be
 * unit-tested with a synthetic logger and arbitrary NODE_ENV without booting
 * the full app. Mounted in app.js as `app.use('/api', buildApiErrorHandler({ logger }))`.
 */
function buildApiErrorHandler({ logger } = {}) {
  return function apiErrorHandler(err, req, res, next) {
    if (logger?.error) {
      logger.error('Unhandled API error', {
        error: err && err.message,
        stack: err && err.stack,
        path: req.path,
        requestId: req.id,
        statusCode: err && (err.statusCode || err.status),
        isOperational: !!(err && err.isOperational),
      });
    }
    if (res.headersSent) return next(err);

    const status = (err && (err.statusCode || err.status)) || 500;
    const isProd = process.env.NODE_ENV === 'production';
    const safe = isSafeToExpose(err);
    const message = (!isProd || safe)
      ? ((err && err.message) || 'Internal server error')
      : 'Internal server error';

    const body = { success: false, error: message, requestId: req.id };
    if (err && err.code) body.code = err.code;
    return res.status(status).json(body);
  };
}

module.exports = { APIError, isSafeToExpose, buildApiErrorHandler };
