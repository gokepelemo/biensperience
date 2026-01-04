import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/chat';

function extractData(response) {
  // Standard API envelope: { success, data, message }
  if (response && typeof response === 'object') {
    if ('data' in response) return response.data;
    if ('success' in response && response.success === false) {
      // Prefer user-friendly message from structured error response
      // Feature flag denials return: { success: false, error: "Feature not available", message: "Chat is not enabled..." }
      const errorMessage = response.message || response.error || 'Request failed';
      const error = new Error(errorMessage);
      error.code = response.code;
      error.response = response;
      throw error;
    }
  }
  return response;
}

export async function getChatToken() {
  try {
    const resp = await sendRequest(`${BASE_URL}/token`, 'POST');
    return extractData(resp);
  } catch (err) {
    logger.error('[chat-api] Failed to get chat token', err);
    throw err;
  }
}

export async function getOrCreateDmChannel(otherUserId) {
  try {
    const resp = await sendRequest(`${BASE_URL}/channels/dm`, 'POST', { otherUserId });
    return extractData(resp);
  } catch (err) {
    logger.error('[chat-api] Failed to get DM channel', err);
    throw err;
  }
}

export async function getOrCreatePlanChannel(planId) {
  try {
    const resp = await sendRequest(`${BASE_URL}/channels/plan`, 'POST', { planId });
    return extractData(resp);
  } catch (err) {
    logger.error('[chat-api] Failed to get plan channel', err);
    throw err;
  }
}

export async function getOrCreatePlanItemChannel(planId, planItemId) {
  try {
    const resp = await sendRequest(`${BASE_URL}/channels/plan-item`, 'POST', { planId, planItemId });
    return extractData(resp);
  } catch (err) {
    logger.error('[chat-api] Failed to get plan item channel', err);
    throw err;
  }
}

export async function cancelBienBotChannel() {
  try {
    const resp = await sendRequest(`${BASE_URL}/channels/bienbot`, 'DELETE');
    return extractData(resp);
  } catch (err) {
    logger.error('[chat-api] Failed to cancel BienBot channel', err);
    throw err;
  }
}
