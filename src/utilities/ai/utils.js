/**
 * AI Utility Functions
 *
 * @module ai/utils
 */

import { AI_PROVIDERS } from './constants';
import { getAIConfig, getApiKey } from './config';

/**
 * Check if a provider is configured (has API key)
 * @param {string} provider - Provider name
 * @returns {boolean} True if provider is configured
 */
export function isProviderConfigured(provider) {
  const apiKey = getApiKey(provider);
  return Boolean(apiKey && apiKey.length > 0);
}

/**
 * Get list of configured providers
 * @returns {string[]} Array of configured provider names
 */
export function getConfiguredProviders() {
  return Object.values(AI_PROVIDERS).filter(isProviderConfigured);
}

/**
 * Check if AI features are available (at least one provider configured)
 * @returns {boolean} True if AI is available
 */
export function isAIAvailable() {
  return getConfiguredProviders().length > 0;
}

/**
 * Get the default provider
 * @returns {string|null} Default provider name or null if none configured
 */
export function getDefaultProvider() {
  const config = getAIConfig();
  if (isProviderConfigured(config.defaultProvider)) {
    return config.defaultProvider;
  }
  // Fall back to first configured provider
  const configured = getConfiguredProviders();
  return configured.length > 0 ? configured[0] : null;
}
