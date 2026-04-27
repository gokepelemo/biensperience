/**
 * AI Travel Tips Generation Function
 *
 * Posts to POST /api/ai/generate-tips. The backend owns prompt resolution and
 * provider routing. The backend currently returns a free-form string in
 * `data.tips` (per the `generate_tips` system prompt — typically a numbered
 * list or JSON array depending on the model). This function applies a tolerant
 * parsing pipeline:
 *
 *   1. Strip markdown code fences (```json ... ```)
 *   2. Try JSON.parse — if the result is an array of strings, return it.
 *   3. Otherwise split by newlines and clean each line (strip list markers,
 *      surrounding quotes), drop empties, slice to `count`.
 *
 * @module ai/functions/generate-tips
 */

import { logger } from '../../logger';
import { postAIRequest } from './_request';

/**
 * Strip markdown code fences (``` and ```json) and surrounding whitespace.
 * Handles JSON returned inside fenced blocks like ```json\n[...]\n```.
 */
function stripCodeFences(content) {
  const trimmed = (content || '').trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Strip leading list markers, ordinals, surrounding quotes from a tip line.
 *  e.g. "1. Bring layers" → "Bring layers"
 *       "- \"Try local food\"" → "Try local food"
 */
function cleanTipLine(line) {
  return line
    .replace(/^\s*(?:\d+[\.\)]|[-*•])\s+/, '') // numbered or bullet prefix
    .replace(/^\s*["'“”‘’]+|["'“”‘’]+\s*$/g, '') // surrounding quotes
    .trim();
}

/**
 * Generate travel tips for a destination or experience.
 *
 * @param {Object} context - Context for generating tips
 * @param {string} [context.destination] - Destination name (required by backend)
 * @param {string} [context.country] - Country (forwarded as additional context)
 * @param {string} [context.experience] - Experience/activity name (forwarded)
 * @param {string} [context.description] - Additional context (forwarded)
 * @param {Object} [options] - Options
 * @param {string} [options.category] - Tip category (general, food, safety, transport, culture)
 * @param {number} [options.count] - Number of tips to request (default backend-side: 5)
 * @param {string[]} [options.categories] - Tip categories array (forwarded as extra context)
 * @param {Object} [options.prompts] - Optional caller prompt overrides forwarded to backend
 * @param {string} [options.provider] - Override provider (forwarded)
 * @param {string} [options.model] - Override model (forwarded)
 * @returns {Promise<string[]>} Array of travel tips
 */
export async function generateTravelTips(context = {}, options = {}) {
  const { destination = '', country, experience, description } = context;
  const { category = 'general', count = 5, ...restOptions } = options;

  const data = await postAIRequest('generate-tips', {
    destination,
    category,
    count,
    options: {
      ...restOptions,
      country,
      experience,
      description
    }
  });

  const raw = typeof data?.tips === 'string' ? data.tips : '';
  const cleaned = stripCodeFences(raw);

  // Attempt to parse as a JSON array first.
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .map(t => (typeof t === 'string' ? t.trim() : String(t).trim()))
        .filter(Boolean)
        .slice(0, count);
    }
  } catch (e) {
    logger.debug('[ai/generate-tips] tips not valid JSON; falling back to line-split', {
      error: e.message
    });
  }

  // Fallback: split by newlines, clean list markers/quotes, drop empties.
  return cleaned
    .split('\n')
    .map(cleanTipLine)
    .filter(Boolean)
    .slice(0, count);
}
