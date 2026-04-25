/**
 * Tests for bienbot-session-summarizer
 *
 * Covers:
 * - Happy path: valid LLM response produces correct summary structure
 * - Fallback for sessions with fewer than 3 messages
 * - Fallback when the AI provider is not configured (no API key)
 * - GatewayError propagation (RATE_LIMIT_EXCEEDED, TOKEN_BUDGET_EXCEEDED, AI_DISABLED)
 * - Non-GatewayError failures return fallback instead of throwing
 * - Malformed LLM responses (invalid JSON, missing fields, wrong types)
 * - next_steps filtering: non-string entries removed, capped at 3
 * - Token budget compliance: truncateMessages respects MAX_MESSAGE_CHARS
 * - Summary caching logic (6-hour TTL) via BienBotSession model methods
 */

// ---------------------------------------------------------------------------
// Mocks — set up before any require() so modules get the mocked versions
// Use requireActual for GatewayError so instanceof checks work correctly.
// ---------------------------------------------------------------------------

jest.mock('../../utilities/ai-gateway', () => {
  const { GatewayError: ActualGatewayError } = jest.requireActual('../../utilities/ai-gateway');
  return {
    executeAIRequest: jest.fn(),
    // controllers/api/ai re-exports getProviderForTask from ai-gateway, so the
    // gateway mock must provide it for the auto-mock of controllers/api/ai
    // to expose a callable getProviderForTask.
    getProviderForTask: jest.fn(),
    GatewayError: ActualGatewayError
  };
});

jest.mock('../../controllers/api/ai');

const { executeAIRequest, GatewayError } = require('../../utilities/ai-gateway');
const { getApiKey, getProviderForTask, AI_TASKS } = require('../../controllers/api/ai');

// Give AI_TASKS a BIENBOT_SUMMARIZE value used by the summarizer
getProviderForTask.mockReturnValue('openai');
AI_TASKS.BIENBOT_SUMMARIZE = 'bienbot_summarize';
AI_TASKS.GENERAL = 'general';

const { summarizeSession, extractAddedPlanItems } = require('../../utilities/bienbot-session-summarizer');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal set of messages (role/content pairs) for testing.
 * @param {number} count - Number of messages to generate (each alternates user/assistant).
 */
function makeMessages(count) {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Message number ${i + 1} with some content to fill in.`
  }));
}

/**
 * Mock a successful schema-shaped LLM response.
 * Accepts the new summarizer shape { text, suggested_next_steps } and also
 * remaps legacy test payloads { summary, next_steps } so older test bodies
 * stay meaningful after the schema migration.
 */
function mockLLMSuccess(payload) {
  const content = ('text' in payload || 'suggested_next_steps' in payload)
    ? { text: payload.text, suggested_next_steps: payload.suggested_next_steps }
    : { text: payload.summary, suggested_next_steps: payload.next_steps };
  executeAIRequest.mockResolvedValueOnce({ content });
}

/**
 * Mock a successful LLM response with arbitrary content (used for malformed
 * / edge-shape cases where we want to assert fallback behavior).
 */
function mockLLMContent(content) {
  executeAIRequest.mockResolvedValueOnce({ content });
}

/**
 * Mock the LLM throwing the given error.
 */
function mockLLMError(err) {
  executeAIRequest.mockRejectedValueOnce(err);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Default: API key is configured
  getApiKey.mockReturnValue('test-api-key');
});

// ---------------------------------------------------------------------------
// 1. Happy path
// ---------------------------------------------------------------------------

describe('summarizeSession – happy path', () => {
  test('returns summary and next_steps from a valid LLM response', async () => {
    mockLLMSuccess({
      summary: 'Discussed visiting Rome next summer.',
      next_steps: ['Book flights', 'Reserve a hotel', 'Plan day trips']
    });

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBe('Discussed visiting Rome next summer.');
    expect(result.next_steps).toEqual(['Book flights', 'Reserve a hotel', 'Plan day trips']);
  });

  test('passes messages, provider, task, and schema to executeAIRequest', async () => {
    mockLLMSuccess({
      summary: 'Test summary',
      next_steps: ['Step A', 'Step B']
    });

    await summarizeSession({ messages: makeMessages(3) });

    expect(executeAIRequest).toHaveBeenCalledTimes(1);
    const callArg = executeAIRequest.mock.calls[0][0];
    expect(callArg.task).toBe(AI_TASKS.BIENBOT_SUMMARIZE);
    expect(callArg.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user' })
      ])
    );
    expect(callArg.schema).toMatchObject({
      name: 'summarize_session',
      json_schema: expect.objectContaining({
        type: 'object',
        required: expect.arrayContaining(['text', 'suggested_next_steps'])
      })
    });
  });

  test('includes context and session info in the user prompt', async () => {
    mockLLMSuccess({
      summary: 'Summary with context.',
      next_steps: ['Do this']
    });

    const session = {
      title: 'My Rome Trip',
      invoke_context: { entity: 'destination', entity_label: 'Rome', entity_id: 'abc123' }
    };
    const context = {
      destination_id: 'dest-001',
      experience_id: 'exp-002'
    };

    await summarizeSession({ messages: makeMessages(3), context, session });

    const callArg = executeAIRequest.mock.calls[0][0];
    const userMessage = callArg.messages.find(m => m.role === 'user');
    expect(userMessage.content).toContain('My Rome Trip');
    expect(userMessage.content).toContain('Rome');
    expect(userMessage.content).toContain('dest-001');
    expect(userMessage.content).toContain('exp-002');
  });
});

// ---------------------------------------------------------------------------
// 2. Fallback: fewer than 3 messages
// ---------------------------------------------------------------------------

describe('summarizeSession – fewer than 3 messages', () => {
  test('returns static fallback for empty message array', async () => {
    const result = await summarizeSession({ messages: [] });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  test('returns static fallback for 2 messages', async () => {
    const result = await summarizeSession({ messages: makeMessages(2) });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  test('returns static fallback when messages is null', async () => {
    const result = await summarizeSession({ messages: null });

    expect(result.summary).toBeDefined();
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  test('fallback includes session title when provided', async () => {
    const session = { title: 'Japan Adventure' };
    const result = await summarizeSession({ messages: makeMessages(1), session });

    expect(result.summary).toContain('Japan Adventure');
  });

  test('fallback includes entity label when available', async () => {
    const session = {
      title: 'Tokyo Trip',
      invoke_context: { entity: 'destination', entity_label: 'Tokyo' }
    };
    const result = await summarizeSession({ messages: [], session });

    expect(result.summary).toContain('Tokyo');
  });
});

// ---------------------------------------------------------------------------
// 3. Fallback: AI provider not configured
// ---------------------------------------------------------------------------

describe('summarizeSession – AI provider not configured', () => {
  test('returns fallback and does not call executeAIRequest when API key is missing', async () => {
    getApiKey.mockReturnValue(null);

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);
    expect(executeAIRequest).not.toHaveBeenCalled();
  });

  test('returns fallback and does not call executeAIRequest when API key is empty string', async () => {
    getApiKey.mockReturnValue('');

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
    expect(executeAIRequest).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. GatewayError propagation
// ---------------------------------------------------------------------------

describe('summarizeSession – GatewayError propagation', () => {
  test('re-throws RATE_LIMIT_EXCEEDED GatewayError', async () => {
    const err = new GatewayError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
    mockLLMError(err);

    const rejection = summarizeSession({ messages: makeMessages(4) });
    await expect(rejection).rejects.toThrow(GatewayError);
    await expect(rejection).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    });
  });

  test('re-throws TOKEN_BUDGET_EXCEEDED GatewayError', async () => {
    const err = new GatewayError('Token budget exceeded', 'TOKEN_BUDGET_EXCEEDED', 429);
    mockLLMError(err);

    await expect(summarizeSession({ messages: makeMessages(4) })).rejects.toThrow(GatewayError);
  });

  test('re-throws AI_DISABLED GatewayError', async () => {
    const err = new GatewayError('AI features are disabled', 'AI_DISABLED', 403);
    mockLLMError(err);

    const rejection = summarizeSession({ messages: makeMessages(4) });
    await expect(rejection).rejects.toThrow(GatewayError);
    await expect(rejection).rejects.toMatchObject({
      code: 'AI_DISABLED',
      statusCode: 403
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Non-GatewayError failures return fallback
// ---------------------------------------------------------------------------

describe('summarizeSession – non-GatewayError failures return fallback', () => {
  test('returns fallback when executeAIRequest throws a generic Error', async () => {
    mockLLMError(new Error('Network error'));

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);
  });

  test('returns fallback when executeAIRequest throws a non-GatewayError subclass', async () => {
    class ProviderError extends Error {
      constructor(msg) { super(msg); this.name = 'ProviderError'; }
    }
    mockLLMError(new ProviderError('Provider unavailable'));

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);
  });

  test('does not throw when executeAIRequest throws a generic error', async () => {
    mockLLMError(new Error('Unexpected error'));

    await expect(summarizeSession({ messages: makeMessages(5) })).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Malformed LLM responses
// ---------------------------------------------------------------------------

describe('summarizeSession – malformed LLM responses', () => {
  test('returns fallback when content is a plain string (pre-schema shape)', async () => {
    mockLLMContent('Sorry, I cannot summarize this conversation.');

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);
  });

  test('returns fallback when object is missing text field', async () => {
    mockLLMContent({ suggested_next_steps: ['Step 1', 'Step 2'] });

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
  });

  test('returns fallback when object is missing suggested_next_steps field', async () => {
    mockLLMContent({ text: 'A valid summary.' });

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.next_steps)).toBe(true);
  });

  test('returns fallback when suggested_next_steps is not an array', async () => {
    mockLLMContent({ text: 'Valid summary', suggested_next_steps: 'Should be an array' });

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
  });

  test('returns fallback when text is not a string', async () => {
    mockLLMContent({ text: 42, suggested_next_steps: ['Step 1'] });

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result).toHaveProperty('summary');
    expect(typeof result.summary).toBe('string');
  });

  test('returns fallback when LLM response content is null', async () => {
    executeAIRequest.mockResolvedValueOnce({ content: null });

    const result = await summarizeSession({ messages: makeMessages(4) });

    expect(result.summary).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 7. next_steps filtering
// ---------------------------------------------------------------------------

describe('summarizeSession – next_steps filtering', () => {
  test('filters out non-string entries from next_steps', async () => {
    mockLLMSuccess({
      summary: 'Test summary.',
      next_steps: ['Valid step', 42, null, 'Another valid step', { bad: true }]
    });

    const result = await summarizeSession({ messages: makeMessages(3) });

    expect(result.next_steps).toEqual(['Valid step', 'Another valid step']);
  });

  test('caps next_steps at 3 items', async () => {
    mockLLMSuccess({
      summary: 'Test summary.',
      next_steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5']
    });

    const result = await summarizeSession({ messages: makeMessages(3) });

    expect(result.next_steps).toHaveLength(3);
    expect(result.next_steps).toEqual(['Step 1', 'Step 2', 'Step 3']);
  });

  test('returns fewer than 3 next_steps when LLM provides only 2', async () => {
    mockLLMSuccess({
      summary: 'Short summary.',
      next_steps: ['Only step one', 'Only step two']
    });

    const result = await summarizeSession({ messages: makeMessages(3) });

    expect(result.next_steps).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 8. Token budget compliance
// ---------------------------------------------------------------------------

describe('summarizeSession – token budget compliance', () => {
  test('does not exceed token budget when messages are very long', async () => {
    // Create messages that would greatly exceed the budget
    const longContent = 'A'.repeat(4000); // 4000 chars each
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: longContent
    }));

    mockLLMSuccess({
      summary: 'Long messages handled.',
      next_steps: ['Continue planning']
    });

    await summarizeSession({ messages });

    const callArg = executeAIRequest.mock.calls[0][0];
    const userMessage = callArg.messages.find(m => m.role === 'user');

    // MAX_MESSAGE_CHARS = 2000 tokens * 4 chars/token = 8000 chars
    // The history section should not exceed 8000 chars
    // (Account for context block prefix)
    const history = userMessage.content.split('--- Conversation ---')[1] || '';
    expect(history.length).toBeLessThanOrEqual(8500);
  });

  test('keeps the most recent messages when truncation is needed', async () => {
    // Build messages where only the last ones fit the budget
    const messages = [
      { role: 'user', content: 'Old message that should be dropped if budget is tight.' },
      { role: 'assistant', content: 'Old reply that should also be dropped.' },
      { role: 'user', content: 'Recent question that must be kept.' },
      { role: 'assistant', content: 'Recent answer that must be kept.' }
    ];

    mockLLMSuccess({
      summary: 'Recent messages kept.',
      next_steps: ['Continue']
    });

    await summarizeSession({ messages });

    const callArg = executeAIRequest.mock.calls[0][0];
    const userMessage = callArg.messages.find(m => m.role === 'user');
    expect(userMessage.content).toContain('Recent question that must be kept.');
    expect(userMessage.content).toContain('Recent answer that must be kept.');
  });

  test('still calls LLM when only 3 messages fit but they are valid', async () => {
    mockLLMSuccess({
      summary: 'Three messages.',
      next_steps: ['Next step']
    });

    await summarizeSession({ messages: makeMessages(3) });

    expect(executeAIRequest).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 9. Summary caching logic — BienBotSession model methods
//    (6-hour TTL via isSummaryStale / cacheSummary)
// ---------------------------------------------------------------------------

describe('Summary caching logic (BienBotSession model)', () => {
  const BienBotSession = require('../../models/bienbot-session');

  // Build a minimal in-memory session-like object to test the methods
  // without hitting MongoDB, by using plain object assignment.
  function makeSessionObject(summaryOverride) {
    return {
      summary: summaryOverride,
      isSummaryStale: BienBotSession.schema.methods.isSummaryStale
    };
  }

  test('isSummaryStale returns true when summary is null', () => {
    const session = makeSessionObject(null);
    expect(session.isSummaryStale()).toBe(true);
  });

  test('isSummaryStale returns true when summary.generated_at is null', () => {
    const session = makeSessionObject({ text: 'A summary', generated_at: null });
    expect(session.isSummaryStale()).toBe(true);
  });

  test('isSummaryStale returns false for a freshly cached summary', () => {
    const session = makeSessionObject({
      text: 'Fresh summary.',
      generated_at: new Date() // now
    });
    expect(session.isSummaryStale()).toBe(false);
  });

  test('isSummaryStale returns true for a summary older than 6 hours', () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
    const session = makeSessionObject({
      text: 'Old summary.',
      generated_at: sevenHoursAgo
    });
    expect(session.isSummaryStale()).toBe(true);
  });

  test('isSummaryStale returns false for a summary exactly 5 hours old', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const session = makeSessionObject({
      text: 'Recent enough summary.',
      generated_at: fiveHoursAgo
    });
    expect(session.isSummaryStale()).toBe(false);
  });

  test('isSummaryStale respects a custom TTL argument', () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const session = makeSessionObject({
      text: 'Summary from 30 min ago.',
      generated_at: thirtyMinutesAgo
    });

    const fifteenMinutesTTL = 15 * 60 * 1000;
    const oneHourTTL = 60 * 60 * 1000;

    expect(session.isSummaryStale(fifteenMinutesTTL)).toBe(true);
    expect(session.isSummaryStale(oneHourTTL)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 10. extractAddedPlanItems — pulls successfully-added items from session
// ---------------------------------------------------------------------------

describe('extractAddedPlanItems', () => {
  test('returns empty array when session has no pending_actions', () => {
    expect(extractAddedPlanItems({})).toEqual([]);
    expect(extractAddedPlanItems({ pending_actions: [] })).toEqual([]);
    expect(extractAddedPlanItems(null)).toEqual([]);
  });

  test('extracts item text from executed add_plan_items actions', () => {
    const session = {
      pending_actions: [{
        id: 'a1',
        type: 'add_plan_items',
        executed: true,
        result: { success: true },
        payload: { plan_id: 'p1', items: [{ text: 'Tapas tour' }, { text: 'Visit Sagrada Familia' }] },
        description: 'Add 2 items'
      }]
    };
    expect(extractAddedPlanItems(session)).toEqual(['Tapas tour', 'Visit Sagrada Familia']);
  });

  test('skips unexecuted add_plan_items actions', () => {
    const session = {
      pending_actions: [{
        id: 'a1',
        type: 'add_plan_items',
        executed: false,
        payload: { items: [{ text: 'Should not appear' }] },
        description: 'pending'
      }]
    };
    expect(extractAddedPlanItems(session)).toEqual([]);
  });

  test('skips executed but failed add_plan_items actions', () => {
    const session = {
      pending_actions: [{
        id: 'a1',
        type: 'add_plan_items',
        executed: true,
        result: { success: false, errors: ['boom'] },
        payload: { items: [{ text: 'Failed item' }] },
        description: 'failed'
      }]
    };
    expect(extractAddedPlanItems(session)).toEqual([]);
  });

  test('extracts items from add_plan_items steps inside an executed workflow', () => {
    const session = {
      pending_actions: [{
        id: 'wf1',
        type: 'workflow',
        executed: true,
        result: { success: true },
        payload: {
          steps: [
            { step: 1, type: 'create_plan', payload: { experience_id: 'e1' }, description: 'Create plan' },
            { step: 2, type: 'add_plan_items', payload: { plan_id: '$step_1._id', items: [{ text: 'Day 1: Arrive' }, { text: 'Day 2: Tour' }] }, description: 'Add items' }
          ]
        },
        description: 'Plan + items'
      }]
    };
    expect(extractAddedPlanItems(session)).toEqual(['Day 1: Arrive', 'Day 2: Tour']);
  });

  test('deduplicates item names across multiple actions', () => {
    const session = {
      pending_actions: [
        { id: 'a1', type: 'add_plan_items', executed: true, payload: { items: [{ text: 'Same item' }] }, description: 'a1' },
        { id: 'a2', type: 'add_plan_items', executed: true, payload: { items: [{ text: 'Same item' }, { text: 'New item' }] }, description: 'a2' }
      ]
    };
    expect(extractAddedPlanItems(session)).toEqual(['Same item', 'New item']);
  });

  test('ignores non-add_plan_items action types', () => {
    const session = {
      pending_actions: [
        { id: 'a1', type: 'create_plan', executed: true, payload: { items: [{ text: 'not a plan item' }] }, description: 'create_plan' },
        { id: 'a2', type: 'update_plan_item', executed: true, payload: { text: 'updated' }, description: 'update' }
      ]
    };
    expect(extractAddedPlanItems(session)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 11. Added plan items appear in LLM context block
// ---------------------------------------------------------------------------

describe('summarizeSession – plan items added context block', () => {
  test('includes "Plan Items Added" block in user prompt when items were added', async () => {
    mockLLMSuccess({ summary: 'You added items.', next_steps: ['Continue'] });

    const session = {
      title: 'Barcelona Trip',
      pending_actions: [{
        id: 'a1',
        type: 'add_plan_items',
        executed: true,
        result: { success: true },
        payload: { items: [{ text: 'Tapas tour' }, { text: 'Visit Sagrada Familia' }] },
        description: 'Added 2 items'
      }]
    };

    await summarizeSession({ messages: makeMessages(4), session });

    const userMessage = executeAIRequest.mock.calls[0][0].messages.find(m => m.role === 'user');
    expect(userMessage.content).toContain('--- Plan Items Added (Successfully Created) ---');
    expect(userMessage.content).toContain('Tapas tour');
    expect(userMessage.content).toContain('Visit Sagrada Familia');
  });

  test('omits "Plan Items Added" block when there are no successful add_plan_items', async () => {
    mockLLMSuccess({ summary: 'Nothing added.', next_steps: ['Continue'] });

    const session = {
      title: 'Empty session',
      pending_actions: [{
        id: 'a1', type: 'add_plan_items', executed: false,
        payload: { items: [{ text: 'Proposed only' }] }, description: 'p'
      }]
    };

    await summarizeSession({ messages: makeMessages(4), session });

    const userMessage = executeAIRequest.mock.calls[0][0].messages.find(m => m.role === 'user');
    expect(userMessage.content).not.toContain('Plan Items Added');
  });

  test('truncates the listed items at MAX and adds "...and N more" tail', async () => {
    mockLLMSuccess({ summary: 'Many items.', next_steps: ['Continue'] });

    const items = Array.from({ length: 20 }, (_, i) => ({ text: `Item ${i + 1}` }));
    const session = {
      pending_actions: [{
        id: 'a1', type: 'add_plan_items', executed: true,
        result: { success: true },
        payload: { items }, description: '20 items'
      }]
    };

    await summarizeSession({ messages: makeMessages(4), session });

    const userMessage = executeAIRequest.mock.calls[0][0].messages.find(m => m.role === 'user');
    // 20 added, MAX=15, expect 5 more in the tail.
    expect(userMessage.content).toContain('...and 5 more');
    expect(userMessage.content).toContain('Item 1');
    expect(userMessage.content).toContain('Item 15');
    expect(userMessage.content).not.toContain('Item 16');
  });

  test('keeps both "Plan Items Added" and "Proposed Actions" blocks when both apply', async () => {
    mockLLMSuccess({ summary: 'Mixed session.', next_steps: ['Continue'] });

    const session = {
      pending_actions: [
        { id: 'a1', type: 'add_plan_items', executed: true, result: { success: true },
          payload: { items: [{ text: 'Confirmed item' }] }, description: 'done' },
        { id: 'a2', type: 'create_destination', executed: false,
          payload: { name: 'Future Destination' }, description: 'Create destination "Future Destination"' }
      ]
    };

    await summarizeSession({ messages: makeMessages(4), session });

    const userMessage = executeAIRequest.mock.calls[0][0].messages.find(m => m.role === 'user');
    expect(userMessage.content).toContain('--- Plan Items Added (Successfully Created) ---');
    expect(userMessage.content).toContain('Confirmed item');
    expect(userMessage.content).toContain('--- Proposed Actions (Not Executed) ---');
    expect(userMessage.content).toContain('Create destination "Future Destination"');
  });
});

// ---------------------------------------------------------------------------
// 12. Fallback summary names added items
// ---------------------------------------------------------------------------

describe('summarizeSession – fallback summary names added items', () => {
  test('fallback (no API key) names a single added item', async () => {
    getApiKey.mockReturnValue(null);

    const session = {
      title: 'Tokyo Trip',
      pending_actions: [{
        id: 'a1', type: 'add_plan_items', executed: true, result: { success: true },
        payload: { items: [{ text: 'Visit Shibuya' }] }, description: 'add'
      }]
    };

    const result = await summarizeSession({ messages: makeMessages(4), session });
    expect(result.summary).toContain('"Visit Shibuya"');
    expect(result.summary).toMatch(/added/i);
  });

  test('fallback names multiple added items and adds a tail when there are more', async () => {
    getApiKey.mockReturnValue(null);

    const session = {
      title: 'Big Trip',
      pending_actions: [{
        id: 'a1', type: 'add_plan_items', executed: true, result: { success: true },
        payload: {
          items: [
            { text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }, { text: 'E' }
          ]
        },
        description: 'add 5'
      }]
    };

    const result = await summarizeSession({ messages: makeMessages(4), session });
    expect(result.summary).toContain('"A"');
    expect(result.summary).toContain('"B"');
    expect(result.summary).toContain('"C"');
    // 5 total, top 3 named, expect "and 2 more items"
    expect(result.summary).toMatch(/2 more items/);
  });

  test('fallback (no API key) without added items does not mention items', async () => {
    getApiKey.mockReturnValue(null);

    const session = { title: 'No items session' };
    const result = await summarizeSession({ messages: makeMessages(4), session });
    expect(result.summary).not.toMatch(/added/i);
  });
});
