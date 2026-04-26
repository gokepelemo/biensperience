/**
 * Tests for bienbot-api SSE parser tool_call_* event handling.
 *
 * Verifies that the SSE event switch in postMessage() dispatches:
 *   - event: tool_call_start  → onToolCallStart(eventData)
 *   - event: tool_call_end    → onToolCallEnd(eventData)
 *
 * These events are emitted by the backend tool-use loop (T5/T6) and surface
 * tool execution to the UI via pill components.
 *
 * Lives under tests/hooks/ so the frontend jest config picks it up
 * (`testMatch` only matches hooks/machines/components/views).
 */

// Stub the auth/session helpers that buildAuthHeaders/postMessage use,
// so the SSE flow runs without trying to read real tokens or fetch CSRF.
jest.mock('../../src/utilities/users-service.js', () => ({
  getToken: jest.fn(() => null)
}));
jest.mock('../../src/utilities/encoding-utils', () => ({
  parseJwtPayload: jest.fn(() => ({ user: { _id: 'u1' } }))
}));
jest.mock('../../src/utilities/session-utils.js', () => ({
  getSessionId: jest.fn(() => null),
  refreshSessionIfNeeded: jest.fn(async () => ({ sessionId: null }))
}));
jest.mock('../../src/utilities/trace-utils.js', () => ({
  generateTraceId: jest.fn(() => 'trace-test')
}));
// Silence the broadcastEvent post-stream emission so it doesn't pull in
// the real event bus (which touches localStorage etc).
jest.mock('../../src/utilities/event-bus', () => ({
  broadcastEvent: jest.fn()
}));

// jsdom (Jest 27) doesn't expose ReadableStream as a global. Bridge the Node
// implementation in via stream/web so the SSE parser can call .getReader().
if (typeof global.ReadableStream === 'undefined') {
  // eslint-disable-next-line global-require
  global.ReadableStream = require('stream/web').ReadableStream;
}

const { postMessage } = require('../../src/utilities/bienbot-api');

/**
 * Build a mock fetch Response whose body is a ReadableStream emitting the
 * provided SSE chunks in sequence.
 */
function makeSSEResponse(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i++;
    }
  });
  return {
    ok: true,
    status: 200,
    body: stream
  };
}

describe('bienbot-api SSE parser — tool_call events', () => {
  beforeEach(() => {
    // Stub global fetch. Routes:
    //   /api/auth/csrf-token → simple JSON
    //   /api/bienbot/chat    → SSE stream with tool_call_* events
    global.fetch = jest.fn(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/csrf-token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ csrfToken: 'csrf-test' })
        };
      }
      // Otherwise: return the SSE stream configured per test via fetch.mockImplementationOnce
      throw new Error(`Unexpected fetch call: ${url}`);
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('dispatches tool_call_start and tool_call_end to handlers', async () => {
    const sseChunks = [
      'event: tool_call_start\ndata: {"call_id":"c1","type":"fetch_plan_items","label":"Fetching plan items"}\n\n',
      'event: tool_call_end\ndata: {"call_id":"c1","ok":true}\n\n',
      'event: done\ndata: {}\n\n'
    ];

    // Re-route /api/bienbot/chat to our SSE response
    global.fetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/csrf-token')) {
        return { ok: true, status: 200, json: async () => ({ csrfToken: 'c' }) };
      }
      return makeSSEResponse(sseChunks);
    });

    const onToolCallStart = jest.fn();
    const onToolCallEnd = jest.fn();
    const onDone = jest.fn();

    await postMessage('sess-1', 'hello', {
      onToolCallStart,
      onToolCallEnd,
      onDone
    });

    expect(onToolCallStart).toHaveBeenCalledTimes(1);
    expect(onToolCallStart).toHaveBeenCalledWith({
      call_id: 'c1',
      type: 'fetch_plan_items',
      label: 'Fetching plan items'
    });

    expect(onToolCallEnd).toHaveBeenCalledTimes(1);
    expect(onToolCallEnd).toHaveBeenCalledWith({ call_id: 'c1', ok: true });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does not throw when handlers are omitted', async () => {
    const sseChunks = [
      'event: tool_call_start\ndata: {"call_id":"c2","type":"fetch_plan_costs"}\n\n',
      'event: tool_call_end\ndata: {"call_id":"c2","ok":false}\n\n',
      'event: done\ndata: {}\n\n'
    ];

    global.fetch.mockImplementation(async (url) => {
      if (typeof url === 'string' && url.includes('/api/auth/csrf-token')) {
        return { ok: true, status: 200, json: async () => ({ csrfToken: 'c' }) };
      }
      return makeSSEResponse(sseChunks);
    });

    // No tool_call handlers passed — must not throw.
    await expect(
      postMessage('sess-2', 'hi', { onDone: jest.fn() })
    ).resolves.toBeUndefined();
  });
});
