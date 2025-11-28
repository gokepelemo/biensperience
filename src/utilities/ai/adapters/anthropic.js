/**
 * Anthropic Claude API Adapter
 *
 * @module ai/adapters/anthropic
 */

import { logger } from '../../logger';
import { AI_PROVIDERS, DEFAULT_MODELS, PROVIDER_ENDPOINTS } from '../constants';
import { getApiKey } from '../config';

/**
 * Anthropic Claude API adapter
 */
const anthropicAdapter = {
  name: AI_PROVIDERS.ANTHROPIC,

  async complete(messages, options = {}) {
    const apiKey = getApiKey(AI_PROVIDERS.ANTHROPIC);
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const model = options.model || DEFAULT_MODELS[AI_PROVIDERS.ANTHROPIC];
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 1000;

    // Convert messages to Anthropic format
    // Anthropic requires system message to be separate
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
};

export default anthropicAdapter;
