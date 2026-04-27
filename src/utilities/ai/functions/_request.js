/**
 * Shared request wrapper for AI task-specific endpoints.
 *
 * Each high-level AI function (autocomplete, improve, summarize, translate,
 * generate-tips, edit-language) POSTs to its own backend endpoint via this
 * wrapper. The backend is authoritative for prompt resolution, provider
 * routing, rate limiting, and policy enforcement.
 *
 * Response envelope shape (from controllers/api/ai.js):
 *   { success: true, data: {...task-specific fields...} }
 *   { success: false, error: string, code?: string }
 *
 * @module ai/functions/_request
 */

import { sendRequest } from '../../send-request';
import { logger } from '../../logger';

const AI_API_BASE = '/api/ai';

/**
 * POST a request to /api/ai/<task> and return `result.data` on success.
 *
 * Throws if the response envelope reports `success: false` or if the
 * underlying network request fails. All callers receive the unwrapped `data`
 * object from a successful response — task-specific fields like `completion`,
 * `improved`, `tips`, etc. are read off of that.
 *
 * @param {string} task - URL slug under /api/ai (e.g., 'autocomplete', 'improve')
 * @param {Object} body - Request body forwarded as JSON
 * @returns {Promise<Object>} The `data` field from the envelope
 * @throws {Error} If the envelope reports failure or the network call fails
 */
export async function postAIRequest(task, body) {
  const url = `${AI_API_BASE}/${task}`;
  try {
    const result = await sendRequest(url, 'POST', body);

    if (!result || result.success !== true) {
      const message = (result && result.error) || `AI request failed: ${task}`;
      throw new Error(message);
    }

    return result.data;
  } catch (error) {
    logger.error('[ai] task request failed', { task, error: error.message });
    throw error;
  }
}
