/**
 * AI Translation Function
 *
 * @module ai/functions/translate
 */

import { AI_TASKS } from '../constants';
import { complete } from '../complete';
import { resolveSystemPrompt } from './_shared';

/**
 * Translate travel content to another language
 *
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language (e.g., 'Spanish', 'French')
 * @param {Object} options - Options
 * @param {string} [options.sourceLanguage] - Source language (auto-detected if not provided)
 * @param {string} [options.provider] - Override provider
 * @param {Object} [options.prompts] - Optional prompts override. An object mapping AI task keys (see `AI_TASKS`) to system prompt strings. When provided, the task-specific prompt will be used instead of the central `SYSTEM_PROMPTS`.
 * @returns {Promise<string>} Translated text
 */
export async function translate(text, targetLanguage, options = {}) {
  if (typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
    throw new Error('translate: targetLanguage is required');
  }

  const { sourceLanguage = 'auto-detect' } = options;

  const systemPrompt = resolveSystemPrompt(AI_TASKS.TRANSLATE, options);

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: sourceLanguage === 'auto-detect'
        ? `Translate to ${targetLanguage}:\n\n${text}`
        : `Translate from ${sourceLanguage} to ${targetLanguage}:\n\n${text}`
    }
  ];

  const result = await complete(messages, {
    ...options,
    task: AI_TASKS.TRANSLATE,
    temperature: 0.3
  });

  return result.content.trim();
}
