/**
 * Discovery cache provider abstraction.
 *
 * Provides Redis (primary) and MongoDB (fallback) cache implementations
 * for caching raw discovery candidates (pre-ranking).
 *
 * Provider selection: REDIS_URL present -> Redis, else MongoDB.
 * Failover: if Redis is unreachable, falls through to MongoDB for that request.
 */

const logger = require('./backend-logger');

const DISCOVERY_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Cache key helper (exported for use in bienbot-context-builders.js)
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic cache key from discovery filters.
 * Used by both Redis and MongoDB cache providers.
 *
 * @param {Object} filters - { activity_types?, destination_id?, destination_name?, max_cost?, cross_destination? }
 * @returns {string} Cache key with 'bien:discovery:' prefix
 */
function getCacheKey(filters) {
  // Cross-destination: ignore destination filters
  const isCrossDestination = !!filters.cross_destination ||
    (!filters.destination_id && !filters.destination_name);

  const destPart = isCrossDestination
    ? 'all'
    : filters.destination_id ||
      (filters.destination_name || '').toLowerCase().trim() ||
      'all';

  const parts = [
    (filters.activity_types || []).sort().join(','),
    destPart,
    filters.max_cost || 'none'
  ];
  return `bien:discovery:${parts.join('|')}`;
}

// ---------------------------------------------------------------------------
// MongoDB fallback provider
// ---------------------------------------------------------------------------

class MongoDiscoveryCache {
  constructor() {
    this._model = null;
  }

  _getModel() {
    if (!this._model) {
      this._model = require('../models/discovery-cache');
    }
    return this._model;
  }

  async get(key) {
    try {
      const Model = this._getModel();
      const entry = await Model.findById(key).lean();
      if (!entry) return null;
      // TTL index handles cleanup, but double-check in case of clock skew
      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) return null;
      return entry.candidates;
    } catch (err) {
      logger.warn('[bienbot-context] MongoDB cache get failed', { key, error: err.message });
      return null;
    }
  }

  async set(key, candidates, ttlMs = DISCOVERY_CACHE_TTL) {
    try {
      const Model = this._getModel();
      await Model.updateOne(
        { _id: key },
        { _id: key, candidates, expiresAt: new Date(Date.now() + ttlMs) },
        { upsert: true }
      );
    } catch (err) {
      logger.warn('[bienbot-context] MongoDB cache set failed', { key, error: err.message });
    }
  }
}

// ---------------------------------------------------------------------------
// Redis primary provider
// ---------------------------------------------------------------------------

class RedisDiscoveryCache {
  constructor(redisUrl) {
    this._redisUrl = redisUrl;
    this._client = null;
    this._connecting = false;
    this._fallback = new MongoDiscoveryCache();
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
      logger.info('[bienbot-context] Redis cache connected');
      client.on('error', (err) => {
        logger.warn('[bienbot-context] Redis error, will fallback to MongoDB', { error: err.message });
        this._client = null;
        this._connecting = false;
      });
      this._client = client;
      return this._client;
    } catch (err) {
      logger.warn('[bienbot-context] Redis connection failed, using MongoDB fallback', { error: err.message });
      this._client = null;
      this._connecting = false;
      return null;
    }
  }

  async get(key) {
    const client = await this._getClient();
    if (!client) return this._fallback.get(key);
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.warn('[bienbot-context] Redis get failed, falling back to MongoDB', { key, error: err.message });
      return this._fallback.get(key);
    }
  }

  async set(key, candidates, ttlMs = DISCOVERY_CACHE_TTL) {
    const client = await this._getClient();
    if (!client) return this._fallback.set(key, candidates, ttlMs);
    try {
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await client.setex(key, ttlSeconds, JSON.stringify(candidates));
    } catch (err) {
      logger.warn('[bienbot-context] Redis set failed, falling back to MongoDB', { key, error: err.message });
      return this._fallback.set(key, candidates, ttlMs);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance = null;

function createDiscoveryCache() {
  if (_instance) return _instance;
  if (process.env.REDIS_URL) {
    logger.info('[bienbot-context] Using Redis discovery cache');
    _instance = new RedisDiscoveryCache(process.env.REDIS_URL);
  } else {
    logger.info('[bienbot-context] Using MongoDB discovery cache (REDIS_URL not set)');
    _instance = new MongoDiscoveryCache();
  }
  return _instance;
}

/** Reset singleton (for tests) */
function resetDiscoveryCache() {
  _instance = null;
}

module.exports = {
  getCacheKey,
  createDiscoveryCache,
  resetDiscoveryCache,
  MongoDiscoveryCache,
  RedisDiscoveryCache,
  DISCOVERY_CACHE_TTL
};
