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
  isAIAvailableAsync,
  getConfiguredProviders,
  getDefaultProvider
} from './utils';
import {
  AI_EVENTS,
  createTrackedRequest,
  completeTrackedRequest,
  failTrackedRequest,
  subscribeToAIEvent,
  subscribeToAIRequests,
  hasAIPendingRequests
} from './events';

/**
 * Stable JSON-style hash of a context object for use as a useEffect dep key.
 * Avoids re-subscribing on every render when the consumer passes an inline
 * object literal as `context`.
 */
function hashContext(ctx) {
  if (!ctx || typeof ctx !== 'object') return '';
  const keys = Object.keys(ctx).sort();
  return keys.map(k => `${k}=${ctx[k]}`).join('|');
}

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
  const [available, setAvailable] = useState(() => isAIAvailable());
  const [configuredProviders, setConfiguredProviders] = useState([]);
  const [defaultProvider, setDefaultProvider] = useState(null);

  // Refs keep latest values without forcing effect/callback re-creation.
  const contextRef = useRef(context);
  contextRef.current = context;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const providerRef = useRef(provider);
  providerRef.current = provider;

  const contextKey = hashContext(context);

  // Hydrate availability + configured providers + default provider from backend.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const [isAvail, providers, defProvider] = await Promise.all([
          isAIAvailableAsync(),
          getConfiguredProviders(),
          getDefaultProvider()
        ]);
        if (cancelled) return;
        setAvailable(isAvail);
        setConfiguredProviders(providers);
        setDefaultProvider(defProvider);
      } catch (err) {
        if (cancelled) return;
        logger.debug('[useAI] Failed to hydrate AI status', { error: err.message });
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to availability/provider change events so multiple tabs / admin
  // updates flow through automatically.
  useEffect(() => {
    const unsubAvailability = subscribeToAIEvent(AI_EVENTS.AVAILABILITY_CHANGED, (event) => {
      if (typeof event.available === 'boolean') {
        setAvailable(event.available);
      }
      if (Array.isArray(event.providers)) {
        setConfiguredProviders(event.providers);
      }
    });

    const unsubProvider = subscribeToAIEvent(AI_EVENTS.PROVIDER_CHANGED, (event) => {
      if (event.newProvider) {
        setDefaultProvider(event.newProvider);
      }
    });

    return () => {
      unsubAvailability();
      unsubProvider();
    };
  }, []);

  // Subscribe to AI events from other tabs/clients for the current context.
  // Re-subscribe only when the *content* of the context filter changes.
  useEffect(() => {
    const unsubscribe = subscribeToAIRequests(contextRef.current, {
      onStart: (event) => {
        logger.debug('[useAI] Remote request started', { requestId: event.requestId });
      },
      onComplete: (event) => {
        logger.debug('[useAI] Remote request completed', {
          requestId: event.requestId,
          task: event.task
        });
        if (onCompleteRef.current) {
          onCompleteRef.current(event.result, event);
        }
      },
      onFail: (event) => {
        logger.debug('[useAI] Remote request failed', {
          requestId: event.requestId,
          error: event.error
        });
        if (onErrorRef.current) {
          onErrorRef.current(new Error(event.error), event);
        }
      }
    });

    return unsubscribe;
  }, [contextKey]);

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

      if (onCompleteRef.current) {
        onCompleteRef.current(result, { requestId: tracker.id, task });
      }

      return result;
    } catch (err) {
      failTrackedRequest(tracker.id, err);
      setError(err.message);
      setLoading(false);

      if (onErrorRef.current) {
        onErrorRef.current(err, { requestId: tracker.id, task });
      }

      throw err;
    }
  }, []);

  const withProvider = (opts) => ({
    ...opts,
    provider: opts.provider || providerRef.current
  });

  const autocomplete = useCallback((text, opts = {}) =>
    executeWithTracking(AI_TASKS.AUTOCOMPLETE, () =>
      aiAutocomplete(text, withProvider(opts))
    ),
  [executeWithTracking]);

  const editLanguage = useCallback((text, opts = {}) =>
    executeWithTracking(AI_TASKS.EDIT_LANGUAGE, () =>
      aiEditLanguage(text, withProvider(opts))
    ),
  [executeWithTracking]);

  const improveDescription = useCallback((description, opts = {}) =>
    executeWithTracking(AI_TASKS.IMPROVE_DESCRIPTION, () =>
      aiImproveDescription(description, withProvider(opts))
    ),
  [executeWithTracking]);

  const summarize = useCallback((content, opts = {}) =>
    executeWithTracking(AI_TASKS.SUMMARIZE, () =>
      aiSummarize(content, withProvider(opts))
    ),
  [executeWithTracking]);

  const generateTravelTips = useCallback((tipContext, opts = {}) =>
    executeWithTracking(AI_TASKS.GENERATE_TIPS, () =>
      aiGenerateTravelTips(tipContext, withProvider(opts))
    ),
  [executeWithTracking]);

  const translate = useCallback((text, targetLanguage, opts = {}) =>
    executeWithTracking(AI_TASKS.TRANSLATE, () =>
      aiTranslate(text, targetLanguage, withProvider(opts))
    ),
  [executeWithTracking]);

  const clearError = useCallback(() => setError(null), []);

  const hasPendingRequests = useCallback(
    () => hasAIPendingRequests(contextRef.current),
    []
  );

  return {
    // State
    loading,
    error,
    lastResult,
    available,
    configuredProviders,
    defaultProvider,

    // Functions
    autocomplete,
    editLanguage,
    improveDescription,
    summarize,
    generateTravelTips,
    translate,

    // Utilities
    clearError,
    hasPendingRequests,
    isAvailable: isAIAvailable
  };
}

export default useAI;
