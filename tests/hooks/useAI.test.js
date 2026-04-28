/**
 * Tests for src/utilities/ai/useAI.js
 *
 * Coverage:
 * - Async hydration of `available` / `configuredProviders` / `defaultProvider`
 *   with no Promise-leak warnings on unmount
 * - Subscription does NOT re-run when context object identity changes but
 *   content is the same (memoization via hashContext)
 * - `onComplete` / `onError` fire once per request
 * - `clearError` resets `error` state
 */

// Mock the function modules — we only need them to be inspectable callable stubs.
jest.mock('../../src/utilities/ai/functions', () => ({
  autocomplete: jest.fn(),
  editLanguage: jest.fn(),
  improveDescription: jest.fn(),
  summarize: jest.fn(),
  generateTravelTips: jest.fn(),
  translate: jest.fn()
}));

// Mock utils so hydration is deterministic.
jest.mock('../../src/utilities/ai/utils', () => ({
  isAIAvailable: jest.fn(() => false),
  isAIAvailableAsync: jest.fn(() => Promise.resolve(true)),
  getConfiguredProviders: jest.fn(() => Promise.resolve(['openai', 'anthropic'])),
  getDefaultProvider: jest.fn(() => Promise.resolve('openai'))
}));

// Mock events module — track subscriptions.
jest.mock('../../src/utilities/ai/events', () => {
  const subscribers = { availability: 0, provider: 0, requests: 0 };
  return {
    AI_EVENTS: {
      AVAILABILITY_CHANGED: 'ai:availability:changed',
      PROVIDER_CHANGED: 'ai:provider:changed'
    },
    createTrackedRequest: jest.fn((task, ctx) => ({ id: `req_${Math.random()}`, task, context: ctx })),
    completeTrackedRequest: jest.fn(),
    failTrackedRequest: jest.fn(),
    subscribeToAIEvent: jest.fn((eventType, handler) => {
      if (eventType === 'ai:availability:changed') subscribers.availability += 1;
      if (eventType === 'ai:provider:changed') subscribers.provider += 1;
      return jest.fn();
    }),
    subscribeToAIRequests: jest.fn(() => {
      subscribers.requests += 1;
      return jest.fn();
    }),
    hasAIPendingRequests: jest.fn(() => false),
    __subscribers: subscribers
  };
});

// Quiet the logger.
jest.mock('../../src/utilities/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { renderHook, act } from '@testing-library/react-hooks';
import { useAI } from '../../src/utilities/ai/useAI';
import * as utils from '../../src/utilities/ai/utils';
import * as fns from '../../src/utilities/ai/functions';
import { subscribeToAIRequests } from '../../src/utilities/ai/events';

describe('useAI hook', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('hydrates available / configuredProviders / defaultProvider asynchronously', async () => {
    const { result, waitForNextUpdate, unmount } = renderHook(() => useAI());

    // Initial state: synchronous false from isAIAvailable mock
    expect(result.current.available).toBe(false);
    expect(result.current.configuredProviders).toEqual([]);
    expect(result.current.defaultProvider).toBeNull();

    // After hydration completes
    await waitForNextUpdate();
    expect(result.current.available).toBe(true);
    expect(result.current.configuredProviders).toEqual(['openai', 'anthropic']);
    expect(result.current.defaultProvider).toBe('openai');

    expect(utils.isAIAvailableAsync).toHaveBeenCalledTimes(1);
    expect(utils.getConfiguredProviders).toHaveBeenCalledTimes(1);
    expect(utils.getDefaultProvider).toHaveBeenCalledTimes(1);

    // Unmount cleanly — no setState-on-unmounted-component warnings.
    unmount();
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/unmounted component/i),
      expect.anything()
    );
  });

  test('does not re-subscribe to AI requests when context identity changes but content is unchanged', async () => {
    const { rerender, waitForNextUpdate, unmount } = renderHook(
      ({ context }) => useAI({ context }),
      { initialProps: { context: { entityId: 'plan_1', entityType: 'plan' } } }
    );

    await waitForNextUpdate();
    const initialCallCount = subscribeToAIRequests.mock.calls.length;

    // New object identity, same content
    rerender({ context: { entityId: 'plan_1', entityType: 'plan' } });
    expect(subscribeToAIRequests.mock.calls.length).toBe(initialCallCount);

    // Different content → resubscribe
    rerender({ context: { entityId: 'plan_2', entityType: 'plan' } });
    expect(subscribeToAIRequests.mock.calls.length).toBe(initialCallCount + 1);

    unmount();
  });

  test('onComplete fires once per successful request', async () => {
    fns.autocomplete.mockResolvedValueOnce('completed text');
    const onComplete = jest.fn();
    const onError = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() =>
      useAI({ onComplete, onError })
    );
    await waitForNextUpdate();

    await act(async () => {
      await result.current.autocomplete('partial');
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toBe('completed text');
    expect(onError).not.toHaveBeenCalled();
  });

  test('onError fires once per failed request', async () => {
    const failure = new Error('provider down');
    fns.autocomplete.mockRejectedValueOnce(failure);
    const onComplete = jest.fn();
    const onError = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() =>
      useAI({ onComplete, onError })
    );
    await waitForNextUpdate();

    await act(async () => {
      await expect(result.current.autocomplete('partial')).rejects.toThrow('provider down');
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(failure);
    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.error).toBe('provider down');
  });

  test('clearError resets error state', async () => {
    fns.autocomplete.mockRejectedValueOnce(new Error('boom'));
    const { result, waitForNextUpdate } = renderHook(() => useAI());
    await waitForNextUpdate();

    await act(async () => {
      await expect(result.current.autocomplete('x')).rejects.toThrow('boom');
    });
    expect(result.current.error).toBe('boom');

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
