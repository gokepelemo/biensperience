/**
 * AI API Client
 *
 * Frontend client for the secure AI backend proxy.
 * All AI operations go through the backend - no API keys in the frontend.
 *
 * @module utilities/ai-api
 */

import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/ai';

/**
 * Check AI service availability
 *
 * @returns {Promise<Object>} Service status
 */
export async function getAIStatus() {
  try {
    const result = await sendRequest(`${BASE_URL}/status`, 'GET');
    return result;
  } catch (error) {
    logger.error('[ai-api] Failed to get AI status', { error: error.message });
    throw error;
  }
}

/**
 * General AI completion
 *
 * @param {Array<Object>} messages - Chat messages
 * @param {Object} options - Options
 * @param {string} options.task - Task type for provider routing
 * @param {string} options.provider - Provider override
 * @param {string} options.model - Model override
 * @param {number} options.temperature - Temperature (0-1)
 * @param {number} options.maxTokens - Max tokens
 * @returns {Promise<Object>} Completion result
 */
export async function aiComplete(messages, options = {}) {
  try {
    logger.debug('[ai-api] Completion request', { messageCount: messages.length, task: options.task });

    const result = await sendRequest(`${BASE_URL}/complete`, 'POST', {
      messages,
      task: options.task,
      options: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens
      }
    });

    if (!result.success) {
      throw new Error(result.error || 'AI completion failed');
    }

    return result.data;
  } catch (error) {
    logger.error('[ai-api] Completion error', { error: error.message });
    throw error;
  }
}

/**
 * Text autocomplete
 *
 * @param {string} text - Text to autocomplete
 * @param {Object} options - Options
 * @param {string} options.context - Additional context
 * @returns {Promise<Object>} Autocomplete result with completion
 */
export async function aiAutocomplete(text, options = {}) {
  try {
    logger.debug('[ai-api] Autocomplete request', { textLength: text.length });

    const result = await sendRequest(`${BASE_URL}/autocomplete`, 'POST', {
      text,
      context: options.context,
      options
    });

    if (!result.success) {
      throw new Error(result.error || 'Autocomplete failed');
    }

    return result.data;
  } catch (error) {
    logger.error('[ai-api] Autocomplete error', { error: error.message });
    throw error;
  }
}

/**
 * Improve text description
 *
 * @param {string} text - Text to improve
 * @param {Object} options - Options
 * @param {string} options.type - Content type (experience, destination, plan, general)
 * @returns {Promise<Object>} Result with improved text
 */
export async function aiImprove(text, options = {}) {
  try {
    logger.debug('[ai-api] Improve request', { type: options.type });

    const result = await sendRequest(`${BASE_URL}/improve`, 'POST', {
      text,
      type: options.type || 'general',
      options
    });

    if (!result.success) {
      throw new Error(result.error || 'Text improvement failed');
    }

    return result.data;
  } catch (error) {
    logger.error('[ai-api] Improve error', { error: error.message });
    throw error;
  }
}

/**
 * Translate text
 *
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language
 * @param {Object} options - Options
 * @param {string} options.sourceLanguage - Source language (default: auto-detect)
 * @returns {Promise<Object>} Result with translation
 */
export async function aiTranslate(text, targetLanguage, options = {}) {
  try {
    logger.debug('[ai-api] Translate request', { targetLanguage });

    const result = await sendRequest(`${BASE_URL}/translate`, 'POST', {
      text,
      targetLanguage,
      sourceLanguage: options.sourceLanguage || 'auto',
      options
    });

    if (!result.success) {
      throw new Error(result.error || 'Translation failed');
    }

    return result.data;
  } catch (error) {
    logger.error('[ai-api] Translate error', { error: error.message });
    throw error;
  }
}

/**
 * Summarize text
 *
 * @param {string} text - Text to summarize
 * @param {Object} options - Options
 * @param {number} options.maxLength - Maximum summary length in words
 * @returns {Promise<Object>} Result with summary
 */
export async function aiSummarize(text, options = {}) {
  try {
    logger.debug('[ai-api] Summarize request', { textLength: text.length });

    const result = await sendRequest(`${BASE_URL}/summarize`, 'POST', {
      text,
      maxLength: options.maxLength || 200,
      options
    });

    if (!result.success) {
      throw new Error(result.error || 'Summarization failed');
    }

    return result.data;
  } catch (error) {
    logger.error('[ai-api] Summarize error', { error: error.message });
    throw error;
  }
}

/**
 * Generate travel tips
 *
 * @param {string} destination - Destination name
 * @param {Object} options - Options
 * @param {string} options.category - Tip category (general, food, safety, transport, culture)
 * @param {number} options.count - Number of tips to generate
 * @returns {Promise<Object>} Result with tips
 */
export async function aiGenerateTips(destination, options = {}) {
  try {
    logger.debug('[ai-api] Generate tips request', { destination, category: options.category });

    const result = await sendRequest(`${BASE_URL}/generate-tips`, 'POST', {
      destination,
      category: options.category || 'general',
      count: options.count || 5,
      options
    });

    if (!result.success) {
      throw new Error(result.error || 'Tip generation failed');
    }

    return result.data;
  } catch (error) {
    logger.error('[ai-api] Generate tips error', { error: error.message });
    throw error;
  }
}

/**
 * Check if AI features are available for the current user
 * This is a convenience function that checks both service availability
 * and user feature flag in one call.
 *
 * @returns {Promise<boolean>} Whether AI features are available
 */
export async function isAIAvailable() {
  try {
    const status = await getAIStatus();
    return status.success && status.data?.available;
  } catch (error) {
    // If we get a 403, the user doesn't have the feature flag
    if (error.message?.includes('403') || error.message?.includes('Feature not available')) {
      return false;
    }
    // For other errors, service might be unavailable
    logger.warn('[ai-api] AI availability check failed', { error: error.message });
    return false;
  }
}

// Export all functions
export default {
  getAIStatus,
  aiComplete,
  aiAutocomplete,
  aiImprove,
  aiTranslate,
  aiSummarize,
  aiGenerateTips,
  isAIAvailable
};
