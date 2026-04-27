/**
 * Distributed rate-limit store factory.
 *
 * Returns an `express-rate-limit`-compatible store backed by Redis when
 * `REDIS_URL` is set, otherwise returns `undefined` so `express-rate-limit`
 * falls back to its built-in in-memory store. The Redis store is required
 * for safe horizontal scaling: per-instance memory stores collapse under
 * `numInstances > 1`, multiplying the intended request budget by N.
 *
 * In production with `REDIS_URL` unset we emit a loud warning so the
 * misconfiguration cannot silently bypass rate limits.
 *
 * The same shared `ioredis` client is reused across every limiter (auth,
 * api, modification, etc.) and exported for the AI-gateway sliding-window
 * limiter, so we don't exhaust the connection cap on Upstash-style
 * managed Redis providers.
 *
 * Recommended deployment: Upstash Redis (serverless, free tier) or any
 * Redis-compatible instance reachable via `REDIS_URL`.
 *
 * @module utilities/rate-limit-store
 */

const backendLogger = require('./backend-logger');

// Shared ioredis client. Lazily constructed on first call so that test
// environments (or any process without REDIS_URL) never load `ioredis`.
let _sharedClient = null;
let _warnedNoRedis = false;
let _warnedConstructFailed = false;

/**
 * Build (and memoize) the shared ioredis client. Returns `null` if
 * `REDIS_URL` is unset or if construction fails — callers must handle
 * the null case by falling back to in-memory rate limiting.
 *
 * @returns {import('ioredis').Redis | null}
 */
function getSharedRedisClient() {
  if (_sharedClient) return _sharedClient;
  if (!process.env.REDIS_URL) return null;

  try {
    // Lazy require — `ioredis` is an optional runtime dep; only loaded
    // when REDIS_URL is configured. Avoids a hard test-time dependency.
    const Redis = require('ioredis');
    const client = new Redis(process.env.REDIS_URL, {
      // Conservative settings — fail fast and let callers fall back
      // rather than blocking the request loop on a wedged Redis.
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      connectTimeout: 5000,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });

    client.on('error', (err) => {
      // Don't tear down the limiter — `rate-limit-redis` will surface
      // failures via its own error handling. Just log so operators see
      // the connection problem.
      backendLogger.warn('[rate-limit] Redis client error', { error: err.message });
    });
    client.on('connect', () => {
      backendLogger.info('[rate-limit] Redis client connected');
    });

    _sharedClient = client;
    return _sharedClient;
  } catch (err) {
    if (!_warnedConstructFailed) {
      backendLogger.warn(
        '[rate-limit] Failed to initialise Redis client — falling back to MemoryStore. ' +
        'Per-instance limits will not protect under horizontal scaling.',
        { error: err && err.message }
      );
      _warnedConstructFailed = true;
    }
    return null;
  }
}

/**
 * Returns an `express-rate-limit`-compatible Store, or `undefined` to use
 * the library's default MemoryStore.
 *
 * Pass a unique `prefix` per limiter so keys don't collide across
 * limiters that share the same Redis namespace (e.g. `rl:auth:` vs
 * `rl:api:`). The library's built-in default prefix is `rl:`.
 *
 * @param {Object} [opts]
 * @param {string} [opts.prefix='rl:']
 * @returns {import('express-rate-limit').Store | undefined}
 */
function createRateLimitStore({ prefix = 'rl:' } = {}) {
  const client = getSharedRedisClient();

  if (!client) {
    if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL && !_warnedNoRedis) {
      backendLogger.warn(
        '[rate-limit] REDIS_URL not set — using MemoryStore. ' +
        'Per-instance limits will not protect under horizontal scaling.'
      );
      _warnedNoRedis = true;
    }
    // Returning undefined leaves express-rate-limit on its default
    // MemoryStore — fine for dev/test/single-instance deployments.
    return undefined;
  }

  // Lazy require — only loaded when we actually have a Redis client.
  const { RedisStore } = require('rate-limit-redis');

  return new RedisStore({
    prefix,
    // ioredis flavour of the sendCommand interface (see rate-limit-redis README).
    sendCommand: (command, ...args) => client.call(command, ...args),
  });
}

/**
 * Test-only helper. Resets the cached client and warning flags so a
 * subsequent `createRateLimitStore()` re-evaluates `process.env.REDIS_URL`.
 * Production code should never call this.
 */
function _resetForTests() {
  if (_sharedClient && typeof _sharedClient.disconnect === 'function') {
    try { _sharedClient.disconnect(); } catch (_) { /* ignore */ }
  }
  _sharedClient = null;
  _warnedNoRedis = false;
  _warnedConstructFailed = false;
}

module.exports = {
  createRateLimitStore,
  getSharedRedisClient,
  _resetForTests,
};
