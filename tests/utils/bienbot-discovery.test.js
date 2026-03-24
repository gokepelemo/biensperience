/**
 * Unit tests for discovery engine helpers
 *
 * Tests:
 * - getCacheKey() determinism, normalization, cross-destination
 * - computeAdaptiveWeights() weight shifts, sum invariant, floors
 * - computeCostAlignment() boundary values
 * - normalizeCostToPercentile() ranking, edge cases
 * - generateMatchReason() templates, dominant signal
 */

const {
  getCacheKey,
  createDiscoveryCache
} = require('../../utilities/discovery-cache');

describe('discovery-cache', () => {
  describe('getCacheKey', () => {
    test('produces deterministic key from sorted activity types', () => {
      const key1 = getCacheKey({ activity_types: ['adventure', 'culinary'] });
      const key2 = getCacheKey({ activity_types: ['culinary', 'adventure'] });
      expect(key1).toBe(key2);
      expect(key1).toBe('bien:discovery:adventure,culinary|all|none');
    });

    test('normalizes destination name to lowercase trimmed', () => {
      const key = getCacheKey({ activity_types: ['culinary'], destination_name: '  Paris  ' });
      expect(key).toBe('bien:discovery:culinary|paris|none');
    });

    test('prefers destination_id over destination_name', () => {
      const key = getCacheKey({
        activity_types: ['culinary'],
        destination_id: '507f1f77bcf86cd799439011',
        destination_name: 'Paris'
      });
      expect(key).toBe('bien:discovery:culinary|507f1f77bcf86cd799439011|none');
    });

    test('uses "all" for cross-destination queries', () => {
      const key = getCacheKey({ activity_types: ['culinary'], cross_destination: true, destination_name: 'Paris' });
      expect(key).toBe('bien:discovery:culinary|all|none');
    });

    test('includes max_cost in key', () => {
      const key = getCacheKey({ activity_types: ['budget'], max_cost: 100 });
      expect(key).toBe('bien:discovery:budget|all|100');
    });

    test('handles empty filters', () => {
      const key = getCacheKey({});
      expect(key).toBe('bien:discovery:|all|none');
    });
  });
});

// ---------------------------------------------------------------------------
// Ranking helper tests
// ---------------------------------------------------------------------------

const {
  computeAdaptiveWeights,
  computeCostAlignment,
  normalizeCostToPercentile,
  generateMatchReason,
  expandActivityTypes,
  computeRecencyScore,
  SEMANTIC_ACTIVITY_MAP
} = require('../../utilities/bienbot-context-builders');

describe('ranking helpers', () => {
  describe('expandActivityTypes', () => {
    test('expands semantic categories to activity types', () => {
      const result = expandActivityTypes(['culinary']);
      expect(result).toEqual(expect.arrayContaining(['food', 'drinks', 'coffee', 'market', 'local']));
    });

    test('passes through unknown types as-is', () => {
      const result = expandActivityTypes(['food', 'unknown_type']);
      expect(result).toContain('food');
      expect(result).toContain('unknown_type');
    });

    test('deduplicates across categories', () => {
      const result = expandActivityTypes(['culinary', 'nightlife']); // both have 'drinks'
      const drinksCount = result.filter(t => t === 'drinks').length;
      expect(drinksCount).toBe(1);
    });

    test('returns empty array for empty input', () => {
      expect(expandActivityTypes([])).toEqual([]);
      expect(expandActivityTypes(undefined)).toEqual([]);
    });
  });

  describe('SEMANTIC_ACTIVITY_MAP', () => {
    test('has 14 categories', () => {
      expect(Object.keys(SEMANTIC_ACTIVITY_MAP)).toHaveLength(14);
    });

    test('includes all new categories', () => {
      const keys = Object.keys(SEMANTIC_ACTIVITY_MAP);
      ['family-friendly', 'budget', 'romantic', 'solo', 'photography',
       'historical', 'beach', 'mountain', 'urban'].forEach(cat => {
        expect(keys).toContain(cat);
      });
    });
  });

  describe('computeAdaptiveWeights', () => {
    test('returns default weights for null signals', () => {
      const weights = computeAdaptiveWeights(null);
      expect(weights.plan_count).toBeCloseTo(0.30);
      expect(weights.completion_rate).toBeCloseTo(0.25);
      expect(weights.recency).toBeCloseTo(0.20);
      expect(weights.collaborators).toBeCloseTo(0.10);
      expect(weights.cost_alignment).toBeCloseTo(0.15);
    });

    test('returns default weights for low-confidence signals', () => {
      const weights = computeAdaptiveWeights({ confidence: 0.1, budget_sensitivity: 0.9 });
      expect(weights.plan_count).toBeCloseTo(0.30);
    });

    test('boosts cost_alignment for budget-sensitive users', () => {
      const weights = computeAdaptiveWeights({ confidence: 0.5, budget_sensitivity: 0.8 });
      expect(weights.cost_alignment).toBeGreaterThan(0.15);
      expect(weights.plan_count).toBeLessThan(0.30);
    });

    test('boosts collaborators for social users', () => {
      const weights = computeAdaptiveWeights({ confidence: 0.5, social: 0.8 });
      expect(weights.collaborators).toBeGreaterThan(0.10);
    });

    test('boosts completion_rate for structured users', () => {
      const weights = computeAdaptiveWeights({ confidence: 0.5, structure: 0.8 });
      expect(weights.completion_rate).toBeGreaterThan(0.25);
    });

    test('boosts recency for novelty-seeking users', () => {
      const weights = computeAdaptiveWeights({ confidence: 0.5, novelty: 0.8 });
      expect(weights.recency).toBeGreaterThan(0.20);
    });

    test('weights always sum to 1.0', () => {
      const weights = computeAdaptiveWeights({
        confidence: 0.9,
        budget_sensitivity: 0.9,
        social: 0.9,
        structure: 0.9,
        novelty: 0.9
      });
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    test('enforces minimum weight floor of 0.05', () => {
      const weights = computeAdaptiveWeights({
        confidence: 0.9,
        budget_sensitivity: 0.9,
        structure: 0.9 // both reduce plan_count by 0.10
      });
      Object.values(weights).forEach(w => {
        expect(w).toBeGreaterThanOrEqual(0.049); // allow float imprecision
      });
    });
  });

  describe('normalizeCostToPercentile', () => {
    test('returns 0.0 for cheapest', () => {
      expect(normalizeCostToPercentile(10, [10, 50, 100])).toBeCloseTo(0.0);
    });

    test('returns 1.0 for most expensive', () => {
      expect(normalizeCostToPercentile(100, [10, 50, 100])).toBeCloseTo(1.0);
    });

    test('returns 0.5 for middle', () => {
      expect(normalizeCostToPercentile(50, [10, 50, 100])).toBeCloseTo(0.5);
    });

    test('returns 0.5 for empty array', () => {
      expect(normalizeCostToPercentile(50, [])).toBeCloseTo(0.5);
    });

    test('returns 0.5 for single-element array', () => {
      expect(normalizeCostToPercentile(50, [50])).toBeCloseTo(0.5);
    });
  });

  describe('computeCostAlignment', () => {
    test('returns 0.5 for null signals', () => {
      expect(computeCostAlignment(100, null, [100])).toBeCloseTo(0.5);
    });

    test('returns 0.5 for null cost', () => {
      expect(computeCostAlignment(null, { budget_sensitivity: 0.5 }, [100])).toBeCloseTo(0.5);
    });

    test('high alignment: budget-sensitive user + cheap experience', () => {
      const score = computeCostAlignment(10, { budget_sensitivity: 0.9 }, [10, 50, 100]);
      expect(score).toBeGreaterThan(0.7);
    });

    test('low alignment: budget-sensitive user + expensive experience', () => {
      const score = computeCostAlignment(100, { budget_sensitivity: 0.9 }, [10, 50, 100]);
      expect(score).toBeLessThan(0.3);
    });
  });

  describe('computeRecencyScore', () => {
    test('returns ~1.0 for today', () => {
      const score = computeRecencyScore(new Date());
      expect(score).toBeGreaterThan(0.95);
    });

    test('returns ~0.7 for 90 days ago', () => {
      const date = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const score = computeRecencyScore(date);
      expect(score).toBeGreaterThan(0.5);
      expect(score).toBeLessThan(0.85);
    });

    test('returns low score for 365 days ago', () => {
      const date = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const score = computeRecencyScore(date);
      expect(score).toBeLessThan(0.3);
    });

    test('returns 0 for null date', () => {
      expect(computeRecencyScore(null)).toBe(0);
    });
  });

  describe('generateMatchReason', () => {
    const baseCandidate = {
      co_occurrence_count: 12,
      avg_completion_rate: 0.78,
      collaborator_count: 8,
      recency_score: 0.6,
      cost_estimate: 50
    };
    const defaultWeights = {
      plan_count: 0.30,
      completion_rate: 0.25,
      recency: 0.20,
      collaborators: 0.10,
      cost_alignment: 0.15
    };

    test('produces a non-empty string', () => {
      const reason = generateMatchReason(baseCandidate, defaultWeights, ['culinary']);
      expect(reason).toBeTruthy();
      expect(typeof reason).toBe('string');
    });

    test('includes category phrase', () => {
      const reason = generateMatchReason(baseCandidate, defaultWeights, ['culinary']);
      expect(reason.toLowerCase()).toContain('culinary');
    });

    test('includes dominant signal template', () => {
      // plan_count is dominant at 0.30
      const reason = generateMatchReason(baseCandidate, defaultWeights, ['adventure']);
      expect(reason).toContain('similar travelers');
    });
  });
});
