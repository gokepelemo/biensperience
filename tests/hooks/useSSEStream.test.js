/**
 * Tests for useSSEStream hook (split from useBienBot)
 *
 * Coverage:
 *  - Initial state (isStreaming false)
 *  - Token accumulation into the assistant placeholder message
 *  - tool_call_start / tool_call_end pill bookkeeping
 *  - Pills clear when the second LLM response starts streaming tokens
 *  - onActions populates the pending-actions slice
 *  - onSession updates currentSession + persists session id
 *  - Errors mark the assistant message + clear flags
 *  - AbortError handling is silent (no error flag set)
 *  - cancelStream aborts the in-flight controller
 */

import { useState, useRef } from 'react';
import { renderHook, act } from '@testing-library/react-hooks';

// ─── Mock bienbot-api ──────────────────────────────────────────────────────
jest.mock('../../src/utilities/bienbot-api', () => ({
  postMessage: jest.fn(),
}));

import * as bienbotApi from '../../src/utilities/bienbot-api';
import useSSEStream from '../../src/hooks/useSSEStream';

/**
 * Build a mock postMessage that walks an event tape, dispatching the
 * matching SSE callback for each entry.
 */
function buildMockPostMessage(events = []) {
  return jest.fn(async (_sid, _text, options = {}) => {
    const {
      onSession,
      onToken,
      onActions,
      onDone,
      onError,
      onToolCallStart,
      onToolCallEnd,
      onStructuredContent,
    } = options;

    for (const ev of events) {
      switch (ev.type) {
        case 'session': onSession?.(ev.data); break;
        case 'token': onToken?.(ev.data); break;
        case 'actions': onActions?.(ev.data); break;
        case 'tool_call_start': onToolCallStart?.(ev.data); break;
        case 'tool_call_end': onToolCallEnd?.(ev.data); break;
        case 'structured_content': onStructuredContent?.(ev.data); break;
        case 'done': onDone?.(ev.data || {}); break;
        case 'error': onError?.(new Error(ev.data)); break;
        default: break;
      }
    }
  });
}

function useTestComposer({ invokeContext, navigationSchema, userId } = {}) {
  const [messages, setMessages] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [pendingActions, setPendingActions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const sessionIdRef = useRef(null);
  const invokeContextSentRef = useRef(false);
  const priorGreetingRef = useRef(null);
  const abortControllerRef = useRef(null);
  // Stable across renders so the hook's useCallback closures and our
  // test assertions see the same jest.fn instance.
  const persistSessionIdRef = useRef(jest.fn(async () => {}));
  const persistSessionId = persistSessionIdRef.current;

  const sse = useSSEStream({
    sessionIdRef,
    invokeContext,
    navigationSchema,
    userId,
    invokeContextSentRef,
    priorGreetingRef,
    abortControllerRef,
    persistSessionId,
    setMessages,
    setCurrentSession,
    setPendingActions,
    setIsLoading,
  });

  return {
    ...sse,
    messages,
    currentSession,
    pendingActions,
    isLoading,
    sessionIdRef,
    abortControllerRef,
    persistSessionId,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSSEStream', () => {
  describe('initial state', () => {
    it('starts with isStreaming false', () => {
      const { result } = renderHook(() => useTestComposer());
      expect(result.current.isStreaming).toBe(false);
      expect(typeof result.current.streamMessage).toBe('function');
      expect(typeof result.current.cancelStream).toBe('function');
    });
  });

  describe('token streaming', () => {
    it('accumulates tokens into the assistant placeholder message', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'token', data: 'Hello' },
        { type: 'token', data: ' world' },
        { type: 'done' },
      ]));

      const { result } = renderHook(() => useTestComposer());

      await act(async () => {
        await result.current.streamMessage({ text: 'Hi' });
      });

      const assistant = result.current.messages.find(m => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant.content).toBe('Hello world');
    });

    it('clears isStreaming + isLoading flags after onDone', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'token', data: 'x' },
        { type: 'done' },
      ]));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'Hi' }); });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('tool-call pills', () => {
    it('exposes pending pill state when no tokens stream after the call', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'tool_call_start', data: { call_id: 'c1', type: 'fetch_plan_items', label: 'Reading items' } },
        { type: 'tool_call_end', data: { call_id: 'c1', ok: true } },
        { type: 'done' },
      ]));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'show plan' }); });

      const assistant = result.current.messages.find(m => m.role === 'assistant');
      expect(assistant.tool_call_pills).toEqual([
        { call_id: 'c1', type: 'fetch_plan_items', label: 'Reading items', status: 'success' },
      ]);
    });

    it('clears pills once tokens start streaming (second LLM response)', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'tool_call_start', data: { call_id: 'c1', type: 'fetch_plan_costs', label: 'Reading costs' } },
        { type: 'tool_call_end', data: { call_id: 'c1', ok: true } },
        { type: 'token', data: 'The total is' },
        { type: 'done' },
      ]));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'cost?' }); });

      const assistant = result.current.messages.find(m => m.role === 'assistant');
      expect(assistant.content).toBe('The total is');
      expect(assistant.tool_call_pills).toEqual([]);
    });

    it('marks failed pills with status:error', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'tool_call_start', data: { call_id: 'c1', type: 'fetch_x', label: 'X' } },
        { type: 'tool_call_end', data: { call_id: 'c1', ok: false } },
        { type: 'done' },
      ]));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'do it' }); });

      const assistant = result.current.messages.find(m => m.role === 'assistant');
      expect(assistant.tool_call_pills[0].status).toBe('error');
    });
  });

  describe('onActions / onSession', () => {
    it('populates pendingActions from onActions', async () => {
      const actions = [{ _id: 'a1', type: 'create_plan' }];
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'actions', data: actions },
        { type: 'done' },
      ]));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'plan' }); });

      expect(result.current.pendingActions).toEqual(actions);
    });

    it('updates currentSession + sessionIdRef + persists from onSession', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'new-sess', title: 'My Trip' } },
        { type: 'done' },
      ]));

      const { result } = renderHook(() => useTestComposer({ userId: 'u-1' }));
      await act(async () => { await result.current.streamMessage({ text: 'hi' }); });

      expect(result.current.currentSession).toMatchObject({ _id: 'new-sess', title: 'My Trip', user: 'u-1' });
      expect(result.current.sessionIdRef.current).toBe('new-sess');
      expect(result.current.persistSessionId).toHaveBeenCalledWith('new-sess');
    });
  });

  describe('error paths', () => {
    it('flags assistant message as error and clears streaming flag on onError', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'error', data: 'Stream broke' },
      ]));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'fail' }); });

      const assistant = result.current.messages.find(m => m.role === 'assistant');
      expect(assistant.error).toBe(true);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('handles thrown errors as error-flagged messages', async () => {
      bienbotApi.postMessage.mockRejectedValueOnce(new Error('network'));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'x' }); });

      const assistant = result.current.messages.find(m => m.role === 'assistant');
      expect(assistant.error).toBe(true);
    });

    it('treats AbortError silently (no error flag set)', async () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      bienbotApi.postMessage.mockRejectedValueOnce(abortErr);

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.streamMessage({ text: 'x' }); });

      const assistant = result.current.messages.find(m => m.role === 'assistant');
      expect(assistant?.error).toBeUndefined();
      expect(result.current.isStreaming).toBe(false);
    });
  });

  describe('cancelStream', () => {
    it('aborts the active controller via the shared ref', async () => {
      const abortFn = jest.fn();
      // Replace AbortController so we can spy on .abort()
      const OriginalAbortController = global.AbortController;
      global.AbortController = jest.fn(() => ({
        abort: abortFn,
        signal: { aborted: false },
      }));

      // postMessage that hangs (never resolves done) so the controller stays
      bienbotApi.postMessage.mockImplementation(async (_sid, _text, options) => {
        options.onToken?.('partial');
      });

      const { result } = renderHook(() => useTestComposer());

      // Start the stream (don't await — we want the controller in-flight)
      act(() => { result.current.streamMessage({ text: 'long' }); });

      // Now cancel — should fire the abort on the AbortController we constructed
      act(() => { result.current.cancelStream(); });

      expect(abortFn).toHaveBeenCalled();
      expect(result.current.abortControllerRef.current).toBeNull();

      global.AbortController = OriginalAbortController;
    });
  });
});
