/**
 * useAI React Hook
 *
 * Provides AI functions with event-bus integration for React components.
 * Tracks loading states, handles errors, and synchronizes via event bus.
 *
 * @module ai/useAI
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '../logger';
import { complete } from './complete';
import { AI_TASKS } from './constants';
import {
  autocomplete as aiAutocomplete,
  editLanguage as aiEditLanguage,
  improveDescription as aiImproveDescription,
  summarize as aiSummarize,
  generateTravelTips as aiGenerateTravelTips,
  translate as aiTranslate
} from './functions';
import {
  isAIAvailable,
  getConfiguredProviders,
  getDefaultProvider
} from './utils';
import {
  AI_EVENTS,
  createTrackedRequest,
  completeTrackedRequest,
  failTrackedRequest,
  subscribeToAIRequests,
  hasAIPendingRequests
} from './events';

/**
 * useAI hook for AI operations with event-bus integration
 *
 * @param {Object} options - Hook options
 * @param {Object} options.context - Context for tracking (e.g., { entityId, entityType })
 * @param {string} options.provider - Override default provider
 * @param {function} options.onComplete - Callback when any AI operation completes
 * @param {function} options.onError - Callback when any AI operation fails
 * @returns {Object} AI functions and state
 */
export function useAI(options = {}) {
  const { context = {}, provider, onComplete, onError } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [available, setAvailable] = useState(isAIAvailable());
  const [configuredProviders, setConfiguredProviders] = useState(getConfiguredProviders());

  const contextRef = useRef(context);
  contextRef.current = context;

  // Subscribe to AI events from other tabs/clients
  useEffect(() => {
    const unsubscribe = subscribeToAIRequests(context, {
      onStart: (event) => {
        // Another client started an AI request for this context
        logger.debug('[useAI] Remote request started', { requestId: event.requestId });
      },
      onComplete: (event) => {
        // Another client completed an AI request for this context
        logger.debug('[useAI] Remote request completed', {
          requestId: event.requestId,
          task: event.task
        });
        // Optionally sync the result
        if (onComplete) {
          onComplete(event.result, event);
        }
      },
      onFail: (event) => {
        // Another client failed an AI request for this context
        logger.debug('[useAI] Remote request failed', {
          requestId: event.requestId,
          error: event.error
        });
      }
    });

    return unsubscribe;
  }, [context, onComplete]);

  /**
   * Execute an AI operation with tracking
   */
  const executeWithTracking = useCallback(async (task, operation) => {
    setLoading(true);
    setError(null);

    const tracker = createTrackedRequest(task, contextRef.current);

    try {
      const result = await operation();
      completeTrackedRequest(tracker.id, result);
      setLastResult(result);
      setLoading(false);

      if (onComplete) {
        onComplete(result, { requestId: tracker.id, task });
      }

      return result;
    } catch (err) {
      failTrackedRequest(tracker.id, err);
      setError(err.message);
      setLoading(false);

      if (onError) {
        onError(err, { requestId: tracker.id, task });
      }

      throw err;
    }
  }, [onComplete, onError]);

  /**
   * Autocomplete text
   */
  const autocomplete = useCallback(async (text, opts = {}) => {
    return executeWithTracking(AI_TASKS.AUTOCOMPLETE, () =>
      aiAutocomplete(text, { ...opts, provider: opts.provider || provider })
    );
  }, [executeWithTracking, provider]);

  /**
   * Edit language
   */
  const editLanguage = useCallback(async (text, opts = {}) => {
    return executeWithTracking(AI_TASKS.EDIT_LANGUAGE, () =>
      aiEditLanguage(text, { ...opts, provider: opts.provider || provider })
    );
  }, [executeWithTracking, provider]);

  /**
   * Improve description
   */
  const improveDescription = useCallback(async (description, opts = {}) => {
    return executeWithTracking(AI_TASKS.IMPROVE_DESCRIPTION, () =>
      aiImproveDescription(description, { ...opts, provider: opts.provider || provider })
    );
  }, [executeWithTracking, provider]);

  /**
   * Summarize content
   */
  const summarize = useCallback(async (content, opts = {}) => {
    return executeWithTracking(AI_TASKS.SUMMARIZE, () =>
      aiSummarize(content, { ...opts, provider: opts.provider || provider })
    );
  }, [executeWithTracking, provider]);

  /**
   * Generate travel tips
   */
  const generateTravelTips = useCallback(async (tipContext, opts = {}) => {
    return executeWithTracking(AI_TASKS.GENERATE_TIPS, () =>
      aiGenerateTravelTips(tipContext, { ...opts, provider: opts.provider || provider })
    );
  }, [executeWithTracking, provider]);

  /**
   * Translate text
   */
  const translate = useCallback(async (text, targetLanguage, opts = {}) => {
    return executeWithTracking(AI_TASKS.TRANSLATE, () =>
      aiTranslate(text, targetLanguage, { ...opts, provider: opts.provider || provider })
    );
  }, [executeWithTracking, provider]);

  /**
   * Send a raw completion request
   */
  const sendCompletion = useCallback(async (messages, opts = {}) => {
    return executeWithTracking(opts.task || AI_TASKS.AUTOCOMPLETE, () =>
      complete(messages, { ...opts, provider: opts.provider || provider })
    );
  }, [executeWithTracking, provider]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Check if any requests are pending for this context
   */
  const hasPendingRequests = useCallback(() => {
    return hasAIPendingRequests(contextRef.current);
  }, []);

  return {
    // State
    loading,
    error,
    lastResult,
    available,
    configuredProviders,
    defaultProvider: getDefaultProvider(),

    // Functions
    autocomplete,
    editLanguage,
    improveDescription,
    summarize,
    generateTravelTips,
    translate,
    sendCompletion,

    // Utilities
    clearError,
    hasPendingRequests,
    isAvailable: isAIAvailable
  };
}

export default useAI;
