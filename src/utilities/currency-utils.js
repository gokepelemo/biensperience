/**
 * Currency utility for formatting monetary values
 * Provides internationalization support for currency display
 *
 * Format: {code}{symbol}{amount} (e.g., USD$100, AUD$50, JPY¥1,000)
 */

import { logger } from './logger';

/**
 * Currency configuration object
 * Extended for multiple currencies and locales
 *
 * Format is always: {code}{symbol}{amount} for 'before' position currencies
 * or {code}{amount}{symbol} for 'after' position currencies
 */
const currencyConfig = {
  USD: {
    symbol: '$',
    code: 'USD',
    locale: 'en-US',
    position: 'before',
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
  },
  AUD: {
    symbol: '$',
    code: 'AUD',
    locale: 'en-AU',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  CAD: {
    symbol: '$',
    code: 'CAD',
    locale: 'en-CA',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  CHF: {
    symbol: 'Fr.',
    code: 'CHF',
    locale: 'de-CH',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: "'",
    decimalSeparator: '.'
  },
  CNY: {
    symbol: '¥',
    code: 'CNY',
    locale: 'zh-CN',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  INR: {
    symbol: '₹',
    code: 'INR',
    locale: 'en-IN',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  KRW: {
    symbol: '₩',
    code: 'KRW',
    locale: 'ko-KR',
    position: 'before',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  MXN: {
    symbol: '$',
    code: 'MXN',
    locale: 'es-MX',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  NZD: {
    symbol: '$',
    code: 'NZD',
    locale: 'en-NZ',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  SGD: {
    symbol: '$',
    code: 'SGD',
    locale: 'en-SG',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  THB: {
    symbol: '฿',
    code: 'THB',
    locale: 'th-TH',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  BRL: {
    symbol: 'R$',
    code: 'BRL',
    locale: 'pt-BR',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  ZAR: {
    symbol: 'R',
    code: 'ZAR',
    locale: 'en-ZA',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  SEK: {
    symbol: 'kr',
    code: 'SEK',
    locale: 'sv-SE',
    position: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  NOK: {
    symbol: 'kr',
    code: 'NOK',
    locale: 'nb-NO',
    position: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  DKK: {
    symbol: 'kr',
    code: 'DKK',
    locale: 'da-DK',
    position: 'after',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  HKD: {
    symbol: '$',
    code: 'HKD',
    locale: 'zh-HK',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  TWD: {
    symbol: '$',
    code: 'TWD',
    locale: 'zh-TW',
    position: 'before',
    decimalPlaces: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  PHP: {
    symbol: '₱',
    code: 'PHP',
    locale: 'en-PH',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  IDR: {
    symbol: 'Rp',
    code: 'IDR',
    locale: 'id-ID',
    position: 'before',
    decimalPlaces: 0,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  MYR: {
    symbol: 'RM',
    code: 'MYR',
    locale: 'ms-MY',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  VND: {
    symbol: '₫',
    code: 'VND',
    locale: 'vi-VN',
    position: 'after',
    decimalPlaces: 0,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  AED: {
    symbol: 'د.إ',
    code: 'AED',
    locale: 'ar-AE',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  SAR: {
    symbol: '﷼',
    code: 'SAR',
    locale: 'ar-SA',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  ILS: {
    symbol: '₪',
    code: 'ILS',
    locale: 'he-IL',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  TRY: {
    symbol: '₺',
    code: 'TRY',
    locale: 'tr-TR',
    position: 'before',
    decimalPlaces: 2,
    thousandsSeparator: '.',
    decimalSeparator: ','
  },
  RUB: {
    symbol: '₽',
    code: 'RUB',
    locale: 'ru-RU',
    position: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  PLN: {
    symbol: 'zł',
    code: 'PLN',
    locale: 'pl-PL',
    position: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  CZK: {
    symbol: 'Kč',
    code: 'CZK',
    locale: 'cs-CZ',
    position: 'after',
    decimalPlaces: 2,
    thousandsSeparator: ' ',
    decimalSeparator: ','
  },
  HUF: {
    symbol: 'Ft',
    code: 'HUF',
    locale: 'hu-HU',
    position: 'after',
    decimalPlaces: 0,
    thousandsSeparator: ' ',
    decimalSeparator: ','
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
    logger.warn('Currency not found, using USD', { requestedCurrency: currencyCode });
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
 * Format: {code}{symbol}{amount} (e.g., USD$100, AUD$50, JPY¥1,000)
 * For currencies with symbol after: {code}{amount}{symbol} (e.g., EUR1.000€)
 *
 * @param {number|string} amount - The amount to format
 * @param {string} currencyCode - Currency code (optional, uses default if not provided)
 * @param {boolean} showSymbol - Whether to show the currency symbol (default: true)
 * @param {boolean} showCode - Whether to show the currency code prefix (default: true)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, currencyCode = defaultCurrency, showSymbol = true, showCode = true) {
  const config = currencyConfig[currencyCode] || currencyConfig.USD;

  // Convert to number and handle invalid values
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) {
    const prefix = showCode ? config.code : '';
    return showSymbol ? `${prefix}${config.symbol}0` : '0';
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
  const codePrefix = showCode ? config.code : '';

  // Build the final string: {code}{symbol}{amount} or {code}{amount}{symbol}
  let result = '';

  if (config.position === 'before') {
    // Format: USD$100, AUD$50, JPY¥1,000
    result = sign + codePrefix + (showSymbol ? config.symbol : '') + formattedNumber;
  } else {
    // Format: EUR1.000€, SEK1 000kr
    result = sign + codePrefix + formattedNumber + (showSymbol ? config.symbol : '');
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
 * Currency display names for dropdowns
 * Maps currency codes to human-readable names
 */
const currencyNames = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc',
  CNY: 'Chinese Yuan',
  INR: 'Indian Rupee',
  KRW: 'South Korean Won',
  MXN: 'Mexican Peso',
  NZD: 'New Zealand Dollar',
  SGD: 'Singapore Dollar',
  THB: 'Thai Baht',
  BRL: 'Brazilian Real',
  ZAR: 'South African Rand',
  SEK: 'Swedish Krona',
  NOK: 'Norwegian Krone',
  DKK: 'Danish Krone',
  HKD: 'Hong Kong Dollar',
  TWD: 'Taiwan Dollar',
  PHP: 'Philippine Peso',
  IDR: 'Indonesian Rupiah',
  MYR: 'Malaysian Ringgit',
  VND: 'Vietnamese Dong',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  ILS: 'Israeli Shekel',
  TRY: 'Turkish Lira',
  RUB: 'Russian Ruble',
  PLN: 'Polish Zloty',
  CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint'
};

/**
 * Get all available currencies with full details
 * @returns {Array<Object>} Array of currency objects with code, symbol, name, locale, position
 */
export function getAvailableCurrencies() {
  return Object.entries(currencyConfig).map(([code, config]) => ({
    code,
    symbol: config.symbol,
    name: currencyNames[code] || code,
    locale: config.locale,
    position: config.position,
    decimalPlaces: config.decimalPlaces
  }));
}

/**
 * Get currency dropdown options for select elements
 * Returns options sorted with common currencies first
 *
 * @param {Object} options - Configuration options
 * @param {string} options.format - Label format: 'code' (USD), 'symbol' (USD$), 'name' (US Dollar), 'full' (USD - US Dollar ($))
 * @param {boolean} options.sortByPopularity - Sort common currencies first (default: true)
 * @param {Array<string>} options.include - Only include these currency codes (optional)
 * @param {Array<string>} options.exclude - Exclude these currency codes (optional)
 * @returns {Array<Object>} Array of { value, label, code, symbol, name } for dropdown options
 *
 * @example
 * // For a simple dropdown
 * getCurrencyDropdownOptions({ format: 'symbol' })
 * // Returns: [{ value: 'USD', label: 'USD$', code: 'USD', symbol: '$', name: 'US Dollar' }, ...]
 *
 * @example
 * // For a detailed dropdown
 * getCurrencyDropdownOptions({ format: 'full' })
 * // Returns: [{ value: 'USD', label: 'USD - US Dollar ($)', ... }, ...]
 */
export function getCurrencyDropdownOptions(options = {}) {
  const {
    format = 'symbol',
    sortByPopularity = true,
    include = null,
    exclude = null
  } = options;

  // Common currencies that should appear first (sorted by global usage)
  const popularCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN'];

  let currencies = getAvailableCurrencies();

  // Filter by include list
  if (include && Array.isArray(include) && include.length > 0) {
    currencies = currencies.filter(c => include.includes(c.code));
  }

  // Filter by exclude list
  if (exclude && Array.isArray(exclude) && exclude.length > 0) {
    currencies = currencies.filter(c => !exclude.includes(c.code));
  }

  // Sort: popular currencies first, then alphabetically
  if (sortByPopularity) {
    currencies.sort((a, b) => {
      const aPopIndex = popularCurrencies.indexOf(a.code);
      const bPopIndex = popularCurrencies.indexOf(b.code);

      // Both are popular - sort by popularity order
      if (aPopIndex !== -1 && bPopIndex !== -1) {
        return aPopIndex - bPopIndex;
      }
      // Only a is popular - a comes first
      if (aPopIndex !== -1) return -1;
      // Only b is popular - b comes first
      if (bPopIndex !== -1) return 1;
      // Neither popular - sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  } else {
    // Sort alphabetically by name
    currencies.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Generate labels based on format
  return currencies.map(currency => {
    let label;
    switch (format) {
      case 'code':
        label = currency.code;
        break;
      case 'symbol':
        label = `${currency.code}${currency.symbol}`;
        break;
      case 'name':
        label = currency.name;
        break;
      case 'full':
        label = `${currency.code} - ${currency.name} (${currency.symbol})`;
        break;
      case 'codeAndName':
        label = `${currency.code} - ${currency.name}`;
        break;
      default:
        label = `${currency.code}${currency.symbol}`;
    }

    return {
      value: currency.code,
      label,
      code: currency.code,
      symbol: currency.symbol,
      name: currency.name
    };
  });
}

/**
 * Get a single currency's display name
 * @param {string} code - Currency code
 * @returns {string} Currency name or code if not found
 */
export function getCurrencyName(code) {
  return currencyNames[code] || code;
}
