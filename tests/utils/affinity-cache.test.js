/**
 * Tests for affinity-cache.js — MongoDB provider (mocked)
 *
 * Covers:
 * 1. getAffinityEntry returns null when no entry exists
 * 2. getAffinityEntry returns the correct entry after setAffinityEntry stores one
 * 3. getAffinityMap returns a Map with all stored entries for a user
 * 4. setAffinityEntry replaces an existing entry (same experienceId → updated score)
 * 5. setAffinityEntry caps at 50 entries (push 51, verify map has 50)
 */

'use strict';

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Mock the User model before requiring affinity-cache
// ---------------------------------------------------------------------------

// In-memory store: userId (string) → array of affinity_cache entries
const _store = {};

function _getStore(userId) {
  return _store[userId.toString()] || [];
}

function _setStore(userId, entries) {
  _store[userId.toString()] = entries;
}

const mockUser = {
  findById: jest.fn((userId) => {
    const entries = _getStore(userId);
    const doc = { affinity_cache: entries };
    return {
      select: () => ({
        lean: async () => doc
      })
    };
  }),
  findByIdAndUpdate: jest.fn(async (userId, update) => {
    let entries = [..._getStore(userId)];

    if (Array.isArray(update)) {
      // Simulate the aggregation pipeline used by MongoAffinityCache.setAffinityEntry:
      // [{ $set: { affinity_cache: { $slice: [{ $concatArrays: [{ $filter: ... }, [newEntry]] }, -MAX_ENTRIES] } } }]
      const pipeline = update[0];
      const sliceOp = pipeline?.$set?.affinity_cache?.$slice;
      if (sliceOp) {
        const concatOp = sliceOp[0]?.$concatArrays;
        const maxEntries = typeof sliceOp[1] === 'number' ? Math.abs(sliceOp[1]) : 50;
        if (concatOp) {
          // concatOp[1] is the literal array containing the new entry
          const newEntries = concatOp[1];
          const newExperienceId = newEntries[0]?.experience_id?.toString();
          // Filter out any existing entry for the same experienceId
          const filtered = newExperienceId
            ? entries.filter((e) => e.experience_id.toString() !== newExperienceId)
            : entries;
          // Append new entries and cap at MAX_ENTRIES (slice from end)
          const combined = [...filtered, ...newEntries];
          entries = combined.length > maxEntries ? combined.slice(-maxEntries) : combined;
        }
      }
    }

    _setStore(userId, entries);
    return null;
  })
};

jest.mock('../../models/user', () => mockUser);

// ---------------------------------------------------------------------------
// Now require the module under test
// ---------------------------------------------------------------------------

const {
  getAffinityEntry,
  setAffinityEntry,
  getAffinityMap,
  resetAffinityCache,
  createAffinityCache
} = require('../../utilities/affinity-cache');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId() {
  return new mongoose.Types.ObjectId();
}

function makeEntry(experienceId, score = 0.8) {
  return {
    experience_id: experienceId,
    score,
    top_dims: [{ dim: 'energy', user_val: 0.7, entity_val: 0.6, delta: 0.1 }],
    computed_at: new Date()
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear in-memory mock store
  Object.keys(_store).forEach((k) => delete _store[k]);
  // Clear Jest mock call history
  mockUser.findById.mockClear();
  mockUser.findByIdAndUpdate.mockClear();
  // Reset singleton so each test gets a fresh MongoAffinityCache instance
  resetAffinityCache();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('affinity-cache (MongoDB provider)', () => {
  it('1. getAffinityEntry returns null when no entry exists for that experienceId', async () => {
    const userId = makeId();
    const experienceId = makeId();

    const result = await getAffinityEntry(userId, experienceId);

    expect(result).toBeNull();
  });

  it('2. getAffinityEntry returns the correct entry after setAffinityEntry stores one', async () => {
    const userId = makeId();
    const experienceId = makeId();
    const entry = makeEntry(experienceId, 0.75);

    await setAffinityEntry(userId, experienceId, entry);
    const result = await getAffinityEntry(userId, experienceId);

    expect(result).not.toBeNull();
    expect(result.score).toBe(0.75);
    expect(result.experience_id.toString()).toBe(experienceId.toString());
  });

  it('3. getAffinityMap returns a Map with all stored entries for a user', async () => {
    const userId = makeId();
    const expId1 = makeId();
    const expId2 = makeId();
    const expId3 = makeId();

    await setAffinityEntry(userId, expId1, makeEntry(expId1, 0.9));
    await setAffinityEntry(userId, expId2, makeEntry(expId2, 0.7));
    await setAffinityEntry(userId, expId3, makeEntry(expId3, 0.5));

    const map = await getAffinityMap(userId);

    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(3);
    expect(map.get(expId1.toString()).score).toBe(0.9);
    expect(map.get(expId2.toString()).score).toBe(0.7);
    expect(map.get(expId3.toString()).score).toBe(0.5);
  });

  it('4. setAffinityEntry replaces an existing entry (same experienceId → updated score)', async () => {
    const userId = makeId();
    const experienceId = makeId();

    await setAffinityEntry(userId, experienceId, makeEntry(experienceId, 0.6));
    await setAffinityEntry(userId, experienceId, makeEntry(experienceId, 0.95));

    const result = await getAffinityEntry(userId, experienceId);
    expect(result.score).toBe(0.95);

    // Should still be exactly one entry for this experienceId
    const map = await getAffinityMap(userId);
    expect(map.size).toBe(1);
  });

  it('5. setAffinityEntry caps at 50 entries (push 51, verify map has 50)', async () => {
    const userId = makeId();

    // Push 51 distinct experience entries
    for (let i = 0; i < 51; i++) {
      const expId = makeId();
      await setAffinityEntry(userId, expId, makeEntry(expId, i / 51));
    }

    const map = await getAffinityMap(userId);
    expect(map.size).toBe(50);
  });
});
