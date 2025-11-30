/**
 * AI Description Improvement Function
 *
 * @module ai/functions/improve-description
 */

import { AI_TASKS, SYSTEM_PROMPTS } from '../constants';
import { complete } from '../complete';

/**
 * Improve a destination or experience description
 *
 * @param {string} description - Original description
 * @param {Object} options - Options
 * @param {string} [options.type] - Content type (destination, experience, activity)
 * @param {string} [options.name] - Name of the destination/experience
 * @param {string} [options.location] - Location context
 * @param {string} [options.provider] - Override provider
 * @param {Object} [options.prompts] - Optional prompts override. An object mapping AI task keys (see `AI_TASKS`) to system prompt strings. When provided, the task-specific prompt will be used instead of the central `SYSTEM_PROMPTS`.
 * @returns {Promise<string>} Improved description
 */
export async function improveDescription(description, options = {}) {
  const { type = 'destination', name = '', location = '' } = options;

  let contextInfo = '';
  if (name) contextInfo += `Name: ${name}\n`;
  if (location) contextInfo += `Location: ${location}\n`;
  if (type) contextInfo += `Type: ${type}\n`;

  const systemPrompt = (options.prompts && options.prompts[AI_TASKS.IMPROVE_DESCRIPTION]) || SYSTEM_PROMPTS[AI_TASKS.IMPROVE_DESCRIPTION];

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: contextInfo
        ? `${contextInfo}\nImprove this ${type} description:\n\n${description}`
        : `Improve this ${type} description:\n\n${description}`
    }
  ];

  const result = await complete(messages, {
    ...options,
    task: AI_TASKS.IMPROVE_DESCRIPTION,
    temperature: 0.7
  });

  return result.content.trim();
}
