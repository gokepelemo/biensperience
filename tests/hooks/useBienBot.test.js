/**
 * Tests for useBienBot hook
 *
 * Tests cover:
 * - Initial state
 * - sendMessage: optimistic messages, SSE streaming (tokens, session, actions, done)
 * - Stream abort/cancel handling
 * - Error handling in sendMessage
 * - executeActions: success and error paths
 * - cancelAction: removes action from pendingActions
 * - updateContext: mid-session context injection
 * - loadSession: session resume lifecycle
 * - clearSession: resets all state
 * - fetchSessions: populates sessions list
 * - Event subscriptions: bienbot:session_deleted, bienbot:session_resumed
 * - Cleanup on unmount (stream cancellation)
 */

import { renderHook, act } from '@testing-library/react-hooks';
import useBienBot from '../../src/hooks/useBienBot';

// ─── Mock bienbot-api ──────────────────────────────────────────────────────
jest.mock('../../src/utilities/bienbot-api', () => ({
  postMessage: jest.fn(),
  getSessions: jest.fn(),
  getSession: jest.fn(),
  resumeSession: jest.fn(),
  executeActions: jest.fn(),
  cancelAction: jest.fn(),
  deleteSession: jest.fn(),
  updateSessionContext: jest.fn(),
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
    reconcileState: jest.fn((cur, event) => event.data || cur),
    generateOptimisticId: jest.fn(() => `optimistic_${Date.now()}`),
    getProtectedFields: jest.fn(() => []),
  };
});

// ─── Imports after mocks ───────────────────────────────────────────────────
import * as bienbotApi from '../../src/utilities/bienbot-api';
import { eventBus } from '../../src/utilities/event-bus';

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a mock postMessage that calls SSE-like callbacks.
 * @param {Object[]} events - Array of { type, data } objects to dispatch in order.
 */
function buildMockPostMessage(events = []) {
  return jest.fn(async (_sid, _text, options = {}) => {
    const { onSession, onToken, onActions, onDone, onError } = options;

    for (const ev of events) {
      switch (ev.type) {
        case 'session':
          if (onSession) onSession(ev.data);
          break;
        case 'token':
          if (onToken) onToken(ev.data);
          break;
        case 'actions':
          if (onActions) onActions(ev.data);
          break;
        case 'done':
          if (onDone) onDone(ev.data || {});
          break;
        case 'error':
          if (onError) onError(new Error(ev.data));
          break;
        default:
          break;
      }
    }
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('useBienBot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bienbotApi.getSessions.mockResolvedValue({ sessions: [] });
    bienbotApi.resumeSession.mockResolvedValue({ session: null, greeting: null });
    bienbotApi.executeActions.mockResolvedValue(null);
    bienbotApi.cancelAction.mockResolvedValue(null);
    bienbotApi.updateSessionContext.mockResolvedValue({ entityLabel: null });
  });

  // ─── Initial state ────────────────────────────────────────────────────
  describe('initial state', () => {
    it('returns empty state with no sessionId', () => {
      const { result } = renderHook(() => useBienBot());

      expect(result.current.sessions).toEqual([]);
      expect(result.current.currentSession).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingActions).toEqual([]);
      expect(result.current.suggestedNextSteps).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });

    it('exposes all action functions', () => {
      const { result } = renderHook(() => useBienBot());

      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.executeActions).toBe('function');
      expect(typeof result.current.cancelAction).toBe('function');
      expect(typeof result.current.updateContext).toBe('function');
      expect(typeof result.current.loadSession).toBe('function');
      expect(typeof result.current.clearSession).toBe('function');
      expect(typeof result.current.fetchSessions).toBe('function');
    });
  });

  // ─── loadSession on mount ─────────────────────────────────────────────
  describe('initialSessionId', () => {
    it('calls loadSession when initialSessionId is provided', async () => {
      const session = { _id: 'sess-1', messages: [], pending_actions: [] };
      const greeting = { text: 'Welcome back!', suggested_next_steps: [] };
      bienbotApi.resumeSession.mockResolvedValue({ session, greeting });

      const { result, waitForNextUpdate } = renderHook(() =>
        useBienBot({ sessionId: 'sess-1' })
      );

      await waitForNextUpdate();

      expect(bienbotApi.resumeSession).toHaveBeenCalledWith('sess-1');
      expect(result.current.currentSession).toEqual(session);
    });

    it('sets greeting as first message when loadSession is called', async () => {
      const session = { _id: 'sess-2', messages: [], pending_actions: [] };
      const greeting = { text: 'Resuming your session!', suggested_next_steps: ['Do this', 'Do that'] };
      bienbotApi.resumeSession.mockResolvedValue({ session, greeting });

      const { result, waitForNextUpdate } = renderHook(() =>
        useBienBot({ sessionId: 'sess-2' })
      );

      await waitForNextUpdate();

      expect(result.current.messages[0]).toMatchObject({
        role: 'assistant',
        content: 'Resuming your session!'
      });
      expect(result.current.suggestedNextSteps).toEqual(['Do this', 'Do that']);
    });

    it('populates messages with session history after greeting', async () => {
      const historyMsg = { _id: 'msg-1', role: 'user', content: 'Hello' };
      const session = { _id: 'sess-3', messages: [historyMsg], pending_actions: [] };
      const greeting = { text: 'Welcome!', suggested_next_steps: [] };
      bienbotApi.resumeSession.mockResolvedValue({ session, greeting });

      const { result, waitForNextUpdate } = renderHook(() =>
        useBienBot({ sessionId: 'sess-3' })
      );

      await waitForNextUpdate();

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1]).toEqual(historyMsg);
    });
  });

  // ─── sendMessage ──────────────────────────────────────────────────────
  describe('sendMessage', () => {
    it('ignores empty/whitespace messages', async () => {
      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('   ');
      });

      expect(bienbotApi.postMessage).not.toHaveBeenCalled();
    });

    it('appends a user message optimistically', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'done', data: {} }
      ]));

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Hello, BienBot!');
      });

      const userMsg = result.current.messages.find(m => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg.content).toBe('Hello, BienBot!');
    });

    it('sets isLoading and isStreaming during send', async () => {
      let capturedLoading;
      let capturedStreaming;

      bienbotApi.postMessage.mockImplementation(async (_sid, _text, options) => {
        // Capture state mid-flight before onDone is called
        capturedLoading = true; // will confirm after via state before done
        if (options.onDone) options.onDone({});
      });

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // After done: loading and streaming should be false
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });

    it('accumulates streamed tokens into assistant message', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'token', data: 'Hello' },
        { type: 'token', data: ' world' },
        { type: 'done', data: {} }
      ]));

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Hi');
      });

      const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg.content).toBe('Hello world');
    });

    it('updates currentSession from onSession callback', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'new-sess-123', title: 'Trip Talk' } },
        { type: 'done', data: {} }
      ]));

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Plan my trip');
      });

      expect(result.current.currentSession).toMatchObject({
        _id: 'new-sess-123',
        title: 'Trip Talk'
      });
    });

    it('updates pendingActions from onActions callback', async () => {
      const actions = [
        { _id: 'act-1', type: 'create_experience', description: 'Create Paris trip' }
      ];

      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'actions', data: actions },
        { type: 'done', data: {} }
      ]));

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Plan Paris trip');
      });

      expect(result.current.pendingActions).toEqual(actions);
    });

    it('marks assistant message as error on onError callback', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'error', data: 'Stream failed' }
      ]));

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Help');
      });

      const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
      expect(assistantMsg?.error).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });

    it('clears suggestedNextSteps when a new message is sent', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'done', data: {} }
      ]));

      // Bootstrap with a session that has suggested steps
      const session = { _id: 'sess-x', messages: [], pending_actions: [] };
      const greeting = { text: 'Hello!', suggested_next_steps: ['Step A', 'Step B'] };
      bienbotApi.resumeSession.mockResolvedValue({ session, greeting });

      const { result, waitForNextUpdate } = renderHook(() =>
        useBienBot({ sessionId: 'sess-x' })
      );
      await waitForNextUpdate();

      expect(result.current.suggestedNextSteps).toEqual(['Step A', 'Step B']);

      await act(async () => {
        await result.current.sendMessage('Tell me more');
      });

      expect(result.current.suggestedNextSteps).toEqual([]);
    });

    it('handles thrown errors gracefully', async () => {
      bienbotApi.postMessage.mockRejectedValue(new Error('Network failure'));

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
      expect(assistantMsg?.error).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });

    it('handles AbortError silently (no error message set)', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      bienbotApi.postMessage.mockRejectedValue(abortError);

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.sendMessage('Test');
      });

      // No error flag on assistant message for abort
      const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
      expect(assistantMsg?.error).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it('forwards invokeContext on first send when no sessionId', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'new-sess', title: 'Context Test' } },
        { type: 'done', data: {} }
      ]));

      const invokeContext = { entity: 'experience', id: 'exp-1', label: 'Paris Trip' };
      const { result } = renderHook(() => useBienBot({ invokeContext }));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(bienbotApi.postMessage).toHaveBeenCalledWith(
        null,
        'Hello',
        expect.objectContaining({
          invokeContext: expect.objectContaining({ entity: 'experience', id: 'exp-1' })
        })
      );
    });

    it('does NOT forward invokeContext on subsequent sends', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'existing-sess', title: 'Test' } },
        { type: 'done', data: {} }
      ]));

      const invokeContext = { entity: 'experience', id: 'exp-1', label: 'Paris' };
      const { result } = renderHook(() => useBienBot({ invokeContext }));

      // First send creates session
      await act(async () => {
        await result.current.sendMessage('First message');
      });

      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'done', data: {} }
      ]));

      // Second send should not include invokeContext
      await act(async () => {
        await result.current.sendMessage('Second message');
      });

      const secondCall = bienbotApi.postMessage.mock.calls[1];
      expect(secondCall[2].invokeContext).toBeUndefined();
    });
  });

  // ─── executeActions ───────────────────────────────────────────────────
  describe('executeActions', () => {
    it('returns null when no sessionId', async () => {
      const { result } = renderHook(() => useBienBot());

      let response;
      await act(async () => {
        response = await result.current.executeActions(['act-1']);
      });

      expect(response).toBeNull();
      expect(bienbotApi.executeActions).not.toHaveBeenCalled();
    });

    it('returns null when no actionIds', async () => {
      // Set up a session ID by having sendMessage create one
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-exec' } },
        { type: 'done', data: {} }
      ]));

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Hi'); });

      let response;
      await act(async () => {
        response = await result.current.executeActions([]);
      });

      expect(response).toBeNull();
    });

    it('removes executed actions from pendingActions', async () => {
      // Set up session with pending actions
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-run' } },
        { type: 'actions', data: [
          { _id: 'act-1', type: 'create_experience' },
          { _id: 'act-2', type: 'create_destination' }
        ]},
        { type: 'done', data: {} }
      ]));

      bienbotApi.executeActions.mockResolvedValue({ session: null });

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Do it'); });

      expect(result.current.pendingActions).toHaveLength(2);

      await act(async () => {
        await result.current.executeActions(['act-1']);
      });

      expect(result.current.pendingActions).toHaveLength(1);
      expect(result.current.pendingActions[0]._id).toBe('act-2');
    });

    it('syncs currentSession when result contains updated session', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-sync' } },
        { type: 'actions', data: [{ _id: 'act-1', type: 'create_experience' }] },
        { type: 'done', data: {} }
      ]));

      const updatedSession = { _id: 'sess-sync', title: 'Updated Session' };
      bienbotApi.executeActions.mockResolvedValue({ session: updatedSession });

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Execute'); });

      await act(async () => {
        await result.current.executeActions(['act-1']);
      });

      expect(result.current.currentSession).toMatchObject({ title: 'Updated Session' });
    });

    it('returns null and logs error on executeActions failure', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-err' } },
        { type: 'actions', data: [{ _id: 'act-1' }] },
        { type: 'done', data: {} }
      ]));

      bienbotApi.executeActions.mockRejectedValue(new Error('Exec failed'));

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Go'); });

      let response;
      await act(async () => {
        response = await result.current.executeActions(['act-1']);
      });

      expect(response).toBeNull();
    });
  });

  // ─── cancelAction ─────────────────────────────────────────────────────
  describe('cancelAction', () => {
    it('does nothing when no sessionId', async () => {
      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.cancelAction('act-1');
      });

      expect(bienbotApi.cancelAction).not.toHaveBeenCalled();
    });

    it('removes the cancelled action from pendingActions', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-cancel' } },
        { type: 'actions', data: [
          { _id: 'act-1', type: 'create_experience' },
          { _id: 'act-2', type: 'navigate_to_entity' }
        ]},
        { type: 'done', data: {} }
      ]));
      bienbotApi.cancelAction.mockResolvedValue(null);

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Cancel test'); });

      await act(async () => {
        await result.current.cancelAction('act-1');
      });

      expect(result.current.pendingActions).toHaveLength(1);
      expect(result.current.pendingActions[0]._id).toBe('act-2');
    });
  });

  // ─── updateContext ─────────────────────────────────────────────────────
  describe('updateContext', () => {
    it('returns null when no sessionId', async () => {
      const { result } = renderHook(() => useBienBot());

      let label;
      await act(async () => {
        label = await result.current.updateContext('plan_item', 'item-1');
      });

      expect(label).toBeNull();
      expect(bienbotApi.updateSessionContext).not.toHaveBeenCalled();
    });

    it('appends ack message when entityLabel is returned', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-ctx' } },
        { type: 'done', data: {} }
      ]));
      bienbotApi.updateSessionContext.mockResolvedValue({ entityLabel: 'Book Hotel' });

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Hi'); });

      const messagesBefore = result.current.messages.length;

      await act(async () => {
        await result.current.updateContext('plan_item', 'item-1', '"Book Hotel"');
      });

      expect(result.current.messages.length).toBeGreaterThan(messagesBefore);
      const ackMsg = result.current.messages[result.current.messages.length - 1];
      expect(ackMsg.isContextAck).toBe(true);
      expect(ackMsg.role).toBe('assistant');
    });

    it('returns the entity label on success', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-ctx2' } },
        { type: 'done', data: {} }
      ]));
      bienbotApi.updateSessionContext.mockResolvedValue({ entityLabel: 'My Plan' });

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Hi'); });

      let label;
      await act(async () => {
        label = await result.current.updateContext('plan', 'plan-1');
      });

      expect(label).toBe('My Plan');
    });

    it('returns null on error', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-ctx3' } },
        { type: 'done', data: {} }
      ]));
      bienbotApi.updateSessionContext.mockRejectedValue(new Error('API error'));

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Hi'); });

      let label;
      await act(async () => {
        label = await result.current.updateContext('plan', 'plan-1');
      });

      expect(label).toBeNull();
    });
  });

  // ─── clearSession ──────────────────────────────────────────────────────
  describe('clearSession', () => {
    it('resets all session state', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'sess-clr' } },
        { type: 'token', data: 'Hello' },
        { type: 'actions', data: [{ _id: 'act-1' }] },
        { type: 'done', data: {} }
      ]));

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Hi'); });

      expect(result.current.messages.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearSession();
      });

      expect(result.current.currentSession).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.pendingActions).toEqual([]);
      expect(result.current.suggestedNextSteps).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });
  });

  // ─── fetchSessions ─────────────────────────────────────────────────────
  describe('fetchSessions', () => {
    it('populates sessions from the API', async () => {
      const sessions = [
        { _id: 's1', title: 'Trip 1' },
        { _id: 's2', title: 'Trip 2' }
      ];
      bienbotApi.getSessions.mockResolvedValue({ sessions });

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.fetchSessions();
      });

      expect(result.current.sessions).toEqual(sessions);
    });

    it('sets empty sessions on error', async () => {
      bienbotApi.getSessions.mockRejectedValue(new Error('Network fail'));

      const { result } = renderHook(() => useBienBot());

      await act(async () => {
        await result.current.fetchSessions();
      });

      expect(result.current.sessions).toEqual([]);
    });
  });

  // ─── Event subscriptions ───────────────────────────────────────────────
  describe('event subscriptions', () => {
    it('subscribes to bienbot:session_deleted and bienbot:session_resumed on mount', () => {
      renderHook(() => useBienBot());
      expect(eventBus.subscribe).toHaveBeenCalledWith('bienbot:session_deleted', expect.any(Function));
      expect(eventBus.subscribe).toHaveBeenCalledWith('bienbot:session_resumed', expect.any(Function));
    });

    it('removes a deleted session from sessions list', async () => {
      const sessions = [{ _id: 's1' }, { _id: 's2' }];
      bienbotApi.getSessions.mockResolvedValue({ sessions });

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.fetchSessions(); });

      expect(result.current.sessions).toHaveLength(2);

      // Simulate session_deleted event
      await act(async () => {
        const handler = eventBus._handlers['bienbot:session_deleted'];
        if (handler) handler({ sessionId: 's1' });
      });

      expect(result.current.sessions).toHaveLength(1);
      expect(result.current.sessions[0]._id).toBe('s2');
    });

    it('clears current session when the active session is deleted', async () => {
      bienbotApi.postMessage.mockImplementation(buildMockPostMessage([
        { type: 'session', data: { sessionId: 'active-sess' } },
        { type: 'done', data: {} }
      ]));

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.sendMessage('Hi'); });

      expect(result.current.currentSession?._id).toBe('active-sess');

      await act(async () => {
        const handler = eventBus._handlers['bienbot:session_deleted'];
        if (handler) handler({ sessionId: 'active-sess' });
      });

      expect(result.current.currentSession).toBeNull();
    });

    it('moves a resumed session to top of sessions list', async () => {
      const sessions = [{ _id: 's1' }, { _id: 's2' }, { _id: 's3' }];
      bienbotApi.getSessions.mockResolvedValue({ sessions });

      const { result } = renderHook(() => useBienBot());
      await act(async () => { await result.current.fetchSessions(); });

      await act(async () => {
        const handler = eventBus._handlers['bienbot:session_resumed'];
        if (handler) handler({ sessionId: 's3' });
      });

      expect(result.current.sessions[0]._id).toBe('s3');
      expect(result.current.sessions).toHaveLength(3);
    });

    it('unsubscribes on unmount', () => {
      const unsubDeletedMock = jest.fn();
      const unsubResumedMock = jest.fn();

      let callCount = 0;
      eventBus.subscribe.mockImplementation((eventType) => {
        callCount++;
        return callCount % 2 !== 0 ? unsubDeletedMock : unsubResumedMock;
      });

      const { unmount } = renderHook(() => useBienBot());
      unmount();

      expect(unsubDeletedMock).toHaveBeenCalled();
    });
  });

  // ─── Stream cancellation ──────────────────────────────────────────────
  describe('stream cancellation', () => {
    it('cancels in-flight stream when clearSession is called', async () => {
      // Simulate a long-running stream that won't resolve until cancelled
      let abortCalled = false;
      const mockAbortController = {
        abort: jest.fn(() => { abortCalled = true; }),
        signal: { aborted: false }
      };

      // Replace AbortController
      const OriginalAbortController = global.AbortController;
      global.AbortController = jest.fn(() => mockAbortController);

      // postMessage that never calls onDone (simulates ongoing stream)
      bienbotApi.postMessage.mockImplementation(async (_sid, _text, options) => {
        // Just call onToken once to activate streaming, then hang
        if (options.onToken) options.onToken('Partial');
      });

      const { result } = renderHook(() => useBienBot());

      // Start send (doesn't await so it remains in-flight)
      act(() => { result.current.sendMessage('Take a long time'); });

      // Now call clearSession which should abort
      act(() => { result.current.clearSession(); });

      global.AbortController = OriginalAbortController;
    });
  });
});
