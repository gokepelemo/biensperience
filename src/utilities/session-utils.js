/**
 * Session ID Utility Functions
 * 
 * Manages user session IDs on the frontend with expiry tracking.
 * Session IDs are bound to authenticated users and expire after 24 hours by default.
 * 
 * @module session-utils
 */

import { encryptData, decryptData } from './crypto-utils';

// Constants
const SESSION_STORAGE_KEY = 'bien_session_data';
const DEFAULT_EXPIRY_HOURS = 24;

/**
 * Get session expiry duration from environment or use default
 * @returns {number} Expiry duration in milliseconds
 */
function getSessionExpiryMs() {
  const hours = parseInt(process.env.REACT_APP_SESSION_EXPIRY_HOURS) || DEFAULT_EXPIRY_HOURS;
  return hours * 60 * 60 * 1000; // Convert hours to milliseconds
}

/**
 * Generate a new session ID
 * Uses crypto.randomUUID() for cryptographically strong random IDs
 * 
 * @returns {string} New session ID in UUID format
 */
export function generateSessionId() {
  return crypto.randomUUID();
}

/**
 * Get current epoch timestamp in milliseconds
 * @returns {number} Current epoch time
 */
function getCurrentEpoch() {
  return Date.now();
}

/**
 * Calculate session expiry epoch time
 * @param {number} createdAt - Session creation epoch time
 * @returns {number} Expiry epoch time
 */
function calculateExpiryEpoch(createdAt = getCurrentEpoch()) {
  return createdAt + getSessionExpiryMs();
}

/**
 * Get session data from localStorage
 * Returns null if no session exists or decryption fails
 * 
 * @param {string} [userId] - Optional user ID for user-specific decryption
 * @returns {Object|null} Session data object or null
 */
async function getSessionData(userId = null) {
  try {
    const encryptedData = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!encryptedData) {
      return null;
    }

    // Decrypt session data (user-specific if userId provided)
    const decrypted = await decryptData(encryptedData, userId);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error retrieving session data:', error);
    return null;
  }
}

/**
 * Save session data to localStorage (encrypted)
 * 
 * @param {Object} sessionData - Session data to store
 * @param {string} sessionData.sessionId - Session ID
 * @param {number} sessionData.createdAt - Creation epoch time
 * @param {number} sessionData.expiresAt - Expiry epoch time
 * @param {string} sessionData.userId - User ID bound to this session
 * @param {string} [userId] - Optional user ID for encryption
 */
async function saveSessionData(sessionData, userId = null) {
  try {
    const dataString = JSON.stringify(sessionData);
    const encrypted = await encryptData(dataString, userId);
    localStorage.setItem(SESSION_STORAGE_KEY, encrypted);
  } catch (error) {
    console.error('Error saving session data:', error);
  }
}

/**
 * Get current session ID if valid, null otherwise
 * Checks expiry and validates session exists
 * 
 * @param {string} [userId] - Optional user ID to validate session binding
 * @returns {Promise<string|null>} Session ID or null if expired/invalid
 */
export async function getSessionId(userId = null) {
  const sessionData = await getSessionData(userId);
  
  if (!sessionData) {
    return null;
  }

  // Check if session is expired
  if (isSessionExpired(sessionData)) {
    // Clear expired session
    clearSession();
    return null;
  }

  // Validate session is bound to correct user (if userId provided)
  if (userId && sessionData.userId !== userId) {
    console.warn('Session user ID mismatch - clearing session');
    clearSession();
    return null;
  }

  return sessionData.sessionId;
}

/**
 * Check if a session is expired
 * 
 * @param {Object} sessionData - Session data object
 * @param {number} sessionData.expiresAt - Expiry epoch time
 * @returns {boolean} True if session is expired
 */
export function isSessionExpired(sessionData) {
  if (!sessionData || !sessionData.expiresAt) {
    return true;
  }

  const now = getCurrentEpoch();
  return now >= sessionData.expiresAt;
}

/**
 * Create a new session for a user
 * Generates new session ID and stores with expiry info
 * 
 * @param {string} userId - User ID to bind session to
 * @returns {Promise<string>} New session ID
 */
export async function createSession(userId) {
  const sessionId = generateSessionId();
  const createdAt = getCurrentEpoch();
  const expiresAt = calculateExpiryEpoch(createdAt);

  const sessionData = {
    sessionId,
    userId,
    createdAt,
    expiresAt
  };

  await saveSessionData(sessionData, userId);
  return sessionId;
}

/**
 * Refresh session if needed (close to expiry)
 * Refreshes if less than 1 hour remaining
 * 
 * @param {string} userId - User ID to refresh session for
 * @returns {Promise<{refreshed: boolean, sessionId: string|null}>}
 */
export async function refreshSessionIfNeeded(userId) {
  const sessionData = await getSessionData(userId);
  
  if (!sessionData) {
    // No session exists - create new one
    const newSessionId = await createSession(userId);
    return { refreshed: true, sessionId: newSessionId };
  }

  // Check if session is expired
  if (isSessionExpired(sessionData)) {
    // Expired - create new session
    const newSessionId = await createSession(userId);
    return { refreshed: true, sessionId: newSessionId };
  }

  // Check if session is close to expiry (less than 1 hour remaining)
  const now = getCurrentEpoch();
  const timeRemaining = sessionData.expiresAt - now;
  const oneHourMs = 60 * 60 * 1000;

  if (timeRemaining < oneHourMs) {
    // Refresh session - generate new ID and extend expiry
    const newSessionId = generateSessionId();
    const createdAt = getCurrentEpoch();
    const expiresAt = calculateExpiryEpoch(createdAt);

    const newSessionData = {
      sessionId: newSessionId,
      userId,
      createdAt,
      expiresAt
    };

    await saveSessionData(newSessionData, userId);
    return { refreshed: true, sessionId: newSessionId };
  }

  // Session still valid - no refresh needed
  return { refreshed: false, sessionId: sessionData.sessionId };
}

/**
 * Clear session from localStorage
 * Should be called on logout
 */
export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Get session info for debugging
 * @param {string} [userId] - Optional user ID
 * @returns {Promise<Object|null>} Session info or null
 */
export async function getSessionInfo(userId = null) {
  const sessionData = await getSessionData(userId);
  
  if (!sessionData) {
    return null;
  }

  const now = getCurrentEpoch();
  const timeRemaining = sessionData.expiresAt - now;
  const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
  const minutesRemaining = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

  return {
    sessionId: sessionData.sessionId,
    userId: sessionData.userId,
    createdAt: sessionData.createdAt,
    expiresAt: sessionData.expiresAt,
    isExpired: isSessionExpired(sessionData),
    timeRemaining: `${hoursRemaining}h ${minutesRemaining}m`,
    timeRemainingMs: timeRemaining
  };
}
