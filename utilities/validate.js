/**
 * Zod validation middleware factory.
 *
 * Returns an Express middleware that validates the incoming request against a
 * zod schema covering one or more of `body`, `query`, and `params`. Use it in
 * routes like:
 *
 *   const { validate } = require('../../utilities/validate');
 *   const { signupSchema } = require('../../controllers/api/users.schemas');
 *
 *   router.post('/', authLimiter, validate(signupSchema), usersCtrl.create);
 *
 * Behavior:
 * - The supplied schema MUST be a `z.object({ body?, query?, params? })` shape.
 *   Only the keys present on the schema are validated; missing keys are simply
 *   not enforced.
 * - On success the parsed (and therefore coerced) values replace
 *   `req.body`, `req.query`, and `req.params`. Downstream controllers can
 *   trust the typed shape.
 * - On failure the middleware short-circuits with a 400 JSON response shaped
 *   to match the rest of the API (see `utilities/controller-helpers.js` and
 *   the centralized `/api` error handler in `app.js`):
 *
 *     {
 *       success: false,
 *       error: 'Validation failed',
 *       code: 'VALIDATION_ERROR',
 *       issues: [{ path, message, code }],
 *       requestId?: <traceId | req.id>
 *     }
 *
 *   The middleware returns the response directly rather than calling
 *   `next(err)` because (a) validation failure is an operational, expected
 *   user-facing 400 (analogous to `isOperational: true` in upstream error
 *   conventions) and (b) we want a consistent shape regardless of which
 *   centralized handler picks the error up.
 *
 * @module utilities/validate
 */

/**
 * Build an Express middleware that validates `{ body, query, params }`.
 *
 * @param {import('zod').ZodTypeAny} schema A zod object schema with optional
 *   `body`, `query`, `params` keys.
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => any}
 */
function validate(schema) {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new TypeError('validate(schema): schema must be a zod schema (got ' + typeof schema + ')');
  }

  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (result.success) {
      // Replace request payloads with parsed values so downstream controllers
      // see coerced/typed data. We only overwrite slots the schema covered;
      // for anything not in the parsed result, leave the original alone.
      const parsed = result.data || {};
      if (Object.prototype.hasOwnProperty.call(parsed, 'body')) {
        req.body = parsed.body;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'query')) {
        req.query = parsed.query;
      }
      if (Object.prototype.hasOwnProperty.call(parsed, 'params')) {
        req.params = parsed.params;
      }
      return next();
    }

    // Map zod issues into a stable, JSON-friendly shape.
    const rawIssues = (result.error && Array.isArray(result.error.issues)) ? result.error.issues : [];
    const issues = rawIssues.map((issue) => ({
      path: Array.isArray(issue.path) ? issue.path.map(String) : [],
      message: issue.message || 'Invalid value',
      code: issue.code || 'invalid',
    }));

    const payload = {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      issues,
    };

    // Surface a correlation ID when the request has one. We support both
    // `req.traceId` (the existing trace-middleware) and `req.id` (which the
    // ticket reference in bd #8f36.4 anticipates).
    const requestId = req.id || req.traceId || null;
    if (requestId) payload.requestId = requestId;

    return res.status(400).json(payload);
  };
}

module.exports = { validate };
