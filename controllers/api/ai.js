/**
 * AI Controller
 *
 * Secure backend proxy for AI provider APIs.
 * Routes all AI requests through the gateway for policy enforcement,
 * rate limiting, token budgets, and usage tracking.
 *
 * All AI API keys are stored server-side only.
 * Requires 'ai_features' feature flag.
 *
 * @module controllers/api/ai
 */

const logger = require('../../utilities/backend-logger');
const { lang } = require('../../utilities/lang.constants');
const { executeAIRequest, GatewayError } = require('../../utilities/ai-gateway');
const { getApiKeyForProvider } = require('../../utilities/ai-provider-registry');

// ---------------------------------------------------------------------------
// Constants (exported for backward compatibility)
// ---------------------------------------------------------------------------

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
  GENERAL: 'general'
};

const DEFAULT_MODELS = {
  [AI_PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [AI_PROVIDERS.ANTHROPIC]: 'claude-3-haiku-20240307',
  [AI_PROVIDERS.MISTRAL]: 'mistral-small-latest',
  [AI_PROVIDERS.GEMINI]: 'gemini-1.5-flash'
};

// ---------------------------------------------------------------------------
// Backward-compatible helpers (used by bienbot controller and others)
// ---------------------------------------------------------------------------

/**
 * Get API key for a provider (backward-compatible wrapper).
 * @param {string} provider
 * @returns {string}
 */
function getApiKey(provider) {
  return getApiKeyForProvider(provider);
}

/**
 * Get provider for a task from env vars (backward-compatible wrapper).
 * @param {string} task
 * @returns {string}
 */
function getProviderForTask(task) {
  const envMap = {
    [AI_TASKS.AUTOCOMPLETE]: 'AI_AUTOCOMPLETE_PROVIDER',
    [AI_TASKS.EDIT_LANGUAGE]: 'AI_EDIT_PROVIDER',
    [AI_TASKS.IMPROVE_DESCRIPTION]: 'AI_IMPROVE_PROVIDER',
    [AI_TASKS.SUMMARIZE]: 'AI_SUMMARIZE_PROVIDER',
    [AI_TASKS.GENERATE_TIPS]: 'AI_TIPS_PROVIDER',
    [AI_TASKS.TRANSLATE]: 'AI_TRANSLATE_PROVIDER'
  };

  const envKey = envMap[task];
  const taskProvider = envKey ? process.env[envKey] : null;
  if (taskProvider && Object.values(AI_PROVIDERS).includes(taskProvider)) {
    return taskProvider;
  }
  return process.env.AI_DEFAULT_PROVIDER || AI_PROVIDERS.OPENAI;
}

/**
 * Call AI provider through the gateway (backward-compatible wrapper).
 *
 * Used by bienbot controller. Pass _user in options for policy enforcement.
 *
 * @param {string} provider - Provider name
 * @param {Array} messages - Chat messages
 * @param {Object} options - { model, temperature, maxTokens, _user, task, intent }
 * @returns {Promise<{content, usage, model, provider}>}
 */
async function callProvider(provider, messages, options = {}) {
  const result = await executeAIRequest({
    messages,
    task: options.task || AI_TASKS.GENERAL,
    user: options._user || null,
    intent: options.intent || null,
    options: {
      provider,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    },
    entityContext: options.entityContext || null
  });

  // Return in the legacy format (without policyApplied)
  return {
    content: result.content,
    usage: result.usage,
    model: result.model,
    provider: result.provider
  };
}

// ---------------------------------------------------------------------------
// Helper: handle gateway errors
// ---------------------------------------------------------------------------

function handleGatewayError(error, res, userId) {
  if (error instanceof GatewayError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }

  logger.error('AI request error', { error: error.message, userId });
  return res.status(500).json({
    success: false,
    error: error.message || 'AI request failed'
  });
}

// ============================================================================
// Controller Methods
// ============================================================================

/**
 * POST /api/ai/complete
 * General completion endpoint
 */
exports.complete = async (req, res) => {
  try {
    const { messages, task = AI_TASKS.GENERAL, options = {} } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }

    logger.info('AI completion request', {
      userId: req.user._id,
      task,
      messageCount: messages.length
    });

    const result = await executeAIRequest({
      messages,
      task,
      user: req.user,
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      },
      entityContext: req.body.entityContext || null
    });

    logger.debug('AI completion success', {
      userId: req.user._id,
      provider: result.provider,
      tokens: result.usage.totalTokens
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return handleGatewayError(error, res, req.user._id);
  }
};

/**
 * POST /api/ai/autocomplete
 * Text autocomplete endpoint
 */
exports.autocomplete = async (req, res) => {
  try {
    const { text, context = '', options = {} } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const systemPrompt = options.prompts?.autocomplete ||
      lang.current.prompts?.autocomplete ||
      'You are a helpful writing assistant. Complete the given text naturally and concisely. Only provide the completion, not the original text.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context ? `Context: ${context}\n\nComplete this text: ${text}` : `Complete this text: ${text}` }
    ];

    logger.info('AI autocomplete request', {
      userId: req.user._id,
      textLength: text.length,
      customPrompt: !!options.prompts?.autocomplete
    });

    const result = await executeAIRequest({
      messages,
      task: AI_TASKS.AUTOCOMPLETE,
      user: req.user,
      options: {
        provider: options.provider,
        model: options.model,
        temperature: 0.7,
        maxTokens: 150
      }
    });

    return res.json({
      success: true,
      data: {
        completion: result.content,
        provider: result.provider,
        usage: result.usage
      }
    });
  } catch (error) {
    return handleGatewayError(error, res, req.user._id);
  }
};

/**
 * POST /api/ai/improve
 * Improve text description endpoint
 */
exports.improve = async (req, res) => {
  try {
    const { text, type = 'general', options = {} } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const systemPrompt = options.prompts?.improve ||
      options.prompts?.improveDescription ||
      lang.current.prompts?.improve_description ||
      lang.current.prompts?.improveDescription ||
      'You are a professional editor. Improve the given text to be more engaging, clear, and well-written. Maintain the original meaning and tone. Return only the improved text.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Improve this ${type} description:\n\n${text}` }
    ];

    logger.info('AI improve request', {
      userId: req.user._id,
      type,
      customPrompt: !!(options.prompts?.improve || options.prompts?.improveDescription)
    });

    const result = await executeAIRequest({
      messages,
      task: AI_TASKS.IMPROVE_DESCRIPTION,
      user: req.user,
      options: { temperature: 0.7, maxTokens: 500 }
    });

    return res.json({
      success: true,
      data: {
        improved: result.content,
        provider: result.provider,
        usage: result.usage
      }
    });
  } catch (error) {
    return handleGatewayError(error, res, req.user._id);
  }
};

/**
 * POST /api/ai/translate
 * Translation endpoint
 */
exports.translate = async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage = 'auto', options = {} } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({
        success: false,
        error: 'Text and target language are required'
      });
    }

    const systemPrompt = options.prompts?.translate ||
      lang.current.prompts?.translate ||
      'You are a professional translator. Translate the given text accurately while preserving meaning, tone, and style. Return only the translation.';

    const sourceInfo = sourceLanguage === 'auto' ? '' : `from ${sourceLanguage} `;
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Translate ${sourceInfo}to ${targetLanguage}:\n\n${text}` }
    ];

    logger.info('AI translate request', {
      userId: req.user._id,
      targetLanguage,
      customPrompt: !!options.prompts?.translate
    });

    const result = await executeAIRequest({
      messages,
      task: AI_TASKS.TRANSLATE,
      user: req.user,
      options: { temperature: 0.3, maxTokens: 1000 }
    });

    return res.json({
      success: true,
      data: {
        translation: result.content,
        targetLanguage,
        provider: result.provider,
        usage: result.usage
      }
    });
  } catch (error) {
    return handleGatewayError(error, res, req.user._id);
  }
};

/**
 * POST /api/ai/summarize
 * Summarization endpoint
 */
exports.summarize = async (req, res) => {
  try {
    const { text, maxLength = 200, options = {} } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Text is required'
      });
    }

    const systemPrompt = options.prompts?.summarize ||
      lang.current.prompts?.summarize ||
      'You are a skilled summarizer. Create a concise summary of the given text that captures the key points. Be clear and informative.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Summarize the following in about ${maxLength} words or less:\n\n${text}` }
    ];

    logger.info('AI summarize request', {
      userId: req.user._id,
      textLength: text.length,
      customPrompt: !!options.prompts?.summarize
    });

    const result = await executeAIRequest({
      messages,
      task: AI_TASKS.SUMMARIZE,
      user: req.user,
      options: { temperature: 0.5, maxTokens: Math.min(maxLength * 2, 500) }
    });

    return res.json({
      success: true,
      data: {
        summary: result.content,
        provider: result.provider,
        usage: result.usage
      }
    });
  } catch (error) {
    return handleGatewayError(error, res, req.user._id);
  }
};

/**
 * POST /api/ai/generate-tips
 * Generate travel tips endpoint
 */
exports.generateTips = async (req, res) => {
  try {
    const { destination, category = 'general', count = 5, options = {} } = req.body;

    if (!destination) {
      return res.status(400).json({
        success: false,
        error: 'Destination is required'
      });
    }

    const systemPrompt = options.prompts?.generateTips ||
      options.prompts?.generate_tips ||
      lang.current.prompts?.generate_tips ||
      lang.current.prompts?.generateTips ||
      'You are a knowledgeable travel expert. Generate practical, specific travel tips for the given destination. Format as a numbered list.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate ${count} ${category} travel tips for ${destination}. Be specific and practical.` }
    ];

    logger.info('AI generate-tips request', {
      userId: req.user._id,
      destination,
      category,
      customPrompt: !!(options.prompts?.generateTips || options.prompts?.generate_tips)
    });

    const result = await executeAIRequest({
      messages,
      task: AI_TASKS.GENERATE_TIPS,
      user: req.user,
      options: { temperature: 0.8, maxTokens: 800 }
    });

    return res.json({
      success: true,
      data: {
        tips: result.content,
        destination,
        category,
        provider: result.provider,
        usage: result.usage
      }
    });
  } catch (error) {
    return handleGatewayError(error, res, req.user._id);
  }
};

/**
 * GET /api/ai/status
 * Check AI service availability
 */
exports.status = async (req, res) => {
  const providers = {
    openai: !!getApiKeyForProvider('openai'),
    anthropic: !!getApiKeyForProvider('anthropic'),
    mistral: !!getApiKeyForProvider('mistral'),
    gemini: !!getApiKeyForProvider('gemini')
  };

  const available = Object.values(providers).some(v => v);

  return res.json({
    success: true,
    data: {
      available,
      defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'openai',
      providers
    }
  });
};

// Export constants and helpers for backward compatibility
exports.AI_PROVIDERS = AI_PROVIDERS;
exports.AI_TASKS = AI_TASKS;
exports.DEFAULT_MODELS = DEFAULT_MODELS;
exports.callProvider = callProvider;
exports.getApiKey = getApiKey;
exports.getProviderForTask = getProviderForTask;
