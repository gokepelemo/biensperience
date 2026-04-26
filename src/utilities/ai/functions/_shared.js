/**
 * Shared helpers for AI function modules.
 *
 * @module ai/functions/_shared
 */

import { SYSTEM_PROMPTS } from '../constants';

/**
 * Resolve the system prompt for a task.
 * Caller-provided override → central SYSTEM_PROMPTS (sourced from lang.constants).
 *
 * @param {string} task - Task key from AI_TASKS
 * @param {Object} [options] - Function options
 * @param {Object<string,string>} [options.prompts] - Optional caller overrides keyed by AI_TASKS values
 * @returns {string|undefined}
 */
export function resolveSystemPrompt(task, options = {}) {
  return options?.prompts?.[task] ?? SYSTEM_PROMPTS[task];
}
