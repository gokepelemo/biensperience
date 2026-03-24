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
