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
 * @returns {Promise<string>} Autocomplete suggestion
 */
export async function autocomplete(text, options = {}) {
  const { context = '', maxLength = 100 } = options;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS[AI_TASKS.AUTOCOMPLETE] },
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
