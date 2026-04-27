/**
 * AI Description Improvement Function
 *
 * Posts to POST /api/ai/improve. The backend owns prompt resolution and
 * provider routing; callers may forward `options.prompts` for per-call
 * overrides honored by the backend's `resolvePrompt()` path.
 *
 * @module ai/functions/improve-description
 */

import { postAIRequest } from './_request';

/**
 * Improve a destination or experience description.
 *
 * @param {string} description - Original description
 * @param {Object} [options] - Options
 * @param {string} [options.type] - Content type (destination, experience, activity, plan, general)
 * @param {string} [options.name] - Name of the destination/experience (forwarded as context)
 * @param {string} [options.location] - Location context (forwarded)
 * @param {Object} [options.prompts] - Optional caller prompt overrides forwarded to backend
 * @param {string} [options.provider] - Override provider (forwarded)
 * @param {string} [options.model] - Override model (forwarded)
 * @returns {Promise<string>} Improved description
 */
export async function improveDescription(description, options = {}) {
  const { type = 'general', ...rest } = options;

  const data = await postAIRequest('improve', {
    text: description,
    type,
    options: rest
  });

  return typeof data?.improved === 'string' ? data.improved.trim() : '';
}
