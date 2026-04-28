/**
 * Tool-use loop tests.
 *
 * - Unit tests for `executeToolCallLoop` (injected `executeAction`).
 * - Integration tests for the chat endpoint that scripts the AI mock to return
 *   `tool_calls` on the first call and a final answer on the second.
 */

const request = require('supertest');

// ---- Mock AI layer (must be before app require) ----------------------------
// Default response is a benign JSON body. Individual tests override per-call
// with `mockResolvedValueOnce` to script the first/second LLM responses.
jest.mock('../../controllers/api/ai', () => ({
  callProvider: jest.fn().mockResolvedValue({
    content: JSON.stringify({ message: 'Default reply.', pending_actions: [] }),
    usage: { prompt_tokens: 10, completion_tokens: 10 }
  }),
  getApiKey: jest.fn().mockReturnValue('test-api-key'),
  getProviderForTask: jest.fn().mockReturnValue('openai'),
  AI_PROVIDERS: { OPENAI: 'openai' },
  AI_TASKS: { GENERAL: 'general', FAST: 'fast', BIENBOT_ANALYZE: 'bienbot_analyze' },
  status: jest.fn((req, res) => res.json({ success: true, available: true })),
  complete: jest.fn((req, res) => res.json({ success: true })),
  autocomplete: jest.fn((req, res) => res.json({ success: true })),
  improve: jest.fn((req, res) => res.json({ success: true })),
  editLanguage: jest.fn((req, res) => res.json({ success: true })),
  translate: jest.fn((req, res) => res.json({ success: true })),
  summarize: jest.fn((req, res) => res.json({ success: true })),
  generateTips: jest.fn((req, res) => res.json({ success: true }))
}));

// ---- Mock intent classifier -------------------------------------------------
jest.mock('../../utilities/bienbot-intent-classifier', () => ({
  classifyIntent: jest.fn().mockResolvedValue({
    intent: 'ANSWER_QUESTION',
    entities: {
      destination_name: null,
      experience_name: null,
      user_email: null,
      plan_item_texts: []
    },
    confidence: 0.9
  })
}));

// ---- Mock context builders --------------------------------------------------
jest.mock('../../utilities/bienbot-context-builders', () => {
  const actual = jest.requireActual('../../utilities/bienbot-context-builders');
  const mocked = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === 'function' ? jest.fn().mockResolvedValue(null) : value;
  }
  mocked.buildContextForInvokeContext = jest.fn().mockResolvedValue(null);
  return mocked;
});

// ---- Mock action executor ---------------------------------------------------
// We override executeAction per-test for the integration block. The default
// returns success with a small body so any unscripted tool call still works.
jest.mock('../../utilities/bienbot-action-executor', () => ({
  ALLOWED_ACTION_TYPES: [
    'create_destination', 'create_experience', 'create_plan',
    'add_plan_items', 'update_plan_item', 'invite_collaborator', 'sync_plan',
    'suggest_plan_items', 'fetch_entity_photos', 'fetch_destination_tips',
    'discover_content', 'fetch_plan_items'
  ],
  READ_ONLY_ACTION_TYPES: new Set([
    'suggest_plan_items', 'fetch_entity_photos', 'fetch_destination_tips',
    'discover_content', 'fetch_plan_items'
  ]),
  TOOL_CALL_ACTION_TYPES: new Set(['fetch_plan_items']),
  executeAction: jest.fn().mockResolvedValue({
    success: true,
    result: { statusCode: 200, body: { items: [], total: 0, returned: 0 } },
    errors: []
  }),
  executeActions: jest.fn().mockResolvedValue({ results: [], errors: [] }),
  executeSingleWorkflowStep: jest.fn().mockResolvedValue({ success: true, result: null, errors: [] })
}));

// ---- Mock session summarizer ------------------------------------------------
jest.mock('../../utilities/bienbot-session-summarizer', () => ({
  summarizeSession: jest.fn().mockResolvedValue({
    summary: '', next_steps: []
  })
}));

const { _executeToolCallLoopForTest } = require('../../controllers/api/bienbot');

describe('executeToolCallLoop', () => {
  const fakeUser = { _id: 'user-1' };

  it('executes a single fetch and returns its formatted result', async () => {
    const fakeExecuteAction = jest.fn().mockResolvedValue({
      success: true,
      result: { statusCode: 200, body: { items: [{ _id: 'i1', content: 'A' }], total: 1, returned: 1 } }
    });

    const out = await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser,
      session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(),
      onCallEnd: jest.fn()
    });

    expect(fakeExecuteAction).toHaveBeenCalledTimes(1);
    expect(out.toolResultsBlock).toContain('fetch_plan_items');
    expect(out.toolResultsBlock).toContain('"items"');
    expect(out.calls).toHaveLength(1);
    expect(out.calls[0].ok).toBe(true);
  });

  it('runs multiple fetches in parallel', async () => {
    const order = [];
    const fakeExecuteAction = jest.fn().mockImplementation(async (action) => {
      order.push(`start-${action.type}`);
      await new Promise(r => setTimeout(r, 20));
      order.push(`end-${action.type}`);
      return { success: true, result: { statusCode: 200, body: { ok: true } } };
    });

    await _executeToolCallLoopForTest({
      toolCalls: [
        { type: 'fetch_plan_items', payload: { plan_id: 'p1' } },
        { type: 'fetch_plan_items', payload: { plan_id: 'p2' } }
      ],
      user: fakeUser,
      session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(),
      onCallEnd: jest.fn()
    });

    expect(order.slice(0, 2)).toEqual(['start-fetch_plan_items', 'start-fetch_plan_items']);
  });

  it('formats failed fetches as { ok: false, error }', async () => {
    const fakeExecuteAction = jest.fn().mockResolvedValue({
      success: false,
      result: { statusCode: 403, body: { ok: false, error: 'not_authorized' } }
    });

    const out = await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser, session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(), onCallEnd: jest.fn()
    });

    expect(out.toolResultsBlock).toContain('"ok":false');
    expect(out.toolResultsBlock).toContain('not_authorized');
    expect(out.calls[0].ok).toBe(false);
  });

  it('treats thrown handler errors as fetch_failed', async () => {
    const fakeExecuteAction = jest.fn().mockRejectedValue(new Error('boom'));
    const out = await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser, session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(), onCallEnd: jest.fn()
    });
    expect(out.toolResultsBlock).toContain('fetch_failed');
    expect(out.calls[0].ok).toBe(false);
  });

  it('emits onCallStart before and onCallEnd after each call', async () => {
    const onCallStart = jest.fn();
    const onCallEnd = jest.fn();
    const fakeExecuteAction = jest.fn().mockResolvedValue({
      success: true, result: { statusCode: 200, body: { ok: true } }
    });

    await _executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: fakeUser, session: {},
      executeAction: fakeExecuteAction, onCallStart, onCallEnd
    });

    expect(onCallStart).toHaveBeenCalledWith(expect.objectContaining({
      type: 'fetch_plan_items', label: 'Fetching plan items…'
    }));
    expect(onCallEnd).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it('aborts in-flight fetches when signal is triggered', async () => {
    const controller = new AbortController();
    const fakeExecuteAction = jest.fn().mockImplementation(async () => {
      await new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(new Error('AbortError')));
      });
    });

    setTimeout(() => controller.abort(), 10);

    await expect(_executeToolCallLoopForTest({
      toolCalls: [{ type: 'fetch_plan_items', payload: { plan_id: 'p1' } }],
      user: { _id: 'u' }, session: {},
      executeAction: fakeExecuteAction,
      onCallStart: jest.fn(), onCallEnd: jest.fn(),
      signal: controller.signal
    })).rejects.toThrow(/abort/i);
  });
});

// ---------------------------------------------------------------------------
// Integration: tool-use loop wired into POST /api/bienbot/chat
// ---------------------------------------------------------------------------

const app = require('../../app');
const BienBotSession = require('../../models/bienbot-session');
const {
  createTestUser,
  createTestDestination,
  createTestExperience,
  createTestPlan,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const dbSetup = require('../setup/testSetup');

async function createAIUser(overrides = {}) {
  return createTestUser({
    name: 'Tool Loop User',
    email: `toolloop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`,
    emailConfirmed: true,
    role: 'super_admin',
    feature_flags: [
      { flag: 'ai_features', enabled: true, granted_at: new Date(), granted_by: null }
    ],
    ...overrides
  });
}

function parseSSEEvents(text) {
  const events = [];
  const blocks = text.split(/\n\n/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let data = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      if (line.startsWith('data: ')) {
        try { data = JSON.parse(line.slice(6)); } catch { data = line.slice(6); }
      }
    }
    if (data !== null) events.push({ event, data });
  }
  return events;
}

describe('POST /api/bienbot/chat — tool-use loop integration', () => {
  let user, authToken, destination, experience, plan;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  beforeEach(async () => {
    await clearTestData();
    await BienBotSession.deleteMany({});

    user = await createAIUser();
    authToken = generateAuthToken(user);

    destination = await createTestDestination(user, { name: 'Tool City', country: 'Tool Country' });
    experience = await createTestExperience(user, destination, { name: 'Tool Experience' });
    plan = await createTestPlan(user, experience);

    // Reset AI mock between tests so per-test scripting is isolated.
    const { callProvider } = require('../../controllers/api/ai');
    callProvider.mockReset();
    callProvider.mockResolvedValue({
      content: JSON.stringify({ message: 'Default reply.', pending_actions: [] }),
      usage: { prompt_tokens: 10, completion_tokens: 10 }
    });

    const { executeAction } = require('../../utilities/bienbot-action-executor');
    executeAction.mockReset();
    executeAction.mockResolvedValue({
      success: true,
      result: { statusCode: 200, body: { items: [], total: 0, returned: 0 } },
      errors: []
    });
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  it('executes tool_calls then re-prompts with [TOOL RESULTS] and uses the second response', async () => {
    const { callProvider } = require('../../controllers/api/ai');
    const { executeAction } = require('../../utilities/bienbot-action-executor');

    // First LLM response → asks for a tool call. Second → final natural answer.
    callProvider
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: '',
          tool_calls: [
            { type: 'fetch_plan_items', payload: { plan_id: plan._id.toString() } }
          ]
        }),
        usage: { prompt_tokens: 50, completion_tokens: 20 }
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'You have 2 items in your Tool Experience plan.',
          pending_actions: []
        }),
        usage: { prompt_tokens: 80, completion_tokens: 30 }
      });

    executeAction.mockResolvedValue({
      success: true,
      result: {
        statusCode: 200,
        body: {
          items: [
            { _id: 'i1', content: 'Item one', completed: false },
            { _id: 'i2', content: 'Item two', completed: false }
          ],
          total: 2,
          returned: 2
        }
      },
      errors: []
    });

    const res = await request(app)
      .post('/api/bienbot/chat')
      .set('Authorization', authToken)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.on('data', chunk => { data += chunk.toString(); });
        response.on('end', () => callback(null, data));
      })
      .send({
        message: 'What’s in my Tool Experience plan?',
        sessionId: undefined
      });

    expect(res.status).toBe(200);

    // Two LLM round-trips
    expect(callProvider).toHaveBeenCalledTimes(2);

    // The second call's last message must contain the [TOOL RESULTS] block.
    const secondCallMessages = callProvider.mock.calls[1][1];
    const lastMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('[TOOL RESULTS');
    expect(lastMessage.content).toContain('fetch_plan_items');

    // executeAction was invoked once for the single tool call.
    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(executeAction.mock.calls[0][0].type).toBe('fetch_plan_items');

    // SSE stream contains tool_call_start and tool_call_end pill events,
    // plus the second response's answer text.
    const events = parseSSEEvents(res.body);
    const eventTypes = events.map(e => e.event);
    expect(eventTypes).toContain('tool_call_start');
    expect(eventTypes).toContain('tool_call_end');

    const tokenText = events
      .filter(e => e.event === 'token')
      .map(e => e.data.text)
      .join('');
    expect(tokenText).toContain('You have 2 items');
  });

  it('drops tool_calls in the second response (recursion budget = 1)', async () => {
    const { callProvider } = require('../../controllers/api/ai');

    callProvider
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: '',
          tool_calls: [{ type: 'fetch_plan_items', payload: { plan_id: plan._id.toString() } }]
        }),
        usage: { prompt_tokens: 30, completion_tokens: 10 }
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'Done.',
          // Second response illegally tries another tool call — must be dropped.
          tool_calls: [{ type: 'fetch_plan_items', payload: { plan_id: plan._id.toString() } }],
          pending_actions: []
        }),
        usage: { prompt_tokens: 30, completion_tokens: 10 }
      });

    const res = await request(app)
      .post('/api/bienbot/chat')
      .set('Authorization', authToken)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.on('data', chunk => { data += chunk.toString(); });
        response.on('end', () => callback(null, data));
      })
      .send({ message: 'Show plan items' });

    expect(res.status).toBe(200);
    // Exactly two LLM calls — the second response's tool_calls were ignored.
    expect(callProvider).toHaveBeenCalledTimes(2);

    const events = parseSSEEvents(res.body);
    const tokenText = events
      .filter(e => e.event === 'token')
      .map(e => e.data.text)
      .join('');
    expect(tokenText).toContain('Done');
  });

  it('falls back to an error message when the second LLM call fails', async () => {
    const { callProvider } = require('../../controllers/api/ai');

    callProvider
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: '',
          tool_calls: [{ type: 'fetch_plan_items', payload: { plan_id: plan._id.toString() } }]
        }),
        usage: { prompt_tokens: 30, completion_tokens: 10 }
      })
      .mockRejectedValueOnce(new Error('upstream LLM 503'));

    const res = await request(app)
      .post('/api/bienbot/chat')
      .set('Authorization', authToken)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.on('data', chunk => { data += chunk.toString(); });
        response.on('end', () => callback(null, data));
      })
      .send({ message: 'Fetch and summarize' });

    expect(res.status).toBe(200);
    expect(callProvider).toHaveBeenCalledTimes(2);

    const events = parseSSEEvents(res.body);
    const tokenText = events
      .filter(e => e.event === 'token')
      .map(e => e.data.text)
      .join('');
    expect(tokenText).toMatch(/trouble pulling that data/i);

    const doneEvent = events.find(e => e.event === 'done');
    expect(doneEvent).toBeTruthy();
    expect(doneEvent.data.source).toBe('tool_loop_failure');
  });

  it('skips the loop entirely when the first response carries no tool_calls', async () => {
    const { callProvider } = require('../../controllers/api/ai');

    callProvider.mockResolvedValueOnce({
      content: JSON.stringify({
        message: 'Direct answer, no tools needed.',
        pending_actions: []
      }),
      usage: { prompt_tokens: 30, completion_tokens: 10 }
    });

    const res = await request(app)
      .post('/api/bienbot/chat')
      .set('Authorization', authToken)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.on('data', chunk => { data += chunk.toString(); });
        response.on('end', () => callback(null, data));
      })
      .send({ message: 'Hello' });

    expect(res.status).toBe(200);
    // Only one LLM call — no re-prompt.
    expect(callProvider).toHaveBeenCalledTimes(1);

    const events = parseSSEEvents(res.body);
    const eventTypes = events.map(e => e.event);
    expect(eventTypes).not.toContain('tool_call_start');
    expect(eventTypes).not.toContain('tool_call_end');
  });
});

// ---------------------------------------------------------------------------
// Integration: registry-defined tool wired into the tool-use loop
// ---------------------------------------------------------------------------
//
// The block above proves the loop works for INTERNAL fetchers (executed via
// executeAction). This block proves the same loop also dispatches REGISTRY
// tools through `toolRegistry.executeRegisteredTool`. We use `fetch_forecast`
// from the Weather provider because it's the simplest env-keyed read tool;
// `global.fetch` is mocked so no real HTTP is performed.

describe('POST /api/bienbot/chat — registry-defined tool integration', () => {
  let user, authToken;
  let originalFetch;
  let originalEnvKey;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  beforeEach(async () => {
    await clearTestData();
    await BienBotSession.deleteMany({});

    user = await createAIUser();
    authToken = generateAuthToken(user);

    // Provider is env-keyed (envKeyOptional: true). Set a fake key BEFORE
    // bootstrap so the Weather provider becomes enabled and `fetch_forecast`
    // is registered in the registry.
    originalEnvKey = process.env.OPENWEATHER_API_KEY;
    process.env.OPENWEATHER_API_KEY = 'test-fake-key';

    const reg = require('../../utilities/bienbot-tool-registry');
    const { _resetForTest, bootstrap } = require('../../utilities/bienbot-tool-registry/bootstrap');
    reg._resetRegistryForTest();
    _resetForTest();
    bootstrap();

    // Reset AI mock so per-test scripting is isolated.
    const { callProvider } = require('../../controllers/api/ai');
    callProvider.mockReset();
    callProvider.mockResolvedValue({
      content: JSON.stringify({ message: 'Default reply.', pending_actions: [] }),
      usage: { prompt_tokens: 10, completion_tokens: 10 }
    });

    // Stub global fetch — providerCtx.httpRequest calls fetch() directly.
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        list: [{
          dt_txt: '2026-05-01 12:00:00',
          main: { temp_min: 10, temp_max: 15 },
          weather: [{ description: 'sunny' }]
        }]
      })
    }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnvKey === undefined) {
      delete process.env.OPENWEATHER_API_KEY;
    } else {
      process.env.OPENWEATHER_API_KEY = originalEnvKey;
    }
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  it('dispatches a registry tool through executeRegisteredTool and folds its result into the second LLM prompt', async () => {
    const { callProvider } = require('../../controllers/api/ai');

    // Sanity check: provider really is registered after bootstrap.
    const reg = require('../../utilities/bienbot-tool-registry');
    expect(reg.getTool('fetch_forecast')).toBeTruthy();

    // First LLM response → asks for the registry tool. Second → final answer.
    callProvider
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: '',
          tool_calls: [{ type: 'fetch_forecast', payload: { location: 'Tokyo', days: 1 } }],
          pending_actions: []
        }),
        usage: { prompt_tokens: 50, completion_tokens: 20 }
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'It will be sunny in Tokyo.',
          pending_actions: []
        }),
        usage: { prompt_tokens: 80, completion_tokens: 30 }
      });

    const res = await request(app)
      .post('/api/bienbot/chat')
      .set('Authorization', authToken)
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.on('data', chunk => { data += chunk.toString(); });
        response.on('end', () => callback(null, data));
      })
      .send({ message: 'what is the weather in Tokyo' });

    expect(res.status).toBe(200);

    // Two LLM round-trips: tool-asking + final.
    expect(callProvider).toHaveBeenCalledTimes(2);

    // The registry handler called global.fetch (not executeAction).
    expect(global.fetch).toHaveBeenCalled();
    const fetchUrl = global.fetch.mock.calls[0][0];
    expect(fetchUrl).toContain('openweathermap.org');
    expect(fetchUrl).toContain('Tokyo');

    // The second prompt's last message must contain the [TOOL RESULTS] block
    // with the registry tool's name and the upstream payload (forecast/sunny).
    const secondCallMessages = callProvider.mock.calls[1][1];
    const lastMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMessage.role).toBe('user');
    expect(lastMessage.content).toContain('[TOOL RESULTS');
    expect(lastMessage.content).toContain('fetch_forecast');
    expect(lastMessage.content).toContain('sunny');

    // SSE stream contains the pill events (label from registry manifest)
    // and the second response's final answer text.
    const events = parseSSEEvents(res.body);
    const eventTypes = events.map(e => e.event);
    expect(eventTypes).toContain('tool_call_start');
    expect(eventTypes).toContain('tool_call_end');

    const startEvent = events.find(e => e.event === 'tool_call_start');
    expect(startEvent.data.type).toBe('fetch_forecast');
    // Label may be the registry-provided "Fetching forecast…" or the generic
    // fallback "Fetching fetch forecast…" depending on whether the controller's
    // TOOL_CALL_LABELS was hydrated before the test re-bootstrapped the registry.
    // Either way it must mention "forecast".
    expect(startEvent.data.label).toMatch(/forecast/i);

    const tokenText = events
      .filter(e => e.event === 'token')
      .map(e => e.data.text)
      .join('');
    expect(tokenText).toContain('It will be sunny');
  });
});
