/**
 * Avatar URL Cache
 *
 * Caches resolved avatar URLs by user ID so the same user's avatar
 * is resolved once per session rather than re-computed on every render
 * or re-fetched from the database on every API call.
 *
 * Features:
 * - In-memory Map with TTL-based expiration
 * - Microtask batching: multiple UserAvatar mounts in one render
 *   cycle are collected and fetched in a single API request
 * - Deduplicates concurrent fetch requests for the same user
 * - Auto-invalidates on user:updated and photo:* events
 *
 * @module avatar-cache
 */

import { sendRequest } from './send-request.js';
import { logger } from './logger.js';
import { eventBus } from './event-bus.js';

const BASE_URL = '/api/users/';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 500;

// Cache: userId (string) → { url: string|null, timestamp: number }
const cache = new Map();

// Microtask batch queue: array of { id, resolve, reject }
let batchQueue = [];
let batchScheduled = false;

// -------------------------------------------------------------------
// Core resolution (same chain as UserAvatar / backend photo-utils)
// -------------------------------------------------------------------

/**
 * Resolve avatar URL from a user object using the standard fallback chain:
 *  1. photos[] + default_photo_id → matching photo URL
 *  2. photos[0] → first photo URL
 *  3. oauthProfilePhoto
 *  4. Legacy photo string field
 *
 * @param {Object} user - User object (may have populated or unpopulated photos)
 * @returns {string|null} Resolved URL or null
 */
export function resolveUrlFromUser(user) {
  if (!user) return null;

  // 1. photos + default_photo_id
  if (user.photos?.length > 0 && user.default_photo_id) {
    const defaultId = user.default_photo_id?._id || user.default_photo_id;
    const match = user.photos.find(p => {
      const photoId = p?._id || p;
      return photoId?.toString() === defaultId?.toString();
    });
    if (match && typeof match === 'object' && match.url) return match.url;
  }

  // 2. First populated photo
  if (user.photos?.length > 0) {
    const first = user.photos[0];
    if (first && typeof first === 'object' && first.url) return first.url;
  }

  // 3. OAuth profile photo
  if (user.oauthProfilePhoto) return user.oauthProfilePhoto;

  // 4. Legacy photo field
  if (user.photo && typeof user.photo === 'string') return user.photo;

  return null;
}

// -------------------------------------------------------------------
// Cache read / write
// -------------------------------------------------------------------

/**
 * Get cached avatar URL for a user ID.
 * @returns {string|null|undefined} URL, null (no avatar), or undefined (not cached)
 */
export function getCachedAvatarUrl(userId) {
  if (!userId) return undefined;
  const key = userId.toString();
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry.url;
}

/**
 * Store an avatar URL in the cache.
 */
export function setCachedAvatarUrl(userId, url) {
  if (!userId) return;
  const key = userId.toString();

  // Evict oldest entry if at capacity
  if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of cache) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) cache.delete(oldestKey);
  }

  cache.set(key, { url: url ?? null, timestamp: Date.now() });
}

// -------------------------------------------------------------------
// Primary API — resolveAvatarUrl
// -------------------------------------------------------------------

/**
 * Resolve avatar URL: cache → user object → cache.
 * Synchronous — does NOT trigger a network request.
 *
 * @param {Object} user - User object with _id and optional photo fields
 * @returns {string|null} Resolved URL or null
 */
export function resolveAvatarUrl(user) {
  if (!user?._id) return null;

  // Check cache first
  const cached = getCachedAvatarUrl(user._id);
  if (cached !== undefined) return cached;

  // Resolve from user data
  const url = resolveUrlFromUser(user);

  // Only cache if we found a URL. When the user object lacks photo fields
  // (e.g. activity actor), returning null without caching allows the lazy
  // fetch in UserAvatar to make the actual API call for this user ID.
  if (url) {
    setCachedAvatarUrl(user._id, url);
  }

  return url;
}

// -------------------------------------------------------------------
// Lazy fetch — single request batched via microtask
// -------------------------------------------------------------------

/**
 * Flush the current batch queue: collect all queued user IDs,
 * make a single API request, and resolve all waiting promises.
 */
async function flushBatch() {
  const pending = batchQueue;
  batchQueue = [];
  batchScheduled = false;

  // Deduplicate IDs
  const idSet = new Set(pending.map(p => p.id));
  const idsToFetch = [...idSet].filter(id => getCachedAvatarUrl(id) === undefined);

  if (idsToFetch.length > 0) {
    try {
      const idsParam = idsToFetch.join(',');
      const result = await sendRequest(`${BASE_URL}avatars?ids=${idsParam}`);

      if (result?.avatars) {
        for (const [userId, url] of Object.entries(result.avatars)) {
          setCachedAvatarUrl(userId, url);
        }
      }

      // Cache null for any requested ID not in the response
      for (const id of idsToFetch) {
        if (getCachedAvatarUrl(id) === undefined) {
          setCachedAvatarUrl(id, null);
        }
      }
    } catch (err) {
      logger.error('[avatar-cache] Batch fetch failed', { error: err.message });
      // Mark all as null so callers don't hang
      for (const id of idsToFetch) {
        if (getCachedAvatarUrl(id) === undefined) {
          setCachedAvatarUrl(id, null);
        }
      }
    }
  }

  // Resolve all waiting promises
  for (const item of pending) {
    item.resolve(getCachedAvatarUrl(item.id) ?? null);
  }
}

/**
 * Request an avatar URL for a user ID.
 * Returns immediately from cache when possible; otherwise queues a
 * lightweight fetch that is batched across all UserAvatar mounts
 * within the same microtask (i.e. the same React render cycle).
 *
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export function fetchAvatarUrl(userId) {
  if (!userId) return Promise.resolve(null);
  const key = userId.toString();

  // Serve from cache
  const cached = getCachedAvatarUrl(key);
  if (cached !== undefined) return Promise.resolve(cached);

  // Queue for batch fetch
  return new Promise((resolve, reject) => {
    batchQueue.push({ id: key, resolve, reject });

    if (!batchScheduled) {
      batchScheduled = true;
      // Schedule flush on next microtask so all synchronous mount()
      // calls within the same render cycle share one request
      Promise.resolve().then(flushBatch);
    }
  });
}

// -------------------------------------------------------------------
// Cache management
// -------------------------------------------------------------------

/**
 * Invalidate a single user's cached avatar.
 */
export function invalidateAvatar(userId) {
  if (!userId) return;
  cache.delete(userId.toString());
}

/**
 * Clear the entire avatar cache.
 */
export function clearAvatarCache() {
  cache.clear();
  batchQueue = [];
  batchScheduled = false;
}

/**
 * Get cache statistics (debugging).
 */
export function getAvatarCacheStats() {
  return { size: cache.size, queueLength: batchQueue.length };
}

// -------------------------------------------------------------------
// Auto-invalidation via event bus
// -------------------------------------------------------------------

try {
  eventBus.subscribe('user:updated', (event) => {
    const userId = event?.userId || event?.user?._id;
    if (userId) invalidateAvatar(userId);
  });

  eventBus.subscribe('photo:created', (event) => {
    const userId = event?.photo?.user || event?.userId;
    if (userId) invalidateAvatar(userId);
  });

  eventBus.subscribe('photo:deleted', (event) => {
    const userId = event?.photo?.user || event?.userId;
    if (userId) invalidateAvatar(userId);
  });
} catch (_e) {
  // Silent — eventBus may not be initialised in all contexts
}
