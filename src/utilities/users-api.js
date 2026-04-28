import { sendApi } from "./api-client.js";
import { logger } from "./logger.js";
import { broadcastEvent } from "./event-bus.js";

const BASE_URL = `/api/users/`;

export async function signUp(userData) {
  // Preserve historical contract: return the raw response (envelope) so
  // callers (users-service.js) can pass it through to setStoredToken unchanged.
  // The legacy `result.user` path remains supported for older backend formats.
  const result = await sendApi("POST", `${BASE_URL}`, userData, { unwrap: false });

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for created events
  try {
    if (result && result.user) {
      broadcastEvent('user:created', { user: result.user, userId: result.user._id });
      logger.debug('[users-api] User created event dispatched', { id: result.user._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function login(credentials) {
  // Backend returns { token, user } inside data; sendApi unwraps to that.
  // Legacy fallback: bare { token } at top level.
  const data = await sendApi("POST", `${BASE_URL}login`, credentials);
  if (data && data.token) {
    return data.token;
  }
  return data;
}

export function checkToken() {
  return sendApi("GET", `${BASE_URL}check-token`);
}

export async function getUserData(id) {
  return await sendApi("GET", `${BASE_URL}${id}`);
}

// OPTIMIZATION: Bulk fetch multiple users in one request
export async function getBulkUserData(ids) {
  if (!ids || ids.length === 0) return [];
  const data = await sendApi("GET", `${BASE_URL}bulk?ids=${ids.join(',')}`);
  return data || [];
}

export async function updateUser(id, userData) {
  // Backend returns { user, token } inside data
  const result = await sendApi("PUT", `${BASE_URL}${id}`, userData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for updated events
  // Backend returns { user, token } so extract user for event
  const user = result?.user || result;
  try {
    if (user) {
      broadcastEvent('user:updated', { user, userId: user._id });
      logger.debug('[users-api] User updated event dispatched', { id: user._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function updateUserAsAdmin(id, userData) {
  const result = await sendApi("PUT", `${BASE_URL}${id}/admin`, userData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for updated events
  // Backend returns { user } so extract user for event
  const user = result?.user || result;
  try {
    if (user) {
      broadcastEvent('user:updated', { user, userId: user._id });
      logger.debug('[users-api] User updated (admin) event dispatched', { id: user._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function startPhoneVerification(userId, phoneNumber) {
  return await sendApi("POST", `${BASE_URL}${userId}/phone-verification/start`, { phoneNumber });
}

export async function confirmPhoneVerification(userId, code) {
  return await sendApi("POST", `${BASE_URL}${userId}/phone-verification/confirm`, { code });
}

export async function searchUsers(query) {
  return await sendApi("GET", `${BASE_URL}search?q=${encodeURIComponent(query)}`);
}

/**
 * Search experiences and destinations owned by the current user by name.
 * Used in the collaborator modal to allow replicating permissions from owned entities.
 * @param {string} query - Search query (min 2 chars)
 * @returns {Promise<Array>} Array of { _id, name, type: 'experience'|'destination', collaboratorCount }
 */
export async function searchOwnedEntities(query) {
  const data = await sendApi("GET", `${BASE_URL}owned-entities/search?q=${encodeURIComponent(query)}`);
  return data || [];
}

export async function updateUserRole(userId, roleData) {
  const result = await sendApi("PUT", `${BASE_URL}${userId}/role`, roleData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for updated events
  // Backend returns { user } so extract user for event
  const user = result?.user || result;
  try {
    if (user) {
      broadcastEvent('user:updated', { user, userId: user._id });
      logger.debug('[users-api] User role updated event dispatched', { id: user._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function getAllUsers() {
  const data = await sendApi("GET", `${BASE_URL}all`);
  // Fallback for legacy response format (direct array)
  return Array.isArray(data) ? data : [];
}

export async function checkCanManageFeatureFlags() {
  const data = await sendApi("GET", `${BASE_URL}feature-admin-check`);
  return data?.canManageFeatureFlags === true;
}

export async function requestPasswordReset(email) {
  return await sendApi("POST", `${BASE_URL}forgot-password`, { email });
}

export async function resetPassword(token, newPassword) {
  return await sendApi("POST", `${BASE_URL}reset-password`, { token, password: newPassword });
}

export async function confirmEmail(token) {
  return await sendApi("GET", `${BASE_URL}confirm-email/${token}`);
}

export async function resendConfirmation(email) {
  return await sendApi("POST", `${BASE_URL}resend-confirmation`, { email });
}

/**
 * Delete user account and optionally transfer data to another user
 * @param {string} id - User ID to delete
 * @param {Object} options - Deletion options
 * @param {string} options.password - User's password for verification
 * @param {string} options.confirmDelete - Must be 'DELETE' to confirm
 * @param {string} [options.transferToUserId] - Optional user ID to transfer data to
 * @returns {Promise<Object>} Result with success status and message
 */
export async function deleteAccount(id, { password, confirmDelete, transferToUserId }) {
  // Backend returns { success, dataTransferred, transferredTo }; we want the original
  // bare response (with `success` flag) so legacy callers keep working. Use unwrap=false.
  const result = await sendApi("DELETE", `${BASE_URL}${id}`, {
    password,
    confirmDelete,
    transferToUserId
  }, { unwrap: false });

  // Emit event via event bus (handles local + cross-tab dispatch)
  try {
    if (result && result.success) {
      broadcastEvent('user:deleted', { userId: id, dataTransferred: result.dataTransferred, transferredTo: result.transferredTo });
      logger.debug('[users-api] User deleted event dispatched', { id, dataTransferred: result.dataTransferred });
    }
  } catch (e) {
    // ignore
  }

  return result;
}
