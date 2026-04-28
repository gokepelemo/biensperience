/**
 * Shared API client wrapping sendRequest with envelope unwrapping
 * and a standard ApiError class.
 *
 * Backend (post bd #8f36.4 + #73f1) returns responses in the standard envelope:
 *
 *   Success: { success: true, data: <payload>, meta?: <pagination/extras> }
 *   Error:   { success: false, error: <string|object>, code?: <string>, requestId?: <string> }
 *
 * `sendApi(method, path, body, opts)` is the canonical helper to use across
 * src/utilities/*-api.js modules. It:
 *   - Forwards the request through `sendRequest` (preserving CSRF, JWT, session,
 *     trace headers, queueing knobs, retry semantics, etc.).
 *   - On 2xx, returns the unwrapped `data` from the envelope. For backward
 *     compatibility with endpoints that have not yet been migrated to the
 *     envelope, bare bodies (no `success` key) are returned as-is.
 *   - On non-2xx, throws an `ApiError` populated from the envelope. The
 *     existing `sendRequest` already throws an `Error` with a `.response`
 *     attached; this module re-throws those as `ApiError` with statusCode,
 *     code, message, requestId, and the raw envelope body for callers that
 *     need richer detail.
 *
 * Callers should treat thrown `ApiError`s as the standard error type. Network
 * failures and timeouts are surfaced with `statusCode: 0` and a descriptive
 * message.
 *
 * @module utilities/api-client
 */

import { sendRequest } from './send-request.js';
import { logger } from './logger.js';

/**
 * Standard error class for API failures. Always thrown by `sendApi` on
 * non-success responses (4xx, 5xx, or transport errors).
 *
 * @property {number} statusCode - HTTP status (0 for transport/network errors)
 * @property {string|null} code   - Backend error code (e.g. EMAIL_NOT_VERIFIED)
 * @property {string|null} requestId - Server-generated request ID for correlating logs
 * @property {Object|null} body   - Raw response envelope (when available)
 */
export class ApiError extends Error {
  constructor({ statusCode = 0, code = null, message, requestId = null, body = null } = {}) {
    super(message || 'API request failed');
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
    this.body = body;
  }
}

/**
 * Extract a human-readable message from an envelope's error field.
 * Handles strings, objects (with `message` or `userMessage`), or fallbacks.
 *
 * @param {*} errField - The `error` property of an envelope
 * @param {string} fallback - Fallback message
 * @returns {string}
 */
function extractErrorMessage(errField, fallback) {
  if (!errField) return fallback;
  if (typeof errField === 'string') return errField;
  if (typeof errField === 'object') {
    return errField.userMessage || errField.message || fallback;
  }
  return fallback;
}

/**
 * Extract an error code from an envelope. Looks at top-level `code`, then
 * inside the `error` object if it's structured.
 *
 * @param {Object} envelope
 * @returns {string|null}
 */
function extractErrorCode(envelope) {
  if (!envelope) return null;
  if (envelope.code) return envelope.code;
  if (envelope.error && typeof envelope.error === 'object' && envelope.error.code) {
    return envelope.error.code;
  }
  return null;
}

/**
 * Determine whether a response object is a standard envelope (has the
 * `success` discriminator). Legacy endpoints return bare data; this lets
 * us unwrap the envelope when present without breaking older callers.
 *
 * @param {*} response
 * @returns {boolean}
 */
function isEnvelope(response) {
  return response && typeof response === 'object' && 'success' in response;
}

/**
 * Unwrap an envelope's `data` field, or return the raw response if it's
 * already bare data. Returns `undefined` for envelope responses that don't
 * include a `data` key (e.g. some delete endpoints).
 *
 * Note: this only returns `data`; callers that need `meta` (pagination)
 * should use `sendApi(..., { unwrap: false })` and handle the envelope
 * themselves, or use the `meta` companion path described below.
 *
 * @param {*} response
 * @returns {*}
 */
function unwrapEnvelope(response) {
  if (isEnvelope(response)) {
    return response.data;
  }
  return response;
}

/**
 * Build an `ApiError` from an error thrown by `sendRequest`. The underlying
 * `sendRequest` attaches a `.response = { status, statusText, data }` to its
 * thrown Error for axios-style compatibility. We translate that into our
 * standard shape here.
 *
 * @param {Error} err - Error thrown by sendRequest
 * @param {{ method: string, path: string }} ctx
 * @returns {ApiError}
 */
function toApiError(err, ctx) {
  // Already an ApiError? Pass through (defensive).
  if (err instanceof ApiError) return err;

  const response = err && err.response;
  if (response) {
    const body = response.data || null;
    const code = extractErrorCode(body);
    const requestId = (body && body.requestId) || null;
    const message = extractErrorMessage(body && body.error, err.message || 'Request failed');

    return new ApiError({
      statusCode: response.status || 0,
      code,
      message,
      requestId,
      body
    });
  }

  // Transport/network error (no response attached).
  return new ApiError({
    statusCode: 0,
    code: null,
    message: err.message || 'Network error',
    requestId: null,
    body: null
  });
}

/**
 * Send an API request and return unwrapped data, throwing ApiError on failure.
 *
 * @param {string} method - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param {string} path - URL path (typically starts with /api/)
 * @param {Object} [body=null] - Request payload (JSON-stringified by sendRequest)
 * @param {Object} [opts={}] - Options forwarded to sendRequest
 * @param {boolean} [opts.unwrap=true] - When true, returns envelope.data on 2xx.
 *                                       When false, returns the full envelope
 *                                       (useful when meta/pagination is needed).
 * @returns {Promise<*>} Unwrapped data (or full envelope when unwrap=false)
 * @throws {ApiError} On non-2xx responses or transport failures
 */
export async function sendApi(method, path, body = null, opts = {}) {
  const { unwrap = true, ...requestOptions } = opts;

  try {
    const response = await sendRequest(path, method, body, requestOptions);
    if (unwrap === false) return response;
    return unwrapEnvelope(response);
  } catch (err) {
    const apiError = toApiError(err, { method, path });

    // Log requestId for server-side correlation when available. Use warn for
    // 4xx (typically expected/handled) and error for 5xx and transport.
    const logFn = apiError.statusCode >= 500 || apiError.statusCode === 0
      ? logger.error
      : logger.warn;

    logFn.call(logger, '[api-client] Request failed', {
      method,
      path,
      statusCode: apiError.statusCode,
      code: apiError.code,
      requestId: apiError.requestId,
      message: apiError.message
    });

    throw apiError;
  }
}

/**
 * Convenience helper to access the meta field (pagination, etc.) alongside
 * unwrapped data. Returns `{ data, meta }`.
 *
 * @param {string} method
 * @param {string} path
 * @param {Object} [body=null]
 * @param {Object} [opts={}]
 * @returns {Promise<{ data: *, meta: Object|undefined }>}
 */
export async function sendApiWithMeta(method, path, body = null, opts = {}) {
  const envelope = await sendApi(method, path, body, { ...opts, unwrap: false });
  if (isEnvelope(envelope)) {
    return { data: envelope.data, meta: envelope.meta };
  }
  // Legacy bare response: surface as data with no meta.
  return { data: envelope, meta: undefined };
}

// Re-export for ergonomics.
export { sendRequest } from './send-request.js';
