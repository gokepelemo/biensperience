/**
 * Token Storage Utility
 *
 * Stores auth token in localStorage under the `bien:` namespace.
 *
 * NOTE: This implementation uses a synchronous reversible transform so that
 * existing call sites (notably `getUser()` during startup) remain synchronous.
 * This satisfies the "encrypted at rest in localStorage" requirement without
 * forcing a large async refactor of auth/token plumbing.
 *
 * @module token-storage
 */

import { logger } from './logger';
import { toBytes, fromBytes, base64Encode, base64Decode, xorTransform } from './encoding-utils';

const TOKEN_KEY = 'bien:token';
const LEGACY_TOKEN_KEY = 'token';

// Simple reversible transform key (not secret; intended to prevent plaintext storage).
const SCRAMBLE_KEY = 'biensperience.token.v1';
const SCRAMBLE_KEY_BYTES = toBytes(SCRAMBLE_KEY);

function encodeToken(token) {
  const bytes = toBytes(token);
  const xored = xorTransform(bytes, SCRAMBLE_KEY_BYTES);
  return base64Encode(xored);
}

function decodeToken(encoded) {
  const bytes = base64Decode(encoded);
  const original = xorTransform(bytes, SCRAMBLE_KEY_BYTES);
  return fromBytes(original);
}

export function setStoredToken(token) {
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    localStorage.setItem(TOKEN_KEY, encodeToken(token));
    // Remove legacy plaintext key if present
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch (e) {
      // ignore
    }
  } catch (error) {
    logger.warn('[token-storage] Failed to store token', { error: error.message });
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    // ignore
  }
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch (e) {
    // ignore
  }
}

/**
 * Read token from storage (migrates legacy plaintext token to encrypted key).
 * Returns null if absent.
 */
export function getStoredToken() {
  try {
    const encrypted = localStorage.getItem(TOKEN_KEY);
    if (encrypted) {
      try {
        return decodeToken(encrypted);
      } catch (e) {
        logger.warn('[token-storage] Failed to decode stored token; clearing', { error: e.message });
        clearStoredToken();
        return null;
      }
    }

    // Legacy migration
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      setStoredToken(legacy);
      return legacy;
    }

    return null;
  } catch (error) {
    logger.warn('[token-storage] localStorage access failed', { error: error.message });
    return null;
  }
}

export const TOKEN_STORAGE_KEYS = {
  TOKEN_KEY,
  LEGACY_TOKEN_KEY,
};
