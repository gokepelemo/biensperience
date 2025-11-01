/**
 * Encryption utilities for secure localStorage storage
 * Uses Web Crypto API (built into modern browsers)
 */

import { logger } from './logger';

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
  if (!userId) {
    logger.warn('No userId provided for encryption, storing unencrypted');
    return JSON.stringify(data);
  }

  try {
    const encoder = new TextEncoder();
    const key = await deriveKey(userId);

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
    logger.error('Encryption failed, storing unencrypted', { error: error.message }, error);
    return JSON.stringify(data);
  }
}

/**
 * Decrypt data from storage
 * @param {string} encryptedString - Encrypted data as base64 string
 * @param {string} userId - User ID for key derivation
 * @returns {Promise<any>} Decrypted data
 */
export async function decryptData(encryptedString, userId) {
  if (!userId) {
    logger.warn('No userId provided for decryption, parsing as unencrypted');
    try {
      return JSON.parse(encryptedString);
    } catch {
      return null;
    }
  }

  try {
    // Try to parse as base64 encrypted data
    const combined = Uint8Array.from(atob(encryptedString), c => c.charCodeAt(0));

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const key = await deriveKey(userId);

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
    // If decryption fails, try parsing as plain JSON
    logger.warn('Decryption failed, attempting plain JSON parse', { error: error.message });
    try {
      return JSON.parse(encryptedString);
    } catch {
      logger.error('Failed to decrypt or parse data', { error: error.message }, error);
      return null;
    }
  }
}
