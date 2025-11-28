/**
 * AI Translation Function
 *
 * @module ai/functions/translate
 */

import { AI_TASKS, SYSTEM_PROMPTS } from '../constants';
import { complete } from '../complete';

/**
 * Translate travel content to another language
 *
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language (e.g., 'Spanish', 'French')
 * @param {Object} options - Options
 * @param {string} [options.sourceLanguage] - Source language (auto-detected if not provided)
 * @param {string} [options.provider] - Override provider
 * @returns {Promise<string>} Translated text
 */
export async function translate(text, targetLanguage, options = {}) {
  const { sourceLanguage = 'auto-detect' } = options;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS[AI_TASKS.TRANSLATE] },
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
