/**
 * JWT denylist (revocation) using the shared Redis client.
 *
 * Each signed JWT carries a `jti` (JWT ID) claim. On logout (or any other
 * security event that should invalidate a still-valid token), the jti is
 * added to a Redis SETEX entry whose TTL equals the remaining lifetime of
 * the token. Auth middlewares (`config/checkToken.js`, the WebSocket
 * handshake) consult this denylist after `jwt.verify` succeeds and reject
 * the request when the jti is present.
 *
 * Graceful degradation: when `getSharedRedisClient()` returns `null`
 * (REDIS_URL unset, ioredis unavailable, or the Redis instance is wedged)
 * `addToDenylist` becomes a no-op and `isDenylisted` returns `false`.
 * Security degrades to "JWT expiry only", which is the system's pre-existing
 * behaviour. We never block legitimate users when Redis is unavailable.
 *
 * Key namespace: `jwt:denylist:<jti>` — small, opaque, isolated from the
 * `rl:` rate-limit prefix and `bien:` cache prefixes already in use.
 *
 * @module utilities/jwt-denylist
 */

const crypto = require('crypto');
const backendLogger = require('./backend-logger');
const { getSharedRedisClient } = require('./rate-limit-store');

const KEY_PREFIX = 'jwt:denylist:';

/**
 * Generate a fresh JWT ID. Callers (token-issuing code) include the
 * returned value in the signed payload as the `jti` claim.
 *
 * @returns {string} A 128-bit random hex string (collision-resistant).
 */
function generateJti() {
  // randomUUID() is preferable but only available on Node ≥ 14.17 / 16+;
  // hex-encoded 16 random bytes is equivalent in entropy and supported
  // on every Node version this codebase targets.
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Add a JWT's `jti` to the denylist with a TTL matching the token's
 * remaining lifetime, so the entry self-prunes once the token would have
 * expired anyway. No-op if Redis is unavailable.
 *
 * @param {string} jti - The token's jti claim.
 * @param {number} ttlSeconds - Seconds until the original token would expire.
 * @returns {Promise<boolean>} `true` if the entry was written, `false` if
 *   skipped (Redis unavailable, missing jti, or non-positive TTL).
 */
async function addToDenylist(jti, ttlSeconds) {
  if (!jti || typeof jti !== 'string') return false;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    // Token is already expired — checkToken/jwt.verify will reject it.
    return false;
  }

  const client = getSharedRedisClient();
  if (!client) return false;

  try {
    const ttl = Math.max(1, Math.ceil(ttlSeconds));
    await client.setex(`${KEY_PREFIX}${jti}`, ttl, '1');
    return true;
  } catch (err) {
    backendLogger.warn('[jwt-denylist] Failed to add jti to denylist', {
      jti,
      error: err && err.message,
    });
    return false;
  }
}

/**
 * Check whether a JWT's `jti` is on the denylist. Returns `false` when
 * Redis is unavailable so a wedged Redis cannot lock every user out.
 *
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
async function isDenylisted(jti) {
  if (!jti || typeof jti !== 'string') return false;

  const client = getSharedRedisClient();
  if (!client) return false;

  try {
    const exists = await client.exists(`${KEY_PREFIX}${jti}`);
    return exists === 1 || exists === '1';
  } catch (err) {
    // Fail open: a Redis blip should not lock all users out. We log the
    // failure so operators see it, but legitimate tokens still pass.
    backendLogger.warn('[jwt-denylist] Failed to read denylist', {
      jti,
      error: err && err.message,
    });
    return false;
  }
}

/**
 * Compute the remaining seconds until a token expires from its `exp`
 * claim (seconds-since-epoch, JWT spec). Returns 0 for expired tokens.
 *
 * @param {number} exp - JWT exp claim in seconds-since-epoch.
 * @returns {number}
 */
function remainingSecondsFromExp(exp) {
  if (!Number.isFinite(exp) || exp <= 0) return 0;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.max(0, exp - nowSec);
}

module.exports = {
  generateJti,
  addToDenylist,
  isDenylisted,
  remainingSecondsFromExp,
  KEY_PREFIX,
};
