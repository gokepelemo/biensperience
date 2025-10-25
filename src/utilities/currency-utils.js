/**
 * Currency utility for formatting monetary values
 * Provides internationalization support for currency display
 */

import { logger } from './logger';

/**
 * Currency configuration object
 * Can be extended for multiple currencies and locales
 */
const currencyConfig = {
  USD: {
    symbol: '$',
    code: 'USD',
    locale: 'en-US',
    position: 'before', // 'before' or 'after'
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  EUR: {
    symbol: '€',
    code: 'EUR',
    locale: 'de-DE',
    position: 'after',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  GBP: {
    symbol: '£',
    code: 'GBP',
    locale: 'en-GB',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  JPY: {
    symbol: '¥',
    code: 'JPY',
    locale: 'ja-JP',
    position: 'before',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  }
};

// Default currency (can be changed based on user preference or location)
let defaultCurrency = 'USD';

/**
 * Set the default currency for the application
 * @param {string} currencyCode - Currency code (USD, EUR, GBP, JPY, etc.)
 */
export function setDefaultCurrency(currencyCode) {
  if (currencyConfig[currencyCode]) {
    defaultCurrency = currencyCode;
  } else {
    logger.warn('Currency not found, using USD', { currencyCode });
    defaultCurrency = 'USD';
  }
}

/**
 * Get the current default currency
 * @returns {string} Current default currency code
 */
export function getDefaultCurrency() {
  return defaultCurrency;
}

/**
 * Get currency symbol for a given currency code
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @returns {string} Currency symbol
 */
export function getCurrencySymbol(currencyCode = defaultCurrency) {
  return currencyConfig[currencyCode]?.symbol || '$';
}

/**
 * Format a number as currency with proper separators and symbol
 * @param {number|string} amount - The amount to format
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @param {boolean} showSymbol - Whether to show the currency symbol (default: true)
 * @param {boolean} showCode - Whether to show the currency code (default: false)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currencyCode = defaultCurrency, showSymbol = true, showCode = false) {
  const config = currencyConfig[currencyCode] || currencyConfig.USD;
  
  // Convert to number and handle invalid values
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    return showSymbol ? `${config.symbol}0` : '0';
  }

  // Check if the amount has cents (decimal places)
  const hasCents = numAmount % 1 !== 0;
  
  // Use Intl.NumberFormat for proper locale-based formatting
  const formatter = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: hasCents ? config.decimalPlaces : 0,
    maximumFractionDigits: config.decimalPlaces,
  });

  const formattedNumber = formatter.format(Math.abs(numAmount));
  const sign = numAmount < 0 ? '-' : '';

  // Build the final string
  let result = '';
  
  if (config.position === 'before') {
    result = sign + (showSymbol ? config.symbol : '') + formattedNumber;
  } else {
    result = sign + formattedNumber + (showSymbol ? config.symbol : '');
  }

  if (showCode) {
    result += ` ${config.code}`;
  }

  return result;
}

/**
 * Format currency for form inputs (no symbol, just number with separators)
 * @param {number|string} amount - The amount to format
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @returns {string} Formatted number string
 */
export function formatCurrencyInput(amount, currencyCode = defaultCurrency) {
  return formatCurrency(amount, currencyCode, false, false);
}

/**
 * Parse a formatted currency string back to a number
 * Removes currency symbols and converts separators
 * @param {string} formattedAmount - The formatted currency string
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @returns {number} Parsed number value
 */
export function parseCurrency(formattedAmount, currencyCode = defaultCurrency) {
  if (typeof formattedAmount === 'number') {
    return formattedAmount;
  }

  const config = currencyConfig[currencyCode] || currencyConfig.USD;
  
  // Remove currency symbol and code
  let cleanedAmount = String(formattedAmount)
    .replace(config.symbol, '')
    .replace(config.code, '')
    .trim();

  // Remove thousands separators
  cleanedAmount = cleanedAmount.replace(new RegExp(`\\${config.thousandsSeparator}`, 'g'), '');
  
  // Convert decimal separator to standard dot
  if (config.decimalSeparator !== '.') {
    cleanedAmount = cleanedAmount.replace(config.decimalSeparator, '.');
  }

  const parsed = parseFloat(cleanedAmount);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a cost estimate with optional "estimated" label
 * @param {number|string} amount - The amount to format
 * @param {boolean} isEstimate - Whether this is an estimate (default: true)
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @returns {string} Formatted cost estimate string
 */
export function formatCostEstimate(amount, isEstimate = true, currencyCode = defaultCurrency) {
  const formatted = formatCurrency(amount, currencyCode);
  return isEstimate ? `~${formatted}` : formatted;
}

/**
 * Format a range of costs
 * @param {number|string} minAmount - Minimum amount
 * @param {number|string} maxAmount - Maximum amount
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @returns {string} Formatted cost range string
 */
export function formatCostRange(minAmount, maxAmount, currencyCode = defaultCurrency) {
  const min = formatCurrency(minAmount, currencyCode);
  const max = formatCurrency(maxAmount, currencyCode);
  return `${min} - ${max}`;
}

/**
 * Calculate and format total cost
 * @param {Array<number>} amounts - Array of amounts to sum
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @returns {string} Formatted total
 */
export function formatTotal(amounts, currencyCode = defaultCurrency) {
  const total = amounts.reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0);
  return formatCurrency(total, currencyCode);
}

/**
 * Get all available currencies
 * @returns {Array<Object>} Array of currency objects with code, symbol, and locale
 */
export function getAvailableCurrencies() {
  return Object.entries(currencyConfig).map(([code, config]) => ({
    code,
    symbol: config.symbol,
    locale: config.locale,
    position: config.position
  }));
}
