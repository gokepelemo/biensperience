/**
 * Core AI Completion Function
 *
 * SECURITY: This module now uses the backend AI proxy instead of direct API calls.
 * All AI API keys are stored server-side only - never exposed to the frontend.
 *
 * @module ai/complete
 */

import { logger } from '../logger';
import { sendRequest } from '../send-request';
import { AI_TASKS } from './constants';

const AI_API_BASE = '/api/ai';

/**
 * Send a completion request via the secure backend proxy
 *
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} options - Options
 * @param {string} [options.provider] - Override provider
 * @param {string} [options.model] - Override model
 * @param {number} [options.temperature] - Temperature (0-1)
 * @param {number} [options.maxTokens] - Max output tokens
 * @param {string} [options.task] - Task type for routing
 * @param {Object} [options.prompts] - Optional prompts override (not used in backend proxy)
 * @returns {Promise<{content: string, usage: Object, model: string, provider: string}>}
 */
export async function complete(messages, options = {}) {
  const task = options.task || AI_TASKS.AUTOCOMPLETE;

  logger.debug('AI completion request (via backend proxy)', { task, messageCount: messages.length });

  try {
    const result = await sendRequest(`${AI_API_BASE}/complete`, 'POST', {
      messages,
      task,
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'AI completion failed');
    }

    logger.debug('AI completion success', { provider: result.data.provider, tokens: result.data.usage?.totalTokens });
    return result.data;
  } catch (error) {
    logger.error('AI completion failed', { task, error: error.message }, error);
    throw error;
  }
}
