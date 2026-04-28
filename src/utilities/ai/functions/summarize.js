/**
 * AI Summarization Function
 *
 * Posts to POST /api/ai/summarize. The backend owns prompt resolution and
 * provider routing; callers may forward `options.prompts` for per-call
 * overrides honored by the backend's `resolvePrompt()` path.
 *
 * @module ai/functions/summarize
 */

import { postAIRequest } from './_request';

/**
 * Generate a summary of travel content.
 *
 * @param {string} content - Content to summarize
 * @param {Object} [options] - Options
 * @param {number} [options.maxLength] - Max summary length in words (default backend-side: 200)
 * @param {string} [options.style] - Summary style hint (brief, detailed, bullet-points), forwarded to backend
 * @param {Object} [options.prompts] - Optional caller prompt overrides forwarded to backend
 * @param {string} [options.provider] - Override provider (forwarded)
 * @param {string} [options.model] - Override model (forwarded)
 * @returns {Promise<string>} Summary
 */
export async function summarize(content, options = {}) {
  const { maxLength, ...rest } = options;

  const data = await postAIRequest('summarize', {
    text: content,
    maxLength,
    options: rest
  });

  return typeof data?.summary === 'string' ? data.summary.trim() : '';
}
