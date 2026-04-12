/**
 * Tests for signals-config scalar keys (SIGNALS_STALENESS_MS, AFFINITY_CACHE_TTL_MS).
 * These are top-level scalars, not weight groups — they must NOT be normalised.
 */

describe('signals-config scalar keys', () => {
  let config;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.SIGNALS_CONFIG;
    config = require('../../utilities/signals-config');
  });

  test('exports SIGNALS_STALENESS_MS with default 15 minutes', () => {
    expect(config.SIGNALS_STALENESS_MS).toBe(15 * 60 * 1000);
  });

  test('exports AFFINITY_CACHE_TTL_MS with default 6 hours', () => {
    expect(config.AFFINITY_CACHE_TTL_MS).toBe(6 * 60 * 60 * 1000);
  });

  test('SIGNALS_CONFIG env override applies to scalar keys', () => {
    jest.resetModules();
    process.env.SIGNALS_CONFIG = JSON.stringify({ SIGNALS_STALENESS_MS: 60000 });
    const overridden = require('../../utilities/signals-config');
    expect(overridden.SIGNALS_STALENESS_MS).toBe(60000);
    delete process.env.SIGNALS_CONFIG;
  });

  test('scalar keys are NOT normalised (values preserved as-is)', () => {
    // If normalised as a weight group, the value would be 1.0 (sum normalised).
    // Check they retain their millisecond values.
    expect(config.SIGNALS_STALENESS_MS).toBeGreaterThan(1000);
    expect(config.AFFINITY_CACHE_TTL_MS).toBeGreaterThan(1000);
  });

  test('invalid scalar override falls back to default', () => {
    jest.resetModules();
    process.env.SIGNALS_CONFIG = JSON.stringify({
      SIGNALS_STALENESS_MS: 0,
      AFFINITY_CACHE_TTL_MS: -1,
    });
    const config = require('../../utilities/signals-config');
    expect(config.SIGNALS_STALENESS_MS).toBe(15 * 60 * 1000);
    expect(config.AFFINITY_CACHE_TTL_MS).toBe(6 * 60 * 60 * 1000);
    delete process.env.SIGNALS_CONFIG;
  });
});
