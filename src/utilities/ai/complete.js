/**
 * Core AI Completion Function
 *
 * @module ai/complete
 */

import { logger } from '../logger';
import { AI_TASKS } from './constants';
import { getProviderForTask } from './config';
import { getAdapter } from './adapters';

/**
 * Send a completion request to the configured AI provider
 *
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} options - Options
 * @param {string} [options.provider] - Override provider
 * @param {string} [options.model] - Override model
 * @param {number} [options.temperature] - Temperature (0-1)
 * @param {number} [options.maxTokens] - Max output tokens
 * @param {string} [options.task] - Task type for routing
 * @param {Object} [options.prompts] - Optional prompts override. When provided, higher-level helpers may use these to override system prompts for a given AI task. `complete` will pass this through to adapters but does not itself select system prompts.
 * @returns {Promise<{content: string, usage: Object, model: string, provider: string}>}
 */
export async function complete(messages, options = {}) {
  const task = options.task || AI_TASKS.AUTOCOMPLETE;
  const provider = getProviderForTask(task, options);
  const adapter = getAdapter(provider);

  logger.debug('AI completion request', { provider, task, messageCount: messages.length });

  try {
    const result = await adapter.complete(messages, options);
    logger.debug('AI completion success', { provider, tokens: result.usage.totalTokens });
    return result;
  } catch (error) {
    logger.error('AI completion failed', { provider, task, error: error.message }, error);
    throw error;
  }
}
