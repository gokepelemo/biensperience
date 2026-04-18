/**
 * Canonical list of AI providers supported by the backend.
 *
 * Single source of truth for provider enums on AIPolicy and AIProviderConfig.
 * Add a new provider here, then configure it in utilities/ai-seed-providers.js
 * and utilities/ai-provider-registry.js.
 *
 * @module utilities/ai-providers
 */

const SUPPORTED_PROVIDERS = Object.freeze(['openai', 'anthropic', 'mistral', 'gemini']);

module.exports = { SUPPORTED_PROVIDERS };
