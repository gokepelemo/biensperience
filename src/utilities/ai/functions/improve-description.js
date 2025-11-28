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
 * @returns {Promise<string>} Improved description
 */
export async function improveDescription(description, options = {}) {
  const { type = 'destination', name = '', location = '' } = options;

  let contextInfo = '';
  if (name) contextInfo += `Name: ${name}\n`;
  if (location) contextInfo += `Location: ${location}\n`;
  if (type) contextInfo += `Type: ${type}\n`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS[AI_TASKS.IMPROVE_DESCRIPTION] },
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
