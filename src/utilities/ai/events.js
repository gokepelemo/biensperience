/**
 * AI Event Bus Integration
 *
 * Enables components to use the event bus for AI operations,
 * providing cross-tab synchronization and request/response tracking.
 *
 * @module ai/events
 */

import { eventBus, generateOptimisticId } from '../event-bus';
import { logger } from '../logger';
import { AI_TASKS } from './constants';

/**
 * AI Event Types
 */
export const AI_EVENTS = {
  // Request events (dispatched when AI operation starts)
  REQUEST_STARTED: 'ai:request:started',
  REQUEST_COMPLETED: 'ai:request:completed',
  REQUEST_FAILED: 'ai:request:failed',

  // Content events (dispatched when AI generates content)
  CONTENT_GENERATED: 'ai:content:generated',
  AUTOCOMPLETE_SUGGESTION: 'ai:autocomplete:suggestion',
  DESCRIPTION_IMPROVED: 'ai:description:improved',
  TIPS_GENERATED: 'ai:tips:generated',
  TRANSLATION_COMPLETED: 'ai:translation:completed',
  SUMMARY_GENERATED: 'ai:summary:generated',

  // Status events
  PROVIDER_CHANGED: 'ai:provider:changed',
  AVAILABILITY_CHANGED: 'ai:availability:changed'
};

/**
 * Pending request tracking
 */
const pendingRequests = new Map();

/**
 * Create a tracked AI request
 *
 * @param {string} task - AI task type from AI_TASKS
 * @param {Object} context - Request context (for logging and tracking)
 * @returns {Object} Request tracker with id, resolve, reject
 */
export function createTrackedRequest(task, context = {}) {
  const requestId = generateOptimisticId('ai_req');

  const tracker = {
    id: requestId,
    task,
    context,
    startTime: Date.now(),
    status: 'pending'
  };

  pendingRequests.set(requestId, tracker);

  // Emit request started event
  eventBus.emit(AI_EVENTS.REQUEST_STARTED, {
    requestId,
    task,
    context,
    timestamp: tracker.startTime
  }, { localOnly: false });

  logger.debug('[AI Events] Request started', { requestId, task });

  return tracker;
}

/**
 * Complete a tracked AI request
 *
 * @param {string} requestId - Request ID
 * @param {Object} result - AI result
 */
export function completeTrackedRequest(requestId, result) {
  const tracker = pendingRequests.get(requestId);
  if (!tracker) {
    logger.warn('[AI Events] Unknown request completed', { requestId });
    return;
  }

  tracker.status = 'completed';
  tracker.endTime = Date.now();
  tracker.duration = tracker.endTime - tracker.startTime;

  // Emit request completed event
  eventBus.emit(AI_EVENTS.REQUEST_COMPLETED, {
    requestId,
    task: tracker.task,
    context: tracker.context,
    result,
    duration: tracker.duration,
    usage: result.usage
  }, { localOnly: false });

  // Emit task-specific event
  const taskEvent = getTaskSpecificEvent(tracker.task);
  if (taskEvent) {
    eventBus.emit(taskEvent, {
      requestId,
      content: result.content,
      context: tracker.context,
      provider: result.provider,
      model: result.model
    }, { localOnly: false });
  }

  logger.debug('[AI Events] Request completed', {
    requestId,
    task: tracker.task,
    duration: tracker.duration
  });

  pendingRequests.delete(requestId);
}

/**
 * Fail a tracked AI request
 *
 * @param {string} requestId - Request ID
 * @param {Error} error - Error object
 */
export function failTrackedRequest(requestId, error) {
  const tracker = pendingRequests.get(requestId);
  if (!tracker) {
    logger.warn('[AI Events] Unknown request failed', { requestId });
    return;
  }

  tracker.status = 'failed';
  tracker.endTime = Date.now();
  tracker.duration = tracker.endTime - tracker.startTime;
  tracker.error = error.message;

  // Emit request failed event
  eventBus.emit(AI_EVENTS.REQUEST_FAILED, {
    requestId,
    task: tracker.task,
    context: tracker.context,
    error: error.message,
    duration: tracker.duration
  }, { localOnly: false });

  logger.error('[AI Events] Request failed', {
    requestId,
    task: tracker.task,
    error: error.message
  }, error);

  pendingRequests.delete(requestId);
}

/**
 * Get task-specific event name
 *
 * @param {string} task - AI task type
 * @returns {string|null} Event name or null
 */
function getTaskSpecificEvent(task) {
  switch (task) {
    case AI_TASKS.AUTOCOMPLETE:
      return AI_EVENTS.AUTOCOMPLETE_SUGGESTION;
    case AI_TASKS.IMPROVE_DESCRIPTION:
      return AI_EVENTS.DESCRIPTION_IMPROVED;
    case AI_TASKS.GENERATE_TIPS:
      return AI_EVENTS.TIPS_GENERATED;
    case AI_TASKS.TRANSLATE:
      return AI_EVENTS.TRANSLATION_COMPLETED;
    case AI_TASKS.SUMMARIZE:
      return AI_EVENTS.SUMMARY_GENERATED;
    default:
      return AI_EVENTS.CONTENT_GENERATED;
  }
}

/**
 * Subscribe to AI events
 *
 * @param {string} eventType - Event type from AI_EVENTS
 * @param {function} handler - Event handler
 * @returns {function} Unsubscribe function
 */
export function subscribeToAIEvent(eventType, handler) {
  return eventBus.subscribe(eventType, handler);
}

/**
 * Subscribe to all AI request events for a specific context
 *
 * @param {Object} contextFilter - Filter criteria (e.g., { entityId: '123' })
 * @param {Object} handlers - Event handlers { onStart, onComplete, onFail }
 * @returns {function} Unsubscribe function
 */
export function subscribeToAIRequests(contextFilter, handlers = {}) {
  const { onStart, onComplete, onFail } = handlers;
  const unsubscribers = [];

  const matchesContext = (eventContext) => {
    if (!contextFilter || Object.keys(contextFilter).length === 0) return true;
    return Object.entries(contextFilter).every(
      ([key, value]) => eventContext[key] === value
    );
  };

  if (onStart) {
    unsubscribers.push(eventBus.subscribe(AI_EVENTS.REQUEST_STARTED, (event) => {
      if (matchesContext(event.context)) {
        onStart(event);
      }
    }));
  }

  if (onComplete) {
    unsubscribers.push(eventBus.subscribe(AI_EVENTS.REQUEST_COMPLETED, (event) => {
      if (matchesContext(event.context)) {
        onComplete(event);
      }
    }));
  }

  if (onFail) {
    unsubscribers.push(eventBus.subscribe(AI_EVENTS.REQUEST_FAILED, (event) => {
      if (matchesContext(event.context)) {
        onFail(event);
      }
    }));
  }

  // Return combined unsubscribe function
  return () => {
    unsubscribers.forEach(unsub => unsub());
  };
}

/**
 * Get pending requests for a context
 *
 * @param {Object} contextFilter - Filter criteria
 * @returns {Array} Array of pending request trackers
 */
export function getPendingRequests(contextFilter = {}) {
  const results = [];

  pendingRequests.forEach((tracker) => {
    const matches = Object.entries(contextFilter).every(
      ([key, value]) => tracker.context[key] === value
    );
    if (Object.keys(contextFilter).length === 0 || matches) {
      results.push({ ...tracker });
    }
  });

  return results;
}

/**
 * Check if any AI requests are pending
 *
 * @param {Object} contextFilter - Optional filter criteria
 * @returns {boolean} True if requests are pending
 */
export function hasAIPendingRequests(contextFilter = {}) {
  return getPendingRequests(contextFilter).length > 0;
}

/**
 * Emit provider changed event
 *
 * @param {string} oldProvider - Previous provider
 * @param {string} newProvider - New provider
 */
export function emitProviderChanged(oldProvider, newProvider) {
  eventBus.emit(AI_EVENTS.PROVIDER_CHANGED, {
    oldProvider,
    newProvider,
    timestamp: Date.now()
  }, { localOnly: false });

  logger.info('[AI Events] Provider changed', { oldProvider, newProvider });
}

/**
 * Emit availability changed event
 *
 * @param {boolean} available - Whether AI is now available
 * @param {string[]} providers - List of available providers
 */
export function emitAvailabilityChanged(available, providers = []) {
  eventBus.emit(AI_EVENTS.AVAILABILITY_CHANGED, {
    available,
    providers,
    timestamp: Date.now()
  }, { localOnly: false });

  logger.info('[AI Events] Availability changed', { available, providerCount: providers.length });
}
