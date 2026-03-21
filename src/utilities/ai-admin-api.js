/**
 * AI Admin API Utility
 *
 * Frontend API calls for AI gateway administration.
 * Follows the sendRequest + broadcastEvent pattern.
 *
 * @module utilities/ai-admin-api
 */

import { sendRequest } from './send-request';
import { broadcastEvent } from './event-bus';
import { logger } from './logger';

const BASE_URL = '/api/ai-admin';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export async function getProviders() {
  return sendRequest(`${BASE_URL}/providers`, 'GET');
}

export async function getProvider(id) {
  return sendRequest(`${BASE_URL}/providers/${id}`, 'GET');
}

export async function createProvider(data) {
  const result = await sendRequest(`${BASE_URL}/providers`, 'POST', data);
  try {
    if (result?.provider) {
      broadcastEvent('ai:provider:created', { provider: result.provider });
      logger.debug('[ai-admin-api] Provider created event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

export async function updateProvider(id, data) {
  const result = await sendRequest(`${BASE_URL}/providers/${id}`, 'PUT', data);
  try {
    if (result?.provider) {
      broadcastEvent('ai:provider:updated', { provider: result.provider, providerId: id });
      logger.debug('[ai-admin-api] Provider updated event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

// ---------------------------------------------------------------------------
// Policies
// ---------------------------------------------------------------------------

export async function getPolicies() {
  return sendRequest(`${BASE_URL}/policies`, 'GET');
}

export async function getPolicy(id) {
  return sendRequest(`${BASE_URL}/policies/${id}`, 'GET');
}

export async function createPolicy(data) {
  const result = await sendRequest(`${BASE_URL}/policies`, 'POST', data);
  try {
    if (result?.policy) {
      broadcastEvent('ai:policy:created', { policy: result.policy });
      logger.debug('[ai-admin-api] Policy created event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

export async function updatePolicy(id, data) {
  const result = await sendRequest(`${BASE_URL}/policies/${id}`, 'PUT', data);
  try {
    if (result?.policy) {
      broadcastEvent('ai:policy:updated', { policy: result.policy, policyId: id });
      logger.debug('[ai-admin-api] Policy updated event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

export async function deletePolicy(id) {
  const result = await sendRequest(`${BASE_URL}/policies/${id}`, 'DELETE');
  try {
    broadcastEvent('ai:policy:deleted', { policyId: id });
    logger.debug('[ai-admin-api] Policy deleted event dispatched');
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

// ---------------------------------------------------------------------------
// Usage Analytics
// ---------------------------------------------------------------------------

export async function getUsageSummary(days = 30) {
  return sendRequest(`${BASE_URL}/usage/summary?days=${days}`, 'GET');
}

export async function getUsage(params = {}) {
  const query = new URLSearchParams();
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.userId) query.set('userId', params.userId);
  if (params.limit) query.set('limit', params.limit);
  if (params.offset) query.set('offset', params.offset);

  const qs = query.toString();
  return sendRequest(`${BASE_URL}/usage${qs ? `?${qs}` : ''}`, 'GET');
}

export async function getUserUsage(userId, days = 30) {
  return sendRequest(`${BASE_URL}/usage/users/${userId}?days=${days}`, 'GET');
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export async function getRouting() {
  return sendRequest(`${BASE_URL}/routing`, 'GET');
}

export async function updateRouting(taskRouting) {
  const result = await sendRequest(`${BASE_URL}/routing`, 'PUT', { task_routing: taskRouting });
  try {
    broadcastEvent('ai:routing:updated', { task_routing: result?.data?.task_routing });
    logger.debug('[ai-admin-api] Routing updated event dispatched');
  } catch (e) { /* ignore event emission errors */ }
  return result;
}
