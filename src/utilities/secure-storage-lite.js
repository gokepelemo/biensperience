/**
 * Secure Storage (Lite)
 *
 * Synchronous, reversible obfuscation for small localStorage/sessionStorage values.
 *
 * Notes:
 * - This is NOT a cryptographic guarantee.
 * - It exists to prevent plaintext at-rest storage of UI/session metadata.
 * - Uses XOR + base64 encoding with safe fallbacks for non-browser runtimes.
 */

import { logger } from './logger';

const PREFIX = 'bien:';
const DEFAULT_SCRAMBLE_KEY = 'biensperience.secure-storage-lite.v1';

function getConfiguredScrambleKey() {
  // NOTE: Avoid using import.meta.env here. Jest (CJS) will fail to parse it.
  // In Vite builds we inject a compile-time constant instead.
  try {
    // eslint-disable-next-line no-undef
    if (typeof __BIEN_SECURE_STORAGE_LITE_SCRAMBLE_KEY__ === 'string') {
      // eslint-disable-next-line no-undef
      const v = __BIEN_SECURE_STORAGE_LITE_SCRAMBLE_KEY__.trim();
      if (v) return v;
    }
  } catch {
    // ignore
  }

  // Node/Jest fallback (does not run in the browser)
  try {
    if (typeof process !== 'undefined' && process?.env?.VITE_BIEN_SECURE_STORAGE_LITE_SCRAMBLE_KEY) {
      const v = String(process.env.VITE_BIEN_SECURE_STORAGE_LITE_SCRAMBLE_KEY).trim();
      if (v) return v;
    }
  } catch {
    // ignore
  }

  return null;
}

// Changing this will make previously stored obfuscated values unreadable unless
// the fallback decoder succeeds.
const PRIMARY_SCRAMBLE_KEY = getConfiguredScrambleKey() || DEFAULT_SCRAMBLE_KEY;

// Backward-compatible decode path: if a custom key is configured, try decoding
// with the legacy default key as well.
const FALLBACK_SCRAMBLE_KEY =
  PRIMARY_SCRAMBLE_KEY === DEFAULT_SCRAMBLE_KEY ? null : DEFAULT_SCRAMBLE_KEY;

let _primaryKeyBytes = null;
let _fallbackKeyBytes = null;

function getPrimaryKeyBytes() {
  if (_primaryKeyBytes) return _primaryKeyBytes;
  _primaryKeyBytes = toBytes(PRIMARY_SCRAMBLE_KEY);
  return _primaryKeyBytes;
}

function getFallbackKeyBytes() {
  if (!FALLBACK_SCRAMBLE_KEY) return null;
  if (_fallbackKeyBytes) return _fallbackKeyBytes;
  _fallbackKeyBytes = toBytes(FALLBACK_SCRAMBLE_KEY);
  return _fallbackKeyBytes;
}

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
  try {
    if (typeof btoa === 'function') {
      return btoa(fromBytes(bytes));
    }
  } catch {
    // ignore
  }

  try {
    // Node/Jest fallback
    // eslint-disable-next-line no-undef
    return Buffer.from(bytes).toString('base64');
  } catch {
    return null;
  }
}

function base64Decode(b64) {
  try {
    if (typeof atob === 'function') {
      const binary = atob(b64);
      return toBytes(binary);
    }
  } catch {
    // ignore
  }

  try {
    // Node/Jest fallback
    // eslint-disable-next-line no-undef
    const buf = Buffer.from(b64, 'base64');
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function xorTransform(inputBytes, keyBytes) {
  if (!keyBytes?.length) return null;
  const out = new Uint8Array(inputBytes.length);
  for (let i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

function isLikelyJsonString(str) {
  if (!str) return false;
  const t = String(str).trimStart();
  if (!t) return false;
  if (t.includes('\u0000')) return false;

  const first = t[0];
  // JSON can start with object/array/string/number literals, or true/false/null.
  return ['{', '[', '"', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 't', 'f', 'n'].includes(first);
}

export function obfuscateString(plain) {
  try {
    if (plain === null || plain === undefined) return null;
    const bytes = toBytes(String(plain));
    const xored = xorTransform(bytes, getPrimaryKeyBytes());
    const b64 = base64Encode(xored);
    if (!b64) return null;
    return PREFIX + b64;
  } catch {
    return null;
  }
}

export function deobfuscateString(stored) {
  try {
    if (!stored || typeof stored !== 'string') return null;
    if (!stored.startsWith(PREFIX)) return null;

    const b64 = stored.slice(PREFIX.length);
    const bytes = base64Decode(b64);
    if (!bytes) return null;

    const primaryOriginal = xorTransform(bytes, getPrimaryKeyBytes());
    if (!primaryOriginal) return null;
    const primaryStr = fromBytes(primaryOriginal);

    const fallbackKeyBytes = getFallbackKeyBytes();
    if (!fallbackKeyBytes) return primaryStr;

    // Prefer whichever decode looks more like our expected JSON payloads.
    if (isLikelyJsonString(primaryStr)) return primaryStr;

    const fallbackOriginal = xorTransform(bytes, fallbackKeyBytes);
    if (!fallbackOriginal) return primaryStr;
    const fallbackStr = fromBytes(fallbackOriginal);
    if (isLikelyJsonString(fallbackStr)) return fallbackStr;

    return primaryStr;
  } catch {
    return null;
  }
}

export function setObfuscatedJson(storage, key, value) {
  try {
    const payload = obfuscateString(JSON.stringify(value));
    if (!payload) return false;
    storage.setItem(key, payload);
    return true;
  } catch (e) {
    logger.debug('[secure-storage-lite] Failed to set obfuscated json', { key, error: e?.message });
    return false;
  }
}

export function getObfuscatedJson(storage, key, defaultValue = null) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return defaultValue;

    const jsonStr = deobfuscateString(raw);
    if (!jsonStr) return defaultValue;

    return JSON.parse(jsonStr);
  } catch {
    return defaultValue;
  }
}

export function removeStorageKey(storage, key) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
