/**
 * Plan Cache Utility
 *
 * Consolidates many per-experience `plan_<userId>_<experienceId>` sessionStorage
 * entries into a single encrypted-at-rest localStorage key.
 *
 * This is used by ExperienceCard to render plan state instantly without
 * round-tripping to the API on every mount.
 */

import { logger } from './logger';
import { STORAGE_KEYS } from './storage-keys';

const PLAN_CACHE_KEY = STORAGE_KEYS.planCache;

// Simple reversible transform key (not secret; intended to prevent plaintext storage).
const SCRAMBLE_KEY = 'biensperience.plancache.v1';

let didMigrateSessionStorage = false;

function toBytes(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function fromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function base64Encode(bytes) {
  return btoa(fromBytes(bytes));
}

function base64Decode(b64) {
  const binary = atob(b64);
  return toBytes(binary);
}

function xorTransform(inputBytes) {
  const keyBytes = toBytes(SCRAMBLE_KEY);
  const out = new Uint8Array(inputBytes.length);
  for (let i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out;
}

function encodeJson(obj) {
  const json = JSON.stringify(obj);
  const bytes = toBytes(json);
  const xored = xorTransform(bytes);
  return base64Encode(xored);
}

function decodeJson(encoded) {
  const bytes = base64Decode(encoded);
  const original = xorTransform(bytes);
  return JSON.parse(fromBytes(original));
}

function safeReadCache() {
  try {
    const raw = localStorage.getItem(PLAN_CACHE_KEY);
    if (!raw) return { v: 1, users: {} };

    try {
      const parsed = decodeJson(raw);
      if (!parsed || typeof parsed !== 'object') return { v: 1, users: {} };
      if (!parsed.users || typeof parsed.users !== 'object') return { v: 1, users: {} };
      return { v: 1, users: parsed.users };
    } catch (e) {
      // Legacy/unexpected format: try plain JSON and re-encode.
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.users && typeof parsed.users === 'object') {
          return { v: 1, users: parsed.users };
        }
      } catch {
        // ignore
      }
      return { v: 1, users: {} };
    }
  } catch (e) {
    return { v: 1, users: {} };
  }
}

function safeWriteCache(cache) {
  try {
    localStorage.setItem(PLAN_CACHE_KEY, encodeJson(cache));
  } catch (e) {
    logger.debug('[plan-cache] Failed to write cache', { error: e?.message });
  }
}

function parseLegacySessionKey(key) {
  // Expected format: plan_<userId>_<experienceId>
  if (!key || typeof key !== 'string') return null;
  if (!key.startsWith('plan_')) return null;

  const parts = key.split('_');
  if (parts.length < 3) return null;

  const userId = parts[1];
  const experienceId = parts.slice(2).join('_');

  if (!userId || !experienceId) return null;
  return { userId, experienceId };
}

function migrateFromSessionStorageOnce() {
  if (didMigrateSessionStorage) return;
  didMigrateSessionStorage = true;

  try {
    if (typeof sessionStorage === 'undefined') return;

    const keysToMigrate = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('plan_')) keysToMigrate.push(key);
    }

    if (keysToMigrate.length === 0) return;

    const cache = safeReadCache();
    for (const key of keysToMigrate) {
      const parsedKey = parseLegacySessionKey(key);
      if (!parsedKey) continue;

      try {
        const raw = sessionStorage.getItem(key);
        if (raw === null) continue;

        const value = JSON.parse(raw);
        if (typeof value !== 'boolean') continue;

        if (!cache.users[parsedKey.userId]) cache.users[parsedKey.userId] = {};
        cache.users[parsedKey.userId][parsedKey.experienceId] = value;

        sessionStorage.removeItem(key);
      } catch {
        // ignore per-key failures
      }
    }

    safeWriteCache(cache);
  } catch {
    // ignore
  }
}

// Public entry point so startup code can proactively migrate.
export function migratePlanCacheFromSessionStorage() {
  migrateFromSessionStorageOnce();
}

export function getCachedPlanState({ userId, experienceId }) {
  if (!userId || !experienceId) return null;

  migrateFromSessionStorageOnce();

  try {
    const cache = safeReadCache();
    const userMap = cache.users?.[userId];
    if (!userMap) return null;

    const value = userMap[experienceId];
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

export function setCachedPlanState({ userId, experienceId, value }) {
  if (!userId || !experienceId) return;

  migrateFromSessionStorageOnce();

  try {
    const cache = safeReadCache();
    if (!cache.users[userId]) cache.users[userId] = {};

    if (value === null) {
      delete cache.users[userId][experienceId];
      if (Object.keys(cache.users[userId]).length === 0) {
        delete cache.users[userId];
      }
    } else {
      cache.users[userId][experienceId] = !!value;
    }

    safeWriteCache(cache);
  } catch {
    // ignore
  }
}

export function clearPlanCacheForUser(userId) {
  if (!userId) return;

  migrateFromSessionStorageOnce();

  try {
    const cache = safeReadCache();
    if (cache.users?.[userId]) {
      delete cache.users[userId];
      safeWriteCache(cache);
    }
  } catch {
    // ignore
  }
}

export const PLAN_CACHE_STORAGE_KEYS = {
  PLAN_CACHE_KEY,
};
