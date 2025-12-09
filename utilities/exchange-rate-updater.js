/**
 * Exchange Rate Updater Utility
 *
 * Fetches current exchange rates from public APIs and updates
 * the fallback-exchange-rates.json file used for offline/error scenarios.
 *
 * Called automatically on server startup from server.js
 *
 * @module utilities/exchange-rate-updater
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const backendLogger = require('./backend-logger');

// Path to the fallback rates JSON file
const FALLBACK_FILE_PATH = path.join(__dirname, '../src/data/fallback-exchange-rates.json');

// API endpoints to try (in order of preference)
const API_ENDPOINTS = [
  {
    name: 'Frankfurter',
    url: 'https://api.frankfurter.app/latest?from=USD',
    parseResponse: (data) => ({
      base: data.base || 'USD',
      date: data.date,
      rates: { USD: 1, ...data.rates }
    })
  },
  {
    name: 'ExchangeRate.host',
    url: 'https://api.exchangerate.host/latest?base=USD',
    parseResponse: (data) => ({
      base: data.base || 'USD',
      date: data.date,
      rates: data.rates
    })
  }
];

// Currencies we support in the app
const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'KRW',
  'MXN', 'NZD', 'SGD', 'THB', 'BRL', 'ZAR', 'SEK', 'NOK', 'DKK', 'HKD',
  'TWD', 'PHP', 'IDR', 'MYR', 'VND', 'AED', 'SAR', 'ILS', 'TRY', 'RUB',
  'PLN', 'CZK', 'HUF'
];

// Default rates (last known good values) for currencies not in API
const DEFAULT_RATES = {
  TWD: 31.197,
  VND: 26364,
  AED: 3.6725,
  SAR: 3.75,
  RUB: 76.727
};

/**
 * Fetch JSON from a URL
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Try to fetch rates from multiple API endpoints
 */
async function fetchRatesFromApis() {
  for (const endpoint of API_ENDPOINTS) {
    try {
      backendLogger.debug('Trying exchange rate API', { api: endpoint.name });
      const data = await fetchJson(endpoint.url);
      const parsed = endpoint.parseResponse(data);

      if (parsed && parsed.rates && Object.keys(parsed.rates).length > 0) {
        backendLogger.debug('Successfully fetched exchange rates', { api: endpoint.name });
        return parsed;
      }
    } catch (err) {
      backendLogger.debug('Exchange rate API failed', { api: endpoint.name, error: err.message });
    }
  }
  return null;
}

/**
 * Read existing fallback rates
 */
function readExistingRates() {
  try {
    if (fs.existsSync(FALLBACK_FILE_PATH)) {
      const content = fs.readFileSync(FALLBACK_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    backendLogger.debug('Could not read existing exchange rates', { error: err.message });
  }
  return null;
}

/**
 * Update the fallback exchange rates file
 * @returns {Promise<boolean>} True if rates were updated successfully
 */
async function updateExchangeRates() {
  backendLogger.debug('Starting exchange rate update');

  // Try to fetch fresh rates
  const freshRates = await fetchRatesFromApis();

  if (!freshRates) {
    backendLogger.debug('All exchange rate APIs failed, keeping existing rates');
    return false;
  }

  // Read existing rates to preserve any missing currencies
  const existingRates = readExistingRates();

  // Build complete rates object with all supported currencies
  const completeRates = { USD: 1 };

  for (const currency of SUPPORTED_CURRENCIES) {
    if (freshRates.rates[currency] !== undefined) {
      // Use fresh rate
      completeRates[currency] = freshRates.rates[currency];
    } else if (existingRates?.rates?.[currency] !== undefined) {
      // Fall back to existing rate
      completeRates[currency] = existingRates.rates[currency];
    } else if (DEFAULT_RATES[currency] !== undefined) {
      // Fall back to default rate
      completeRates[currency] = DEFAULT_RATES[currency];
    }
  }

  // Build the output JSON
  const output = {
    base: 'USD',
    date: freshRates.date || new Date().toISOString().split('T')[0],
    description: 'Fallback exchange rates for offline/error scenarios. These rates are updated periodically and should not be used for financial transactions.',
    source: 'Compiled from Frankfurter API, X-Rates, and Wise',
    lastUpdated: new Date().toISOString(),
    rates: completeRates
  };

  // Write to file
  try {
    // Ensure directory exists
    const dir = path.dirname(FALLBACK_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify(output, null, 2) + '\n');
    backendLogger.debug('Exchange rates updated', {
      currencies: Object.keys(completeRates).length,
      date: output.date
    });
    return true;
  } catch (err) {
    backendLogger.error('Failed to write exchange rates file', { error: err.message });
    return false;
  }
}

module.exports = { updateExchangeRates };
