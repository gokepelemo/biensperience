/**
 * Currency conversion utility
 * - Fetches exchange rates from configurable API endpoints (via env vars)
 * - Primary: EXCHANGE_RATE_API_URL (default: v6.exchangerate-api.com)
 * - Fallback: EXCHANGE_RATE_FALLBACK_URL (default: exchangerate.host)
 * - API key: EXCHANGE_RATE_API_KEY (required for exchangerate-api.com)
 * - Caches rates for a configurable TTL (default 1 hour, configurable via EXCHANGE_RATE_CACHE_TTL)
 * - Allows manual injection of rates for offline/testing
 */

import { logger } from './logger';

let _rates = null; // { base: 'USD', rates: { EUR: 0.92, GBP: 0.78, ... }, fetchedAt: 0 }

// Cache TTL from env var (in milliseconds) or default to 1 hour
const DEFAULT_TTL = 1000 * 60 * 60; // 1 hour
let _ttl = parseInt(import.meta.env.EXCHANGE_RATE_CACHE_TTL, 10) || DEFAULT_TTL;

// API endpoints from env vars with defaults
const PRIMARY_API_URL = import.meta.env.EXCHANGE_RATE_API_URL ||
  'https://v6.exchangerate-api.com/v6/{apikey}/latest/{base}';

const FALLBACK_API_URL = import.meta.env.EXCHANGE_RATE_FALLBACK_URL ||
  'https://api.exchangerate.host/latest?base={base}';

// API key for authenticated access (optional)
const EXCHANGE_RATE_API_KEY = import.meta.env.EXCHANGE_RATE_API_KEY || '';

/**
 * Build API URL from template, replacing {base} with the currency code
 * and {apikey} with the API key if configured
 */
function buildApiUrl(template, base) {
  let url = template.replace('{base}', encodeURIComponent(base));
  if (EXCHANGE_RATE_API_KEY) {
    url = url.replace('{apikey}', encodeURIComponent(EXCHANGE_RATE_API_KEY));
  }
  return url;
}

// Exchange rate API endpoints (in order of preference)
const API_ENDPOINTS = [
  (base) => buildApiUrl(PRIMARY_API_URL, base),
  (base) => buildApiUrl(FALLBACK_API_URL, base),
].filter((_, i) => i === 0 || FALLBACK_API_URL); // Only include fallback if configured

export function setRatesObject(ratesObj) {
  // ratesObj: { base: 'USD', rates: { EUR: 0.9, GBP: 0.78 }, fetchedAt?: timestamp }
  if (!ratesObj || !ratesObj.base || !ratesObj.rates) return;
  _rates = { ...ratesObj, fetchedAt: ratesObj.fetchedAt || Date.now() };
}

export function getRatesObject() {
  return _rates;
}

export function setCacheTTL(ms) {
  _ttl = ms;
}

/**
 * Attempt to fetch rates from multiple API endpoints
 */
async function tryFetchFromEndpoint(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    mode: 'cors'
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch rates: ${res.status}`);
  }
  const data = await res.json();
  if (!data || !data.rates) {
    throw new Error('Invalid rates response');
  }
  return data;
}

export async function fetchRates(base = 'USD', symbols = []) {
  try {
    // Use cached if fresh
    if (_rates && _rates.base === base && (Date.now() - (_rates.fetchedAt || 0)) < _ttl) {
      return _rates;
    }

    let data = null;
    let lastError = null;

    // Try each endpoint until one succeeds
    for (const getUrl of API_ENDPOINTS) {
      try {
        const url = getUrl(base);
        data = await tryFetchFromEndpoint(url);
        if (data && data.rates) {
          logger.debug('currency-conversion: Successfully fetched rates', {
            base,
            rateCount: Object.keys(data.rates).length
          });
          break;
        }
      } catch (err) {
        lastError = err;
        logger.debug('currency-conversion: Endpoint failed, trying next', { error: err.message });
      }
    }

    if (!data || !data.rates) {
      throw lastError || new Error('All exchange rate APIs failed');
    }

    _rates = { base: data.base_code || data.base || base, rates: data.rates, fetchedAt: Date.now() };
    return _rates;
  } catch (err) {
    logger.error('currency-conversion: fetchRates failed', { error: err.message }, err);
    // fall back to cached rates if available
    if (_rates) return _rates;
    throw err;
  }
}

/**
 * Convert an amount from one currency to another.
 * If rates are not loaded, this will fetch latest rates for `from` as base.
 */
export async function convert(amount, from = 'USD', to = 'USD') {
  const num = parseFloat(amount);
  if (isNaN(num)) return 0;
  if (from === to) return num;

  // Ensure we have rates for `from` as base
  let ratesObj = _rates;
  if (!ratesObj || ratesObj.base !== from || (Date.now() - (ratesObj.fetchedAt || 0)) >= _ttl) {
    try {
      ratesObj = await fetchRates(from);
    } catch (err) {
      // If fetch failed but a cached ratesObj exists for other base, attempt cross conversion
      if (!_rates) throw err;
      ratesObj = _rates;
    }
  }

  // If ratesObj.base === from, direct multiply
  if (ratesObj && ratesObj.base === from && ratesObj.rates && ratesObj.rates[to] !== undefined) {
    return num * ratesObj.rates[to];
  }

  // Otherwise try cross-rate via base
  // Convert amount -> base of cached rates, then to `to`
  try {
    const baseRates = ratesObj;
    // Convert from `from` to baseRates.base
    let amountInBase;
    if (baseRates.base === from) {
      amountInBase = num;
    } else if (baseRates.rates && baseRates.rates[from] !== undefined) {
      // amount * (1 / rate[from]) to get base
      amountInBase = num / baseRates.rates[from];
    } else {
      // As a last resort, fetch rates with from as base and use that
      const fresh = await fetchRates(from);
      if (fresh.rates && fresh.rates[to] !== undefined) return num * fresh.rates[to];
      throw new Error('No viable conversion path');
    }

    if (baseRates.rates && baseRates.rates[to] !== undefined) {
      return amountInBase * baseRates.rates[to];
    }
  } catch (err) {
    logger.warn('currency-conversion: cross conversion failed', { error: err.message });
  }

  throw new Error('Conversion failed');
}

export default {
  fetchRates,
  convert,
  setRatesObject,
  getRatesObject,
  setCacheTTL,
};
