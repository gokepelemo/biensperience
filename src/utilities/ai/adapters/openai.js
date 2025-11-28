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

    const response = await fetch(PROVIDER_ENDPOINTS[AI_PROVIDERS.OPENAI], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
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
};

export default openaiAdapter;
