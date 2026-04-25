/**
 * AI Language Editing Function
 *
 * @module ai/functions/edit-language
 */

import { AI_TASKS } from '../constants';
import { complete } from '../complete';
import { resolveSystemPrompt } from './_shared';

/**
 * Edit and improve the language of text
 *
 * @param {string} text - Text to edit
 * @param {Object} options - Options
 * @param {string} [options.tone] - Desired tone (formal, casual, professional)
 * @param {string} [options.provider] - Override provider
 * @param {Object} [options.prompts] - Optional prompts override. An object mapping AI task keys (see `AI_TASKS`) to system prompt strings. When provided, the task-specific prompt will be used instead of the central `SYSTEM_PROMPTS`.
 * @returns {Promise<string>} Edited text
 */
export async function editLanguage(text, options = {}) {
  const { tone = 'friendly' } = options;

  const systemPrompt = resolveSystemPrompt(AI_TASKS.EDIT_LANGUAGE, options);

  const messages = [
    { role: 'system', content: systemPrompt },
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
