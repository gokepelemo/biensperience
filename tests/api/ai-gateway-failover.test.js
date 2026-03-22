/**
 * Tests for AI Gateway provider failover logic.
 *
 * Validates that:
 * - Primary provider is tried first
 * - On transient error (5xx/timeout), the next fallback provider is tried
 * - Non-retryable errors do NOT trigger failover
 * - All providers exhausted → throws last error
 * - No API key → skipped silently, next provider tried
 * - Successful failover is logged and result reflects the actual provider used
 *
 * @see utilities/ai-gateway.js
 */

jest.mock('../../models/ai-policy');
jest.mock('../../models/ai-usage');
jest.mock('../../utilities/ai-provider-registry');
jest.mock('../../utilities/backend-logger');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a transient (retryable) error */
function transientError(msg = 'Service Unavailable') {
  const err = new Error(msg);
  err.statusCode = 503;
  return err;
}

/** Build a non-retryable error */
function authError(msg = 'Unauthorized') {
  const err = new Error(msg);
  err.statusCode = 401;
  return err;
}

/** Minimal successful provider result */
function providerResult(provider = 'openai') {
  return {
    content: `Response from ${provider}`,
    provider,
    model: `${provider}-default`,
    usage: { inputTokens: 10, outputTokens: 20 }
  };
}

/** Default policy with no failover */
function makePolicy(overrides = {}) {
  return {
    allowed_providers: [],
    blocked_providers: [],
    allowed_models: [],
    fallback_providers: [],
    rate_limits: {},
    token_budget: {},
    task_routing: [],
    content_filtering: { enabled: false },
    max_tokens_per_request: 4000,
    preferred_provider: null,
    preferred_model: null,
    temperature: null,
    max_tokens: null,
    system_prompt_override: null,
    language: null,
    ai_disabled: false,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Fresh module loading per test (avoids mock state bleeding between tests)
// ---------------------------------------------------------------------------

let gateway, AIPolicy, AIUsage, registry, logger;

beforeEach(() => {
  jest.resetModules();

  // Re-require all mocked modules AFTER resetModules so they share the same
  // registry entry that the freshly loaded gateway will use.
  AIPolicy = require('../../models/ai-policy');
  AIUsage = require('../../models/ai-usage');
  registry = require('../../utilities/ai-provider-registry');
  logger = require('../../utilities/backend-logger');

  // Default logger stubs
  logger.info = jest.fn();
  logger.warn = jest.fn();
  logger.debug = jest.fn();
  logger.error = jest.fn();

  // Default AIPolicy: return a simple global policy with no fallbacks
  // The gateway calls AIPolicy.find({}).lean(), so mock must support chaining.
  AIPolicy.find = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue([{ scope: 'global', ...makePolicy() }])
  });

  // Default AIUsage stubs
  AIUsage.trackRequest = jest.fn().mockResolvedValue(undefined);
  AIUsage.getDailyUsage = jest.fn().mockResolvedValue(null);
  AIUsage.getMonthlyUsage = jest.fn().mockResolvedValue({ total_input_tokens: 0, total_output_tokens: 0 });

  // Default registry stubs (will be overridden per test)
  registry.getApiKeyForProvider = jest.fn().mockReturnValue('');
  registry.callProvider = jest.fn();
  registry.getAllProviderConfigs = jest.fn().mockResolvedValue(new Map());

  // Load gateway LAST so it picks up all mocked dependencies
  gateway = require('../../utilities/ai-gateway');
});

// ---------------------------------------------------------------------------
// resolvePolicy — fallback_providers field
// ---------------------------------------------------------------------------

describe('resolvePolicy — fallback_providers', () => {
  it('defaults fallback_providers to empty array', async () => {
    // Default beforeEach mock has no fallback_providers
    const policy = await gateway.resolvePolicy({});
    expect(policy.fallback_providers).toEqual([]);
  });

  it('uses fallback_providers from global policy', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        { scope: 'global', ...makePolicy({ fallback_providers: ['anthropic', 'google'] }) }
      ])
    });
    const policy = await gateway.resolvePolicy({});
    expect(policy.fallback_providers).toEqual(['anthropic', 'google']);
  });

  it('user policy overrides global fallback_providers', async () => {
    const userId = 'user-123';
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        { scope: 'global', ...makePolicy({ fallback_providers: ['anthropic'] }) },
        {
          scope: 'user',
          target: { toString: () => userId },
          ...makePolicy({ fallback_providers: ['google', 'cohere'] })
        }
      ])
    });
    const policy = await gateway.resolvePolicy({ user: { _id: userId } });
    expect(policy.fallback_providers).toEqual(['google', 'cohere']);
  });
});

// ---------------------------------------------------------------------------
// executeAIRequest — provider failover
// ---------------------------------------------------------------------------

describe('executeAIRequest — provider failover', () => {
  const messages = [{ role: 'user', content: 'Hello' }];
  const task = 'autocomplete';
  const user = { _id: 'u1', role: 'regular_user' };
  // Always use maxRetries: 0 to keep tests fast (no delay between retries)
  const fastRetry = { retryConfig: { maxRetries: 0 } };

  // Helper: mock AIPolicy.find to return a policy list with lean() support
  function mockPoliciesOnce(docs) {
    AIPolicy.find.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(docs) });
  }

  it('uses primary provider when it succeeds', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider.mockResolvedValue(providerResult('openai'));

    const result = await gateway.executeAIRequest({ messages, task, user, options: fastRetry });

    expect(result.provider).toBe('openai');
    expect(registry.callProvider).toHaveBeenCalledTimes(1);
    expect(registry.callProvider).toHaveBeenCalledWith('openai', expect.any(Array), expect.any(Object));
  });

  it('fails over to the first fallback on primary 503', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider
      .mockRejectedValueOnce(transientError())         // openai fails
      .mockResolvedValueOnce(providerResult('anthropic')); // anthropic succeeds

    const result = await gateway.executeAIRequest({ messages, task, user, options: fastRetry });

    expect(result.provider).toBe('anthropic');
    expect(registry.callProvider).toHaveBeenCalledTimes(2);
    expect(registry.callProvider).toHaveBeenNthCalledWith(1, 'openai', expect.any(Array), expect.any(Object));
    expect(registry.callProvider).toHaveBeenNthCalledWith(2, 'anthropic', expect.any(Array), expect.any(Object));
  });

  it('resets model to undefined for fallback provider', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', preferred_model: 'gpt-4', fallback_providers: ['anthropic'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce(providerResult('anthropic'));

    await gateway.executeAIRequest({ messages, task, user, options: fastRetry });

    const anthropicCallOptions = registry.callProvider.mock.calls[1][2];
    expect(anthropicCallOptions.model).toBeUndefined();
  });

  it('fails over across multiple fallbacks', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic', 'google'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider
      .mockRejectedValueOnce(transientError())   // openai fails
      .mockRejectedValueOnce(transientError())   // anthropic fails
      .mockResolvedValueOnce(providerResult('google')); // google succeeds

    const result = await gateway.executeAIRequest({ messages, task, user, options: fastRetry });

    expect(result.provider).toBe('google');
    expect(registry.callProvider).toHaveBeenCalledTimes(3);
  });

  it('does NOT failover on non-retryable errors (auth, 4xx)', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider.mockRejectedValue(authError());

    await expect(
      gateway.executeAIRequest({ messages, task, user, options: fastRetry })
    ).rejects.toMatchObject({ statusCode: 401 });

    // Only primary was tried, no fallback
    expect(registry.callProvider).toHaveBeenCalledTimes(1);
    expect(registry.callProvider).toHaveBeenCalledWith('openai', expect.any(Array), expect.any(Object));
  });

  it('throws last error after all providers exhausted', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic'] }) }
    ]);
    const err = transientError('All down');
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider.mockRejectedValue(err);

    await expect(
      gateway.executeAIRequest({ messages, task, user, options: fastRetry })
    ).rejects.toMatchObject({ message: 'All down' });

    expect(registry.callProvider).toHaveBeenCalledTimes(2); // openai + anthropic
  });

  it('skips providers with no API key and tries next', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic', 'google'] }) }
    ]);
    // openai → no key, anthropic → no key, google → has key
    registry.getApiKeyForProvider
      .mockReturnValueOnce('')         // openai: no key
      .mockReturnValueOnce('')         // anthropic: no key
      .mockReturnValueOnce('sk-test'); // google: has key
    registry.callProvider.mockResolvedValue(providerResult('google'));

    const result = await gateway.executeAIRequest({ messages, task, user });

    expect(result.provider).toBe('google');
    // callProvider only called once (for google)
    expect(registry.callProvider).toHaveBeenCalledTimes(1);
    expect(registry.callProvider).toHaveBeenCalledWith('google', expect.any(Array), expect.any(Object));
  });

  it('throws PROVIDER_NOT_CONFIGURED when no providers have API keys', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue(''); // all empty
    registry.callProvider.mockResolvedValue(providerResult('openai'));

    await expect(
      gateway.executeAIRequest({ messages, task, user })
    ).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });

    expect(registry.callProvider).not.toHaveBeenCalled();
  });

  it('deduplicates providers — primary not repeated in fallback chain', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['openai', 'anthropic'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider
      .mockRejectedValueOnce(transientError()) // openai fails (first and only time)
      .mockResolvedValueOnce(providerResult('anthropic')); // anthropic succeeds

    const result = await gateway.executeAIRequest({ messages, task, user, options: fastRetry });

    expect(result.provider).toBe('anthropic');
    // openai called once, anthropic called once (openai not duplicated in chain)
    expect(registry.callProvider).toHaveBeenCalledTimes(2);
  });

  it('logs failover info when a fallback is used', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: ['anthropic'] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider
      .mockRejectedValueOnce(transientError())
      .mockResolvedValueOnce(providerResult('anthropic'));

    await gateway.executeAIRequest({ messages, task, user, options: fastRetry });

    expect(logger.info).toHaveBeenCalledWith(
      '[ai-gateway] Failover succeeded',
      expect.objectContaining({ primaryProvider: 'openai', usedProvider: 'anthropic' })
    );
  });

  it('no failover when fallback_providers is empty', async () => {
    mockPoliciesOnce([
      { scope: 'global', ...makePolicy({ preferred_provider: 'openai', fallback_providers: [] }) }
    ]);
    registry.getApiKeyForProvider.mockReturnValue('sk-test');
    registry.callProvider.mockRejectedValue(transientError());

    await expect(
      gateway.executeAIRequest({ messages, task, user, options: fastRetry })
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(registry.callProvider).toHaveBeenCalledTimes(1);
  });
});
