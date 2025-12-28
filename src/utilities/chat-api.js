import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/chat';

function extractData(response) {
  // Standard API envelope: { success, data, message }
  if (response && typeof response === 'object') {
    if ('data' in response) return response.data;
    if ('success' in response && response.success === false) {
      throw new Error(response.error || 'Request failed');
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
