/**
 * Unit tests for AI controller input sanitization.
 *
 * Tests the validation logic in controllers/api/ai.js without requiring a running
 * server. All handlers are called with mock req/res objects.
 *
 * Coverage:
 * - generateTips: count clamping, category/destination truncation
 * - autocomplete, improve, translate, summarize: 50,000-char text length guard
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before the controller is required
// ---------------------------------------------------------------------------

jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../utilities/lang.constants', () => ({
  lang: {
    current: {
      prompts: {}
    }
  }
}));

jest.mock('../../utilities/ai-gateway', () => ({
  executeAIRequest: jest.fn(),
  GatewayError: class GatewayError extends Error {
    constructor(message, code, statusCode) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  }
}));

jest.mock('../../utilities/ai-provider-registry', () => ({
  getApiKeyForProvider: jest.fn(() => 'test-key')
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { executeAIRequest } = require('../../utilities/ai-gateway');
const controller = require('../../controllers/api/ai');

/** Build a minimal mock response object */
function mockRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    }
  };
  return res;
}

/** Build a minimal mock request object */
function mockReq(body = {}) {
  return {
    body,
    user: { _id: 'user_test_id' }
  };
}

/** Stub executeAIRequest to return a minimal successful result */
function stubSuccess() {
  executeAIRequest.mockResolvedValue({
    content: 'AI response',
    provider: 'openai',
    model: 'gpt-4o-mini',
    usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 }
  });
}

// ---------------------------------------------------------------------------
// generateTips — count sanitization
// ---------------------------------------------------------------------------

describe('generateTips — count sanitization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('uses default count 5 when count is a non-numeric string', async () => {
    const req = mockReq({ destination: 'Paris', count: 'hello' });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const userMsg = executeAIRequest.mock.calls[0][0].messages[1].content;
    expect(userMsg).toMatch(/^Generate 5 /);
  });

  it('clamps count to 20 when count exceeds max', async () => {
    const req = mockReq({ destination: 'Paris', count: 999 });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const userMsg = executeAIRequest.mock.calls[0][0].messages[1].content;
    expect(userMsg).toMatch(/^Generate 20 /);
  });

  it('clamps count to 1 when count is negative', async () => {
    const req = mockReq({ destination: 'Paris', count: -1 });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const userMsg = executeAIRequest.mock.calls[0][0].messages[1].content;
    expect(userMsg).toMatch(/^Generate 1 /);
  });

  it('passes through valid count within range', async () => {
    const req = mockReq({ destination: 'Paris', count: 10 });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const userMsg = executeAIRequest.mock.calls[0][0].messages[1].content;
    expect(userMsg).toMatch(/^Generate 10 /);
  });

  it('uses default count 5 when count is 0', async () => {
    const req = mockReq({ destination: 'Paris', count: 0 });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const userMsg = executeAIRequest.mock.calls[0][0].messages[1].content;
    // parseInt('0') || 5 → 5 (since 0 is falsy)
    expect(userMsg).toMatch(/^Generate 5 /);
  });
});

// ---------------------------------------------------------------------------
// generateTips — category / destination truncation
// ---------------------------------------------------------------------------

describe('generateTips — category and destination truncation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('truncates destination silently when over 200 chars', async () => {
    const longDest = 'x'.repeat(201);
    const req = mockReq({ destination: longDest });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    // Response destination field should be truncated
    expect(res._body.data.destination).toHaveLength(200);
    // The prompt should use the truncated destination
    const userMsg = executeAIRequest.mock.calls[0][0].messages[1].content;
    expect(userMsg).toContain('x'.repeat(200));
    expect(userMsg).not.toContain('x'.repeat(201));
  });

  it('passes destination of exactly 200 chars without truncation', async () => {
    const dest = 'a'.repeat(200);
    const req = mockReq({ destination: dest });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.destination).toHaveLength(200);
  });

  it('truncates category silently when over 200 chars', async () => {
    const longCat = 'c'.repeat(201);
    const req = mockReq({ destination: 'Paris', category: longCat });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.category).toHaveLength(200);
  });

  it('passes category of exactly 200 chars without truncation', async () => {
    const cat = 'b'.repeat(200);
    const req = mockReq({ destination: 'Paris', category: cat });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.category).toHaveLength(200);
  });
});

// ---------------------------------------------------------------------------
// Text length guard — 50,000 character limit
// ---------------------------------------------------------------------------

describe('autocomplete — text length guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('rejects text over 50,000 chars with HTTP 400', async () => {
    const req = mockReq({ text: 'x'.repeat(50001) });
    const res = mockRes();
    await controller.autocomplete(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ success: false, error: 'Text exceeds maximum length' });
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  it('allows text of exactly 50,000 chars', async () => {
    const req = mockReq({ text: 'x'.repeat(50000) });
    const res = mockRes();
    await controller.autocomplete(req, res);

    expect(res._status).toBe(200);
    expect(executeAIRequest).toHaveBeenCalled();
  });
});

describe('improve — text length guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('rejects text over 50,000 chars with HTTP 400', async () => {
    const req = mockReq({ text: 'x'.repeat(50001) });
    const res = mockRes();
    await controller.improve(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ success: false, error: 'Text exceeds maximum length' });
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  it('allows text of exactly 50,000 chars', async () => {
    const req = mockReq({ text: 'x'.repeat(50000) });
    const res = mockRes();
    await controller.improve(req, res);

    expect(res._status).toBe(200);
    expect(executeAIRequest).toHaveBeenCalled();
  });
});

describe('translate — text length guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('rejects text over 50,000 chars with HTTP 400', async () => {
    const req = mockReq({ text: 'x'.repeat(50001), targetLanguage: 'French' });
    const res = mockRes();
    await controller.translate(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ success: false, error: 'Text exceeds maximum length' });
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  it('allows text of exactly 50,000 chars', async () => {
    const req = mockReq({ text: 'x'.repeat(50000), targetLanguage: 'French' });
    const res = mockRes();
    await controller.translate(req, res);

    expect(res._status).toBe(200);
    expect(executeAIRequest).toHaveBeenCalled();
  });
});

describe('summarize — text length guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('rejects text over 50,000 chars with HTTP 400', async () => {
    const req = mockReq({ text: 'x'.repeat(50001) });
    const res = mockRes();
    await controller.summarize(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ success: false, error: 'Text exceeds maximum length' });
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  it('allows text of exactly 50,000 chars', async () => {
    const req = mockReq({ text: 'x'.repeat(50000) });
    const res = mockRes();
    await controller.summarize(req, res);

    expect(res._status).toBe(200);
    expect(executeAIRequest).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// generateTips — text length guard (destination field)
// ---------------------------------------------------------------------------

describe('generateTips — destination missing returns 400', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('returns 400 when destination is missing', async () => {
    const req = mockReq({});
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ success: false, error: 'Destination is required' });
  });
});

// ---------------------------------------------------------------------------
// Provider/Model forwarding — all handlers
// ---------------------------------------------------------------------------

describe('improve — forwards provider and model options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('forwards provider and model when provided', async () => {
    const req = mockReq({
      text: 'Hello world',
      options: {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        temperature: 0.5
      }
    });
    const res = mockRes();
    await controller.improve(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBe('anthropic');
    expect(callArgs.options.model).toBe('claude-3-haiku-20240307');
  });

  it('forwards undefined provider/model when not provided', async () => {
    const req = mockReq({ text: 'Hello world' });
    const res = mockRes();
    await controller.improve(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBeUndefined();
    expect(callArgs.options.model).toBeUndefined();
  });

  it('preserves task-specific parameters alongside provider/model', async () => {
    const req = mockReq({
      text: 'Hello world',
      options: { provider: 'mistral', model: 'mistral-small-latest' }
    });
    const res = mockRes();
    await controller.improve(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.temperature).toBe(0.7);
    expect(callArgs.options.maxTokens).toBe(500);
    expect(callArgs.options.provider).toBe('mistral');
  });
});

describe('translate — forwards provider and model options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('forwards provider and model when provided', async () => {
    const req = mockReq({
      text: 'Hello',
      targetLanguage: 'French',
      options: {
        provider: 'gemini',
        model: 'gemini-1.5-flash'
      }
    });
    const res = mockRes();
    await controller.translate(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBe('gemini');
    expect(callArgs.options.model).toBe('gemini-1.5-flash');
  });

  it('forwards undefined provider/model when not provided', async () => {
    const req = mockReq({
      text: 'Hello',
      targetLanguage: 'Spanish'
    });
    const res = mockRes();
    await controller.translate(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBeUndefined();
    expect(callArgs.options.model).toBeUndefined();
  });

  it('preserves task-specific parameters alongside provider/model', async () => {
    const req = mockReq({
      text: 'Hello',
      targetLanguage: 'German',
      options: { provider: 'openai', model: 'gpt-4o-mini' }
    });
    const res = mockRes();
    await controller.translate(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.temperature).toBe(0.3);
    expect(callArgs.options.maxTokens).toBe(1000);
    expect(callArgs.options.provider).toBe('openai');
  });
});

describe('summarize — forwards provider and model options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('forwards provider and model when provided', async () => {
    const req = mockReq({
      text: 'A long text here',
      options: {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307'
      }
    });
    const res = mockRes();
    await controller.summarize(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBe('anthropic');
    expect(callArgs.options.model).toBe('claude-3-haiku-20240307');
  });

  it('forwards undefined provider/model when not provided', async () => {
    const req = mockReq({ text: 'A long text here' });
    const res = mockRes();
    await controller.summarize(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBeUndefined();
    expect(callArgs.options.model).toBeUndefined();
  });

  it('preserves task-specific parameters alongside provider/model', async () => {
    const req = mockReq({
      text: 'A long text here',
      maxLength: 150,
      options: { provider: 'mistral', model: 'mistral-small-latest' }
    });
    const res = mockRes();
    await controller.summarize(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.temperature).toBe(0.5);
    // maxTokens calculated from maxLength: Math.min(150 * 2, 500) = 300
    expect(callArgs.options.maxTokens).toBe(300);
    expect(callArgs.options.provider).toBe('mistral');
  });
});

describe('generateTips — forwards provider and model options', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stubSuccess();
  });

  it('forwards provider and model when provided', async () => {
    const req = mockReq({
      destination: 'Paris',
      options: {
        provider: 'gemini',
        model: 'gemini-1.5-flash'
      }
    });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBe('gemini');
    expect(callArgs.options.model).toBe('gemini-1.5-flash');
  });

  it('forwards undefined provider/model when not provided', async () => {
    const req = mockReq({ destination: 'Tokyo' });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.provider).toBeUndefined();
    expect(callArgs.options.model).toBeUndefined();
  });

  it('preserves task-specific parameters alongside provider/model', async () => {
    const req = mockReq({
      destination: 'Barcelona',
      category: 'budget travel',
      count: 8,
      options: { provider: 'openai', model: 'gpt-4o-mini' }
    });
    const res = mockRes();
    await controller.generateTips(req, res);

    expect(res._status).toBe(200);
    const callArgs = executeAIRequest.mock.calls[0][0];
    expect(callArgs.options.temperature).toBe(0.8);
    expect(callArgs.options.maxTokens).toBe(800);
    expect(callArgs.options.provider).toBe('openai');
  });
});
