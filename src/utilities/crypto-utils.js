/**
 * Encryption utilities for secure localStorage storage
 * Uses Web Crypto API (built into modern browsers)
 */

import { logger } from './logger';

// All persisted client storage should be encrypted-at-rest. When no userId is
// available (anonymous/session scenarios), use a deterministic anon key material
// so stored values remain decryptable across reloads.
const ANON_KEY_MATERIAL = 'bien:anon';

const FALLBACK_PREFIX = '__bien_xor__:';

function xorStringToBase64(plainText, keyMaterial) {
  const key = keyMaterial || ANON_KEY_MATERIAL;
  const keyLen = key.length;
  let out = '';
  for (let i = 0; i < plainText.length; i++) {
    // XOR each 16-bit charCode (good enough for our JSON strings)
    const c = plainText.charCodeAt(i) ^ key.charCodeAt(i % keyLen);
    out += String.fromCharCode(c);
  }
  return btoa(out);
}

function base64ToXorString(b64, keyMaterial) {
  const key = keyMaterial || ANON_KEY_MATERIAL;
  const keyLen = key.length;
  const raw = atob(b64);
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i) ^ key.charCodeAt(i % keyLen);
    out += String.fromCharCode(c);
  }
  return out;
}

/**
 * Generate a deterministic encryption key from user ID
 * Uses PBKDF2 to derive a key from user ID + app secret
 * @param {string} userId - User ID
 * @returns {Promise<CryptoKey>} Encryption key
 */
async function deriveKey(userId) {
  const encoder = new TextEncoder();

  // Use user ID + a salt to derive the key
  // In production, you might want to add an environment-specific salt
  const salt = encoder.encode(`biensperience-form-encryption-${userId}`);

  // Import the user ID as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive an AES-GCM key from the key material
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data for storage
 * @param {any} data - Data to encrypt (will be JSON stringified)
 * @param {string} userId - User ID for key derivation
 * @returns {Promise<string>} Encrypted data as base64 string
 */
export async function encryptData(data, userId) {
  const keyMaterial = userId || ANON_KEY_MATERIAL;

  try {
    const encoder = new TextEncoder();
    const key = await deriveKey(keyMaterial);

    // Generate a random IV (Initialization Vector)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encodedData = encoder.encode(JSON.stringify(data));
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    // Never fall back to plaintext persistence.
    logger.error('Encryption failed, using fallback encoding', { error: error.message }, error);
    const json = JSON.stringify(data);
    return `${FALLBACK_PREFIX}${xorStringToBase64(json, keyMaterial)}`;
  }
}

/**
 * Decrypt data from storage
 * @param {string} encryptedString - Encrypted data as base64 string
 * @param {string} userId - User ID for key derivation
 * @returns {Promise<any>} Decrypted data
 */
export async function decryptData(encryptedString, userId) {
  const keyMaterial = userId || ANON_KEY_MATERIAL;

  try {
    if (typeof encryptedString === 'string' && encryptedString.startsWith(FALLBACK_PREFIX)) {
      const b64 = encryptedString.slice(FALLBACK_PREFIX.length);
      const json = base64ToXorString(b64, keyMaterial);
      return JSON.parse(json);
    }

    // Try to parse as base64 encrypted data
    const combined = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const key = await deriveKey(keyMaterial);

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );

    // Decode and parse JSON
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decryptedData));
  } catch (error) {
    // If decryption fails, try parsing as plain JSON (expected for legacy/unencrypted data)
    try {
      const parsed = JSON.parse(encryptedString);
      // Only log at debug level - this is expected for legacy data
      logger.debug('Data was not encrypted, parsed as plain JSON');
      return parsed;
    } catch {
      // Only log error if both decryption AND JSON parsing fail
      logger.debug('Failed to decrypt or parse data', { error: error.message });
      return null;
    }
  }
}
