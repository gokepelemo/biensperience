/**
 * AI Autocomplete Function
 *
 * @module ai/functions/autocomplete
 */

import { AI_TASKS, SYSTEM_PROMPTS } from '../constants';
import { complete } from '../complete';

/**
 * Autocomplete text with AI suggestions
 *
 * @param {string} text - Text to complete
 * @param {Object} options - Options
 * @param {string} [options.context] - Additional context (e.g., destination name)
 * @param {string} [options.provider] - Override provider
 * @param {number} [options.maxLength] - Max completion length
 * @param {Object} [options.prompts] - Optional prompts override. An object mapping AI task keys (see `AI_TASKS`) to system prompt strings. When provided, the task-specific prompt will be used instead of the central `SYSTEM_PROMPTS`.
 * @returns {Promise<string>} Autocomplete suggestion
 */
export async function autocomplete(text, options = {}) {
  const { context = '', maxLength = 100 } = options;

  const systemPrompt = (options.prompts && options.prompts[AI_TASKS.AUTOCOMPLETE]) || SYSTEM_PROMPTS[AI_TASKS.AUTOCOMPLETE];

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: context
        ? `Context: ${context}\n\nComplete this text (max ${maxLength} characters):\n"${text}"`
        : `Complete this text (max ${maxLength} characters):\n"${text}"`
    }
  ];

  const result = await complete(messages, {
    ...options,
    task: AI_TASKS.AUTOCOMPLETE,
    maxTokens: Math.ceil(maxLength / 2),
    temperature: 0.7
  });

  return result.content.trim();
}
