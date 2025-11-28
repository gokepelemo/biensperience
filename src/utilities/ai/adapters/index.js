/**
 * AI Provider Adapters Registry
 *
 * @module ai/adapters
 */

import { AI_PROVIDERS } from '../constants';
import openaiAdapter from './openai';
import anthropicAdapter from './anthropic';
import mistralAdapter from './mistral';
import geminiAdapter from './gemini';

/**
 * Provider adapter registry
 */
export const adapters = {
  [AI_PROVIDERS.OPENAI]: openaiAdapter,
  [AI_PROVIDERS.ANTHROPIC]: anthropicAdapter,
  [AI_PROVIDERS.MISTRAL]: mistralAdapter,
  [AI_PROVIDERS.GEMINI]: geminiAdapter
};

/**
 * Get adapter for a provider
 * @param {string} provider - Provider name
 * @returns {Object} Provider adapter
 */
export function getAdapter(provider) {
  const adapter = adapters[provider];
  if (!adapter) {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
  return adapter;
}

export {
  openaiAdapter,
  anthropicAdapter,
  mistralAdapter,
  geminiAdapter
};
