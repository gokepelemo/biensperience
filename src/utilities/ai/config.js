/**
 * AI Configuration (frontend)
 *
 * SECURITY: API keys live server-side only. The frontend never reads them
 * from `import.meta.env` and never selects providers based on key presence —
 * routing decisions happen in `utilities/ai-gateway.js` on the backend.
 *
 * This module retains only `getProviderForTask`, which lets a caller suggest
 * a preferred provider via env var. The backend remains the source of truth
 * and may override the suggestion.
 *
 * @module ai/config
 */

import { AI_PROVIDERS, AI_TASKS } from './constants';

/**
 * Get the suggested provider for a specific task. Returns the caller's
 * explicit override if it names a known provider, then a per-task hint from
 * env vars, then the default-provider hint, then null.
 *
 * The backend gateway is authoritative; this is just a routing hint.
 *
 * @param {string} task - Task type from AI_TASKS
 * @param {Object} options - Options with optional provider override
 * @returns {string|null} Provider name or null
 */
export function getProviderForTask(task, options = {}) {
  if (options.provider && Object.values(AI_PROVIDERS).includes(options.provider)) {
    return options.provider;
  }

  const envMap = {
    [AI_TASKS.AUTOCOMPLETE]: 'AI_AUTOCOMPLETE_PROVIDER',
    [AI_TASKS.EDIT_LANGUAGE]: 'AI_EDIT_PROVIDER',
    [AI_TASKS.IMPROVE_DESCRIPTION]: 'AI_IMPROVE_PROVIDER',
    [AI_TASKS.SUMMARIZE]: 'AI_SUMMARIZE_PROVIDER',
    [AI_TASKS.GENERATE_TIPS]: 'AI_TIPS_PROVIDER',
    [AI_TASKS.TRANSLATE]: 'AI_TRANSLATE_PROVIDER'
  };

  const envKey = envMap[task];
  const taskProvider = envKey ? import.meta.env[envKey] : null;
  if (taskProvider && Object.values(AI_PROVIDERS).includes(taskProvider)) {
    return taskProvider;
  }

  const defaultProvider = import.meta.env.AI_DEFAULT_PROVIDER;
  if (defaultProvider && Object.values(AI_PROVIDERS).includes(defaultProvider)) {
    return defaultProvider;
  }

  return null;
}
