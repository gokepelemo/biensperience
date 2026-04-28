/**
 * AI Language Editing Function
 *
 * Posts to POST /api/ai/edit-language. The backend owns prompt resolution and
 * provider routing; callers may forward `options.prompts` for per-call
 * overrides honored by the backend's `resolvePrompt()` path.
 *
 * @module ai/functions/edit-language
 */

import { postAIRequest } from './_request';

/**
 * Edit and improve the language of text.
 *
 * @param {string} text - Text to edit
 * @param {Object} [options] - Options
 * @param {string} [options.tone] - Desired tone (formal, casual, professional) — forwarded to backend
 * @param {Object} [options.prompts] - Optional caller prompt overrides forwarded to backend
 * @param {string} [options.provider] - Override provider (forwarded)
 * @param {string} [options.model] - Override model (forwarded)
 * @returns {Promise<string>} Edited text
 */
export async function editLanguage(text, options = {}) {
  const data = await postAIRequest('edit-language', {
    text,
    options
  });

  return typeof data?.edited === 'string' ? data.edited.trim() : '';
}
