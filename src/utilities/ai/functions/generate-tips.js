/**
 * AI Travel Tips Generation Function
 *
 * @module ai/functions/generate-tips
 */

import { logger } from '../../logger';
import { AI_TASKS } from '../constants';
import { complete } from '../complete';
import { resolveSystemPrompt } from './_shared';

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
 * Strip leading list markers, ordinals, quotes from a tip line.
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
 * Generate travel tips for a destination or experience
 *
 * @param {Object} context - Context for generating tips
 * @param {string} [context.destination] - Destination name
 * @param {string} [context.country] - Country
 * @param {string} [context.experience] - Experience/activity name
 * @param {string} [context.description] - Additional context
 * @param {Object} options - Options
 * @param {number} [options.count] - Number of tips to generate
 * @param {string[]} [options.categories] - Tip categories to focus on
 * @param {string} [options.provider] - Override provider
 * @param {Object} [options.prompts] - Optional prompts override. An object mapping AI task keys (see `AI_TASKS`) to system prompt strings. When provided, the task-specific prompt will be used instead of the central `SYSTEM_PROMPTS`.
 * @returns {Promise<string[]>} Array of travel tips
 */
export async function generateTravelTips(context, options = {}) {
  const { count = 5, categories = [] } = options;
  const { destination = '', country = '', experience = '', description = '' } = context;

  let contextStr = '';
  if (destination) contextStr += `Destination: ${destination}\n`;
  if (country) contextStr += `Country: ${country}\n`;
  if (experience) contextStr += `Experience: ${experience}\n`;
  if (description) contextStr += `Description: ${description}\n`;
  if (categories.length > 0) contextStr += `Focus on: ${categories.join(', ')}\n`;

  const systemPrompt = resolveSystemPrompt(AI_TASKS.GENERATE_TIPS, options);

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `${contextStr}\nGenerate ${count} practical travel tips. Return as a JSON array of strings.`
    }
  ];

  const result = await complete(messages, {
    ...options,
    task: AI_TASKS.GENERATE_TIPS,
    temperature: 0.8
  });

  // Parse JSON response (tolerant of markdown code fences)
  const cleaned = stripCodeFences(result.content);
  try {
    const tips = JSON.parse(cleaned);
    if (Array.isArray(tips)) {
      return tips
        .map(t => (typeof t === 'string' ? t.trim() : String(t).trim()))
        .filter(Boolean)
        .slice(0, count);
    }
  } catch (e) {
    logger.warn('Failed to parse travel tips as JSON, attempting extraction', { content: result.content });
  }

  // Fallback: extract from non-JSON response, stripping list markers/quotes
  return cleaned
    .split('\n')
    .map(cleanTipLine)
    .filter(Boolean)
    .slice(0, count);
}
