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
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Map<string, Object>>}
   */
  async getAffinityMap(userId) {
    try {
      const User = this._getUser();
      const user = await User.findById(userId).select('affinity_cache').lean();
      if (!user || !Array.isArray(user.affinity_cache)) return new Map();

      const map = new Map();
      for (const entry of user.affinity_cache) {
        map.set(entry.experience_id.toString(), entry);
      }
      return map;
    } catch (err) {
      logger.warn('[affinity-cache] MongoDB getAffinityMap failed', {
        userId: userId.toString(),
        error: err.message
      });
      return new Map();
    }
  }

  /**
   * Retrieve a single affinity entry for (userId, experienceId).
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
        userId: userId.toString(),
        experienceId: experienceId.toString(),
        error: err.message
      });
      return null;
    }
  }

  /**
   * Store or replace an affinity entry for (userId, experienceId).
   * Removes any existing entry with the same experienceId before pushing,
   * then caps the array at MAX_ENTRIES (keeping the most recent).
   *
   * @param {string|ObjectId} userId
   * @param {string|ObjectId} experienceId
   * @param {Object} entry - affinityCacheEntry-shaped object
   * @returns {Promise<void>}
   */
  async setAffinityEntry(userId, experienceId, entry) {
    try {
      const User = this._getUser();
      // Step 1: remove existing entry for this experienceId (MongoDB does not
      // support upsert on subdocument array fields by a nested key).
      await User.findByIdAndUpdate(userId, {
        $pull: { affinity_cache: { experience_id: experienceId } }
      });
      // Step 2: push new entry with $slice to enforce the cap.
      await User.findByIdAndUpdate(userId, {
        $push: {
          affinity_cache: {
            $each: [entry],
            $slice: -MAX_ENTRIES
          }
        }
      });
    } catch (err) {
      logger.warn('[affinity-cache] MongoDB setAffinityEntry failed', {
        userId: userId.toString(),
        experienceId: experienceId.toString(),
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
    this._connecting = false;
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

  async _getClient() {
    if (this._client) return this._client;
    if (this._connecting) return null;
    this._connecting = true;
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
        this._connecting = false;
      });
      this._client = client;
      return this._client;
    } catch (err) {
      logger.warn('[affinity-cache] Redis connection failed, using MongoDB fallback', {
        error: err.message
      });
      this._client = null;
      this._connecting = false;
      return null;
    }
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
      const map = new Map();
      for (const entry of entries) {
        map.set(entry.experience_id.toString(), entry);
      }
      return map;
    } catch (err) {
      logger.warn('[affinity-cache] Redis getAffinityMap failed, falling back to MongoDB', {
        userId: userId.toString(),
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
        userId: userId.toString(),
        experienceId: experienceId.toString(),
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

      const ttlSeconds = Math.ceil(AFFINITY_CACHE_TTL_MS / 1000);
      await client.setex(key, ttlSeconds, JSON.stringify(entries));
    } catch (err) {
      logger.warn('[affinity-cache] Redis setAffinityEntry failed, falling back to MongoDB', {
        userId: userId.toString(),
        experienceId: experienceId.toString(),
        error: err.message
      });
      return this._fallback.setAffinityEntry(userId, experienceId, entry);
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

module.exports = {
  getAffinityEntry,
  setAffinityEntry,
  getAffinityMap,
  resetAffinityCache,
  createAffinityCache,
  MongoAffinityCache,
  RedisAffinityCache,
  MAX_ENTRIES
};
