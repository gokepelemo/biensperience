/**
 * OpenAI API Adapter
 *
 * @module ai/adapters/openai
 */

import { logger } from '../../logger';
import { AI_PROVIDERS, DEFAULT_MODELS, PROVIDER_ENDPOINTS } from '../constants';
import { getApiKey } from '../config';

/**
 * OpenAI API adapter
 */
const openaiAdapter = {
  name: AI_PROVIDERS.OPENAI,

  async complete(messages, options = {}) {
    const apiKey = getApiKey(AI_PROVIDERS.OPENAI);
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const model = options.model || DEFAULT_MODELS[AI_PROVIDERS.OPENAI];
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
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      [tokenLimitKey]: maxTokens,
      stream: false
    };
    // o-series models do not support temperature (gpt-5+ still does)
    if (!isOSeries) requestBody.temperature = temperature;

    const response = await fetch(PROVIDER_ENDPOINTS[AI_PROVIDERS.OPENAI], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
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
};

export default openaiAdapter;
