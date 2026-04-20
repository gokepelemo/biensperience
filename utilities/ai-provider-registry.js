/**
 * AI Provider Registry
 *
 * Manages AI provider handlers with DB-backed configuration and in-memory caching.
 * Replaces the hardcoded callOpenAI/callAnthropic/etc. functions from controllers/api/ai.js
 * with a registry pattern that loads config from the AIProviderConfig model.
 *
 * @module utilities/ai-provider-registry
 */

const logger = require('./backend-logger');

// ---------------------------------------------------------------------------
// Provider handler registry
// ---------------------------------------------------------------------------

const providers = new Map();

/**
 * Register a provider handler function.
 * @param {string} name - Provider name (lowercase)
 * @param {Function} handler - async (messages, options, config) => { content, usage, model, provider }
 */
function registerProvider(name, handler) {
  providers.set(name.toLowerCase(), handler);
}

/**
 * Get a registered provider handler.
 * @param {string} name
 * @returns {Function|null}
 */
function getProviderHandler(name) {
  return providers.get(name.toLowerCase()) || null;
}

// ---------------------------------------------------------------------------
// DB config cache (5-minute TTL)
// ---------------------------------------------------------------------------

let configCache = null;
let configCacheTimestamp = 0;
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

// Lazy model loading
let AIProviderConfig;
function loadModel() {
  if (!AIProviderConfig) {
    AIProviderConfig = require('../models/ai-provider-config');
  }
}

/**
 * Get all provider configs from DB (cached).
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<Map<string, Object>>} Map of provider name → config document
 */
async function getAllProviderConfigs(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && configCache && (now - configCacheTimestamp) < CONFIG_CACHE_TTL_MS) {
    return configCache;
  }

  try {
    loadModel();
    const docs = await AIProviderConfig.find({}).lean();
    const map = new Map();
    for (const doc of docs) {
      map.set(doc.provider, doc);
    }
    configCache = map;
    configCacheTimestamp = now;
    return map;
  } catch (err) {
    logger.warn('[ai-provider-registry] Failed to load provider configs from DB, using cache or empty', { error: err.message });
    return configCache || new Map();
  }
}

/**
 * Get a single provider config from DB (cached).
 * @param {string} providerName
 * @returns {Promise<Object|null>}
 */
async function getProviderConfig(providerName) {
  const configs = await getAllProviderConfigs();
  return configs.get(providerName.toLowerCase()) || null;
}

/**
 * Invalidate the provider config cache. Call after admin updates.
 */
function invalidateConfigCache() {
  configCache = null;
  configCacheTimestamp = 0;
}

// ---------------------------------------------------------------------------
// Provider call dispatch
// ---------------------------------------------------------------------------

/**
 * Call a provider through the registry with DB-loaded config.
 *
 * @param {string} providerName - Provider name
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {Object} options - { model, temperature, maxTokens, ... }
 * @returns {Promise<{content: string, usage: Object, model: string, provider: string}>}
 */
async function callProvider(providerName, messages, options = {}) {
  const name = providerName.toLowerCase();
  const handler = getProviderHandler(name);
  if (!handler || typeof handler !== 'function') {
    throw new Error(`Unknown AI provider: ${providerName}`);
  }

  // Load config from DB
  const config = await getProviderConfig(name);

  // If no DB config, fall back to env-var based config (backward compat)
  if (!config) {
    logger.debug('[ai-provider-registry] No DB config for provider, using env-var fallback', { provider: name });
  }

  if (config && !config.enabled) {
    throw new Error(`AI provider ${providerName} is currently disabled`);
  }

  return handler(messages, options, config);
}

/**
 * Get the API key for a provider from environment variables.
 * Uses the env_key_name from DB config, or falls back to convention.
 *
 * @param {string} providerName
 * @param {Object} [dbConfig] - Optional pre-loaded DB config
 * @returns {string} API key or empty string
 */
function getApiKeyForProvider(providerName, dbConfig = null) {
  const name = providerName.toLowerCase();

  // If DB config specifies the env var name, use it
  if (dbConfig && dbConfig.env_key_name) {
    return process.env[dbConfig.env_key_name] || '';
  }

  // Convention-based fallback
  const envKeyMap = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    mistral: 'MISTRAL_API_KEY',
    gemini: 'GEMINI_API_KEY'
  };

  return process.env[envKeyMap[name]] || '';
}

/**
 * Check if a model is valid for a provider using DB config.
 * Falls back to the hardcoded allowlist if no DB config.
 *
 * @param {string} providerName
 * @param {string} model
 * @param {Object} [dbConfig] - Optional pre-loaded DB config
 * @returns {boolean}
 */
function isValidModel(providerName, model, dbConfig = null) {
  if (!model || typeof model !== 'string') return false;

  if (dbConfig && dbConfig.valid_models && dbConfig.valid_models.length > 0) {
    return dbConfig.valid_models.includes(model);
  }

  // Hardcoded fallback (from original controllers/api/ai.js)
  const FALLBACK_VALID_MODELS = {
    openai: [
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-turbo-preview', 'gpt-4',
      'gpt-3.5-turbo', 'gpt-3.5-turbo-16k', 'o1-preview', 'o1-mini'
    ],
    anthropic: [
      'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307',
      'claude-3-5-sonnet-20240620', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
      'claude-sonnet-4-20250514', 'claude-opus-4-5-20251101'
    ],
    mistral: [
      'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest',
      'open-mistral-7b', 'open-mixtral-8x7b', 'open-mixtral-8x22b',
      'codestral-latest', 'mistral-embed'
    ],
    gemini: [
      'gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-1.5-flash', 'gemini-1.5-flash-latest',
      'gemini-1.0-pro', 'gemini-1.0-pro-latest', 'gemini-pro', 'gemini-pro-vision',
      'gemini-2.0-flash-exp', 'gemini-exp-1206'
    ]
  };

  const allowlist = FALLBACK_VALID_MODELS[providerName.toLowerCase()];
  return allowlist ? allowlist.includes(model) : false;
}

// ---------------------------------------------------------------------------
// Built-in provider handlers
// ---------------------------------------------------------------------------

/**
 * OpenAI handler
 */
registerProvider('openai', async (messages, options = {}, dbConfig = null) => {
  const apiKey = getApiKeyForProvider('openai', dbConfig);
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const endpoint = (dbConfig && dbConfig.endpoint) || 'https://api.openai.com/v1/chat/completions';
  const defaultModel = (dbConfig && dbConfig.default_model) || 'gpt-4o-mini';
  const requestedModel = options.model || defaultModel;
  const model = isValidModel('openai', requestedModel, dbConfig) ? requestedModel : defaultModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;
  // Newer OpenAI models (o-series: o1/o3/o4, and gpt-5+) use max_completion_tokens instead of max_tokens.
  // o-series models also do not support the temperature parameter.
  const isOSeries = /^o\d/.test(model);
  const isNewGenGPT = /^gpt-[5-9]/.test(model);
  const isNewModel = isOSeries || isNewGenGPT;
  const tokenLimitKey = isNewModel ? 'max_completion_tokens' : 'max_tokens';

  const requestBody = {
    model,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    [tokenLimitKey]: maxTokens,
    stream: false
  };
  // o-series models do not support temperature (gpt-5+ still does)
  if (!isOSeries) requestBody.temperature = temperature;
  // Enable JSON object mode for tasks that always return JSON (BienBot chat/analyze).
  // Requires the system or user prompt to mention "JSON" — which BienBot's prompts do.
  // Skipped for o-series models and o1/o1-mini which do not support response_format.
  const isJsonTask = options.jsonMode === true || (typeof options.task === 'string' && options.task.startsWith('bienbot'));
  if (isJsonTask && !isOSeries) {
    requestBody.response_format = { type: 'json_object' };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    logger.error('[ai-provider-registry] OpenAI API error', { status: response.status, message: error.error?.message });
    throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    },
    model: data.model,
    provider: 'openai'
  };
});

/**
 * Anthropic handler
 */
registerProvider('anthropic', async (messages, options = {}, dbConfig = null) => {
  const apiKey = getApiKeyForProvider('anthropic', dbConfig);
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const endpoint = (dbConfig && dbConfig.endpoint) || 'https://api.anthropic.com/v1/messages';
  const apiVersion = (dbConfig && dbConfig.api_version) || '2023-06-01';
  const defaultModel = (dbConfig && dbConfig.default_model) || 'claude-3-haiku-20240307';
  const requestedModel = options.model || defaultModel;
  const model = isValidModel('anthropic', requestedModel, dbConfig) ? requestedModel : defaultModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;

  let systemMessage = '';
  const userMessages = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessage = msg.content;
    } else {
      userMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
    }
  }

  const requestBody = {
    model,
    system: systemMessage || undefined,
    messages: userMessages,
    max_tokens: maxTokens,
    temperature
  };

  // Structured output via Anthropic tool-use: force the model to emit a single
  // tool call whose input matches the requested JSON schema.
  if (options.schema) {
    requestBody.tools = [{
      name: options.schema.name,
      description: options.schema.description || '',
      input_schema: options.schema.json_schema
    }];
    requestBody.tool_choice = { type: 'tool', name: options.schema.name };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': apiVersion
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    logger.error('[ai-provider-registry] Anthropic API error', { status: response.status, message: error.error?.message });
    throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();

  if (options.schema) {
    const toolUse = Array.isArray(data.content)
      ? data.content.find(c => c && c.type === 'tool_use' && c.name === options.schema.name)
      : null;
    if (!toolUse) {
      throw new Error(`Anthropic schema response missing tool_use for ${options.schema.name}`);
    }
    return {
      content: toolUse.input,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      },
      model: data.model,
      provider: 'anthropic'
    };
  }

  return {
    content: data.content[0]?.text || '',
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    },
    model: data.model,
    provider: 'anthropic'
  };
});

/**
 * Mistral handler
 */
registerProvider('mistral', async (messages, options = {}, dbConfig = null) => {
  const apiKey = getApiKeyForProvider('mistral', dbConfig);
  if (!apiKey) throw new Error('Mistral API key not configured');

  const endpoint = (dbConfig && dbConfig.endpoint) || 'https://api.mistral.ai/v1/chat/completions';
  const defaultModel = (dbConfig && dbConfig.default_model) || 'mistral-small-latest';
  const requestedModel = options.model || defaultModel;
  const model = isValidModel('mistral', requestedModel, dbConfig) ? requestedModel : defaultModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    logger.error('[ai-provider-registry] Mistral API error', { status: response.status, message: error.error?.message });
    throw new Error(error.error?.message || `Mistral API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    usage: {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0
    },
    model: data.model,
    provider: 'mistral'
  };
});

/**
 * Gemini handler — uses @google/generative-ai SDK.
 * API key is passed via the SDK constructor (never in a URL query string).
 */
registerProvider('gemini', async (messages, options = {}, dbConfig = null) => {
  const apiKey = getApiKeyForProvider('gemini', dbConfig);
  if (!apiKey) throw new Error('Gemini API key not configured');

  const { GoogleGenerativeAI } = require('@google/generative-ai');

  const defaultModel = (dbConfig && dbConfig.default_model) || 'gemini-1.5-flash';
  const requestedModel = options.model || defaultModel;
  const model = isValidModel('gemini', requestedModel, dbConfig) ? requestedModel : defaultModel;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;

  let systemInstruction = '';
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction = msg.content;
    } else {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({
      model,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: { temperature, maxOutputTokens: maxTokens }
    });

    const result = await genModel.generateContent({ contents });
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata || {};

    return {
      content: text || '',
      usage: {
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0
      },
      model,
      provider: 'gemini'
    };
  } catch (err) {
    logger.error('[ai-provider-registry] Gemini SDK error', { status: err.status || 'unknown', message: err.message });
    throw new Error(err.message || `Gemini API error`);
  }
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  registerProvider,
  getProviderHandler,
  callProvider,
  getProviderConfig,
  getAllProviderConfigs,
  invalidateConfigCache,
  getApiKeyForProvider,
  isValidModel
};
