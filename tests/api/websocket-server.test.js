/**
 * WebSocket Server Integration Tests
 *
 * Covers the auth, rate-limit, message-size, and connection-cap contracts
 * enforced by utilities/websocket-server.js.
 *
 * The WS server contract (see utilities/websocket-server.js):
 *  - No token              -> close(4001, 'Unauthorized')
 *  - Invalid token         -> close(4001, 'Unauthorized')
 *  - Valid token           -> connection accepted, sends 'system:connected' welcome
 *  - >100 msgs / 60s       -> sends an 'error' frame with code RATE_LIMIT_EXCEEDED
 *                             (does NOT close the socket)
 *  - Message > 64KB        -> sends an 'error' frame with code MESSAGE_TOO_LARGE
 *                             (does NOT close the socket)
 *  - 6th conn for one user -> sends 'error' frame, then close(4003, 'Connection limit exceeded')
 */

const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const SECRET = process.env.SECRET || process.env.JWT_SECRET || 'test-secret';

// Force the SECRET env so the WS server can sign-verify with the same key
process.env.SECRET = SECRET;

const { createWebSocketServer } = require('../../utilities/websocket-server');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUserId() {
  return new mongoose.Types.ObjectId().toString();
}

function signToken(userId) {
  return jwt.sign({ user: { _id: userId } }, SECRET, { expiresIn: '1h' });
}

/**
 * Open a websocket connection. Returns a Promise that resolves with the ws
 * once it has either opened OR closed (whichever comes first).
 *
 * Buffers ALL inbound messages on `ws._buffered` from the moment the socket
 * is created — this prevents losing the server's welcome 'system:connected'
 * frame if it arrives before the caller can attach `waitForFrame`. The
 * helper `waitForFrame` consumes the buffer first.
 *
 * Rationale: a server-rejected connection may close before 'open' ever fires,
 * so we resolve on either event and let the caller inspect ws.readyState.
 */
function openWs(url, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws._buffered = [];
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (_) { msg = raw.toString(); }
      ws._buffered.push(msg);
      // Notify any pending waitForFrame consumers.
      if (ws._onFrameBuffered) ws._onFrameBuffered();
    });

    const timer = setTimeout(() => {
      try { ws.terminate(); } catch (_) {}
      reject(new Error(`openWs timed out after ${timeoutMs}ms (${url})`));
    }, timeoutMs);

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ws);
    };

    ws.once('open', settle);
    ws.once('close', settle);
    ws.once('error', () => {
      // Don't reject; ws will follow up with 'close'. Just wait for that.
    });
  });
}

/**
 * Wait for the next 'close' event on a ws and resolve with { code, reason }.
 * If the ws is already closed, resolves immediately.
 */
function waitForClose(ws, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.CLOSED) {
      return resolve({ code: ws._closeCode, reason: ws._closeReason });
    }
    const timer = setTimeout(
      () => reject(new Error(`waitForClose timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
    ws.once('close', (code, reasonBuf) => {
      clearTimeout(timer);
      resolve({ code, reason: reasonBuf?.toString?.() ?? '' });
    });
  });
}

/**
 * Wait for the next inbound message that satisfies `predicate`.
 * First drains the buffer populated by openWs(); if no buffered frame
 * matches, waits for new ones. Returns the parsed JSON message.
 */
function waitForFrame(ws, predicate, { timeoutMs = 5000 } = {}) {
  // First, scan whatever is already buffered.
  if (Array.isArray(ws._buffered)) {
    for (let i = 0; i < ws._buffered.length; i++) {
      const m = ws._buffered[i];
      if (predicate(m)) {
        ws._buffered.splice(i, 1);
        return Promise.resolve(m);
      }
    }
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws._onFrameBuffered = null;
      reject(new Error(`waitForFrame timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    ws._onFrameBuffered = () => {
      while (ws._buffered.length > 0) {
        const m = ws._buffered.shift();
        if (predicate(m)) {
          clearTimeout(timer);
          ws._onFrameBuffered = null;
          resolve(m);
          return;
        }
      }
    };
  });
}

/**
 * Open a ws and wait for the welcome 'system:connected' frame.
 * Resolves with the ws.
 */
async function openAndAwaitConnected(url, opts = {}) {
  const ws = await openWs(url, opts);
  if (ws.readyState !== WebSocket.OPEN) {
    throw new Error(`expected OPEN, got readyState=${ws.readyState}`);
  }
  await waitForFrame(ws, (m) => m && m.type === 'system:connected', opts);
  return ws;
}

function safeClose(ws) {
  if (!ws) return;
  try {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  } catch (_) {}
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('WebSocket server: auth, rate-limit, message-size, conn-cap', () => {
  let server;
  let wss;
  let baseUrl;
  let openSockets;

  beforeAll((done) => {
    server = http.createServer();
    wss = createWebSocketServer(server, { path: '/ws' });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      baseUrl = `ws://127.0.0.1:${port}/ws`;
      done();
    });
  });

  afterAll((done) => {
    try { wss.close(); } catch (_) {}
    server.close(() => done());
  });

  beforeEach(() => {
    openSockets = [];
  });

  afterEach(() => {
    for (const ws of openSockets) safeClose(ws);
    openSockets = [];
  });

  // --- 1. Auth: no token --------------------------------------------------
  it('rejects connections with no token (close 4001)', async () => {
    const ws = await openWs(baseUrl);
    openSockets.push(ws);
    const { code } = await waitForClose(ws);
    expect(code).toBe(4001);
  });

  // --- 2. Auth: invalid token --------------------------------------------
  it('rejects connections with invalid token (close 4001)', async () => {
    const ws = await openWs(`${baseUrl}?token=not-a-real-jwt`);
    openSockets.push(ws);
    const { code } = await waitForClose(ws);
    expect(code).toBe(4001);
  });

  // --- 3. Auth: valid token ----------------------------------------------
  it('accepts connections with valid token and sends system:connected', async () => {
    const userId = makeUserId();
    const token = signToken(userId);
    const ws = await openAndAwaitConnected(`${baseUrl}?token=${token}&sessionId=s1`);
    openSockets.push(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  // --- 4. Rate limit: 100 msg / 60s --------------------------------------
  it('enforces rate limit (>100 messages per window) with RATE_LIMIT_EXCEEDED error frame',
    async () => {
      const userId = makeUserId();
      const token = signToken(userId);
      const ws = await openAndAwaitConnected(`${baseUrl}?token=${token}&sessionId=rl`);
      openSockets.push(ws);

      // Send 100 well-formed messages. Each has a missing roomId so handler
      // returns an error frame back; that's fine for rate accounting.
      // We use unknown 'noop' type; it falls into the default branch which
      // requires a payload, so we include one.
      // Note: the server only counts messages against the rate limit; it
      // does NOT close on rate-limit, it sends an error frame.
      const sendOne = (i) => ws.send(JSON.stringify({
        type: 'event:broadcast',
        payload: { roomId: `plan:${i}`, foo: 'bar' }
      }));

      for (let i = 0; i < 100; i++) sendOne(i);

      // Now send the 101st and wait for the rate-limit error frame.
      const ratePromise = waitForFrame(
        ws,
        (m) => m && m.type === 'error' && m.payload && m.payload.code === 'RATE_LIMIT_EXCEEDED',
        { timeoutMs: 10000 }
      );
      sendOne(100);

      const errFrame = await ratePromise;
      expect(errFrame.payload.code).toBe('RATE_LIMIT_EXCEEDED');
      // Socket should still be open after rate-limit (server does NOT close).
      expect(ws.readyState).toBe(WebSocket.OPEN);
    },
    20000
  );

  // --- 5. Message size cap: 64KB -----------------------------------------
  it('rejects messages over 64KB with MESSAGE_TOO_LARGE error frame',
    async () => {
      const userId = makeUserId();
      const token = signToken(userId);
      const ws = await openAndAwaitConnected(`${baseUrl}?token=${token}&sessionId=sz`);
      openSockets.push(ws);

      // Build a 65KB string payload.
      const big = 'a'.repeat(65 * 1024);
      const oversized = JSON.stringify({
        type: 'event:broadcast',
        payload: { roomId: 'plan:test', big }
      });
      expect(Buffer.byteLength(oversized)).toBeGreaterThan(64 * 1024);

      const sizePromise = waitForFrame(
        ws,
        (m) => m && m.type === 'error' && m.payload && m.payload.code === 'MESSAGE_TOO_LARGE',
        { timeoutMs: 5000 }
      );
      ws.send(oversized);

      const errFrame = await sizePromise;
      expect(errFrame.payload.code).toBe('MESSAGE_TOO_LARGE');
      // Server does NOT close the socket on size violation.
      expect(ws.readyState).toBe(WebSocket.OPEN);
    },
    10000
  );

  // --- 6. Connection cap: 5 per user, 6th rejected -----------------------
  it('enforces 5-connections-per-user cap (6th closes with 4003)',
    async () => {
      const userId = makeUserId();
      const token = signToken(userId);

      // Open 5 valid connections; each must reach OPEN + welcome.
      const conns = [];
      for (let i = 0; i < 5; i++) {
        const ws = await openAndAwaitConnected(`${baseUrl}?token=${token}&sessionId=c${i}`);
        conns.push(ws);
        openSockets.push(ws);
      }

      // Open the 6th. The server accepts the TCP/WS handshake then immediately
      // sends an error frame and closes with code 4003.
      const ws6 = await openWs(`${baseUrl}?token=${token}&sessionId=c5`);
      openSockets.push(ws6);

      const { code } = await waitForClose(ws6, { timeoutMs: 5000 });
      expect(code).toBe(4003);

      // Sanity: the original 5 are still open.
      for (const c of conns) {
        expect(c.readyState).toBe(WebSocket.OPEN);
      }
    },
    15000
  );
});
