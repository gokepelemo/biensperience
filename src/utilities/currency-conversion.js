/**
 * Currency conversion utility
 * - Fetches exchange rates from exchangerate.host (free) by default
 * - Caches rates for a configurable TTL (default 1 hour)
 * - Allows manual injection of rates for offline/testing
 */

import { logger } from './logger';

let _rates = null; // { base: 'USD', rates: { EUR: 0.92, GBP: 0.78, ... }, fetchedAt: 0 }
let _ttl = 1000 * 60 * 60; // 1 hour

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

export async function fetchRates(base = 'USD', symbols = []) {
  try {
    // Use cached if fresh
    if (_rates && _rates.base === base && (Date.now() - (_rates.fetchedAt || 0)) < _ttl) {
      return _rates;
    }

    const symbolParam = symbols.length ? `&symbols=${symbols.join(',')}` : '';
    const url = `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}${symbolParam}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch rates: ${res.status}`);
    }
    const data = await res.json();
    if (!data || !data.rates) {
      throw new Error('Invalid rates response');
    }
    _rates = { base: data.base || base, rates: data.rates, fetchedAt: Date.now() };
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
