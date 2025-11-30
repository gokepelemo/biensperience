/**
 * AI Summarization Function
 *
 * @module ai/functions/summarize
 */

import { AI_TASKS, SYSTEM_PROMPTS } from '../constants';
import { complete } from '../complete';

/**
 * Generate a summary of travel content
 *
 * @param {string} content - Content to summarize
 * @param {Object} options - Options
 * @param {number} [options.maxLength] - Max summary length in words
 * @param {string} [options.style] - Summary style (brief, detailed, bullet-points)
 * @param {string} [options.provider] - Override provider
 * @param {Object} [options.prompts] - Optional prompts override. An object mapping AI task keys (see `AI_TASKS`) to system prompt strings. When provided, the task-specific prompt will be used instead of the central `SYSTEM_PROMPTS`.
 * @returns {Promise<string>} Summary
 */
export async function summarize(content, options = {}) {
  const { maxLength = 100, style = 'brief' } = options;

  let styleInstruction = '';
  switch (style) {
    case 'detailed':
      styleInstruction = 'Provide a comprehensive summary covering all key aspects.';
      break;
    case 'bullet-points':
      styleInstruction = 'Format the summary as bullet points highlighting key information.';
      break;
    default:
      styleInstruction = 'Provide a concise summary capturing the essential points.';
  }

  const systemPrompt = (options.prompts && options.prompts[AI_TASKS.SUMMARIZE]) || SYSTEM_PROMPTS[AI_TASKS.SUMMARIZE];

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `${styleInstruction}\nMax length: ${maxLength} words.\n\nContent to summarize:\n\n${content}`
    }
  ];

  const result = await complete(messages, {
    ...options,
    task: AI_TASKS.SUMMARIZE,
    temperature: 0.5
  });

  return result.content.trim();
}
