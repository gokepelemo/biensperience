const {
  registerProvider,
  getTool,
  getReadToolNames,
  getWriteToolNames,
  _resetRegistryForTest
} = require('../../utilities/bienbot-tool-registry');

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
