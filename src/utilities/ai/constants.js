/**
 * AI Constants
 *
 * Provider identifiers, task types, default models, and API endpoints.
 *
 * @module ai/constants
 */

/**
 * Supported AI providers
 */
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  MISTRAL: 'mistral',
  GEMINI: 'gemini'
};

/**
 * Task types for AI operations
 */
export const AI_TASKS = {
  AUTOCOMPLETE: 'autocomplete',
  EDIT_LANGUAGE: 'edit_language',
  IMPROVE_DESCRIPTION: 'improve_description',
  SUMMARIZE: 'summarize',
  GENERATE_TIPS: 'generate_tips',
  TRANSLATE: 'translate'
};

/**
 * BienBot intents from the intent corpus.
 * Used for intent-based routing rules.
 */
export const BIENBOT_INTENTS = {
  QUERY_DESTINATION: 'QUERY_DESTINATION',
  PLAN_EXPERIENCE: 'PLAN_EXPERIENCE',
  CREATE_EXPERIENCE: 'CREATE_EXPERIENCE',
  ADD_PLAN_ITEMS: 'ADD_PLAN_ITEMS',
  INVITE_COLLABORATOR: 'INVITE_COLLABORATOR',
  SYNC_PLAN: 'SYNC_PLAN',
  ANSWER_QUESTION: 'ANSWER_QUESTION'
};

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS = {
  [AI_PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [AI_PROVIDERS.ANTHROPIC]: 'claude-3-haiku-20240307',
  [AI_PROVIDERS.MISTRAL]: 'mistral-small-latest',
  [AI_PROVIDERS.GEMINI]: 'gemini-1.5-flash'
};

/**
 * Provider API endpoints
 */
export const PROVIDER_ENDPOINTS = {
  [AI_PROVIDERS.OPENAI]: 'https://api.openai.com/v1/chat/completions',
  [AI_PROVIDERS.ANTHROPIC]: 'https://api.anthropic.com/v1/messages',
  [AI_PROVIDERS.MISTRAL]: 'https://api.mistral.ai/v1/chat/completions',
  [AI_PROVIDERS.GEMINI]: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// Note: System prompts now live exclusively on the backend
// (utilities/lang.constants.js → lang.en.prompts), resolved per-request via
// `resolvePrompt()` in controllers/api/ai.js. Callers can still override on
// a per-call basis by passing `options.prompts` to any high-level function;
// the override is forwarded to the backend.
