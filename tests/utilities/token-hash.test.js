const { generateRawToken, hashToken, compareToken } = require('../../utilities/token-hash');

describe('token-hash helper', () => {
  describe('generateRawToken', () => {
    it('returns a 64-char hex string (32 random bytes)', () => {
      const t = generateRawToken();
      expect(typeof t).toBe('string');
      expect(t).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns distinct tokens on each call', () => {
      const a = generateRawToken();
      const b = generateRawToken();
      expect(a).not.toBe(b);
    });
  });

  describe('hashToken', () => {
    it('returns deterministic 64-char hex hash', () => {
      const raw = 'abc123';
      const h1 = hashToken(raw);
      const h2 = hashToken(raw);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });

    it('throws on empty or non-string input', () => {
      expect(() => hashToken('')).toThrow(TypeError);
      expect(() => hashToken(null)).toThrow(TypeError);
      expect(() => hashToken(undefined)).toThrow(TypeError);
      expect(() => hashToken(123)).toThrow(TypeError);
    });
  });

  describe('compareToken', () => {
    it('returns true when raw matches stored hash', () => {
      const raw = generateRawToken();
      const stored = hashToken(raw);
      expect(compareToken(raw, stored)).toBe(true);
    });

    it('returns false when raw does not match', () => {
      const stored = hashToken('correct');
      expect(compareToken('wrong', stored)).toBe(false);
    });

    it('returns false on malformed stored hash', () => {
      expect(compareToken('anything', 'short')).toBe(false);
      expect(compareToken('anything', '')).toBe(false);
    });

    it('returns false on non-string inputs', () => {
      expect(compareToken(null, hashToken('x'))).toBe(false);
      expect(compareToken('x', null)).toBe(false);
    });
  });
});
