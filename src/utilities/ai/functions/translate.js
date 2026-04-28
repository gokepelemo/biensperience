/**
 * AI Translation Function
 *
 * Posts to POST /api/ai/translate. The backend owns prompt resolution and
 * provider routing; callers may forward `options.prompts` for per-call
 * overrides honored by the backend's `resolvePrompt()` path.
 *
 * @module ai/functions/translate
 */

import { postAIRequest } from './_request';

/**
 * Translate travel content to another language.
 *
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language (e.g., 'Spanish', 'French')
 * @param {Object} [options] - Options
 * @param {string} [options.sourceLanguage] - Source language (default 'auto' on backend)
 * @param {Object} [options.prompts] - Optional caller prompt overrides forwarded to backend
 * @param {string} [options.provider] - Override provider (forwarded)
 * @param {string} [options.model] - Override model (forwarded)
 * @returns {Promise<string>} Translated text
 */
export async function translate(text, targetLanguage, options = {}) {
  if (typeof targetLanguage !== 'string' || !targetLanguage.trim()) {
    throw new Error('translate: targetLanguage is required');
  }

  const { sourceLanguage, ...rest } = options;

  const data = await postAIRequest('translate', {
    text,
    targetLanguage,
    sourceLanguage,
    options: rest
  });

  return typeof data?.translation === 'string' ? data.translation.trim() : '';
}
