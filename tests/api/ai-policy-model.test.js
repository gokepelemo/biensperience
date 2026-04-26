/**
 * Tests for the AIPolicy Mongoose model.
 *
 * Schema validators run in-memory via doc.validate() without a DB connection.
 * findEffective is exercised by stubbing the model's findOne chain.
 *
 * @see models/ai-policy.js
 */

jest.mock('../../utilities/ai-gateway', () => ({
  invalidatePolicyCache: jest.fn()
}));

const mongoose = require('mongoose');
const AIPolicy = require('../../models/ai-policy');

function basePolicy(overrides = {}) {
  return {
    name: 'Test Policy',
    scope: 'global',
    target: null,
    ...overrides
  };
}

describe('AIPolicy schema — taskRoutingSchema validator', () => {
  it('rejects a routing entry with neither task nor intent', async () => {
    const doc = new AIPolicy(basePolicy({
      task_routing: [{ provider: 'openai' }]
    }));
    await expect(doc.validate()).rejects.toThrow(/task or an intent/);
  });

  it('accepts a routing entry with task set', async () => {
    const doc = new AIPolicy(basePolicy({
      task_routing: [{ task: 'summarize', provider: 'openai' }]
    }));
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it('accepts a routing entry with intent set', async () => {
    const doc = new AIPolicy(basePolicy({
      task_routing: [{ intent: 'ask_question', provider: 'anthropic' }]
    }));
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it('lowercases intent to match task normalization', async () => {
    const doc = new AIPolicy(basePolicy({
      task_routing: [{ intent: 'Ask_Question', provider: 'OPENAI' }]
    }));
    await doc.validate();
    expect(doc.task_routing[0].intent).toBe('ask_question');
    expect(doc.task_routing[0].provider).toBe('openai');
  });

  it('rejects an unsupported provider in routing', async () => {
    const doc = new AIPolicy(basePolicy({
      task_routing: [{ task: 'summarize', provider: 'bogus' }]
    }));
    await expect(doc.validate()).rejects.toThrow();
  });
});

describe('AIPolicy schema — scope ↔ target consistency', () => {
  it('rejects user-scope without target', async () => {
    const doc = new AIPolicy(basePolicy({ scope: 'user', target: null }));
    await expect(doc.validate()).rejects.toThrow(/user-scoped policy requires a target/);
  });

  it('rejects global-scope with a target', async () => {
    const doc = new AIPolicy(basePolicy({
      scope: 'global',
      target: new mongoose.Types.ObjectId()
    }));
    await expect(doc.validate()).rejects.toThrow(/global-scoped policy must have null target/);
  });

  it('accepts global-scope with null target', async () => {
    const doc = new AIPolicy(basePolicy({ scope: 'global', target: null }));
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  it('accepts user-scope with a target', async () => {
    const doc = new AIPolicy(basePolicy({
      scope: 'user',
      target: new mongoose.Types.ObjectId()
    }));
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});

describe('AIPolicy schema — provider list validation', () => {
  it('rejects overlap between allowed_providers and blocked_providers', async () => {
    const doc = new AIPolicy(basePolicy({
      allowed_providers: ['openai', 'anthropic'],
      blocked_providers: ['anthropic']
    }));
    await expect(doc.validate()).rejects.toThrow(/cannot appear in both/);
  });

  it('detects overlap case-insensitively (post-normalization)', async () => {
    const doc = new AIPolicy(basePolicy({
      allowed_providers: ['OpenAI'],
      blocked_providers: ['openai']
    }));
    await expect(doc.validate()).rejects.toThrow(/cannot appear in both/);
  });

  it('rejects unsupported providers in allowed/blocked/fallback lists', async () => {
    for (const key of ['allowed_providers', 'blocked_providers', 'fallback_providers']) {
      const doc = new AIPolicy(basePolicy({ [key]: ['notreal'] }));
      await expect(doc.validate()).rejects.toThrow();
    }
  });

  it('lowercases providers across all provider lists', async () => {
    const doc = new AIPolicy(basePolicy({
      allowed_providers: ['OPENAI'],
      fallback_providers: ['Anthropic'],
      blocked_providers: ['Mistral']
    }));
    await doc.validate();
    expect(doc.allowed_providers).toEqual(['openai']);
    expect(doc.fallback_providers).toEqual(['anthropic']);
    expect(doc.blocked_providers).toEqual(['mistral']);
  });
});

describe('AIPolicy schema — content filtering regex validation', () => {
  it('rejects a malformed regex in block_patterns', async () => {
    const doc = new AIPolicy(basePolicy({
      content_filtering: { enabled: true, block_patterns: ['('], redact_patterns: [] }
    }));
    await expect(doc.validate()).rejects.toThrow(/catastrophic|Invalid/);
  });

  it('rejects a nested-quantifier regex (ReDoS heuristic)', async () => {
    const doc = new AIPolicy(basePolicy({
      content_filtering: { enabled: true, block_patterns: ['(a+)+'], redact_patterns: [] }
    }));
    await expect(doc.validate()).rejects.toThrow(/catastrophic|Invalid/);
  });

  it('rejects a nested-quantifier regex in redact_patterns', async () => {
    const doc = new AIPolicy(basePolicy({
      content_filtering: { enabled: true, block_patterns: [], redact_patterns: ['(.+)+$'] }
    }));
    await expect(doc.validate()).rejects.toThrow(/catastrophic|Invalid/);
  });

  it('accepts a simple valid regex', async () => {
    const doc = new AIPolicy(basePolicy({
      content_filtering: {
        enabled: true,
        block_patterns: ['\\bpassword\\s*=\\s*\\S+'],
        redact_patterns: ['\\b\\d{3}-\\d{2}-\\d{4}\\b']
      }
    }));
    await expect(doc.validate()).resolves.toBeUndefined();
  });
});

describe('AIPolicy schema — allowedModelSchema normalization', () => {
  it('lowercases provider and model names', async () => {
    const doc = new AIPolicy(basePolicy({
      allowed_models: [{ provider: 'OpenAI', models: ['GPT-4o-Mini', ' gpt-4o '] }]
    }));
    await doc.validate();
    expect(doc.allowed_models[0].provider).toBe('openai');
    expect(doc.allowed_models[0].models).toEqual(['gpt-4o-mini', 'gpt-4o']);
  });

  it('rejects an unsupported provider in allowed_models', async () => {
    const doc = new AIPolicy(basePolicy({
      allowed_models: [{ provider: 'fakeprovider', models: [] }]
    }));
    await expect(doc.validate()).rejects.toThrow();
  });
});

describe('AIPolicy static — findEffective', () => {
  let findOneSpy;

  beforeEach(() => {
    findOneSpy = jest.spyOn(AIPolicy, 'findOne');
  });

  afterEach(() => {
    findOneSpy.mockRestore();
  });

  function mockFindOne(result) {
    findOneSpy.mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(result) });
  }

  it('returns user policy when one exists', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const userPolicy = { name: 'User Policy', scope: 'user', target: userId };
    mockFindOne(userPolicy);

    const result = await AIPolicy.findEffective(userId);

    expect(result).toBe(userPolicy);
    expect(findOneSpy).toHaveBeenCalledTimes(1);
    expect(findOneSpy).toHaveBeenCalledWith({ scope: 'user', target: userId, active: true });
  });

  it('falls back to global when user policy does not exist', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const globalPolicy = { name: 'Global', scope: 'global', target: null };
    mockFindOne(null);          // user lookup misses
    mockFindOne(globalPolicy);  // global lookup hits

    const result = await AIPolicy.findEffective(userId);

    expect(result).toBe(globalPolicy);
    expect(findOneSpy).toHaveBeenCalledTimes(2);
    expect(findOneSpy).toHaveBeenNthCalledWith(2, { scope: 'global', active: true });
  });

  it('returns global directly when userId is null', async () => {
    const globalPolicy = { name: 'Global', scope: 'global' };
    mockFindOne(globalPolicy);

    const result = await AIPolicy.findEffective(null);

    expect(result).toBe(globalPolicy);
    expect(findOneSpy).toHaveBeenCalledTimes(1);
    expect(findOneSpy).toHaveBeenCalledWith({ scope: 'global', active: true });
  });

  it('returns null when neither user nor global policy exists', async () => {
    mockFindOne(null);
    mockFindOne(null);
    const result = await AIPolicy.findEffective(new mongoose.Types.ObjectId().toString());
    expect(result).toBeNull();
  });
});

describe('AIPolicy — SUPPORTED_PROVIDERS export', () => {
  it('exposes the canonical provider list', () => {
    expect(AIPolicy.SUPPORTED_PROVIDERS).toEqual(['openai', 'anthropic', 'mistral', 'gemini']);
  });
});
