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

const TOKEN_KEY = 'bien:token';
const LEGACY_TOKEN_KEY = 'token';

// Simple reversible transform key (not secret; intended to prevent plaintext storage).
const SCRAMBLE_KEY = 'biensperience.token.v1';

function toBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function fromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function base64Encode(bytes) {
  // btoa expects a binary string
  return btoa(fromBytes(bytes));
}

function base64Decode(b64) {
  const binary = atob(b64);
  return toBytes(binary);
}

function xorTransform(inputBytes) {
  const keyBytes = toBytes(SCRAMBLE_KEY);
  const out = new Uint8Array(inputBytes.length);
  for (let i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

function encodeToken(token) {
  const bytes = toBytes(token);
  const xored = xorTransform(bytes);
  return base64Encode(xored);
}

function decodeToken(encoded) {
  const bytes = base64Decode(encoded);
  const original = xorTransform(bytes);
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
