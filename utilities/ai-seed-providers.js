/**
 * AI Provider & Policy Seed Script
 *
 * Seeds the ai_provider_configs collection with the four built-in providers
 * and creates a default global policy if none exists. Safe to call multiple
 * times — uses upsert operations and skips existing documents.
 *
 * Called on server startup if the collection is empty.
 *
 * @module utilities/ai-seed-providers
 */

const logger = require('./backend-logger');

const DEFAULT_PROVIDERS = [
  {
    provider: 'openai',
    display_name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    api_version: null,
    default_model: 'gpt-4o-mini',
    valid_models: [
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-turbo-preview', 'gpt-4',
      'gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'o1-preview', 'o1-mini'
    ],
    enabled: true,
    priority: 0,
    env_key_name: 'OPENAI_API_KEY'
  },
  {
    provider: 'anthropic',
    display_name: 'Anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    api_version: '2023-06-01',
    default_model: 'claude-3-haiku-20240307',
    valid_models: [
      'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20240620', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
      'claude-sonnet-4-20250514', 'claude-opus-4-5-20251101'
    ],
    enabled: true,
    priority: 1,
    env_key_name: 'ANTHROPIC_API_KEY'
  },
  {
    provider: 'mistral',
    display_name: 'Mistral',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    api_version: null,
    default_model: 'mistral-small-latest',
    valid_models: [
      'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest',
      'open-mistral-7b', 'open-mixtral-8x7b', 'open-mixtral-8x22b',
      'codestral-latest', 'mistral-embed'
    ],
    enabled: true,
    priority: 2,
    env_key_name: 'MISTRAL_API_KEY'
  },
  {
    provider: 'gemini',
    display_name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    api_version: null,
    default_model: 'gemini-1.5-flash',
    valid_models: [
      'gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-latest',
      'gemini-1.0-pro', 'gemini-1.0-pro-latest', 'gemini-pro', 'gemini-pro-vision',
      'gemini-2.0-flash-exp', 'gemini-exp-1206'
    ],
    enabled: true,
    priority: 3,
    env_key_name: 'GEMINI_API_KEY'
  }
];

const DEFAULT_GLOBAL_POLICY = {
  name: 'Global Default',
  scope: 'global',
  target: null,
  allowed_providers: [],
  blocked_providers: [],
  allowed_models: [],
  rate_limits: {
    requests_per_minute: 20,
    requests_per_hour: 200,
    requests_per_day: 1000
  },
  token_budget: {
    daily_input_tokens: null,
    daily_output_tokens: null,
    monthly_input_tokens: null,
    monthly_output_tokens: null
  },
  task_routing: [],
  content_filtering: {
    enabled: false,
    block_patterns: [],
    redact_patterns: []
  },
  max_tokens_per_request: 4000,
  active: true
};

/**
 * Seed AI provider configs and global policy.
 * Safe to call multiple times (idempotent via upsert).
 *
 * @returns {Promise<{ providers: number, policyCreated: boolean }>}
 */
async function seedAIProviders() {
  const AIProviderConfig = require('../models/ai-provider-config');
  const AIPolicy = require('../models/ai-policy');

  let providersSeeded = 0;
  let policyCreated = false;

  try {
    // Seed providers (upsert by provider name).
    // `includeResultMetadata` exposes the underlying MongoDB write result so
    // we can reliably detect inserts vs updates without comparing timestamps.
    // (Replaces the deprecated `rawResult` option in mongoose 8+.)
    for (const providerData of DEFAULT_PROVIDERS) {
      const result = await AIProviderConfig.findOneAndUpdate(
        { provider: providerData.provider },
        { $setOnInsert: providerData },
        { upsert: true, new: true, includeResultMetadata: true }
      );

      const lastError = result?.lastErrorObject;
      const wasInsert = lastError && lastError.updatedExisting === false;
      if (wasInsert) {
        providersSeeded++;
      }
    }

    // Seed global policy (only if none exists)
    const existingGlobal = await AIPolicy.findOne({ scope: 'global' }).lean();
    if (!existingGlobal) {
      await AIPolicy.create(DEFAULT_GLOBAL_POLICY);
      policyCreated = true;
    }

    if (providersSeeded > 0 || policyCreated) {
      logger.info('[ai-seed] AI providers and policy seeded', { providersSeeded, policyCreated });
    }

    return { providers: providersSeeded, policyCreated };
  } catch (err) {
    logger.error('[ai-seed] Failed to seed AI providers', { error: err.message });
    return { providers: 0, policyCreated: false };
  }
}

module.exports = { seedAIProviders, DEFAULT_PROVIDERS };
