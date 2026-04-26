const {
  registerProvider,
  getTool,
  getReadToolNames,
  getWriteToolNames,
  _resetRegistryForTest
} = require('../../utilities/bienbot-tool-registry');
const { executeRegisteredTool } = require('../../utilities/bienbot-tool-registry');

describe('bienbot-tool-registry — manifest validation', () => {
  beforeEach(() => _resetRegistryForTest());

  const validReadTool = {
    name: 'fetch_test_thing',
    mutating: false,
    description: 'Test',
    idRefs: [],
    payloadSchema: {},
    label: 'Fetching test…',
    promptHints: ['"test" → fetch_test_thing'],
    handler: async () => ({ statusCode: 200, body: { ok: true } })
  };

  const validProvider = {
    name: 'test',
    displayName: 'Test',
    baseUrl: 'https://example.test',
    authType: 'none',
    envKey: null,
    envKeyOptional: false,
    budgetPerHour: 60,
    retryPolicy: { maxRetries: 1, baseDelayMs: 100, timeoutMs: 1000 },
    tools: [validReadTool]
  };

  it('accepts a well-formed provider', () => {
    expect(() => registerProvider(validProvider)).not.toThrow();
    expect(getTool('fetch_test_thing')).toBeTruthy();
  });

  it('rejects a provider without a name', () => {
    expect(() => registerProvider({ ...validProvider, name: undefined }))
      .toThrow(/name/);
  });

  it('rejects a tool without promptHints', () => {
    const bad = { ...validProvider, tools: [{ ...validReadTool, promptHints: [] }] };
    expect(() => registerProvider(bad)).toThrow(/promptHint/);
  });

  it('rejects duplicate tool names across providers', () => {
    registerProvider(validProvider);
    expect(() => registerProvider({ ...validProvider, name: 'test2' }))
      .toThrow(/duplicate/i);
  });

  it('rejects a tool whose idRefs reference fields not in payloadSchema', () => {
    const bad = {
      ...validProvider,
      tools: [{
        ...validReadTool,
        idRefs: [{ field: 'plan_id', model: 'plan', required: true }],
        payloadSchema: {}
      }]
    };
    expect(() => registerProvider(bad)).toThrow(/payloadSchema/);
  });

  it('separates read and write tool names', () => {
    registerProvider({
      ...validProvider,
      tools: [
        validReadTool,
        {
          ...validReadTool,
          name: 'do_test_write',
          mutating: true,
          confirmDescription: 'Do the write',
          irreversible: false
        }
      ]
    });
    expect(getReadToolNames().has('fetch_test_thing')).toBe(true);
    expect(getWriteToolNames().has('do_test_write')).toBe(true);
    expect(getReadToolNames().has('do_test_write')).toBe(false);
  });

  it('requires confirmDescription on mutating tools', () => {
    const bad = {
      ...validProvider,
      tools: [{ ...validReadTool, name: 'do_bad', mutating: true }]
    };
    expect(() => registerProvider(bad)).toThrow(/confirmDescription/);
  });
});

describe('executeRegisteredTool', () => {
  beforeEach(() => _resetRegistryForTest());

  function makeProvider(toolOverride = {}) {
    return {
      name: 'test', displayName: 'T', baseUrl: 'https://x', authType: 'none',
      envKey: null, envKeyOptional: false, budgetPerHour: 60,
      retryPolicy: { maxRetries: 0, baseDelayMs: 0, timeoutMs: 100 },
      tools: [{
        name: 'fetch_test',
        mutating: false,
        description: 'Test',
        idRefs: [],
        payloadSchema: { name: { type: 'string', required: true } },
        label: 'Fetching…',
        promptHints: ['"test" → fetch_test'],
        handler: jest.fn(async (payload) => ({ statusCode: 200, body: { received: payload } })),
        ...toolOverride
      }]
    };
  }

  it('rejects unknown tool name', async () => {
    const out = await executeRegisteredTool('does_not_exist', {}, { _id: 'u1' }, {});
    expect(out.success).toBe(false);
    expect(out.body.error).toBe('unknown_tool');
  });

  it('validates required fields and short-circuits when missing', async () => {
    const provider = makeProvider();
    registerProvider(provider);
    const out = await executeRegisteredTool('fetch_test', {}, { _id: 'u1' }, {});
    expect(out.success).toBe(false);
    expect(out.body.error).toBe('invalid_payload');
    expect(out.body.missing).toContain('name');
    expect(provider.tools[0].handler).not.toHaveBeenCalled();
  });

  it('strips unknown payload fields before invoking handler', async () => {
    const provider = makeProvider();
    registerProvider(provider);
    await executeRegisteredTool('fetch_test', { name: 'x', extra: 'drop me' }, { _id: 'u1' }, {});
    const handlerArg = provider.tools[0].handler.mock.calls[0][0];
    expect(handlerArg.name).toBe('x');
    expect(handlerArg.extra).toBeUndefined();
  });

  it('invokes handler with (payload, user, providerCtx) and wraps result with success boolean', async () => {
    const provider = makeProvider();
    registerProvider(provider);
    const out = await executeRegisteredTool('fetch_test', { name: 'y' }, { _id: 'u1' }, {});
    expect(out.success).toBe(true);
    expect(out.statusCode).toBe(200);
    expect(out.body.received).toEqual({ name: 'y' });
  });

  it('catches handler exceptions and returns fetch_failed', async () => {
    const provider = makeProvider({
      handler: async () => { throw new Error('boom'); }
    });
    registerProvider(provider);
    const out = await executeRegisteredTool('fetch_test', { name: 'y' }, { _id: 'u1' }, {});
    expect(out.success).toBe(false);
    expect(out.body.error).toBe('fetch_failed');
  });

  it('treats handler-returned non-2xx statusCode as failure', async () => {
    const provider = makeProvider({
      handler: async () => ({ statusCode: 403, body: { ok: false, error: 'denied' } })
    });
    registerProvider(provider);
    const out = await executeRegisteredTool('fetch_test', { name: 'y' }, { _id: 'u1' }, {});
    expect(out.success).toBe(false);
    expect(out.body.error).toBe('denied');
  });

  it('rejects when provider is disabled (envKeyOptional + missing key)', async () => {
    const provider = {
      ...makeProvider(),
      authType: 'env_key',
      envKey: 'NONEXISTENT_KEY_XYZ',
      envKeyOptional: true
    };
    registerProvider(provider);
    const out = await executeRegisteredTool('fetch_test', { name: 'y' }, { _id: 'u1' }, {});
    expect(out.success).toBe(false);
    expect(out.body.error).toBe('unknown_tool');
  });
});
