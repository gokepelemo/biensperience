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
 *  1. photos[].photo for the default entry → that photo's URL
 *  2. photos[].photo for any other entry → that photo's URL
 *  3. oauthProfilePhoto
 *
 * Tolerates orphan references — when a photos entry's `.photo` is null
 * (the underlying Photo document was deleted), we keep walking the array
 * and finally fall through to oauthProfilePhoto rather than returning null.
 *
 * @param {Object} user - User object (may have populated or unpopulated photos)
 * @returns {string|null} Resolved URL or null
 */
export function resolveUrlFromUser(user) {
  if (!user) return null;

  if (user.photos?.length > 0) {
    // Walk wrapped entries first: prefer the default, then any other entry
    // whose photo is populated and has a URL.
    const wrappedCandidates = user.photos
      .slice()
      .sort((a, b) => (b?.default ? 1 : 0) - (a?.default ? 1 : 0));

    let sawWrapper = false;
    for (const entry of wrappedCandidates) {
      if (!entry || typeof entry !== 'object') continue;
      // Wrapper shape: { photo: PhotoObj | ObjectId, default: bool }
      if ('photo' in entry) {
        sawWrapper = true;
        const p = entry.photo;
        if (p && typeof p === 'object' && p.url) return p.url;
        // null = orphan ref; non-null but no .url = unpopulated ObjectId — keep looking.
        continue;
      }
      // Legacy flat shape: photo doc directly in the array.
      if (entry.url) return entry.url;
    }

    // If every wrapped entry was either orphaned or unpopulated,
    // fall through to oauthProfilePhoto rather than returning null —
    // photos.length > 0 alone shouldn't disqualify the OAuth fallback.
    if (sawWrapper && user.oauthProfilePhoto) return user.oauthProfilePhoto;

    // Wrapper present but neither populated nor obviously orphaned — return
    // null so the lazy fetch hits the backend (which has the same fallback).
    if (sawWrapper) return null;
  }

  if (user.oauthProfilePhoto) return user.oauthProfilePhoto;

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

  // Positive URLs only. Caching null poisons the cache for the TTL window —
  // any subsequent resolution against a fresher user object would lose to the
  // stale null. Absence-from-cache is the correct representation of
  // "no avatar known for this user yet"; the next render or fetch will retry.
  if (!url) return;
  cache.set(key, { url, timestamp: Date.now() });
}

// -------------------------------------------------------------------
// Primary API — resolveAvatarUrl
// -------------------------------------------------------------------

/**
 * Resolve avatar URL with trust order: user object → cache.
 *
 * The user object is the primary source of truth — when populated photos are
 * available in props, we resolve from them every render (cheap: one Map
 * sort + a small linear walk). The cache is consulted only when the user
 * object can't yield a URL (e.g. unpopulated photos in a stub user reference
 * from an activity feed or list). This intentionally inverts the previous
 * cache-first ordering, which was vulnerable to permanent null-cache states
 * — once the cache poisoned (whether from a divergent backend resolution,
 * a partial user:updated event, or an in-flight upload race), the avatar
 * stayed gone for the TTL window even if the prop user object had perfectly
 * valid populated photos.
 *
 * Synchronous — does NOT trigger a network request.
 *
 * @param {Object} user - User object with _id and optional photo fields
 * @returns {string|null} Resolved URL or null
 */
export function resolveAvatarUrl(user) {
  if (!user?._id) return null;

  // Try the user object first — this is the freshest source of truth.
  const fromUser = resolveUrlFromUser(user);
  if (fromUser) {
    // Update the cache so other mounts (with a stale user prop, e.g. a
    // tooltip referencing the same user) pick up the new URL on next read.
    setCachedAvatarUrl(user._id, fromUser);
    return fromUser;
  }

  // User object had nothing resolvable — last resort: a previously-cached
  // value (could be from a lazy fetch result against /api/users/avatars).
  const cached = getCachedAvatarUrl(user._id);
  return cached || null;
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
          // setCachedAvatarUrl is now no-op for null/empty URLs, so this
          // line is safe even when the backend returns null for a user.
          // The deliberate consequence is that "no avatar" stays as
          // absence-from-cache rather than a sticky null entry.
          setCachedAvatarUrl(userId, url);
        }
      }
    } catch (err) {
      logger.error('[avatar-cache] Batch fetch failed', { error: err.message });
      // Transient network failure — leave the cache untouched so the next
      // render's resolveAvatarUrl can retry from the user object or refetch.
    }
  }

  // Resolve waiting promises with whatever's now in cache. Returning null
  // is correct here for "no avatar found"; UserAvatar then falls back to
  // initials, and a future re-render with populated user props will
  // succeed via resolveUrlFromUser without ever touching the cache.
  for (const item of pending) {
    item.resolve(getCachedAvatarUrl(item.id) || null);
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
// Auto-invalidation and re-population via event bus
// -------------------------------------------------------------------

try {
  // Critical invariant for the user:updated subscriber: only update the cache
  // when the event payload contains a NEW resolvable URL. Never invalidate
  // based on partial payloads — partial events (e.g. updateUserRole returns
  // {_id, name, email, role, isSuperAdmin} with no photos field at all) do
  // not mean "the user has no avatar"; they mean "this event isn't about the
  // avatar." Previously we invalidated in those cases, which deleted a
  // perfectly good cached URL and could trigger a lazy fetch that returned
  // null (because of backend resolution divergence pre-fix), poisoning the
  // cache with null and making the avatar permanently disappear.
  eventBus.subscribe('user:updated', (event) => {
    const userId = event?.userId || event?.user?._id;
    if (!userId) return;

    const userData = event?.user;
    if (!userData) return;

    // Only act when the payload actually includes photo fields. Otherwise
    // the event is about something else (role change, name change, prefs,
    // etc.) and the cache is already correct.
    if (!userData.photos && !userData.oauthProfilePhoto) return;

    const freshUrl = resolveUrlFromUser(userData);
    if (!freshUrl) {
      // The payload had photo fields but they were unpopulated or all
      // orphaned. Don't invalidate — the existing cache (if any) is still
      // a better answer than nothing. Next render of UserAvatar will
      // re-resolve from its own user prop, which may have populated data.
      return;
    }

    setCachedAvatarUrl(userId, freshUrl);
    logger.debug('[avatar-cache] Re-populated cache from user:updated event', { userId });
    eventBus.emit('avatar:changed', { userId });
  });

  // Photo events: only invalidate when we know the affected user AND the
  // photo:created/deleted came with explicit user attribution. Most
  // frontend-emitted photo events carry only { photoId } (no user info),
  // in which case we can't tell whose avatar to invalidate — so we don't.
  // Real avatar changes flow through user:updated events (above), which
  // carry the full populated user object and are the authoritative trigger.
  eventBus.subscribe('photo:created', (event) => {
    const userId = event?.photo?.user || event?.userId;
    if (!userId) return;
    invalidateAvatar(userId);
    eventBus.emit('avatar:changed', { userId });
  });

  eventBus.subscribe('photo:deleted', (event) => {
    const userId = event?.photo?.user || event?.userId;
    if (!userId) return;
    invalidateAvatar(userId);
    eventBus.emit('avatar:changed', { userId });
  });
} catch (_e) {
  // Silent — eventBus may not be initialised in all contexts
}
