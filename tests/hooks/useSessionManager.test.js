/**
 * Tests for useSessionManager hook (split from useBienBot)
 *
 * Coverage:
 *  - Initial state
 *  - fetchSessions populates sessions list
 *  - loadSession on mount when initialSessionId is provided (greeting + history)
 *  - clearSession resets state
 *  - Encrypted persistence (persistSessionId / clearPersistedSession / getPersistedSession)
 *  - Event subscriptions: bienbot:session_deleted clears + drops from list
 *  - shareSession / unshareSession round-trip
 *  - deleteSession server call + local removal
 */

import { useState, useRef } from 'react';
import { renderHook, act } from '@testing-library/react-hooks';

// ─── Mock bienbot-api ──────────────────────────────────────────────────────
jest.mock('../../src/utilities/bienbot-api', () => ({
  getSessions: jest.fn(),
  resumeSession: jest.fn(),
  deleteSession: jest.fn(),
  addSessionCollaborator: jest.fn(),
  removeSessionCollaborator: jest.fn(),
}));

// ─── Mock event-bus ────────────────────────────────────────────────────────
jest.mock('../../src/utilities/event-bus', () => {
  const handlers = {};
  return {
    eventBus: {
      subscribe: jest.fn((eventType, handler) => {
        handlers[eventType] = handler;
        return jest.fn(() => { delete handlers[eventType]; });
      }),
      emit: jest.fn(),
      _handlers: handlers,
    },
    broadcastEvent: jest.fn(),
  };
});

// ─── Mock crypto-utils ─────────────────────────────────────────────────────
jest.mock('../../src/utilities/crypto-utils', () => ({
  encryptData: jest.fn(async (payload) => `enc:${JSON.stringify(payload)}`),
  decryptData: jest.fn(async (raw) => {
    if (!raw?.startsWith('enc:')) return null;
    return JSON.parse(raw.slice(4));
  }),
}));

import * as bienbotApi from '../../src/utilities/bienbot-api';
import { eventBus } from '../../src/utilities/event-bus';
import * as cryptoUtils from '../../src/utilities/crypto-utils';
import useSessionManager from '../../src/hooks/useSessionManager';

/**
 * Test composer that wires sub-hook into a parent that owns the same state
 * shape as the real composed hook would (messages / pendingActions / etc).
 */
function useTestComposer({ initialSessionId, userId, invokeContext } = {}) {
  const [messages, setMessages] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [suggestedNextSteps, setSuggestedNextSteps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const sessionIdRef = useRef(initialSessionId || null);
  const invokeContextSentRef = useRef(false);
  // Stable across renders so the hook's useCallback closures and our
  // test assertions see the same jest.fn instance.
  const cancelStreamRef = useRef(jest.fn(() => {}));
  const cancelStream = cancelStreamRef.current;

  const session = useSessionManager({
    initialSessionId,
    userId,
    invokeContext,
    sessionIdRef,
    invokeContextSentRef,
    setMessages,
    setPendingActions,
    setSuggestedNextSteps,
    setIsLoading,
    setIsStreaming,
    cancelStream,
  });

  return {
    ...session,
    messages,
    pendingActions,
    suggestedNextSteps,
    isLoading,
    isStreaming,
    sessionIdRef,
    invokeContextSentRef,
    cancelStream,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  bienbotApi.getSessions.mockResolvedValue({ sessions: [] });
  bienbotApi.resumeSession.mockResolvedValue({ session: null, greeting: null });
  bienbotApi.deleteSession.mockResolvedValue(null);
  bienbotApi.addSessionCollaborator.mockResolvedValue(null);
  bienbotApi.removeSessionCollaborator.mockResolvedValue(null);
  // Reset localStorage mock
  window.localStorage.getItem.mockReset();
  window.localStorage.setItem.mockReset();
  window.localStorage.removeItem.mockReset();
});

describe('useSessionManager', () => {
  describe('initial state', () => {
    it('returns empty sessions and null currentSession by default', () => {
      const { result } = renderHook(() => useTestComposer());
      expect(result.current.sessions).toEqual([]);
      expect(result.current.currentSession).toBeNull();
    });

    it('exposes the public action surface', () => {
      const { result } = renderHook(() => useTestComposer());
      expect(typeof result.current.loadSession).toBe('function');
      expect(typeof result.current.fetchSessions).toBe('function');
      expect(typeof result.current.clearSession).toBe('function');
      expect(typeof result.current.resetSession).toBe('function');
      expect(typeof result.current.deleteSession).toBe('function');
      expect(typeof result.current.shareSession).toBe('function');
      expect(typeof result.current.unshareSession).toBe('function');
      expect(typeof result.current.persistSessionId).toBe('function');
      expect(typeof result.current.clearPersistedSession).toBe('function');
      expect(typeof result.current.getPersistedSession).toBe('function');
    });
  });

  describe('fetchSessions', () => {
    it('populates sessions from the API', async () => {
      const sessions = [{ _id: 's1' }, { _id: 's2' }];
      bienbotApi.getSessions.mockResolvedValueOnce({ sessions });

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.fetchSessions(); });

      expect(result.current.sessions).toEqual(sessions);
    });

    it('falls back to empty array on API failure', async () => {
      bienbotApi.getSessions.mockRejectedValueOnce(new Error('boom'));

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.fetchSessions(); });

      expect(result.current.sessions).toEqual([]);
    });
  });

  describe('loadSession on mount', () => {
    it('calls resumeSession with sid + null context when no invokeContext', async () => {
      const session = { _id: 'sess-1', messages: [], pending_actions: [] };
      bienbotApi.resumeSession.mockResolvedValueOnce({
        session,
        greeting: { text: 'Welcome back!', suggested_next_steps: [] },
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useTestComposer({ initialSessionId: 'sess-1' })
      );
      await waitForNextUpdate();

      expect(bienbotApi.resumeSession).toHaveBeenCalledWith('sess-1', null);
      expect(result.current.currentSession).toEqual(session);
    });

    it('inserts greeting + session history into messages', async () => {
      const historyMsg = { _id: 'm1', role: 'user', content: 'Hi' };
      bienbotApi.resumeSession.mockResolvedValueOnce({
        session: { _id: 'sess-2', messages: [historyMsg], pending_actions: [] },
        greeting: { text: 'Resuming!', suggested_next_steps: ['Step A'] },
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useTestComposer({ initialSessionId: 'sess-2' })
      );
      await waitForNextUpdate();

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]).toMatchObject({ role: 'assistant', content: 'Resuming!' });
      expect(result.current.messages[1]).toEqual(historyMsg);
      expect(result.current.suggestedNextSteps).toEqual(['Step A']);
    });

    it('forwards invokeContext as currentPageContext to resumeSession', async () => {
      bienbotApi.resumeSession.mockResolvedValueOnce({
        session: { _id: 'sess-3', messages: [], pending_actions: [] },
        greeting: null,
      });
      const invokeContext = { entity: 'experience', id: 'exp-1', label: 'Paris' };

      const { waitForNextUpdate } = renderHook(() =>
        useTestComposer({ initialSessionId: 'sess-3', invokeContext })
      );
      await waitForNextUpdate();

      expect(bienbotApi.resumeSession).toHaveBeenCalledWith('sess-3', {
        entity: 'experience',
        id: 'exp-1',
        label: 'Paris',
      });
    });
  });

  describe('clearSession', () => {
    it('cancels stream + resets all state', async () => {
      const session = { _id: 'clr-1', messages: [{ role: 'user', content: 'hi' }], pending_actions: [] };
      bienbotApi.resumeSession.mockResolvedValueOnce({
        session,
        greeting: { text: 'Hello', suggested_next_steps: ['x'] },
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useTestComposer({ initialSessionId: 'clr-1' })
      );
      await waitForNextUpdate();

      expect(result.current.messages.length).toBeGreaterThan(0);
      expect(result.current.suggestedNextSteps.length).toBeGreaterThan(0);

      act(() => { result.current.clearSession(); });

      expect(result.current.cancelStream).toHaveBeenCalled();
      expect(result.current.currentSession).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingActions).toEqual([]);
      expect(result.current.suggestedNextSteps).toEqual([]);
      expect(result.current.sessionIdRef.current).toBeNull();
      expect(result.current.invokeContextSentRef.current).toBe(false);
    });
  });

  describe('resetSession', () => {
    it('clears session tracking but preserves messages + suggested prompts', async () => {
      const session = { _id: 'rst-1', messages: [{ role: 'assistant', content: 'analysis' }], pending_actions: [] };
      bienbotApi.resumeSession.mockResolvedValueOnce({
        session,
        greeting: { text: 'Hello', suggested_next_steps: ['keep me'] },
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useTestComposer({ initialSessionId: 'rst-1' })
      );
      await waitForNextUpdate();

      const messagesBefore = result.current.messages;
      const stepsBefore = result.current.suggestedNextSteps;

      act(() => { result.current.resetSession(); });

      expect(result.current.currentSession).toBeNull();
      expect(result.current.sessionIdRef.current).toBeNull();
      // Preserved
      expect(result.current.messages).toBe(messagesBefore);
      expect(result.current.suggestedNextSteps).toBe(stepsBefore);
    });
  });

  describe('encrypted persistence', () => {
    it('persistSessionId writes encrypted payload to localStorage when userId is set', async () => {
      const { result } = renderHook(() => useTestComposer({ userId: 'u-1' }));

      await act(async () => { await result.current.persistSessionId('sess-A'); });

      expect(cryptoUtils.encryptData).toHaveBeenCalledWith(
        { sessionId: 'sess-A', userId: 'u-1' },
        'u-1'
      );
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'bien:bienbot_active_session',
        expect.stringContaining('enc:')
      );
    });

    it('persistSessionId is a no-op when userId is missing', async () => {
      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.persistSessionId('sess-A'); });
      expect(cryptoUtils.encryptData).not.toHaveBeenCalled();
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });

    it('clearPersistedSession removes the storage key', () => {
      const { result } = renderHook(() => useTestComposer({ userId: 'u-2' }));
      act(() => { result.current.clearPersistedSession(); });
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('bien:bienbot_active_session');
    });

    it('getPersistedSession decrypts a stored payload', async () => {
      window.localStorage.getItem.mockReturnValueOnce('enc:{"sessionId":"sess-X","userId":"u-3"}');
      const { result } = renderHook(() => useTestComposer({ userId: 'u-3' }));

      let value;
      await act(async () => { value = await result.current.getPersistedSession(); });

      expect(value).toEqual({ sessionId: 'sess-X', userId: 'u-3' });
    });
  });

  describe('event subscriptions', () => {
    it('drops the session from the list when bienbot:session_deleted fires', async () => {
      bienbotApi.getSessions.mockResolvedValueOnce({ sessions: [{ _id: 's1' }, { _id: 's2' }] });

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.fetchSessions(); });

      await act(async () => {
        const handler = eventBus._handlers['bienbot:session_deleted'];
        if (handler) handler({ sessionId: 's1' });
      });

      expect(result.current.sessions).toEqual([{ _id: 's2' }]);
    });

    it('moves the resumed session to the top of the list', async () => {
      bienbotApi.getSessions.mockResolvedValueOnce({ sessions: [{ _id: 's1' }, { _id: 's2' }, { _id: 's3' }] });

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.fetchSessions(); });

      await act(async () => {
        const handler = eventBus._handlers['bienbot:session_resumed'];
        if (handler) handler({ sessionId: 's3' });
      });

      expect(result.current.sessions[0]._id).toBe('s3');
      expect(result.current.sessions).toHaveLength(3);
    });
  });

  describe('shareSession / unshareSession', () => {
    it('updates currentSession.shared_with after shareSession', async () => {
      bienbotApi.resumeSession.mockResolvedValueOnce({
        session: { _id: 'sh-1', messages: [], pending_actions: [], shared_with: [] },
        greeting: null,
      });
      bienbotApi.addSessionCollaborator.mockResolvedValueOnce({
        shared_with: [{ user_id: 'u-2', role: 'editor' }],
      });

      const { result, waitForNextUpdate } = renderHook(() =>
        useTestComposer({ initialSessionId: 'sh-1' })
      );
      await waitForNextUpdate();

      await act(async () => { await result.current.shareSession('u-2', 'editor'); });

      expect(bienbotApi.addSessionCollaborator).toHaveBeenCalledWith('sh-1', 'u-2', 'editor');
      expect(result.current.currentSession.shared_with).toEqual([{ user_id: 'u-2', role: 'editor' }]);
    });

    it('updates currentSession.shared_with after unshareSession', async () => {
      bienbotApi.resumeSession.mockResolvedValueOnce({
        session: { _id: 'sh-2', messages: [], pending_actions: [], shared_with: [{ user_id: 'u-3' }] },
        greeting: null,
      });
      bienbotApi.removeSessionCollaborator.mockResolvedValueOnce({ shared_with: [] });

      const { result, waitForNextUpdate } = renderHook(() =>
        useTestComposer({ initialSessionId: 'sh-2' })
      );
      await waitForNextUpdate();

      await act(async () => { await result.current.unshareSession('u-3'); });

      expect(bienbotApi.removeSessionCollaborator).toHaveBeenCalledWith('sh-2', 'u-3');
      expect(result.current.currentSession.shared_with).toEqual([]);
    });
  });

  describe('deleteSession', () => {
    it('calls deleteSessionAPI then drops from sessions list', async () => {
      bienbotApi.getSessions.mockResolvedValueOnce({ sessions: [{ _id: 'd1' }, { _id: 'd2' }] });

      const { result } = renderHook(() => useTestComposer());
      await act(async () => { await result.current.fetchSessions(); });

      await act(async () => { await result.current.deleteSession('d1'); });

      expect(bienbotApi.deleteSession).toHaveBeenCalledWith('d1');
      expect(result.current.sessions).toEqual([{ _id: 'd2' }]);
    });
  });
});
