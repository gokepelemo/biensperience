/**
 * Encoding Utilities
 *
 * Shared XOR + Base64 encoding/decoding primitives used by token-storage,
 * plan-cache, and secure-storage-lite for lightweight obfuscation of
 * localStorage values.
 *
 * NOTE: This is NOT cryptographic encryption. It prevents plaintext at-rest
 * storage but is trivially reversible.
 *
 * @module encoding-utils
 */

/**
 * Convert a string to a Uint8Array of char codes.
 * @param {string} str
 * @returns {Uint8Array}
 */
export function toBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

/**
 * Convert a Uint8Array back to a string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function fromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/**
 * Base64-encode a Uint8Array. Falls back to Node Buffer in non-browser runtimes.
 * @param {Uint8Array} bytes
 * @returns {string|null}
 */
export function base64Encode(bytes) {
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

/**
 * Base64-decode a string to a Uint8Array. Falls back to Node Buffer in non-browser runtimes.
 * @param {string} b64
 * @returns {Uint8Array|null}
 */
export function base64Decode(b64) {
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

/**
 * Decode the payload segment of a JWT token.
 * JWTs use base64url encoding (RFC 4648) which replaces '+' with '-' and '/' with '_',
 * and omits '=' padding. Plain atob() will throw on these characters.
 * @param {string} base64url - The raw base64url-encoded JWT segment
 * @returns {Object} Parsed JSON payload
 */
export function parseJwtPayload(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

/**
 * XOR-transform input bytes against a key (repeating the key as needed).
 * @param {Uint8Array} inputBytes
 * @param {Uint8Array} keyBytes
 * @returns {Uint8Array|null}
 */
export function xorTransform(inputBytes, keyBytes) {
  if (!keyBytes?.length) return null;
  const out = new Uint8Array(inputBytes.length);
  for (let i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}
