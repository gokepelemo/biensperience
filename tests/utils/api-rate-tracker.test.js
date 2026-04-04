jest.mock('../../utilities/backend-logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Re-require both modules fresh for each test to avoid shared state.
// resetModules clears the registry so the tracker gets a new backend-logger
// instance — we must re-require logger too so our spy matches what the tracker uses.
let tracker;
let logger;
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  tracker = require('../../utilities/api-rate-tracker');
  logger = require('../../utilities/backend-logger');
});

describe('api-rate-tracker', () => {
  describe('checkBudget()', () => {
    it('returns allowed:true and full remaining when unused', () => {
      const result = tracker.checkBudget('unsplash');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('returns allowed:false when limit is reached', () => {
      // Record usage up to the limit
      tracker.recordUsage('unsplash', 50);
      const result = tracker.checkBudget('unsplash');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('prunes timestamps older than the window', () => {
      jest.useFakeTimers();
      // Record 50 requests at time 0
      tracker.recordUsage('unsplash', 50);
      expect(tracker.checkBudget('unsplash').allowed).toBe(false);

      // Advance past the 1-hour window
      jest.advanceTimersByTime(3_600_001);
      const result = tracker.checkBudget('unsplash');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50);
      jest.useRealTimers();
    });

    it('returns resetAt = oldest_timestamp + windowMs when full', () => {
      jest.useFakeTimers();
      const now = Date.now();
      tracker.recordUsage('unsplash', 50);
      const result = tracker.checkBudget('unsplash');
      expect(result.resetAt.getTime()).toBeCloseTo(now + 3_600_000, -3);
      jest.useRealTimers();
    });

    it('fails open for unknown provider', () => {
      const result = tracker.checkBudget('unknown_provider');
      expect(result.allowed).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('recordUsage()', () => {
    it('decrements remaining by count', () => {
      tracker.recordUsage('unsplash', 10);
      expect(tracker.checkBudget('unsplash').remaining).toBe(40);
    });

    it('logs a warning when crossing 80% threshold', () => {
      tracker.recordUsage('unsplash', 40); // 80% exactly
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unsplash'),
        expect.objectContaining({ provider: 'unsplash', used: 40, limit: 50 })
      );
    });

    it('does not log warning below 80%', () => {
      tracker.recordUsage('unsplash', 39); // 78%
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('logs an error for unknown provider and does not throw', () => {
      expect(() => tracker.recordUsage('unknown_provider', 1)).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getStatus()', () => {
    it('returns all providers when no argument given', () => {
      const status = tracker.getStatus();
      expect(status).toHaveProperty('unsplash');
      expect(status).toHaveProperty('google_maps_text_search');
      expect(status).toHaveProperty('google_maps_photos');
      expect(status).toHaveProperty('tripadvisor');
    });

    it('returns single provider status when key given', () => {
      tracker.recordUsage('tripadvisor', 20);
      const status = tracker.getStatus('tripadvisor');
      expect(status.used).toBe(20);
      expect(status.remaining).toBe(80);
      expect(status.usedPercent).toBeCloseTo(0.2);
    });
  });
});
