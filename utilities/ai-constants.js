/**
 * Shared AI constants used by the controller, gateway, and bienbot utilities.
 * @module utilities/ai-constants
 */

const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  MISTRAL: 'mistral',
  GEMINI: 'gemini'
};

const AI_TASKS = {
  AUTOCOMPLETE: 'autocomplete',
  EDIT_LANGUAGE: 'edit_language',
  IMPROVE_DESCRIPTION: 'improve_description',
  SUMMARIZE: 'summarize',
  GENERATE_TIPS: 'generate_tips',
  TRANSLATE: 'translate',
  GENERAL: 'general',
  BIENBOT_CHAT: 'bienbot_chat',
  BIENBOT_SUMMARIZE: 'bienbot_summarize',
  BIENBOT_ANALYZE: 'bienbot_analyze'
};

const DEFAULT_MODELS = {
  [AI_PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [AI_PROVIDERS.ANTHROPIC]: 'claude-3-haiku-20240307',
  [AI_PROVIDERS.MISTRAL]: 'mistral-small-latest',
  [AI_PROVIDERS.GEMINI]: 'gemini-1.5-flash'
};

module.exports = { AI_PROVIDERS, AI_TASKS, DEFAULT_MODELS };
