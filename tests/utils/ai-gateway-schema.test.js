/**
 * Schema option tests for the AI provider registry (fetch-based).
 * Mocks global fetch to assert the request body and parsed response
 * shape produced when callers opt into structured output via
 * `options.schema`.
 */

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetModules();
});

describe('ai-provider-registry schema option — Anthropic path', () => {
  test('passes tools + tool_choice and returns tool input as parsed content', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'tool_use',
            name: 'classify_intent',
            input: {
              intent: 'QUERY_DESTINATION',
              confidence: 0.9,
              entities: { destination_name: 'Tokyo' }
            }
          }
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'tool_use'
      })
    });
    global.fetch = fetchMock;

    const { callProvider } = require('../../utilities/ai-provider-registry');

    const schema = {
      name: 'classify_intent',
      description: 'Classify user intent',
      json_schema: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          confidence: { type: 'number' },
          entities: { type: 'object' }
        },
        required: ['intent', 'confidence']
      }
    };

    const result = await callProvider('anthropic', [
      { role: 'user', content: 'Tell me about Tokyo' }
    ], { schema, maxTokens: 100 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.tools).toEqual([{
      name: 'classify_intent',
      description: 'Classify user intent',
      input_schema: schema.json_schema
    }]);
    expect(sentBody.tool_choice).toEqual({ type: 'tool', name: 'classify_intent' });

    expect(result.content).toEqual({
      intent: 'QUERY_DESTINATION',
      confidence: 0.9,
      entities: { destination_name: 'Tokyo' }
    });
    expect(result.provider).toBe('anthropic');
  });

  test('throws when Anthropic response is missing tool_use block', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'plain text' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-3-haiku-20240307',
        stop_reason: 'end_turn'
      })
    });

    const { callProvider } = require('../../utilities/ai-provider-registry');

    await expect(callProvider('anthropic', [
      { role: 'user', content: 'hi' }
    ], {
      schema: { name: 'classify_intent', json_schema: { type: 'object' } }
    })).rejects.toThrow(/tool_use/);
  });
});
