'use strict';

/**
 * Tests for the appendAffinityBlock behaviour in bienbot-context-builders.
 *
 * appendAffinityBlock is a local (unexported) helper, so we test it indirectly
 * by mocking affinityCache and calling buildContextForInvokeContext with
 * entity === 'experience'. The [AFFINITY] line should appear (or not) in the
 * returned string based on the cache entry.
 */

jest.mock('../../utilities/affinity-cache');
jest.mock('../../utilities/permission-enforcer', () => ({
  getEnforcer: () => ({
    canView: jest.fn().mockResolvedValue({ allowed: true }),
  }),
}));
jest.mock('../../utilities/controller-helpers', () => ({
  validateObjectId: (id) => ({ valid: !!id && id.length >= 24, objectId: id }),
}));
jest.mock('../../utilities/fuzzy-match', () => ({ findSimilarItems: jest.fn() }));
jest.mock('../../utilities/hidden-signals', () => ({
  aggregateGroupSignals: jest.fn(),
  applySignalDecay: jest.fn(s => s),
  signalsToNaturalLanguage: jest.fn(() => null),
  computePopularityScore: jest.fn(() => 0.5),
  computeAffinityScore: jest.fn(() => 0.5),
}));
jest.mock('../../utilities/signals-config', () => ({
  formula: { adaptiveFactor: 0.4, trustScore: 0.2, popularity: 0.2, recencyBoost: 0.1, affinity: 0.1 },
}));
jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Minimal Experience model mock
const mockExperience = {
  _id: '64f1234567890abcdef12345',
  name: 'Test Experience',
  destination: { _id: '64f1234567890abcdef12346', name: 'Test Destination' },
  plan_items: [],
  overview: null,
  experience_type: [],
  difficulty: null,
  rating: null,
  visibility: null,
  signal_tags: [],
  cost_estimate: 0,
  max_planning_days: 1,
};

jest.mock('../../models/experience', () => ({
  findById: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(mockExperience),
  }),
}));
jest.mock('../../models/plan', () => ({
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  }),
  findOne: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    populate: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }),
  }),
  find: jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }),
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
  }),
}));
jest.mock('../../models/destination', () => ({}));
jest.mock('../../models/user', () => ({
  findById: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
  }),
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
  }),
}));
jest.mock('../../models/activity', () => ({}));

const affinityCache = require('../../utilities/affinity-cache');
const { buildContextForInvokeContext } = require('../../utilities/bienbot-context-builders');

const VALID_EXPERIENCE_ID = '64f1234567890abcdef12345';
const VALID_USER_ID = '64f1234567890abcdef12399';

const invokeCtx = {
  entity: 'experience',
  entity_id: VALID_EXPERIENCE_ID,
  entity_label: 'Test Experience',
};

describe('appendAffinityBlock (via buildContextForInvokeContext)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('appends [AFFINITY] line when score is 0.82 with 2 top_dims (strong alignment)', async () => {
    affinityCache.getAffinityEntry.mockResolvedValue({
      score: 0.82,
      top_dims: [{ dim: 'adventure' }, { dim: 'outdoor' }],
    });

    const result = await buildContextForInvokeContext(invokeCtx, VALID_USER_ID);

    expect(result).toContain('[AFFINITY]');
    expect(result).toContain('0.82');
    expect(result).toContain('strong alignment');
    expect(result).toContain('adventure');
    expect(result).toContain('outdoor');
  });

  test('does NOT append [AFFINITY] when score is 0.52 (within ±0.05 of neutral 0.5)', async () => {
    affinityCache.getAffinityEntry.mockResolvedValue({
      score: 0.52,
      top_dims: [{ dim: 'adventure' }],
    });

    const result = await buildContextForInvokeContext(invokeCtx, VALID_USER_ID);

    expect(result).not.toContain('[AFFINITY]');
  });

  test('does NOT append [AFFINITY] when entry is null (cache miss)', async () => {
    affinityCache.getAffinityEntry.mockResolvedValue(null);

    const result = await buildContextForInvokeContext(invokeCtx, VALID_USER_ID);

    expect(result).not.toContain('[AFFINITY]');
  });

  test('does NOT append [AFFINITY] when top_dims is empty', async () => {
    affinityCache.getAffinityEntry.mockResolvedValue({
      score: 0.82,
      top_dims: [],
    });

    const result = await buildContextForInvokeContext(invokeCtx, VALID_USER_ID);

    expect(result).not.toContain('[AFFINITY]');
  });

  test('uses "strong alignment" label for score > 0.6', async () => {
    affinityCache.getAffinityEntry.mockResolvedValue({
      score: 0.75,
      top_dims: [{ dim: 'cultural' }],
    });

    const result = await buildContextForInvokeContext(invokeCtx, VALID_USER_ID);

    expect(result).toContain('strong alignment');
  });

  test('uses "low alignment" label for score < 0.4', async () => {
    affinityCache.getAffinityEntry.mockResolvedValue({
      score: 0.25,
      top_dims: [{ dim: 'nightlife' }],
    });

    const result = await buildContextForInvokeContext(invokeCtx, VALID_USER_ID);

    expect(result).toContain('[AFFINITY]');
    expect(result).toContain('low alignment');
  });

  test('uses "moderate alignment" label for score in 0.4–0.6 range (but > ±0.05 from neutral)', async () => {
    // score = 0.42: abs(0.42 - 0.5) = 0.08 > 0.05, and 0.4 <= 0.42 <= 0.6
    affinityCache.getAffinityEntry.mockResolvedValue({
      score: 0.42,
      top_dims: [{ dim: 'wellness' }],
    });

    const result = await buildContextForInvokeContext(invokeCtx, VALID_USER_ID);

    expect(result).toContain('[AFFINITY]');
    expect(result).toContain('moderate alignment');
  });
});
