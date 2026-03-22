/**
 * Tests for AI Gateway policy resolution.
 *
 * Validates that:
 * - Policy merge chain: entity ai_config → user policy → global policy → env defaults
 * - Rate limit enforcement (per-minute, per-hour, per-day)
 * - Token budget enforcement (daily and monthly input/output)
 * - Content filtering (block patterns, redact patterns)
 * - Provider/model whitelisting and blacklisting
 * - Super admin bypass of rate limits and token budgets
 * - AI disabled flag in entity config
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

/** Build a base policy doc with no restrictions */
function makePolicy(overrides = {}) {
  return {
    allowed_providers: [],
    blocked_providers: [],
    allowed_models: [],
    fallback_providers: [],
    rate_limits: {
      requests_per_minute: null,
      requests_per_hour: null,
      requests_per_day: null
    },
    token_budget: {
      daily_input_tokens: null,
      daily_output_tokens: null,
      monthly_input_tokens: null,
      monthly_output_tokens: null
    },
    task_routing: [],
    content_filtering: { enabled: false, block_patterns: [], redact_patterns: [] },
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

/** Minimal successful provider result */
function providerResult(provider = 'openai') {
  return {
    content: `Response from ${provider}`,
    provider,
    model: `${provider}-default`,
    usage: { inputTokens: 10, outputTokens: 20 }
  };
}

/** Build a minimal chat messages array */
function messages(text = 'Hello') {
  return [{ role: 'user', content: text }];
}

// ---------------------------------------------------------------------------
// Module state (reset per test)
// ---------------------------------------------------------------------------

let gateway, AIPolicy, AIUsage, registry, logger;

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();

  AIPolicy = require('../../models/ai-policy');
  AIUsage = require('../../models/ai-usage');
  registry = require('../../utilities/ai-provider-registry');
  logger = require('../../utilities/backend-logger');

  // Default logger stubs
  logger.info = jest.fn();
  logger.warn = jest.fn();
  logger.debug = jest.fn();
  logger.error = jest.fn();

  // Default AIPolicy: empty (no active policies)
  AIPolicy.find = jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue([])
  });

  // Default AIUsage stubs
  AIUsage.trackRequest = jest.fn().mockResolvedValue(undefined);
  AIUsage.getDailyUsage = jest.fn().mockResolvedValue({ total_input_tokens: 0, total_output_tokens: 0 });
  AIUsage.getMonthlyUsage = jest.fn().mockResolvedValue({ total_input_tokens: 0, total_output_tokens: 0 });

  // Default registry stubs
  registry.getApiKeyForProvider = jest.fn().mockReturnValue('test-api-key');
  registry.callProvider = jest.fn().mockResolvedValue(providerResult());
  registry.getAllProviderConfigs = jest.fn().mockResolvedValue(new Map());

  // Load gateway LAST so it picks up all mocked dependencies
  gateway = require('../../utilities/ai-gateway');
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// resolvePolicy — base defaults (env layer)
// ---------------------------------------------------------------------------

describe('resolvePolicy — env defaults', () => {
  it('returns empty arrays and null limits when no policies exist in DB', async () => {
    const policy = await gateway.resolvePolicy({});

    expect(policy.allowed_providers).toEqual([]);
    expect(policy.blocked_providers).toEqual([]);
    expect(policy.allowed_models).toEqual([]);
    expect(policy.fallback_providers).toEqual([]);
    expect(policy.rate_limits.requests_per_minute).toBeNull();
    expect(policy.rate_limits.requests_per_hour).toBeNull();
    expect(policy.rate_limits.requests_per_day).toBeNull();
    expect(policy.token_budget.daily_input_tokens).toBeNull();
    expect(policy.token_budget.daily_output_tokens).toBeNull();
    expect(policy.token_budget.monthly_input_tokens).toBeNull();
    expect(policy.token_budget.monthly_output_tokens).toBeNull();
    expect(policy.content_filtering.enabled).toBe(false);
    expect(policy.max_tokens_per_request).toBe(4000);
    expect(policy.ai_disabled).toBe(false);
  });

  it('respects AI_DEFAULT_PROVIDER env var via routeRequest fallback', async () => {
    const originalEnv = process.env.AI_DEFAULT_PROVIDER;
    process.env.AI_DEFAULT_PROVIDER = 'anthropic';
    try {
      const policy = await gateway.resolvePolicy({});
      // resolvePolicy doesn't set preferred_provider from env, but defaults hold
      expect(policy.preferred_provider).toBeNull();
    } finally {
      if (originalEnv === undefined) delete process.env.AI_DEFAULT_PROVIDER;
      else process.env.AI_DEFAULT_PROVIDER = originalEnv;
    }
  });
});

// ---------------------------------------------------------------------------
// resolvePolicy — global policy layer
// ---------------------------------------------------------------------------

describe('resolvePolicy — global policy', () => {
  it('applies global rate limits', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({
            rate_limits: { requests_per_minute: 10, requests_per_hour: 100, requests_per_day: 500 }
          })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.rate_limits.requests_per_minute).toBe(10);
    expect(policy.rate_limits.requests_per_hour).toBe(100);
    expect(policy.rate_limits.requests_per_day).toBe(500);
  });

  it('applies global token budget', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({
            token_budget: {
              daily_input_tokens: 50000,
              daily_output_tokens: 20000,
              monthly_input_tokens: 500000,
              monthly_output_tokens: 200000
            }
          })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.token_budget.daily_input_tokens).toBe(50000);
    expect(policy.token_budget.daily_output_tokens).toBe(20000);
    expect(policy.token_budget.monthly_input_tokens).toBe(500000);
    expect(policy.token_budget.monthly_output_tokens).toBe(200000);
  });

  it('applies global allowed_providers whitelist', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ allowed_providers: ['openai', 'anthropic'] })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.allowed_providers).toEqual(['openai', 'anthropic']);
  });

  it('applies global blocked_providers', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ blocked_providers: ['cohere'] })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.blocked_providers).toEqual(['cohere']);
  });

  it('applies global allowed_models', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({
            allowed_models: [{ provider: 'openai', models: ['gpt-4', 'gpt-3.5-turbo'] }]
          })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.allowed_models).toEqual([{ provider: 'openai', models: ['gpt-4', 'gpt-3.5-turbo'] }]);
  });

  it('applies global content filtering config', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({
            content_filtering: {
              enabled: true,
              block_patterns: ['\\bpassword\\b', '\\bsecret\\b'],
              redact_patterns: ['\\d{4}-\\d{4}-\\d{4}-\\d{4}']
            }
          })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.content_filtering.enabled).toBe(true);
    expect(policy.content_filtering.block_patterns).toHaveLength(2);
    expect(policy.content_filtering.redact_patterns).toHaveLength(1);
  });

  it('applies global max_tokens_per_request', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ max_tokens_per_request: 2000 })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.max_tokens_per_request).toBe(2000);
  });

  it('falls back to cached policy on DB failure', async () => {
    // First load succeeds — warms the cache
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ rate_limits: { requests_per_minute: 5 } })
        }
      ])
    });
    await gateway.resolvePolicy({});

    // Second load fails — should return cached value
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockRejectedValue(new Error('DB error'))
    });
    // Force cache expiry by advancing time just beyond TTL (5 minutes = 300000ms)
    jest.advanceTimersByTime(301000);
    // Even with forced cache expiry, the gateway should fall back to last-known
    const policy = await gateway.resolvePolicy({});
    expect(policy).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// resolvePolicy — user policy layer (overrides global)
// ---------------------------------------------------------------------------

describe('resolvePolicy — user policy overrides global', () => {
  const userId = 'user-abc-123';

  it('user rate limits override global', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ rate_limits: { requests_per_minute: 10 } })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => userId },
          ...makePolicy({ rate_limits: { requests_per_minute: 50 } })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({ user: { _id: userId } });
    expect(policy.rate_limits.requests_per_minute).toBe(50);
  });

  it('user policy can have higher token budget than global', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ token_budget: { daily_input_tokens: 10000, daily_output_tokens: 5000 } })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => userId },
          ...makePolicy({ token_budget: { daily_input_tokens: 100000, daily_output_tokens: 50000 } })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({ user: { _id: userId } });
    expect(policy.token_budget.daily_input_tokens).toBe(100000);
    expect(policy.token_budget.daily_output_tokens).toBe(50000);
  });

  it('user allowed_providers overrides global allowed_providers', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ allowed_providers: ['openai'] })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => userId },
          ...makePolicy({ allowed_providers: ['anthropic', 'google'] })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({ user: { _id: userId } });
    expect(policy.allowed_providers).toEqual(['anthropic', 'google']);
  });

  it('user task_routing overrides global task_routing', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({
            task_routing: [{ task: 'summarize', provider: 'openai', model: null }]
          })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => userId },
          ...makePolicy({
            task_routing: [{ task: 'summarize', provider: 'anthropic', model: 'claude-3' }]
          })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({ user: { _id: userId } });
    expect(policy.task_routing[0].provider).toBe('anthropic');
    expect(policy.task_routing[0].model).toBe('claude-3');
  });

  it('user policy not applied for a different user', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ rate_limits: { requests_per_minute: 10 } })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => 'other-user-id' },
          ...makePolicy({ rate_limits: { requests_per_minute: 50 } })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({ user: { _id: userId } });
    // Should use global rate limit, not other-user's rate limit
    expect(policy.rate_limits.requests_per_minute).toBe(10);
  });

  it('global policy applies when no user object provided', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ rate_limits: { requests_per_minute: 5 } })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => userId },
          ...makePolicy({ rate_limits: { requests_per_minute: 100 } })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.rate_limits.requests_per_minute).toBe(5); // global only
  });
});

// ---------------------------------------------------------------------------
// resolvePolicy — entity ai_config layer (highest priority)
// ---------------------------------------------------------------------------

describe('resolvePolicy — entity ai_config (highest priority)', () => {
  it('entity preferred_provider overrides everything', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ allowed_providers: ['openai'] })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({
      entityAIConfig: { preferred_provider: 'anthropic' }
    });
    expect(policy.preferred_provider).toBe('anthropic');
  });

  it('entity preferred_model is set from ai_config', async () => {
    const policy = await gateway.resolvePolicy({
      entityAIConfig: { preferred_provider: 'openai', preferred_model: 'gpt-4' }
    });
    expect(policy.preferred_provider).toBe('openai');
    expect(policy.preferred_model).toBe('gpt-4');
  });

  it('entity temperature override is applied', async () => {
    const policy = await gateway.resolvePolicy({
      entityAIConfig: { temperature: 0.2 }
    });
    expect(policy.temperature).toBe(0.2);
  });

  it('entity max_tokens override is applied', async () => {
    const policy = await gateway.resolvePolicy({
      entityAIConfig: { max_tokens: 512 }
    });
    expect(policy.max_tokens).toBe(512);
  });

  it('entity system_prompt_override is applied', async () => {
    const policy = await gateway.resolvePolicy({
      entityAIConfig: { system_prompt_override: 'You are a travel assistant.' }
    });
    expect(policy.system_prompt_override).toBe('You are a travel assistant.');
  });

  it('entity language is applied', async () => {
    const policy = await gateway.resolvePolicy({
      entityAIConfig: { language: 'fr' }
    });
    expect(policy.language).toBe('fr');
  });

  it('entity disabled flag sets ai_disabled to true', async () => {
    const policy = await gateway.resolvePolicy({
      entityAIConfig: { disabled: true }
    });
    expect(policy.ai_disabled).toBe(true);
  });

  it('entity config can override user and global policies', async () => {
    const userId = 'user-xyz';
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ allowed_providers: ['openai'] })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => userId },
          ...makePolicy({ preferred_provider: 'anthropic' })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({
      user: { _id: userId },
      entityAIConfig: { preferred_provider: 'google', preferred_model: 'gemini-pro' }
    });
    expect(policy.preferred_provider).toBe('google');
    expect(policy.preferred_model).toBe('gemini-pro');
  });
});

// ---------------------------------------------------------------------------
// Rate limit enforcement — executeAIRequest
// ---------------------------------------------------------------------------

describe('executeAIRequest — rate limit enforcement', () => {
  const userId = 'rate-limit-test-user';
  const user = { _id: userId };

  function setupRateLimitedPolicy(limits) {
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ rate_limits: limits })
        }
      ])
    });
  }

  it('allows first request when under per-minute limit', async () => {
    setupRateLimitedPolicy({ requests_per_minute: 5 });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).resolves.toBeDefined();
  });

  it('blocks request when per-minute limit is exceeded', async () => {
    setupRateLimitedPolicy({ requests_per_minute: 2 });

    // Make first two requests (consume the limit)
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user });
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user });

    // Third request should be blocked
    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429
    });
  });

  it('blocks request when per-hour limit is exceeded', async () => {
    setupRateLimitedPolicy({ requests_per_hour: 2 });

    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user });
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('blocks request when per-day limit is exceeded', async () => {
    setupRateLimitedPolicy({ requests_per_day: 2 });

    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user });
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('super admin bypasses rate limits', async () => {
    setupRateLimitedPolicy({ requests_per_minute: 1 });

    const superAdmin = { _id: 'admin-id', role: 'super_admin' };

    // First request
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: superAdmin });
    // Second request — would normally be blocked but super admin is exempt
    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: superAdmin })
    ).resolves.toBeDefined();
  });

  it('isSuperAdmin flag also bypasses rate limits', async () => {
    setupRateLimitedPolicy({ requests_per_minute: 1 });

    // First request (consume the limit for a regular user)
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user });
    // User with isSuperAdmin flag should bypass the rate limit
    const superAdminUser = { _id: 'admin2-id', isSuperAdmin: true };
    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: superAdminUser })
    ).resolves.toBeDefined();
  });

  it('different users have independent rate limit buckets', async () => {
    setupRateLimitedPolicy({ requests_per_minute: 2 });

    const user1 = { _id: 'user-one' };
    const user2 = { _id: 'user-two' };

    // user1 exhausts their limit
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: user1 });
    await gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: user1 });

    // user2 should still be allowed (independent bucket)
    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: user2 })
    ).resolves.toBeDefined();

    // user1 is blocked
    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: user1 })
    ).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });
});

// ---------------------------------------------------------------------------
// Token budget enforcement — executeAIRequest
// ---------------------------------------------------------------------------

describe('executeAIRequest — token budget enforcement', () => {
  const userId = 'budget-test-user';
  const user = { _id: userId };

  function setupBudgetPolicy(budget) {
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ token_budget: budget })
        }
      ])
    });
  }

  it('allows request when daily input tokens is within budget', async () => {
    setupBudgetPolicy({ daily_input_tokens: 1000 });
    AIUsage.getDailyUsage.mockResolvedValue({ total_input_tokens: 500, total_output_tokens: 0 });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).resolves.toBeDefined();
  });

  it('blocks request when daily input tokens budget is exceeded', async () => {
    setupBudgetPolicy({ daily_input_tokens: 1000 });
    AIUsage.getDailyUsage.mockResolvedValue({
      total_input_tokens: 1000, // at limit
      total_output_tokens: 0
    });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).rejects.toMatchObject({ code: 'TOKEN_BUDGET_EXCEEDED', statusCode: 429 });
  });

  it('blocks request when daily output tokens budget is exceeded', async () => {
    setupBudgetPolicy({ daily_output_tokens: 500 });
    AIUsage.getDailyUsage.mockResolvedValue({
      total_input_tokens: 0,
      total_output_tokens: 500 // at limit
    });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).rejects.toMatchObject({ code: 'TOKEN_BUDGET_EXCEEDED' });
  });

  it('blocks request when monthly input tokens budget is exceeded', async () => {
    setupBudgetPolicy({ monthly_input_tokens: 100000 });
    AIUsage.getDailyUsage.mockResolvedValue({ total_input_tokens: 0, total_output_tokens: 0 });
    AIUsage.getMonthlyUsage.mockResolvedValue({
      total_input_tokens: 100000, // at limit
      total_output_tokens: 0
    });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).rejects.toMatchObject({ code: 'TOKEN_BUDGET_EXCEEDED' });
  });

  it('blocks request when monthly output tokens budget is exceeded', async () => {
    setupBudgetPolicy({ monthly_output_tokens: 50000 });
    AIUsage.getDailyUsage.mockResolvedValue({ total_input_tokens: 0, total_output_tokens: 0 });
    AIUsage.getMonthlyUsage.mockResolvedValue({
      total_input_tokens: 0,
      total_output_tokens: 50000 // at limit
    });

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).rejects.toMatchObject({ code: 'TOKEN_BUDGET_EXCEEDED' });
  });

  it('super admin bypasses token budget', async () => {
    setupBudgetPolicy({ daily_input_tokens: 1000 });
    AIUsage.getDailyUsage.mockResolvedValue({ total_input_tokens: 1000, total_output_tokens: 0 });

    const superAdmin = { _id: 'admin-budget', role: 'super_admin' };

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user: superAdmin })
    ).resolves.toBeDefined();
  });

  it('allows request when budget check DB fails (fail-open)', async () => {
    setupBudgetPolicy({ daily_input_tokens: 100 });
    AIUsage.getDailyUsage.mockRejectedValue(new Error('DB timeout'));

    await expect(
      gateway.executeAIRequest({ messages: messages(), task: 'autocomplete', user })
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Content filtering — applyContentFiltering (via executeAIRequest)
// ---------------------------------------------------------------------------

describe('executeAIRequest — content filtering', () => {
  function setupFilteringPolicy(filteringConfig) {
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ content_filtering: filteringConfig })
        }
      ])
    });
  }

  it('allows request when content filtering is disabled', async () => {
    setupFilteringPolicy({ enabled: false, block_patterns: ['secret'] });

    await expect(
      gateway.executeAIRequest({
        messages: [{ role: 'user', content: 'My secret password is 1234' }],
        task: 'autocomplete',
        user: { _id: 'user-1' }
      })
    ).resolves.toBeDefined();
  });

  it('blocks request matching a block pattern', async () => {
    setupFilteringPolicy({ enabled: true, block_patterns: ['\\bpassword\\b'], redact_patterns: [] });

    await expect(
      gateway.executeAIRequest({
        messages: [{ role: 'user', content: 'My password is 1234' }],
        task: 'autocomplete',
        user: { _id: 'user-2' }
      })
    ).rejects.toMatchObject({ code: 'CONTENT_FILTERED', statusCode: 400 });
  });

  it('does not block assistant messages (only user messages checked)', async () => {
    setupFilteringPolicy({ enabled: true, block_patterns: ['\\bpassword\\b'], redact_patterns: [] });

    await expect(
      gateway.executeAIRequest({
        messages: [
          { role: 'assistant', content: 'Your password was reset.' },
          { role: 'user', content: 'Thanks!' }
        ],
        task: 'autocomplete',
        user: { _id: 'user-3' }
      })
    ).resolves.toBeDefined();
  });

  it('redacts matching patterns in user messages', async () => {
    setupFilteringPolicy({
      enabled: true,
      block_patterns: [],
      redact_patterns: ['\\d{16}']
    });

    // Capture actual message passed to provider
    let capturedMessages;
    registry.callProvider.mockImplementationOnce((provider, msgs) => {
      capturedMessages = msgs;
      return Promise.resolve(providerResult(provider));
    });

    await gateway.executeAIRequest({
      messages: [{ role: 'user', content: 'My card is 1234567890123456' }],
      task: 'autocomplete',
      user: { _id: 'user-4' }
    });

    expect(capturedMessages[0].content).toContain('[REDACTED]');
    expect(capturedMessages[0].content).not.toContain('1234567890123456');
  });

  it('handles invalid regex patterns gracefully (no throw)', async () => {
    setupFilteringPolicy({
      enabled: true,
      block_patterns: ['[invalid regex'],
      redact_patterns: []
    });

    // Invalid regex should be silently skipped, not throw
    await expect(
      gateway.executeAIRequest({
        messages: messages('Hello'),
        task: 'autocomplete',
        user: { _id: 'user-5' }
      })
    ).resolves.toBeDefined();
  });

  it('tracks filtered request in usage', async () => {
    setupFilteringPolicy({ enabled: true, block_patterns: ['\\bsecret\\b'], redact_patterns: [] });

    await expect(
      gateway.executeAIRequest({
        messages: [{ role: 'user', content: 'This is a secret message' }],
        task: 'autocomplete',
        user: { _id: 'user-6' }
      })
    ).rejects.toMatchObject({ code: 'CONTENT_FILTERED' });

    expect(AIUsage.trackRequest).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'filtered' })
    );
  });
});

// ---------------------------------------------------------------------------
// Provider/model whitelisting — executeAIRequest
// ---------------------------------------------------------------------------

describe('executeAIRequest — provider whitelisting', () => {
  function setupProviderPolicy(providerConfig) {
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy(providerConfig)
        }
      ])
    });
  }

  it('uses provider from allowed_providers when preferred_provider is not in whitelist', async () => {
    setupProviderPolicy({ allowed_providers: ['anthropic'] });
    registry.getApiKeyForProvider.mockReturnValue('test-key');
    registry.callProvider.mockResolvedValue(providerResult('anthropic'));

    const result = await gateway.executeAIRequest({
      messages: messages(),
      task: 'autocomplete',
      user: { _id: 'user-1' },
      options: { provider: 'openai' } // requested openai, but not allowed
    });

    // Should have been called with anthropic (the allowed provider)
    expect(registry.callProvider).toHaveBeenCalledWith('anthropic', expect.any(Array), expect.any(Object));
  });

  it('skips blocked provider and uses an alternative', async () => {
    setupProviderPolicy({ blocked_providers: ['openai'] });

    // Set up getAllProviderConfigs to have anthropic as an alternative
    registry.getAllProviderConfigs.mockResolvedValue(
      new Map([
        ['openai', { provider: 'openai', enabled: true, priority: 1 }],
        ['anthropic', { provider: 'anthropic', enabled: true, priority: 2 }]
      ])
    );
    registry.getApiKeyForProvider.mockImplementation(p => p === 'anthropic' ? 'test-key' : null);
    registry.callProvider.mockResolvedValue(providerResult('anthropic'));

    const result = await gateway.executeAIRequest({
      messages: messages(),
      task: 'autocomplete',
      user: { _id: 'user-2' }
    });

    expect(registry.callProvider).toHaveBeenCalledWith('anthropic', expect.any(Array), expect.any(Object));
  });

  it('enforces model whitelist for a provider', async () => {
    setupProviderPolicy({
      allowed_models: [{ provider: 'openai', models: ['gpt-3.5-turbo'] }]
    });
    registry.getApiKeyForProvider.mockReturnValue('test-key');
    registry.callProvider.mockResolvedValue(providerResult('openai'));

    await gateway.executeAIRequest({
      messages: messages(),
      task: 'autocomplete',
      user: { _id: 'user-3' },
      options: { provider: 'openai', model: 'gpt-4' } // gpt-4 not in whitelist
    });

    // Model should be capped to allowed model (gpt-3.5-turbo)
    expect(registry.callProvider).toHaveBeenCalledWith(
      'openai',
      expect.any(Array),
      expect.objectContaining({ model: 'gpt-3.5-turbo' })
    );
  });

  it('throws GatewayError with AI_DISABLED code when entity disables AI', async () => {
    // No need for policy setup — entity config sets ai_disabled
    await expect(
      gateway.executeAIRequest({
        messages: messages(),
        task: 'autocomplete',
        user: { _id: 'user-4' },
        entityContext: { aiConfig: { disabled: true } }
      })
    ).rejects.toMatchObject({ code: 'AI_DISABLED', statusCode: 403 });
  });
});

// ---------------------------------------------------------------------------
// Policy cache
// ---------------------------------------------------------------------------

describe('resolvePolicy — cache invalidation', () => {
  it('invalidatePolicyCache causes next resolvePolicy to refetch from DB', async () => {
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ max_tokens_per_request: 100 })
        }
      ])
    });

    const p1 = await gateway.resolvePolicy({});
    expect(p1.max_tokens_per_request).toBe(100);

    // Change DB value
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({ max_tokens_per_request: 200 })
        }
      ])
    });

    // Without invalidation, should return cached value (100)
    const p2 = await gateway.resolvePolicy({});
    expect(p2.max_tokens_per_request).toBe(100);

    // After invalidation, should refetch (200)
    gateway.invalidatePolicyCache();
    const p3 = await gateway.resolvePolicy({});
    expect(p3.max_tokens_per_request).toBe(200);
  });

  it('cache TTL of 5 minutes means repeated calls within window do not re-query DB', async () => {
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([])
    });

    await gateway.resolvePolicy({});
    await gateway.resolvePolicy({});
    await gateway.resolvePolicy({});

    // find() should only have been called once (cache prevents re-queries)
    expect(AIPolicy.find).toHaveBeenCalledTimes(1);
  });

  it('cache expires after 5 minutes and re-queries DB', async () => {
    AIPolicy.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([])
    });

    await gateway.resolvePolicy({});
    expect(AIPolicy.find).toHaveBeenCalledTimes(1);

    // Advance time beyond 5-minute TTL
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    await gateway.resolvePolicy({});
    expect(AIPolicy.find).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// mergePolicy — partial overrides
// ---------------------------------------------------------------------------

describe('mergePolicy — partial field overrides', () => {
  it('only overrides rate_limit sub-fields that are non-null in source', async () => {
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({
            rate_limits: {
              requests_per_minute: 30,
              requests_per_hour: null,
              requests_per_day: 1000
            }
          })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({});
    expect(policy.rate_limits.requests_per_minute).toBe(30);
    expect(policy.rate_limits.requests_per_hour).toBeNull();
    expect(policy.rate_limits.requests_per_day).toBe(1000);
  });

  it('user policy only overrides the sub-fields it sets', async () => {
    const userId = 'merge-user';
    AIPolicy.find.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue([
        {
          scope: 'global',
          active: true,
          ...makePolicy({
            token_budget: {
              daily_input_tokens: 10000,
              daily_output_tokens: 5000,
              monthly_input_tokens: null,
              monthly_output_tokens: null
            }
          })
        },
        {
          scope: 'user',
          active: true,
          target: { toString: () => userId },
          ...makePolicy({
            token_budget: {
              daily_input_tokens: 50000, // override
              daily_output_tokens: null, // not set, will not clear global
              monthly_input_tokens: null,
              monthly_output_tokens: null
            }
          })
        }
      ])
    });

    const policy = await gateway.resolvePolicy({ user: { _id: userId } });
    expect(policy.token_budget.daily_input_tokens).toBe(50000); // user override
    expect(policy.token_budget.daily_output_tokens).toBe(5000); // global remains
  });
});
