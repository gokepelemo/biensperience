/**
 * Tests for hidden-signals.js — computeAndCacheAffinity and refreshSignalsAndAffinity
 *
 * Covers:
 * 1. computeAndCacheAffinity calls affinityCache.setAffinityEntry with a valid entry
 *    when both user and experience have hidden_signals
 * 2. computeAndCacheAffinity returns early without calling setAffinityEntry when
 *    userId is invalid
 * 3. computeAndCacheAffinity returns early without calling setAffinityEntry when
 *    user not found
 * 4. computeAndCacheAffinity top_dims contains only dimensions where delta < 0.3,
 *    sorted ascending by delta
 * 5. refreshSignalsAndAffinity calls updateExperienceSignals when computedAt is null
 * 6. refreshSignalsAndAffinity does NOT call updateExperienceSignals when computedAt
 *    is fresh (within SIGNALS_STALENESS_MS)
 * 7. refreshSignalsAndAffinity never throws even if computeAndCacheAffinity rejects
 */

'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Mock affinityCache module before requiring hidden-signals
// ---------------------------------------------------------------------------

const mockSetAffinityEntry = jest.fn().mockResolvedValue(undefined);

jest.mock('../../utilities/affinity-cache', () => ({
  setAffinityEntry: mockSetAffinityEntry,
  getAffinityEntry: jest.fn().mockResolvedValue(null),
  getAffinityMap: jest.fn().mockResolvedValue(new Map()),
  resetAffinityCache: jest.fn(),
  createAffinityCache: jest.fn()
}));

// ---------------------------------------------------------------------------
// Mock models
// ---------------------------------------------------------------------------

const VALID_USER_ID = new mongoose.Types.ObjectId().toString();
const VALID_EXPERIENCE_ID = new mongoose.Types.ObjectId().toString();

const defaultUserSignals = {
  energy: 0.8,
  novelty: 0.6,
  budget_sensitivity: 0.4,
  social: 0.7,
  structure: 0.5,
  food_focus: 0.3,
  cultural_depth: 0.6,
  comfort_zone: 0.4,
  confidence: 0.9,
  last_updated: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago (triggers decay check but minimal decay)
};

const defaultExperienceSignals = {
  energy: 0.7,
  novelty: 0.5,
  budget_sensitivity: 0.3,
  social: 0.6,
  structure: 0.5,
  food_focus: 0.4,
  cultural_depth: 0.7,
  comfort_zone: 0.5,
  confidence: 0.8,
  last_updated: new Date(Date.now() - 60 * 60 * 1000)
};

const mockUserFindById = jest.fn();
const mockExperienceFindById = jest.fn();

jest.mock('../../models/user', () => ({
  findById: (...args) => mockUserFindById(...args)
}));

jest.mock('../../models/experience', () => ({
  findById: (...args) => mockExperienceFindById(...args),
  findByIdAndUpdate: jest.fn().mockResolvedValue(null)
}));

// Also mock plan model (required by updateExperienceSignals)
jest.mock('../../models/plan', () => ({
  aggregate: jest.fn().mockResolvedValue([{
    planCount: 5,
    planCountWithActivity: 3,
    completedPlanCount: 2
  }])
}));

// Mock feature-flags (required by updateExperienceSignals)
jest.mock('../../utilities/feature-flags', () => ({
  hasFeatureFlag: jest.fn().mockReturnValue(false)
}));

// ---------------------------------------------------------------------------
// Set up default mock implementations
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  mockUserFindById.mockReturnValue({
    select: () => ({
      lean: async () => ({
        _id: new mongoose.Types.ObjectId(VALID_USER_ID),
        hidden_signals: { ...defaultUserSignals }
      })
    })
  });

  mockExperienceFindById.mockReturnValue({
    select: () => ({
      lean: async () => ({
        _id: new mongoose.Types.ObjectId(VALID_EXPERIENCE_ID),
        hidden_signals: { ...defaultExperienceSignals },
        user: new mongoose.Types.ObjectId(),
        public: true,
        plan_items: []
      })
    })
  });
}

// ---------------------------------------------------------------------------
// Require the module under test (after mocks are set up)
// ---------------------------------------------------------------------------

const {
  computeAndCacheAffinity,
  refreshSignalsAndAffinity,
  updateExperienceSignals: _updateExperienceSignals
} = require('../../utilities/hidden-signals');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeAndCacheAffinity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('1. calls setAffinityEntry with a valid entry when both user and experience have hidden_signals', async () => {
    await computeAndCacheAffinity(VALID_USER_ID, VALID_EXPERIENCE_ID);

    expect(mockSetAffinityEntry).toHaveBeenCalledTimes(1);

    const [calledUserId, calledExperienceId, entry] = mockSetAffinityEntry.mock.calls[0];

    expect(calledUserId.toString()).toBe(VALID_USER_ID.toString());
    expect(calledExperienceId.toString()).toBe(VALID_EXPERIENCE_ID.toString());

    // Validate entry shape
    expect(entry).toHaveProperty('experience_id');
    expect(entry).toHaveProperty('score');
    expect(entry).toHaveProperty('top_dims');
    expect(entry).toHaveProperty('computed_at');
    expect(typeof entry.score).toBe('number');
    expect(entry.score).toBeGreaterThanOrEqual(0);
    expect(entry.score).toBeLessThanOrEqual(1);
    expect(Array.isArray(entry.top_dims)).toBe(true);
    expect(entry.computed_at).toBeInstanceOf(Date);
  });

  test('2. returns early without calling setAffinityEntry when userId is invalid', async () => {
    await computeAndCacheAffinity('not-a-valid-objectid', VALID_EXPERIENCE_ID);
    expect(mockSetAffinityEntry).not.toHaveBeenCalled();
  });

  test('3. returns early without calling setAffinityEntry when user not found', async () => {
    mockUserFindById.mockReturnValue({
      select: () => ({
        lean: async () => null
      })
    });

    await computeAndCacheAffinity(VALID_USER_ID, VALID_EXPERIENCE_ID);
    expect(mockSetAffinityEntry).not.toHaveBeenCalled();
  });

  test('4. top_dims contains only dimensions where delta < 0.3, sorted ascending by delta', async () => {
    // Set up signals where some dimensions have large deltas (>= 0.3) and some have small deltas (< 0.3)
    mockUserFindById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(VALID_USER_ID),
          hidden_signals: {
            energy: 0.9,           // delta with experience: |0.9 - 0.2| = 0.7 → excluded
            novelty: 0.5,          // delta: |0.5 - 0.5| = 0.0 → included (dim 1, lowest delta)
            budget_sensitivity: 0.5, // delta: |0.5 - 0.6| = 0.1 → included (dim 2)
            social: 0.5,           // delta: |0.5 - 0.65| = 0.15 → included (dim 3)
            structure: 0.5,        // delta: |0.5 - 0.8| = 0.3 → excluded (not < 0.3)
            food_focus: 0.9,       // delta: |0.9 - 0.1| = 0.8 → excluded
            cultural_depth: 0.5,   // delta: |0.5 - 0.5| = 0.0 → included (but only top 3)
            comfort_zone: 0.9,     // delta: |0.9 - 0.1| = 0.8 → excluded
            confidence: 0.9,
            last_updated: new Date(Date.now() - 60 * 60 * 1000)
          }
        })
      })
    });

    mockExperienceFindById.mockReturnValue({
      select: () => ({
        lean: async () => ({
          _id: new mongoose.Types.ObjectId(VALID_EXPERIENCE_ID),
          hidden_signals: {
            energy: 0.2,
            novelty: 0.5,
            budget_sensitivity: 0.6,
            social: 0.65,
            structure: 0.8,
            food_focus: 0.1,
            cultural_depth: 0.5,
            comfort_zone: 0.1,
            confidence: 0.9,
            last_updated: new Date(Date.now() - 60 * 60 * 1000)
          }
        })
      })
    });

    await computeAndCacheAffinity(VALID_USER_ID, VALID_EXPERIENCE_ID);

    expect(mockSetAffinityEntry).toHaveBeenCalledTimes(1);
    const entry = mockSetAffinityEntry.mock.calls[0][2];
    const topDims = entry.top_dims;

    // All top_dims must have delta < 0.3
    for (const td of topDims) {
      expect(td.delta).toBeLessThan(0.3);
    }

    // Must have required fields
    for (const td of topDims) {
      expect(td).toHaveProperty('dim');
      expect(td).toHaveProperty('user_val');
      expect(td).toHaveProperty('entity_val');
      expect(td).toHaveProperty('delta');
    }

    // Must be sorted ascending by delta
    for (let i = 1; i < topDims.length; i++) {
      expect(topDims[i].delta).toBeGreaterThanOrEqual(topDims[i - 1].delta);
    }

    // Must contain at most 3 items
    expect(topDims.length).toBeLessThanOrEqual(3);

    // Dimensions with large deltas (energy, food_focus, comfort_zone) must NOT be included
    const dimNames = topDims.map(td => td.dim);
    expect(dimNames).not.toContain('energy');
    expect(dimNames).not.toContain('food_focus');
    expect(dimNames).not.toContain('comfort_zone');
    // structure has delta exactly 0.3, which is not < 0.3, so it should be excluded
    expect(dimNames).not.toContain('structure');
  });
});

describe('refreshSignalsAndAffinity', () => {
  // We need to spy on updateExperienceSignals which is an internal function.
  // We'll verify its side effects via the mocked models.

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test('5. calls updateExperienceSignals when computedAt is null (always stale)', async () => {
    const Experience = require('../../models/experience');
    const experienceFindByIdAndUpdateSpy = jest.spyOn(Experience, 'findByIdAndUpdate');

    await refreshSignalsAndAffinity(VALID_EXPERIENCE_ID, VALID_USER_ID, null);

    // updateExperienceSignals writes to Experience.findByIdAndUpdate
    expect(experienceFindByIdAndUpdateSpy).toHaveBeenCalled();
  });

  test('6. does NOT call updateExperienceSignals when computedAt is fresh (within SIGNALS_STALENESS_MS)', async () => {
    const config = require('../../utilities/signals-config');
    const Experience = require('../../models/experience');
    const experienceFindByIdAndUpdateSpy = jest.spyOn(Experience, 'findByIdAndUpdate');

    // computedAt = right now (fresh, within staleness window)
    const freshComputedAt = new Date(Date.now() - (config.SIGNALS_STALENESS_MS / 2));

    await refreshSignalsAndAffinity(VALID_EXPERIENCE_ID, VALID_USER_ID, freshComputedAt);

    // updateExperienceSignals should NOT have been called (signals are fresh)
    expect(experienceFindByIdAndUpdateSpy).not.toHaveBeenCalled();
  });

  test('7. never throws even if computeAndCacheAffinity rejects', async () => {
    // Make user lookup fail so computeAndCacheAffinity will log a warning and return early
    // But more directly: make affinityCache.setAffinityEntry reject
    const affinityCache = require('../../utilities/affinity-cache');
    affinityCache.setAffinityEntry.mockRejectedValueOnce(new Error('Cache write failure'));

    // computedAt is null so staleness check will call updateExperienceSignals too
    // We need models to work for the test but setAffinityEntry to fail
    // refreshSignalsAndAffinity should still not throw
    await expect(
      refreshSignalsAndAffinity(VALID_EXPERIENCE_ID, VALID_USER_ID, null)
    ).resolves.not.toThrow();
  });
});
