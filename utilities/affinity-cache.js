/**
 * Affinity cache provider abstraction.
 *
 * Provides Redis (primary) and MongoDB (fallback) cache implementations
 * for storing pre-computed user ↔ experience affinity scores so BienBot
 * does not recompute them live on every call.
 *
 * Key schema (Redis):  `bien:affinity:{userId}`  → JSON array of all cache
 *                       entries for that user (capped at 50 most recent).
 * Storage schema (MongoDB): User.affinity_cache  → bounded subdocument array.
 *
 * Provider selection: REDIS_URL present → Redis, else MongoDB.
 *
 * @module utilities/affinity-cache
 */

'use strict';

const logger = require('./backend-logger');
const { AFFINITY_CACHE_TTL_MS } = require('./signals-config');

// Maximum number of affinity entries to keep per user.
const MAX_ENTRIES = 50;

// ---------------------------------------------------------------------------
// MongoDB provider
// ---------------------------------------------------------------------------

class MongoAffinityCache {
  constructor() {
    this._User = null;
  }

  _getUser() {
    if (!this._User) {
      this._User = require('../models/user');
    }
    return this._User;
  }

  /**
   * Build a Map<experienceIdString, entry> for a given user.
   * Entries older than AFFINITY_CACHE_TTL_MS are excluded (TTL enforcement).
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Map<string, Object>>}
   */
  async getAffinityMap(userId) {
    try {
      const User = this._getUser();
      const user = await User.findById(userId).select('affinity_cache').lean();
      if (!user || !Array.isArray(user.affinity_cache)) return new Map();

      const cutoff = Date.now() - AFFINITY_CACHE_TTL_MS;
      const map = new Map();
      for (const entry of user.affinity_cache) {
        // Skip entries that have passed the TTL (stale affinity scores)
        const computedAt = entry.computed_at ? new Date(entry.computed_at).getTime() : 0;
        if (computedAt < cutoff) continue;
        map.set(entry.experience_id.toString(), entry);
      }
      return map;
    } catch (err) {
      logger.warn('[affinity-cache] MongoDB getAffinityMap failed', {
        userId: String(userId),
        error: err.message
      });
      return new Map();
    }
  }

  /**
   * Retrieve a single affinity entry for (userId, experienceId).
   * Returns null if the entry is absent or older than AFFINITY_CACHE_TTL_MS.
   *
   * @param {string|ObjectId} userId
   * @param {string|ObjectId} experienceId
   * @returns {Promise<Object|null>}
   */
  async getAffinityEntry(userId, experienceId) {
    try {
      const map = await this.getAffinityMap(userId);
      return map.get(experienceId.toString()) || null;
    } catch (err) {
      logger.warn('[affinity-cache] MongoDB getAffinityEntry failed', {
        userId: String(userId),
        experienceId: String(experienceId),
        error: err.message
      });
      return null;
    }
  }

  /**
   * Store or replace an affinity entry for (userId, experienceId).
   * Uses a single aggregation pipeline update to atomically filter out any
   * existing entry for this experienceId, append the new entry, and cap at
   * MAX_ENTRIES — eliminating the two-step $pull + $push race condition.
   *
   * @param {string|ObjectId} userId
   * @param {string|ObjectId} experienceId
   * @param {Object} entry - affinityCacheEntry-shaped object
   * @returns {Promise<void>}
   */
  async setAffinityEntry(userId, experienceId, entry) {
    try {
      const User = this._getUser();
      const mongoose = require('mongoose');
      // Convert to ObjectId once so the aggregation $ne comparison works reliably
      // without relying on the server-side $toObjectId cast.
      const expObjId = new mongoose.Types.ObjectId(experienceId.toString());
      // Atomic: filter existing entry for this experienceId + append new one +
      // cap at MAX_ENTRIES in a single aggregation pipeline update (MongoDB 4.2+).
      await User.findByIdAndUpdate(userId, [
        {
          $set: {
            affinity_cache: {
              $slice: [
                {
                  $concatArrays: [
                    {
                      $filter: {
                        input: { $ifNull: ['$affinity_cache', []] },
                        cond: {
                          $ne: ['$$this.experience_id', expObjId]
                        }
                      }
                    },
                    [entry]
                  ]
                },
                -MAX_ENTRIES
              ]
            }
          }
        }
      ]);
    } catch (err) {
      logger.warn('[affinity-cache] MongoDB setAffinityEntry failed', {
        userId: String(userId),
        experienceId: String(experienceId),
        error: err.message
      });
    }
  }

  /**
   * Replace or append many affinity entries in a single atomic update.
   * Used by discovery to warm the cache for N candidates without N round-trips.
   *
   * Each entry must already carry experience_id. Dedup happens by experience_id:
   * any existing entries with a matching experience_id are filtered out first,
   * then all new entries are appended, then the array is capped at MAX_ENTRIES.
   *
   * @param {string|ObjectId} userId
   * @param {Array<Object>} entries
   * @returns {Promise<void>}
   */
  async setAffinityEntries(userId, entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    try {
      const User = this._getUser();
      const mongoose = require('mongoose');
      const incomingIds = entries.map(e => new mongoose.Types.ObjectId(e.experience_id.toString()));
      await User.findByIdAndUpdate(userId, [
        {
          $set: {
            affinity_cache: {
              $slice: [
                {
                  $concatArrays: [
                    {
                      $filter: {
                        input: { $ifNull: ['$affinity_cache', []] },
                        cond: { $not: [{ $in: ['$$this.experience_id', incomingIds] }] }
                      }
                    },
                    entries
                  ]
                },
                -MAX_ENTRIES
              ]
            }
          }
        }
      ]);
    } catch (err) {
      logger.warn('[affinity-cache] MongoDB setAffinityEntries failed', {
        userId: String(userId),
        count: entries.length,
        error: err.message
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Redis provider (primary)
// ---------------------------------------------------------------------------

class RedisAffinityCache {
  constructor(redisUrl) {
    this._redisUrl = redisUrl;
    this._client = null;
    /** @type {Promise<import('ioredis').Redis|null>|null} */
    this._connectionPromise = null;
    this._fallback = new MongoAffinityCache();
  }

  /**
   * Build the Redis key for a user's affinity entries.
   *
   * @param {string|ObjectId} userId
   * @returns {string}
   */
  _key(userId) {
    return `bien:affinity:${userId.toString()}`;
  }

  /**
   * Establish the Redis connection. Returns the connected client or null on failure.
   * Stores the pending Promise so concurrent callers await the same connection
   * instead of falling through to MongoDB before the first connect resolves.
   *
   * @returns {Promise<import('ioredis').Redis|null>}
   */
  async _getClient() {
    if (this._client) return this._client;
    if (this._connectionPromise) return this._connectionPromise;

    this._connectionPromise = (async () => {
      try {
        const Redis = require('ioredis');
        const client = new Redis(this._redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          connectTimeout: 3000,
          retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000))
        });
        await client.connect();
        logger.info('[affinity-cache] Redis cache connected');
        client.on('error', (err) => {
          logger.warn('[affinity-cache] Redis error, will fallback to MongoDB', {
            error: err.message
          });
          this._client = null;
          this._connectionPromise = null;
        });
        this._client = client;
        return this._client;
      } catch (err) {
        logger.warn('[affinity-cache] Redis connection failed, using MongoDB fallback', {
          error: err.message
        });
        this._client = null;
        this._connectionPromise = null;
        return null;
      }
    })();

    return this._connectionPromise;
  }

  /**
   * Build a Map<experienceIdString, entry> from Redis for a given user.
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Map<string, Object>>}
   */
  async getAffinityMap(userId) {
    const client = await this._getClient();
    if (!client) return this._fallback.getAffinityMap(userId);
    try {
      const raw = await client.get(this._key(userId));
      if (!raw) return new Map();
      const entries = JSON.parse(raw);
      const cutoff = Date.now() - AFFINITY_CACHE_TTL_MS;
      const map = new Map();
      for (const entry of entries) {
        const computedAt = entry.computed_at ? new Date(entry.computed_at).getTime() : 0;
        if (computedAt < cutoff) continue;
        map.set(entry.experience_id.toString(), entry);
      }
      return map;
    } catch (err) {
      logger.warn('[affinity-cache] Redis getAffinityMap failed, falling back to MongoDB', {
        userId: String(userId),
        error: err.message
      });
      return this._fallback.getAffinityMap(userId);
    }
  }

  /**
   * Retrieve a single affinity entry for (userId, experienceId) from Redis.
   *
   * @param {string|ObjectId} userId
   * @param {string|ObjectId} experienceId
   * @returns {Promise<Object|null>}
   */
  async getAffinityEntry(userId, experienceId) {
    const client = await this._getClient();
    if (!client) return this._fallback.getAffinityEntry(userId, experienceId);
    try {
      const map = await this.getAffinityMap(userId);
      return map.get(experienceId.toString()) || null;
    } catch (err) {
      logger.warn('[affinity-cache] Redis getAffinityEntry failed, falling back to MongoDB', {
        userId: String(userId),
        experienceId: String(experienceId),
        error: err.message
      });
      return this._fallback.getAffinityEntry(userId, experienceId);
    }
  }

  /**
   * Store or replace an affinity entry for (userId, experienceId) in Redis.
   * Gets the current array, upserts the entry, caps at MAX_ENTRIES, then
   * writes back with SETEX using AFFINITY_CACHE_TTL_MS.
   *
   * @param {string|ObjectId} userId
   * @param {string|ObjectId} experienceId
   * @param {Object} entry
   * @returns {Promise<void>}
   */
  async setAffinityEntry(userId, experienceId, entry) {
    const client = await this._getClient();
    if (!client) return this._fallback.setAffinityEntry(userId, experienceId, entry);
    try {
      const key = this._key(userId);
      const raw = await client.get(key);
      let entries = raw ? JSON.parse(raw) : [];

      // Remove any existing entry for this experienceId
      entries = entries.filter(
        (e) => e.experience_id.toString() !== experienceId.toString()
      );

      // Push the new entry
      entries.push(entry);

      // Cap at MAX_ENTRIES (keep the last/most recent MAX_ENTRIES)
      if (entries.length > MAX_ENTRIES) {
        entries = entries.slice(-MAX_ENTRIES);
      }

      const ttlSeconds = Number.isFinite(AFFINITY_CACHE_TTL_MS) && AFFINITY_CACHE_TTL_MS > 0
        ? Math.ceil(AFFINITY_CACHE_TTL_MS / 1000)
        : 6 * 60 * 60; // 6-hour safe default
      await client.setex(key, ttlSeconds, JSON.stringify(entries));
    } catch (err) {
      logger.warn('[affinity-cache] Redis setAffinityEntry failed, falling back to MongoDB', {
        userId: String(userId),
        experienceId: String(experienceId),
        error: err.message
      });
      return this._fallback.setAffinityEntry(userId, experienceId, entry);
    }
  }

  /**
   * Batch upsert — see MongoAffinityCache#setAffinityEntries.
   * Single Redis GET + SETEX rather than N round-trips.
   *
   * @param {string|ObjectId} userId
   * @param {Array<Object>} entries
   * @returns {Promise<void>}
   */
  async setAffinityEntries(userId, entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const client = await this._getClient();
    if (!client) return this._fallback.setAffinityEntries(userId, entries);
    try {
      const key = this._key(userId);
      const raw = await client.get(key);
      let existing = raw ? JSON.parse(raw) : [];

      const incomingIds = new Set(entries.map(e => e.experience_id.toString()));
      existing = existing.filter(e => !incomingIds.has(e.experience_id.toString()));
      let merged = existing.concat(entries);

      if (merged.length > MAX_ENTRIES) {
        merged = merged.slice(-MAX_ENTRIES);
      }

      const ttlSeconds = Number.isFinite(AFFINITY_CACHE_TTL_MS) && AFFINITY_CACHE_TTL_MS > 0
        ? Math.ceil(AFFINITY_CACHE_TTL_MS / 1000)
        : 6 * 60 * 60;
      await client.setex(key, ttlSeconds, JSON.stringify(merged));
    } catch (err) {
      logger.warn('[affinity-cache] Redis setAffinityEntries failed, falling back to MongoDB', {
        userId: String(userId),
        count: entries.length,
        error: err.message
      });
      return this._fallback.setAffinityEntries(userId, entries);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance = null;

/**
 * Create (or return cached) affinity cache instance.
 * Uses Redis when REDIS_URL is set; falls back to MongoDB.
 *
 * @returns {MongoAffinityCache|RedisAffinityCache}
 */
function createAffinityCache() {
  if (_instance) return _instance;
  if (process.env.REDIS_URL) {
    logger.info('[affinity-cache] Using Redis affinity cache');
    _instance = new RedisAffinityCache(process.env.REDIS_URL);
  } else {
    logger.info('[affinity-cache] Using MongoDB affinity cache (REDIS_URL not set)');
    _instance = new MongoAffinityCache();
  }
  return _instance;
}

/** Reset singleton — for tests only. */
function resetAffinityCache() {
  _instance = null;
}

// ---------------------------------------------------------------------------
// Public convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Get a single affinity entry for (userId, experienceId).
 *
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} experienceId
 * @returns {Promise<Object|null>}
 */
async function getAffinityEntry(userId, experienceId) {
  return createAffinityCache().getAffinityEntry(userId, experienceId);
}

/**
 * Store or replace an affinity entry for (userId, experienceId).
 *
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} experienceId
 * @param {Object} entry
 * @returns {Promise<void>}
 */
async function setAffinityEntry(userId, experienceId, entry) {
  return createAffinityCache().setAffinityEntry(userId, experienceId, entry);
}

/**
 * Build a Map<experienceIdString, entry> for all cached affinity entries of a user.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<Map<string, Object>>}
 */
async function getAffinityMap(userId) {
  return createAffinityCache().getAffinityMap(userId);
}

/**
 * Batch upsert — store many affinity entries for a user in a single round-trip.
 *
 * @param {string|ObjectId} userId
 * @param {Array<Object>} entries - Each must carry experience_id.
 * @returns {Promise<void>}
 */
async function setAffinityEntries(userId, entries) {
  return createAffinityCache().setAffinityEntries(userId, entries);
}

module.exports = {
  getAffinityEntry,
  setAffinityEntry,
  setAffinityEntries,
  getAffinityMap,
  resetAffinityCache,
  createAffinityCache,
  MongoAffinityCache,
  RedisAffinityCache,
  MAX_ENTRIES
};
