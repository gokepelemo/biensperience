/**
 * Currency Conversion Utility for Backend
 *
 * Provides exchange rate fetching and currency conversion functions.
 * Uses the Open Exchange Rates API with caching.
 *
 * @module utilities/currency-utils
 */

const logger = require('./backend-logger');

// Cache for exchange rates
let _rates = null;
let _ratesFetchedAt = null;
let _cacheValidMs = 60 * 60 * 1000; // 1 hour default

// API configuration
const EXCHANGE_RATE_API = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest';

/**
 * Currency configuration with symbols and formatting rules
 */
const currencyConfig = {
  USD: { symbol: '$', code: 'USD', position: 'before', decimalPlaces: 2 },
  EUR: { symbol: '€', code: 'EUR', position: 'after', decimalPlaces: 2 },
  GBP: { symbol: '£', code: 'GBP', position: 'before', decimalPlaces: 2 },
  JPY: { symbol: '¥', code: 'JPY', position: 'before', decimalPlaces: 0 },
  AUD: { symbol: '$', code: 'AUD', position: 'before', decimalPlaces: 2 },
  CAD: { symbol: '$', code: 'CAD', position: 'before', decimalPlaces: 2 },
  CHF: { symbol: 'Fr.', code: 'CHF', position: 'before', decimalPlaces: 2 },
  CNY: { symbol: '¥', code: 'CNY', position: 'before', decimalPlaces: 2 },
  INR: { symbol: '₹', code: 'INR', position: 'before', decimalPlaces: 2 },
  KRW: { symbol: '₩', code: 'KRW', position: 'before', decimalPlaces: 0 },
  MXN: { symbol: '$', code: 'MXN', position: 'before', decimalPlaces: 2 },
  NZD: { symbol: '$', code: 'NZD', position: 'before', decimalPlaces: 2 },
  SGD: { symbol: '$', code: 'SGD', position: 'before', decimalPlaces: 2 },
  THB: { symbol: '฿', code: 'THB', position: 'before', decimalPlaces: 2 },
  BRL: { symbol: 'R$', code: 'BRL', position: 'before', decimalPlaces: 2 },
  ZAR: { symbol: 'R', code: 'ZAR', position: 'before', decimalPlaces: 2 },
  SEK: { symbol: 'kr', code: 'SEK', position: 'after', decimalPlaces: 2 },
  NOK: { symbol: 'kr', code: 'NOK', position: 'after', decimalPlaces: 2 },
  DKK: { symbol: 'kr', code: 'DKK', position: 'after', decimalPlaces: 2 },
  HKD: { symbol: '$', code: 'HKD', position: 'before', decimalPlaces: 2 },
  TWD: { symbol: '$', code: 'TWD', position: 'before', decimalPlaces: 0 },
  PHP: { symbol: '₱', code: 'PHP', position: 'before', decimalPlaces: 2 },
  IDR: { symbol: 'Rp', code: 'IDR', position: 'before', decimalPlaces: 0 },
  MYR: { symbol: 'RM', code: 'MYR', position: 'before', decimalPlaces: 2 },
  VND: { symbol: '₫', code: 'VND', position: 'after', decimalPlaces: 0 },
  AED: { symbol: 'د.إ', code: 'AED', position: 'before', decimalPlaces: 2 },
  SAR: { symbol: '﷼', code: 'SAR', position: 'before', decimalPlaces: 2 },
  ILS: { symbol: '₪', code: 'ILS', position: 'before', decimalPlaces: 2 },
  TRY: { symbol: '₺', code: 'TRY', position: 'before', decimalPlaces: 2 },
  RUB: { symbol: '₽', code: 'RUB', position: 'after', decimalPlaces: 2 },
  PLN: { symbol: 'zł', code: 'PLN', position: 'after', decimalPlaces: 2 },
  CZK: { symbol: 'Kč', code: 'CZK', position: 'after', decimalPlaces: 2 },
  HUF: { symbol: 'Ft', code: 'HUF', position: 'after', decimalPlaces: 0 }
};

/**
 * Validate that a currency code is in our allowed list
 * Prevents SSRF by ensuring only known currency codes are used in API requests
 * @param {string} currency - Currency code to validate
 * @returns {boolean} True if valid
 */
function isValidCurrency(currency) {
  if (typeof currency !== 'string') return false;
  // Only allow currencies defined in currencyConfig (uppercase 3-letter codes)
  const normalizedCurrency = currency.toUpperCase().trim();
  return Object.prototype.hasOwnProperty.call(currencyConfig, normalizedCurrency);
}

/**
 * Fetch exchange rates from API
 * @param {string} baseCurrency - Base currency for rates (default: USD)
 * @returns {Promise<Object>} Exchange rates object with base and rates
 */
async function fetchRates(baseCurrency = 'USD') {
  // Validate currency to prevent SSRF attacks
  const normalizedCurrency = (baseCurrency || 'USD').toUpperCase().trim();
  if (!isValidCurrency(normalizedCurrency)) {
    logger.warn('[currency-utils] Invalid currency code rejected', { baseCurrency });
    throw new Error(`Invalid currency code: ${baseCurrency}`);
  }

  // Check cache
  if (_rates && _ratesFetchedAt && (Date.now() - _ratesFetchedAt < _cacheValidMs)) {
    if (_rates.base === normalizedCurrency) {
      return _rates;
    }
    // Convert cached rates to new base if possible
    if (_rates.rates && _rates.rates[normalizedCurrency] !== undefined) {
      const baseRate = _rates.rates[normalizedCurrency];
      const convertedRates = {};
      for (const [currency, rate] of Object.entries(_rates.rates)) {
        convertedRates[currency] = rate / baseRate;
      }
      convertedRates[_rates.base] = 1 / baseRate;
      return { base: normalizedCurrency, rates: convertedRates };
    }
  }

  try {
    // Use validated/normalized currency code to prevent SSRF
    const response = await fetch(`${EXCHANGE_RATE_API}/${normalizedCurrency}`);
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.result === 'success' && data.rates) {
      _rates = { base: normalizedCurrency, rates: data.rates };
      _ratesFetchedAt = Date.now();
      logger.debug('[currency-utils] Exchange rates fetched', { base: normalizedCurrency, rateCount: Object.keys(data.rates).length });
      return _rates;
    }

    throw new Error('Invalid response from exchange rate API');
  } catch (error) {
    logger.warn('[currency-utils] Failed to fetch exchange rates', { error: error.message, baseCurrency });
    // Return cached rates if available, even if expired
    if (_rates) {
      return _rates;
    }
    throw error;
  }
}

/**
 * Convert amount from one currency to another
 * Uses cached rates or fetches new ones if needed
 *
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {Promise<number>} Converted amount
 */
async function convert(amount, fromCurrency = 'USD', toCurrency = 'USD') {
  const num = parseFloat(amount);
  if (isNaN(num)) return 0;
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return num;

  try {
    // Ensure rates are loaded
    if (!_rates || !_ratesFetchedAt || (Date.now() - _ratesFetchedAt >= _cacheValidMs)) {
      await fetchRates('USD');
    }

    return convertSync(num, fromCurrency, toCurrency);
  } catch (error) {
    logger.warn('[currency-utils] Conversion failed', { error: error.message, amount, fromCurrency, toCurrency });
    return num; // Return original amount if conversion fails
  }
}

/**
 * Synchronously convert amount using cached rates
 * Returns original amount if rates not available
 *
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @returns {number} Converted amount or original if conversion fails
 */
function convertSync(amount, fromCurrency = 'USD', toCurrency = 'USD') {
  const num = parseFloat(amount);
  if (isNaN(num)) return 0;
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return num;

  if (!_rates || !_rates.rates) {
    return num;
  }

  try {
    // Case 1: Direct conversion if base matches source currency
    if (_rates.base === fromCurrency && _rates.rates[toCurrency] !== undefined) {
      return num * _rates.rates[toCurrency];
    }

    // Case 2: Converting TO the base currency
    if (_rates.base === toCurrency && _rates.rates[fromCurrency] !== undefined) {
      return num / _rates.rates[fromCurrency];
    }

    // Case 3: Cross-rate conversion via base
    if (_rates.rates[fromCurrency] !== undefined && _rates.rates[toCurrency] !== undefined) {
      const amountInBase = num / _rates.rates[fromCurrency];
      return amountInBase * _rates.rates[toCurrency];
    }

    return num;
  } catch {
    return num;
  }
}

/**
 * Convert a cost object's amount to a target currency
 *
 * @param {Object} cost - Cost object with { cost: number, currency?: string }
 * @param {string} targetCurrency - Target currency code
 * @returns {number} Converted cost amount
 */
function convertCostToTarget(cost, targetCurrency = 'USD') {
  const costAmount = cost?.cost || 0;
  const costCurrency = cost?.currency || 'USD';
  return convertSync(costAmount, costCurrency, targetCurrency);
}

/**
 * Calculate total from array of costs, converting to target currency
 *
 * @param {Array} costs - Array of cost objects with { cost, currency }
 * @param {string} targetCurrency - Target currency code
 * @returns {number} Total in target currency
 */
function calculateTotal(costs, targetCurrency = 'USD') {
  if (!Array.isArray(costs)) return 0;

  return costs.reduce((sum, cost) => {
    const converted = convertCostToTarget(cost, targetCurrency);
    return sum + converted;
  }, 0);
}

/**
 * Convert an array of costs to a target currency with breakdown
 *
 * @param {Array} costs - Array of cost objects
 * @param {string} targetCurrency - Target currency code
 * @returns {{ convertedCosts: Array, total: number, byCurrency: Object }}
 */
function convertCostsToTarget(costs, targetCurrency = 'USD') {
  if (!Array.isArray(costs)) return { convertedCosts: [], total: 0, byCurrency: {} };

  let total = 0;
  const byCurrency = {};

  const convertedCosts = costs.map(cost => {
    const originalCurrency = cost.currency || 'USD';
    const converted = convertCostToTarget(cost, targetCurrency);
    total += converted;

    // Track by original currency
    if (!byCurrency[originalCurrency]) {
      byCurrency[originalCurrency] = 0;
    }
    byCurrency[originalCurrency] += cost.cost || 0;

    return {
      ...cost,
      originalCost: cost.cost,
      originalCurrency,
      convertedCost: converted,
      targetCurrency
    };
  });

  return { convertedCosts, total, byCurrency };
}

/**
 * Get currency symbol
 * @param {string} currencyCode - Currency code
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currencyCode = 'USD') {
  return currencyConfig[currencyCode]?.symbol || '$';
}

/**
 * Format currency amount with symbol
 *
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - Currency code
 * @param {boolean} showSymbol - Whether to show symbol
 * @param {boolean} showCode - Whether to show currency code
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount, currencyCode = 'USD', showSymbol = true, showCode = true) {
  const config = currencyConfig[currencyCode] || currencyConfig.USD;

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    const prefix = showCode ? config.code : '';
    return showSymbol ? `${prefix}${config.symbol}0` : '0';
  }

  const hasCents = numAmount % 1 !== 0;
  const formatted = Math.abs(numAmount).toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? config.decimalPlaces : 0,
    maximumFractionDigits: config.decimalPlaces
  });

  const sign = numAmount < 0 ? '-' : '';
  const codePrefix = showCode ? config.code : '';

  if (config.position === 'before') {
    return sign + codePrefix + (showSymbol ? config.symbol : '') + formatted;
  } else {
    return sign + codePrefix + formatted + (showSymbol ? config.symbol : '');
  }
}

/**
 * Get list of available currencies
 * @returns {Array<Object>} Array of { code, symbol, name }
 */
function getAvailableCurrencies() {
  return Object.entries(currencyConfig).map(([code, config]) => ({
    code,
    symbol: config.symbol,
    decimalPlaces: config.decimalPlaces
  }));
}

/**
 * Set cache TTL for exchange rates
 * @param {number} ms - Cache TTL in milliseconds
 */
function setCacheTTL(ms) {
  _cacheValidMs = ms;
}

/**
 * Clear rate cache (for testing)
 */
function clearCache() {
  _rates = null;
  _ratesFetchedAt = null;
}

/**
 * Check if rates are loaded
 * @returns {boolean}
 */
function hasRates() {
  return !!(_rates && _rates.rates);
}

module.exports = {
  fetchRates,
  convert,
  convertSync,
  convertCostToTarget,
  calculateTotal,
  convertCostsToTarget,
  getCurrencySymbol,
  formatCurrency,
  getAvailableCurrencies,
  setCacheTTL,
  clearCache,
  hasRates
};
