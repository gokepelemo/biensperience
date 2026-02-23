import { hashData } from '../../src/utilities/data-hash';

describe('hashData', () => {
  describe('basic types', () => {
    it('returns 0 for null', () => {
      expect(hashData(null)).toBe(0);
    });

    it('returns 0 for undefined', () => {
      expect(hashData(undefined)).toBe(0);
    });

    it('hashes primitive strings', () => {
      const hash = hashData('hello');
      expect(typeof hash).toBe('number');
      expect(hash).not.toBe(0);
    });

    it('hashes primitive numbers', () => {
      const hash = hashData(42);
      expect(typeof hash).toBe('number');
      expect(hash).not.toBe(0);
    });

    it('hashes booleans', () => {
      expect(hashData(true)).not.toBe(hashData(false));
    });
  });

  describe('stability', () => {
    it('returns the same hash for identical objects', () => {
      const obj = { name: 'Test', count: 5, active: true };
      expect(hashData(obj)).toBe(hashData({ ...obj }));
    });

    it('returns the same hash regardless of key order', () => {
      const a = { name: 'Test', count: 5 };
      const b = { count: 5, name: 'Test' };
      expect(hashData(a)).toBe(hashData(b));
    });

    it('returns the same hash for deeply nested objects with different key order', () => {
      const a = { outer: { b: 2, a: 1 }, name: 'test' };
      const b = { name: 'test', outer: { a: 1, b: 2 } };
      expect(hashData(a)).toBe(hashData(b));
    });

    it('returns consistent hash across multiple calls', () => {
      const data = { plans: [{ id: 1 }, { id: 2 }], total: 100 };
      const hash1 = hashData(data);
      const hash2 = hashData(data);
      const hash3 = hashData(data);
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('differentiation', () => {
    it('returns different hashes for different values', () => {
      expect(hashData({ a: 1 })).not.toBe(hashData({ a: 2 }));
    });

    it('returns different hashes for different keys', () => {
      expect(hashData({ a: 1 })).not.toBe(hashData({ b: 1 }));
    });

    it('returns different hashes for different array orders', () => {
      expect(hashData([1, 2, 3])).not.toBe(hashData([3, 2, 1]));
    });

    it('returns different hashes for different nested values', () => {
      const a = { user: { name: 'Alice' } };
      const b = { user: { name: 'Bob' } };
      expect(hashData(a)).not.toBe(hashData(b));
    });
  });

  describe('ignoreKeys', () => {
    it('ignores __ctx_merged_at by default', () => {
      const a = { name: 'Test', __ctx_merged_at: 1000 };
      const b = { name: 'Test', __ctx_merged_at: 2000 };
      expect(hashData(a)).toBe(hashData(b));
    });

    it('ignores _optimistic by default', () => {
      const a = { name: 'Test', _optimistic: true };
      const b = { name: 'Test', _optimistic: false };
      expect(hashData(a)).toBe(hashData(b));
    });

    it('produces same hash with and without ignored keys', () => {
      const withMeta = { name: 'Test', __ctx_merged_at: 999, _optimistic: true };
      const withoutMeta = { name: 'Test' };
      expect(hashData(withMeta)).toBe(hashData(withoutMeta));
    });

    it('supports custom ignoreKeys', () => {
      const a = { name: 'Test', version: 1 };
      const b = { name: 'Test', version: 99 };
      expect(hashData(a, { ignoreKeys: ['version'] }))
        .toBe(hashData(b, { ignoreKeys: ['version'] }));
    });

    it('ignores nested keys matching ignoreKeys', () => {
      const a = { data: { value: 1, __ctx_merged_at: 100 } };
      const b = { data: { value: 1, __ctx_merged_at: 200 } };
      expect(hashData(a)).toBe(hashData(b));
    });
  });

  describe('arrays', () => {
    it('hashes arrays correctly', () => {
      const hash = hashData([1, 2, 3]);
      expect(typeof hash).toBe('number');
    });

    it('preserves array order', () => {
      expect(hashData([1, 2])).not.toBe(hashData([2, 1]));
    });

    it('handles arrays of objects', () => {
      const a = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
      const b = [{ name: 'A', id: 1 }, { name: 'B', id: 2 }]; // Different key order
      expect(hashData(a)).toBe(hashData(b));
    });
  });

  describe('edge cases', () => {
    it('handles empty objects', () => {
      expect(hashData({})).toBe(hashData({}));
    });

    it('handles empty arrays', () => {
      expect(hashData([])).toBe(hashData([]));
    });

    it('differentiates empty object from empty array', () => {
      expect(hashData({})).not.toBe(hashData([]));
    });
  });
});
