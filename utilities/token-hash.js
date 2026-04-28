/**
 * Token hashing helpers for password-reset and email-confirmation flows.
 *
 * Pattern:
 *   1. Generate a raw token with `generateRawToken()`, email it to the user.
 *   2. Persist `hashToken(raw)` in the database (never the raw value).
 *   3. On verification, hash the submitted token and look it up by hash, OR
 *      use `compareToken(submitted, storedHash)` for constant-time equality.
 *
 * SHA-256 is appropriate here because the inputs are already 256 bits of
 * cryptographic entropy from `crypto.randomBytes(32)` — they don't need
 * a slow KDF like bcrypt (used for low-entropy passwords).
 */

const crypto = require('crypto');

const RAW_TOKEN_BYTES = 32;
const HASH_HEX_LENGTH = 64; // SHA-256 in hex

function generateRawToken() {
  return crypto.randomBytes(RAW_TOKEN_BYTES).toString('hex');
}

function hashToken(rawToken) {
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    throw new TypeError('hashToken expects a non-empty string');
  }
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function compareToken(rawToken, storedHash) {
  if (typeof rawToken !== 'string' || typeof storedHash !== 'string') return false;
  if (storedHash.length !== HASH_HEX_LENGTH) return false;
  const computed = hashToken(rawToken);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  generateRawToken,
  hashToken,
  compareToken,
};
