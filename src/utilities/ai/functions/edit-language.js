/**
 * AI Language Editing Function
 *
 * @module ai/functions/edit-language
 */

import { AI_TASKS, SYSTEM_PROMPTS } from '../constants';
import { complete } from '../complete';

/**
 * Edit and improve the language of text
 *
 * @param {string} text - Text to edit
 * @param {Object} options - Options
 * @param {string} [options.tone] - Desired tone (formal, casual, professional)
 * @param {string} [options.provider] - Override provider
 * @returns {Promise<string>} Edited text
 */
export async function editLanguage(text, options = {}) {
  const { tone = 'friendly' } = options;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS[AI_TASKS.EDIT_LANGUAGE] },
    {
      role: 'user',
      content: `Edit this text to improve its grammar and clarity. Maintain a ${tone} tone:\n\n${text}`
    }
  ];

  const result = await complete(messages, {
    ...options,
    task: AI_TASKS.EDIT_LANGUAGE,
    temperature: 0.3
  });

  return result.content.trim();
}
