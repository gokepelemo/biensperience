/**
 * AI Autocomplete Function
 *
 * Posts to POST /api/ai/autocomplete. The backend owns prompt resolution and
 * provider routing; callers may forward `options.prompts` for per-call
 * overrides honored by the backend's `resolvePrompt()` path.
 *
 * @module ai/functions/autocomplete
 */

import { postAIRequest } from './_request';

/**
 * Autocomplete text with AI suggestions.
 *
 * @param {string} text - Text to complete
 * @param {Object} [options] - Options
 * @param {string} [options.context] - Additional context (e.g., destination name)
 * @param {Object} [options.prompts] - Optional caller prompt overrides keyed by
 *                                      backend prompt key (e.g., `autocomplete`).
 *                                      Forwarded to the backend.
 * @param {string} [options.provider] - Override provider (forwarded to backend)
 * @param {string} [options.model] - Override model (forwarded to backend)
 * @returns {Promise<string>} Autocomplete suggestion
 */
export async function autocomplete(text, options = {}) {
  const { context, ...rest } = options;

  const data = await postAIRequest('autocomplete', {
    text,
    context,
    options: rest
  });

  return typeof data?.completion === 'string' ? data.completion.trim() : '';
}
