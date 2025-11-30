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

/**
 * System prompts for different tasks
 */
import { lang } from '../../lang.constants';

// Export system prompts from language constants so prompts can be localized
// and centrally managed. Callers may still pass overrides via options.prompts.
export const SYSTEM_PROMPTS = (lang && lang.en && lang.en.prompts) || {
  // Fallbacks (should not be used in normal operation if lang.prompts is present)
  [AI_TASKS.AUTOCOMPLETE]: `You are a helpful travel assistant that provides autocomplete suggestions for travel-related content.
Provide concise, relevant completions that match the user's writing style.
Only output the completion text, no explanations.`,

  [AI_TASKS.EDIT_LANGUAGE]: `You are an expert editor for travel content.
Improve the grammar, clarity, and flow of the text while maintaining the original meaning and tone.
Fix any spelling or punctuation errors.
Only output the edited text, no explanations or commentary.`,

  [AI_TASKS.IMPROVE_DESCRIPTION]: `You are a skilled travel writer who creates engaging, vivid descriptions of destinations and experiences.
Enhance the description to be more compelling, informative, and evocative while keeping it authentic and accurate.
Maintain a friendly, conversational tone suitable for travel planning.
Only output the improved description, no explanations.`,

  [AI_TASKS.SUMMARIZE]: `You are a travel content summarizer.
Create a concise, informative summary that captures the essential details.
Focus on key highlights, practical information, and what makes the destination or experience unique.
Only output the summary, no explanations.`,

  [AI_TASKS.GENERATE_TIPS]: `You are an experienced traveler sharing practical tips.
Generate helpful, actionable travel tips based on the destination or experience.
Include local insights, best practices, and things to be aware of.
Format tips as a JSON array of strings. Only output valid JSON.`,

  [AI_TASKS.TRANSLATE]: `You are a professional translator specializing in travel content.
Translate the text while preserving the meaning, tone, and cultural nuances.
Adapt any culturally-specific references appropriately.
Only output the translated text, no explanations.`
};
