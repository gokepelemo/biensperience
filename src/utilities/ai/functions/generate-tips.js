/**
 * AI Travel Tips Generation Function
 *
 * @module ai/functions/generate-tips
 */

import { logger } from '../../logger';
import { AI_TASKS, SYSTEM_PROMPTS } from '../constants';
import { complete } from '../complete';

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

  const systemPrompt = (options.prompts && options.prompts[AI_TASKS.GENERATE_TIPS]) || SYSTEM_PROMPTS[AI_TASKS.GENERATE_TIPS];

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

  // Parse JSON response
  try {
    const tips = JSON.parse(result.content);
    if (Array.isArray(tips)) {
      return tips.slice(0, count);
    }
  } catch (e) {
    logger.warn('Failed to parse travel tips as JSON, attempting extraction', { content: result.content });
    // Try to extract tips from non-JSON response
    const lines = result.content.split('\n').filter(line => line.trim());
    return lines.slice(0, count);
  }

  return [];
}
