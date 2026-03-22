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

export async function reorderProviders(orderedProviders) {
  const result = await sendRequest(`${BASE_URL}/providers/reorder`, 'PUT', { orderedProviders });
  try {
    broadcastEvent('ai:provider:reordered', { orderedProviders });
    logger.debug('[ai-admin-api] Providers reordered event dispatched');
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

// ---------------------------------------------------------------------------
// Intent Corpus
// ---------------------------------------------------------------------------

export async function getCorpus() {
  return sendRequest(`${BASE_URL}/corpus`, 'GET');
}

export async function getCorpusIntent(intent) {
  return sendRequest(`${BASE_URL}/corpus/${encodeURIComponent(intent)}`, 'GET');
}

export async function createCorpusIntent(data) {
  const result = await sendRequest(`${BASE_URL}/corpus`, 'POST', data);
  try {
    if (result?.intent) {
      broadcastEvent('ai:corpus:created', { intent: result.intent });
      logger.debug('[ai-admin-api] Corpus intent created event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

export async function updateCorpusIntent(intent, data) {
  const result = await sendRequest(`${BASE_URL}/corpus/${encodeURIComponent(intent)}`, 'PUT', data);
  try {
    if (result?.intent) {
      broadcastEvent('ai:corpus:updated', { intent: result.intent });
      logger.debug('[ai-admin-api] Corpus intent updated event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

export async function deleteCorpusIntent(intent) {
  const result = await sendRequest(`${BASE_URL}/corpus/${encodeURIComponent(intent)}`, 'DELETE');
  try {
    broadcastEvent('ai:corpus:deleted', { intent });
    logger.debug('[ai-admin-api] Corpus intent deleted event dispatched');
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

export async function retrainClassifier() {
  const result = await sendRequest(`${BASE_URL}/corpus/retrain`, 'POST');
  try {
    broadcastEvent('ai:classifier:retrained', { ...result });
    logger.debug('[ai-admin-api] Classifier retrained event dispatched');
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

// ---------------------------------------------------------------------------
// Classification Logs
// ---------------------------------------------------------------------------

export async function getClassificationLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.low_confidence) query.set('low_confidence', 'true');
  if (params.reviewed !== undefined) query.set('reviewed', String(params.reviewed));
  if (params.intent) query.set('intent', params.intent);
  if (params.start_date) query.set('start_date', params.start_date);
  if (params.end_date) query.set('end_date', params.end_date);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);

  const qs = query.toString();
  return sendRequest(`${BASE_URL}/classifications${qs ? `?${qs}` : ''}`, 'GET');
}

export async function getClassificationSummary(days = 30) {
  return sendRequest(`${BASE_URL}/classifications/summary?days=${days}`, 'GET');
}

export async function reviewClassification(id, data) {
  const result = await sendRequest(`${BASE_URL}/classifications/${id}/review`, 'PUT', data);
  try {
    if (result?.log) {
      broadcastEvent('ai:classification:reviewed', { log: result.log, logId: id });
      logger.debug('[ai-admin-api] Classification reviewed event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

export async function batchAddToCorpus(corrections) {
  const result = await sendRequest(`${BASE_URL}/classifications/batch-add`, 'POST', { corrections });
  try {
    broadcastEvent('ai:corpus:batch_added', { results: result?.results });
    logger.debug('[ai-admin-api] Batch corpus add event dispatched');
  } catch (e) { /* ignore event emission errors */ }
  return result;
}

// ---------------------------------------------------------------------------
// Classifier Config
// ---------------------------------------------------------------------------

export async function getClassifierConfig() {
  return sendRequest(`${BASE_URL}/classifier-config`, 'GET');
}

export async function updateClassifierConfig(data) {
  const result = await sendRequest(`${BASE_URL}/classifier-config`, 'PUT', data);
  try {
    if (result?.config) {
      broadcastEvent('ai:classifier_config:updated', { config: result.config });
      logger.debug('[ai-admin-api] Classifier config updated event dispatched');
    }
  } catch (e) { /* ignore event emission errors */ }
  return result;
}
