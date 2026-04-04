/**
 * API Rate Limit Tracker
 *
 * Unified in-memory sliding window counter for external API providers.
 * Each provider tracks a rolling array of request timestamps within its window.
 *
 * @module utilities/api-rate-tracker
 */

const logger = require('./backend-logger');

const WARN_THRESHOLD = 0.8;

/**
 * Provider configuration.
 * windowMs: sliding window duration in milliseconds
 * limit:    max requests allowed within the window
 * timestamps: rolling array of request times (Date.now() values)
 */
const PROVIDERS = {
  unsplash: {
    windowMs: 3_600_000, // 1 hour
    limit: parseInt(process.env.UNSPLASH_HOURLY_LIMIT || '50', 10),
    timestamps: [],
  },
  google_maps_text_search: {
    windowMs: 86_400_000, // 24 hours
    limit: parseInt(process.env.GOOGLE_MAPS_DAILY_TEXT_SEARCH_LIMIT || '50', 10),
    timestamps: [],
  },
  google_maps_photos: {
    windowMs: 86_400_000,
    limit: parseInt(process.env.GOOGLE_MAPS_DAILY_PHOTO_LIMIT || '100', 10),
    timestamps: [],
  },
  tripadvisor: {
    windowMs: 86_400_000,
    limit: parseInt(process.env.TRIPADVISOR_DAILY_LIMIT || '100', 10),
    timestamps: [],
  },
};

/**
 * Prune timestamps older than windowMs from a provider entry.
 * Mutates provider.timestamps in place.
 *
 * @param {object} provider - Entry from PROVIDERS
 */
function prune(provider) {
  const cutoff = Date.now() - provider.windowMs;
  provider.timestamps = provider.timestamps.filter(t => t > cutoff);
}

/**
 * Check if a provider has budget remaining without recording usage.
 * Read-only — no side effects.
 *
 * @param {string} providerKey
 * @returns {{ allowed: boolean, remaining: number, resetAt: Date }}
 */
function checkBudget(providerKey) {
  const provider = PROVIDERS[providerKey];
  if (!provider) {
    logger.error('[api-rate-tracker] Unknown provider key', { provider: providerKey });
    return { allowed: true, remaining: 0, resetAt: new Date() };
  }

  prune(provider);
  const used = provider.timestamps.length;
  const remaining = Math.max(0, provider.limit - used);
  const oldest = provider.timestamps[0];
  const resetAt = oldest
    ? new Date(oldest + provider.windowMs)
    : new Date(Date.now() + provider.windowMs);

  return { allowed: remaining > 0, remaining, resetAt };
}

/**
 * Record one or more requests against a provider's budget.
 * Logs a warning when usage crosses the 80% threshold.
 *
 * @param {string} providerKey
 * @param {number} [count=1]
 */
function recordUsage(providerKey, count = 1) {
  const provider = PROVIDERS[providerKey];
  if (!provider) {
    logger.error('[api-rate-tracker] Unknown provider key in recordUsage', { provider: providerKey });
    return;
  }

  const now = Date.now();
  for (let i = 0; i < count; i++) {
    provider.timestamps.push(now);
  }

  prune(provider);

  const used = provider.timestamps.length;
  const usedPercent = used / provider.limit;
  if (usedPercent >= WARN_THRESHOLD) {
    logger.warn(`[api-rate-tracker] ${providerKey} budget at ${Math.round(usedPercent * 100)}%`, {
      provider: providerKey,
      used,
      limit: provider.limit,
      remaining: Math.max(0, provider.limit - used),
      resetAt: provider.timestamps[0]
        ? new Date(provider.timestamps[0] + provider.windowMs)
        : null,
    });
  }
}

/**
 * Return current usage status for one or all providers.
 *
 * @param {string} [providerKey] - If omitted, returns all providers
 * @returns {object}
 */
function getStatus(providerKey) {
  if (providerKey) {
    const provider = PROVIDERS[providerKey];
    if (!provider) return null;
    prune(provider);
    const used = provider.timestamps.length;
    const remaining = Math.max(0, provider.limit - used);
    return {
      used,
      remaining,
      limit: provider.limit,
      windowMs: provider.windowMs,
      usedPercent: used / provider.limit,
      resetAt: provider.timestamps[0]
        ? new Date(provider.timestamps[0] + provider.windowMs)
        : null,
    };
  }

  const result = {};
  for (const key of Object.keys(PROVIDERS)) {
    result[key] = getStatus(key);
  }
  return result;
}

module.exports = { checkBudget, recordUsage, getStatus };
