/**
 * AI Controller
 *
 * Secure backend proxy for AI provider APIs.
 * All AI API keys are stored server-side only.
 * Requires 'ai_features' feature flag.
 *
 * @module controllers/api/ai
 */

const logger = require('../../utilities/backend-logger');
const { hasFeatureFlag, getFeatureFlagConfig } = require('../../utilities/feature-flags');
const { lang } = require('../../utilities/lang.constants');

// AI Provider configuration (server-side only)
const AI_PROVIDERS = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  MISTRAL: 'mistral',
  GEMINI: 'gemini'
};

const PROVIDER_ENDPOINTS = {
  [AI_PROVIDERS.OPENAI]: 'https://api.openai.com/v1/chat/completions',
  [AI_PROVIDERS.ANTHROPIC]: 'https://api.anthropic.com/v1/messages',
  [AI_PROVIDERS.MISTRAL]: 'https://api.mistral.ai/v1/chat/completions',
  [AI_PROVIDERS.GEMINI]: 'https://generativelanguage.googleapis.com/v1beta/models'
};

const DEFAULT_MODELS = {
  [AI_PROVIDERS.OPENAI]: 'gpt-4o-mini',
  [AI_PROVIDERS.ANTHROPIC]: 'claude-3-haiku-20240307',
  [AI_PROVIDERS.MISTRAL]: 'mistral-small-latest',
  [AI_PROVIDERS.GEMINI]: 'gemini-1.5-flash'
};

// Task types for routing
const AI_TASKS = {
  AUTOCOMPLETE: 'autocomplete',
  EDIT_LANGUAGE: 'edit_language',
  IMPROVE_DESCRIPTION: 'improve_description',
  SUMMARIZE: 'summarize',
  GENERATE_TIPS: 'generate_tips',
  TRANSLATE: 'translate',
  GENERAL: 'general'
};

/**
 * Get AI configuration from environment
 */
function getAIConfig() {
  return {
    defaultProvider: process.env.AI_DEFAULT_PROVIDER || AI_PROVIDERS.OPENAI,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    mistralApiKey: process.env.MISTRAL_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    taskRouting: {
      [AI_TASKS.AUTOCOMPLETE]: process.env.AI_AUTOCOMPLETE_PROVIDER || null,
      [AI_TASKS.EDIT_LANGUAGE]: process.env.AI_EDIT_PROVIDER || null,
      [AI_TASKS.IMPROVE_DESCRIPTION]: process.env.AI_IMPROVE_PROVIDER || null,
      [AI_TASKS.SUMMARIZE]: process.env.AI_SUMMARIZE_PROVIDER || null,
      [AI_TASKS.GENERATE_TIPS]: process.env.AI_TIPS_PROVIDER || null,
      [AI_TASKS.TRANSLATE]: process.env.AI_TRANSLATE_PROVIDER || null
    }
  };
}

/**
 * Get API key for a provider
 */
function getApiKey(provider) {
  const config = getAIConfig();
  switch (provider) {
    case AI_PROVIDERS.OPENAI:
      return config.openaiApiKey;
    case AI_PROVIDERS.ANTHROPIC:
      return config.anthropicApiKey;
    case AI_PROVIDERS.MISTRAL:
      return config.mistralApiKey;
    case AI_PROVIDERS.GEMINI:
      return config.geminiApiKey;
    default:
      return '';
  }
}

/**
 * Get provider for a task
 */
function getProviderForTask(task) {
  const config = getAIConfig();
  const taskProvider = config.taskRouting[task];
  if (taskProvider && Object.values(AI_PROVIDERS).includes(taskProvider)) {
    return taskProvider;
  }
  return config.defaultProvider;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages, options = {}) {
  const apiKey = getApiKey(AI_PROVIDERS.OPENAI);
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const model = options.model || DEFAULT_MODELS[AI_PROVIDERS.OPENAI];
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;

  const response = await fetch(PROVIDER_ENDPOINTS[AI_PROVIDERS.OPENAI], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    logger.error('OpenAI API error', { status: response.status, error });
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
    provider: AI_PROVIDERS.OPENAI
  };
}

/**
 * Call Anthropic API
 */
async function callAnthropic(messages, options = {}) {
  const apiKey = getApiKey(AI_PROVIDERS.ANTHROPIC);
  if (!apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const model = options.model || DEFAULT_MODELS[AI_PROVIDERS.ANTHROPIC];
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;

  // Convert messages to Anthropic format
  let systemMessage = '';
  const userMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemMessage = msg.content;
    } else {
      userMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    }
  }

  const response = await fetch(PROVIDER_ENDPOINTS[AI_PROVIDERS.ANTHROPIC], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      system: systemMessage || undefined,
      messages: userMessages,
      max_tokens: maxTokens,
      temperature
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    logger.error('Anthropic API error', { status: response.status, error });
    throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.content[0]?.text || '',
    usage: {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    },
    model: data.model,
    provider: AI_PROVIDERS.ANTHROPIC
  };
}

/**
 * Call Mistral API
 */
async function callMistral(messages, options = {}) {
  const apiKey = getApiKey(AI_PROVIDERS.MISTRAL);
  if (!apiKey) {
    throw new Error('Mistral API key not configured');
  }

  const model = options.model || DEFAULT_MODELS[AI_PROVIDERS.MISTRAL];
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;

  const response = await fetch(PROVIDER_ENDPOINTS[AI_PROVIDERS.MISTRAL], {
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
    logger.error('Mistral API error', { status: response.status, error });
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
    provider: AI_PROVIDERS.MISTRAL
  };
}

/**
 * Call Gemini API
 */
async function callGemini(messages, options = {}) {
  const apiKey = getApiKey(AI_PROVIDERS.GEMINI);
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const model = options.model || DEFAULT_MODELS[AI_PROVIDERS.GEMINI];
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 1000;

  // Convert messages to Gemini format
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

  const endpoint = `${PROVIDER_ENDPOINTS[AI_PROVIDERS.GEMINI]}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    logger.error('Gemini API error', { status: response.status, error });
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0
    },
    model,
    provider: AI_PROVIDERS.GEMINI
  };
}

/**
 * Call AI provider based on provider name
 */
async function callProvider(provider, messages, options = {}) {
  switch (provider) {
    case AI_PROVIDERS.OPENAI:
      return callOpenAI(messages, options);
    case AI_PROVIDERS.ANTHROPIC:
      return callAnthropic(messages, options);
    case AI_PROVIDERS.MISTRAL:
      return callMistral(messages, options);
    case AI_PROVIDERS.GEMINI:
      return callGemini(messages, options);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
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

    // Get provider for task
    const provider = options.provider || getProviderForTask(task);

    // Check if provider is configured
    if (!getApiKey(provider)) {
      logger.warn('AI provider not configured', { provider, task, userId: req.user._id });
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    logger.info('AI completion request', {
      userId: req.user._id,
      task,
      provider,
      messageCount: messages.length
    });

    const result = await callProvider(provider, messages, options);

    logger.debug('AI completion success', {
      userId: req.user._id,
      provider,
      tokens: result.usage.totalTokens
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('AI completion error', { error: error.message, userId: req.user._id });
    return res.status(500).json({
      success: false,
      error: error.message || 'AI completion failed'
    });
  }
};

/**
 * POST /api/ai/autocomplete
 * Text autocomplete endpoint
 *
 * Accepts optional prompt override via options.prompts.autocomplete
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

    const provider = getProviderForTask(AI_TASKS.AUTOCOMPLETE);

    if (!getApiKey(provider)) {
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // Allow prompt override via options.prompts.autocomplete
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

    const result = await callProvider(provider, messages, {
      temperature: 0.7,
      maxTokens: 150,
      ...options
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
    logger.error('AI autocomplete error', { error: error.message, userId: req.user._id });
    return res.status(500).json({
      success: false,
      error: error.message || 'Autocomplete failed'
    });
  }
};

/**
 * POST /api/ai/improve
 * Improve text description endpoint
 *
 * Accepts optional prompt override via options.prompts.improve or options.prompts.improveDescription
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

    const provider = getProviderForTask(AI_TASKS.IMPROVE_DESCRIPTION);

    if (!getApiKey(provider)) {
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // Allow prompt override via options.prompts
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

    const result = await callProvider(provider, messages, {
      temperature: 0.7,
      maxTokens: 500,
      ...options
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
    logger.error('AI improve error', { error: error.message, userId: req.user._id });
    return res.status(500).json({
      success: false,
      error: error.message || 'Text improvement failed'
    });
  }
};

/**
 * POST /api/ai/translate
 * Translation endpoint
 *
 * Accepts optional prompt override via options.prompts.translate
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

    const provider = getProviderForTask(AI_TASKS.TRANSLATE);

    if (!getApiKey(provider)) {
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // Allow prompt override via options.prompts.translate
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

    const result = await callProvider(provider, messages, {
      temperature: 0.3,
      maxTokens: 1000,
      ...options
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
    logger.error('AI translate error', { error: error.message, userId: req.user._id });
    return res.status(500).json({
      success: false,
      error: error.message || 'Translation failed'
    });
  }
};

/**
 * POST /api/ai/summarize
 * Summarization endpoint
 *
 * Accepts optional prompt override via options.prompts.summarize
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

    const provider = getProviderForTask(AI_TASKS.SUMMARIZE);

    if (!getApiKey(provider)) {
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // Allow prompt override via options.prompts.summarize
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

    const result = await callProvider(provider, messages, {
      temperature: 0.5,
      maxTokens: Math.min(maxLength * 2, 500),
      ...options
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
    logger.error('AI summarize error', { error: error.message, userId: req.user._id });
    return res.status(500).json({
      success: false,
      error: error.message || 'Summarization failed'
    });
  }
};

/**
 * POST /api/ai/generate-tips
 * Generate travel tips endpoint
 *
 * Accepts optional prompt override via options.prompts.generateTips or options.prompts.generate_tips
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

    const provider = getProviderForTask(AI_TASKS.GENERATE_TIPS);

    if (!getApiKey(provider)) {
      return res.status(503).json({
        success: false,
        error: 'AI service not available',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // Allow prompt override via options.prompts
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

    const result = await callProvider(provider, messages, {
      temperature: 0.8,
      maxTokens: 800,
      ...options
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
    logger.error('AI generate-tips error', { error: error.message, userId: req.user._id });
    return res.status(500).json({
      success: false,
      error: error.message || 'Tip generation failed'
    });
  }
};

/**
 * GET /api/ai/status
 * Check AI service availability
 */
exports.status = async (req, res) => {
  const config = getAIConfig();

  const providers = {
    openai: !!config.openaiApiKey,
    anthropic: !!config.anthropicApiKey,
    mistral: !!config.mistralApiKey,
    gemini: !!config.geminiApiKey
  };

  const available = Object.values(providers).some(v => v);

  return res.json({
    success: true,
    data: {
      available,
      defaultProvider: config.defaultProvider,
      providers,
      taskRouting: config.taskRouting
    }
  });
};

// Export constants for use in routes
exports.AI_PROVIDERS = AI_PROVIDERS;
exports.AI_TASKS = AI_TASKS;
