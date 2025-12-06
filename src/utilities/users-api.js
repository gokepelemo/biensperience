import { sendRequest } from "./send-request.js";
import { logger } from "./logger.js";
import { broadcastEvent } from "./event-bus.js";

const BASE_URL = `/api/users/`;

export async function signUp(userData) {
  const result = await sendRequest(`${BASE_URL}`, "POST", userData);

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
  const response = await sendRequest(`${BASE_URL}login`, "POST", credentials);
  // Backend now returns { success: true, token, user } - extract token
  return response.token || response;
}

export function checkToken() {
  return sendRequest(`${BASE_URL}check-token`);
}

export async function getUserData(id) {
  return await sendRequest(`${BASE_URL}${id}`, "GET");
}

// OPTIMIZATION: Bulk fetch multiple users in one request
export async function getBulkUserData(ids) {
  if (!ids || ids.length === 0) return [];
  return await sendRequest(`${BASE_URL}bulk?ids=${ids.join(',')}`, "GET");
}

export async function updateUser(id, userData) {
  const result = await sendRequest(`${BASE_URL}${id}`, "PUT", userData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for updated events
  try {
    if (result) {
      broadcastEvent('user:updated', { user: result, userId: result._id });
      logger.debug('[users-api] User updated event dispatched', { id: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function updateUserAsAdmin(id, userData) {
  const result = await sendRequest(`${BASE_URL}${id}/admin`, "PUT", userData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for updated events
  try {
    if (result) {
      broadcastEvent('user:updated', { user: result, userId: result._id });
      logger.debug('[users-api] User updated (admin) event dispatched', { id: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function searchUsers(query) {
  return await sendRequest(`${BASE_URL}search?q=${encodeURIComponent(query)}`, "GET");
}

export async function updateUserRole(userId, roleData) {
  const result = await sendRequest(`${BASE_URL}${userId}/role`, "PUT", roleData);

  // Emit event via event bus (handles local + cross-tab dispatch)
  // Standardized payload: { entity, entityId } for updated events
  try {
    if (result) {
      broadcastEvent('user:updated', { user: result, userId: result._id });
      logger.debug('[users-api] User role updated event dispatched', { id: result._id });
    }
  } catch (e) {
    // ignore
  }

  return result;
}

export async function getAllUsers() {
  return await sendRequest(`${BASE_URL}all`, "GET");
}

export async function requestPasswordReset(email) {
  return await sendRequest(`${BASE_URL}forgot-password`, "POST", { email });
}

export async function resetPassword(token, newPassword) {
  return await sendRequest(`${BASE_URL}reset-password`, "POST", { token, password: newPassword });
}

export async function confirmEmail(token) {
  return await sendRequest(`${BASE_URL}confirm-email/${token}`, "GET");
}

export async function resendConfirmation(email) {
  return await sendRequest(`${BASE_URL}resend-confirmation`, "POST", { email });
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
  const result = await sendRequest(`${BASE_URL}${id}`, "DELETE", {
    password,
    confirmDelete,
    transferToUserId
  });

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
