/**
 * Google Gemini API Adapter
 *
 * @module ai/adapters/gemini
 */

import { logger } from '../../logger';
import { AI_PROVIDERS, DEFAULT_MODELS, PROVIDER_ENDPOINTS } from '../constants';
import { getApiKey } from '../config';

/**
 * Google Gemini API adapter
 */
const geminiAdapter = {
  name: AI_PROVIDERS.GEMINI,

  async complete(messages, options = {}) {
    const apiKey = getApiKey(AI_PROVIDERS.GEMINI);
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = options.model || DEFAULT_MODELS[AI_PROVIDERS.GEMINI];
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens || 1000;

    // Convert messages to Gemini format
    const contents = [];
    let systemInstruction = '';

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

    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    };

    // Add system instruction if provided
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      logger.error('Gemini API error', { status: response.status, error });
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    return {
      content: candidate?.content?.parts?.[0]?.text || '',
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model,
      provider: AI_PROVIDERS.GEMINI
    };
  }
};

export default geminiAdapter;
