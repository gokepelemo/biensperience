/**
 * AI Configuration
 *
 * Environment-based configuration and provider routing.
 * Uses simplified env var names (without VITE_ or REACT_APP_ prefix).
 *
 * @module ai/config
 */

import { AI_PROVIDERS, AI_TASKS } from './constants';

/**
 * Get AI configuration from environment variables
 * @returns {Object} AI configuration
 */
export function getAIConfig() {
  return {
    defaultProvider: import.meta.env.AI_DEFAULT_PROVIDER || AI_PROVIDERS.OPENAI,
    openaiApiKey: import.meta.env.OPENAI_API_KEY || '',
    anthropicApiKey: import.meta.env.ANTHROPIC_API_KEY || '',
    mistralApiKey: import.meta.env.MISTRAL_API_KEY || '',
    geminiApiKey: import.meta.env.GEMINI_API_KEY || '',
    // Task-specific provider routing
    taskRouting: {
      [AI_TASKS.AUTOCOMPLETE]: import.meta.env.AI_AUTOCOMPLETE_PROVIDER || null,
      [AI_TASKS.EDIT_LANGUAGE]: import.meta.env.AI_EDIT_PROVIDER || null,
      [AI_TASKS.IMPROVE_DESCRIPTION]: import.meta.env.AI_IMPROVE_PROVIDER || null,
      [AI_TASKS.SUMMARIZE]: import.meta.env.AI_SUMMARIZE_PROVIDER || null,
      [AI_TASKS.GENERATE_TIPS]: import.meta.env.AI_TIPS_PROVIDER || null,
      [AI_TASKS.TRANSLATE]: import.meta.env.AI_TRANSLATE_PROVIDER || null
    }
  };
}

/**
 * Get the API key for a specific provider
 * @param {string} provider - Provider name
 * @param {Object} config - Optional config override
 * @returns {string} API key
 */
export function getApiKey(provider, config = null) {
  const cfg = config || getAIConfig();
  switch (provider) {
    case AI_PROVIDERS.OPENAI:
      return cfg.openaiApiKey;
    case AI_PROVIDERS.ANTHROPIC:
      return cfg.anthropicApiKey;
    case AI_PROVIDERS.MISTRAL:
      return cfg.mistralApiKey;
    case AI_PROVIDERS.GEMINI:
      return cfg.geminiApiKey;
    default:
      return '';
  }
}

/**
 * Get the provider for a specific task
 * @param {string} task - Task type from AI_TASKS
 * @param {Object} options - Options with optional provider override
 * @returns {string} Provider name
 */
export function getProviderForTask(task, options = {}) {
  // Explicit provider override takes precedence
  if (options.provider && Object.values(AI_PROVIDERS).includes(options.provider)) {
    return options.provider;
  }

  const config = getAIConfig();

  // Check task-specific routing
  const taskProvider = config.taskRouting[task];
  if (taskProvider && Object.values(AI_PROVIDERS).includes(taskProvider)) {
    return taskProvider;
  }

  // Fall back to default provider
  return config.defaultProvider;
}
