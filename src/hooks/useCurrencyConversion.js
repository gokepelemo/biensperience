/**
 * useCurrencyConversion Hook
 *
 * React hook for converting currencies with automatic rate fetching and caching.
 * Uses the user's preferred currency from preferences context.
 *
 * @module hooks/useCurrencyConversion
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../contexts/UserContext';
import { convert, fetchRates, getRatesObject } from '../utilities/currency-conversion';
import { logger } from '../utilities/logger';

/**
 * Hook for currency conversion with user preference support
 *
 * @param {Object} options - Configuration options
 * @param {string} options.defaultTargetCurrency - Target currency if user preference not available (default: 'USD')
 * @param {boolean} options.autoFetch - Auto-fetch rates on mount (default: true)
 * @returns {Object} Currency conversion utilities
 *
 * @example
 * const { convert, convertedAmount, loading, error, userCurrency } = useCurrencyConversion();
 *
 * // Convert $100 USD to user's currency
 * const amount = await convert(100, 'USD');
 *
 * // Or use the synchronous convertAmount if rates are pre-loaded
 * const amount = convertAmount(100, 'USD');
 */
export function useCurrencyConversion(options = {}) {
  const { defaultTargetCurrency = 'USD', autoFetch = true } = options;

  // Get user's preferred currency from context
  let user = null;
  try {
    const userContext = useUser();
    user = userContext?.user;
  } catch {
    // User context not available
  }

  const userCurrency = user?.preferences?.currency || defaultTargetCurrency;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Auto-fetch rates on mount if enabled
  useEffect(() => {
    if (autoFetch && userCurrency) {
      setLoading(true);
      setError(null);

      fetchRates(userCurrency)
        .then(() => {
          setRatesLoaded(true);
          setLoading(false);
        })
        .catch((err) => {
          logger.warn('useCurrencyConversion: Failed to fetch rates', { error: err.message });
          setError(err);
          setLoading(false);
        });
    }
  }, [autoFetch, userCurrency]);

  /**
   * Convert an amount from one currency to the user's preferred currency
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency code (default: 'USD')
   * @param {string} toCurrency - Target currency code (default: user's preference)
   * @returns {Promise<number>} Converted amount
   */
  const convertAsync = useCallback(async (amount, fromCurrency = 'USD', toCurrency = userCurrency) => {
    if (!amount || isNaN(amount)) return 0;
    if (fromCurrency === toCurrency) return parseFloat(amount);

    try {
      const result = await convert(amount, fromCurrency, toCurrency);
      return result;
    } catch (err) {
      logger.warn('useCurrencyConversion: Conversion failed', {
        amount,
        fromCurrency,
        toCurrency,
        error: err.message
      });
      // Return original amount if conversion fails
      return parseFloat(amount);
    }
  }, [userCurrency]);

  /**
   * Synchronously convert an amount using cached rates
   * Returns original amount if rates not available
   * NOTE: ratesLoaded is in dependency array to trigger re-render when rates become available
   * @param {number} amount - Amount to convert
   * @param {string} fromCurrency - Source currency code
   * @param {string} toCurrency - Target currency code (default: user's preference)
   * @returns {number} Converted amount or original if conversion not possible
   */
  const convertSync = useCallback((amount, fromCurrency = 'USD', toCurrency = userCurrency) => {
    if (!amount || isNaN(amount)) return 0;
    if (fromCurrency === toCurrency) return parseFloat(amount);

    const rates = getRatesObject();
    if (!rates || !rates.rates) {
      // Rates not loaded, return original
      return parseFloat(amount);
    }

    try {
      const num = parseFloat(amount);

      // Case 1: Direct conversion if base matches source currency
      // e.g., base='USD', from='USD', to='EUR' -> multiply by rates['EUR']
      if (rates.base === fromCurrency && rates.rates[toCurrency] !== undefined) {
        return num * rates.rates[toCurrency];
      }

      // Case 2: Converting TO the base currency
      // e.g., base='EUR', from='JPY', to='EUR' -> divide by rates['JPY']
      if (rates.base === toCurrency && rates.rates[fromCurrency] !== undefined) {
        return num / rates.rates[fromCurrency];
      }

      // Case 3: Cross-rate conversion via base (neither currency is the base)
      // e.g., base='EUR', from='JPY', to='USD' -> (amount / rates['JPY']) * rates['USD']
      if (rates.rates[fromCurrency] !== undefined && rates.rates[toCurrency] !== undefined) {
        const amountInBase = num / rates.rates[fromCurrency];
        return amountInBase * rates.rates[toCurrency];
      }

      // Conversion not possible with cached rates
      return num;
    } catch {
      return parseFloat(amount);
    }
  }, [userCurrency, ratesLoaded]);

  /**
   * Get the exchange rate between two currencies
   * NOTE: ratesLoaded is in dependency array to trigger re-render when rates become available
   * @param {string} fromCurrency - Source currency
   * @param {string} toCurrency - Target currency (default: user's preference)
   * @returns {number|null} Exchange rate or null if not available
   */
  const getRate = useCallback((fromCurrency = 'USD', toCurrency = userCurrency) => {
    if (fromCurrency === toCurrency) return 1;

    const rates = getRatesObject();
    if (!rates || !rates.rates) return null;

    // Case 1: Direct rate if base matches source currency
    if (rates.base === fromCurrency && rates.rates[toCurrency] !== undefined) {
      return rates.rates[toCurrency];
    }

    // Case 2: Converting TO the base currency (inverse of rate)
    if (rates.base === toCurrency && rates.rates[fromCurrency] !== undefined) {
      return 1 / rates.rates[fromCurrency];
    }

    // Case 3: Cross-rate via base
    if (rates.rates[fromCurrency] !== undefined && rates.rates[toCurrency] !== undefined) {
      return rates.rates[toCurrency] / rates.rates[fromCurrency];
    }

    return null;
  }, [userCurrency, ratesLoaded]);

  /**
   * Format a converted amount with currency symbol
   * @param {number} amount - Amount to convert and format
   * @param {string} fromCurrency - Source currency
   * @param {Object} formatOptions - Intl.NumberFormat options
   * @returns {string} Formatted string with currency symbol
   */
  const formatConverted = useCallback((amount, fromCurrency = 'USD', formatOptions = {}) => {
    const converted = convertSync(amount, fromCurrency, userCurrency);

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: userCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...formatOptions
      }).format(converted);
    } catch {
      // Fallback formatting
      return `${userCurrency} ${converted.toFixed(2)}`;
    }
  }, [convertSync, userCurrency]);

  /**
   * Convert an array of costs to user's currency
   * @param {Array} costs - Array of cost objects with { cost, currency } fields
   * @returns {Array} Costs with converted amounts
   */
  const convertCosts = useCallback((costs) => {
    if (!Array.isArray(costs)) return [];

    return costs.map(cost => ({
      ...cost,
      originalCost: cost.cost,
      originalCurrency: cost.currency || 'USD',
      cost: convertSync(cost.cost, cost.currency || 'USD', userCurrency),
      currency: userCurrency
    }));
  }, [convertSync, userCurrency]);

  /**
   * Calculate total from an array of costs, converting to user's currency
   * @param {Array} costs - Array of cost objects
   * @returns {number} Total in user's currency
   */
  const calculateTotal = useCallback((costs) => {
    if (!Array.isArray(costs)) return 0;

    return costs.reduce((sum, cost) => {
      const converted = convertSync(cost.cost || 0, cost.currency || 'USD', userCurrency);
      return sum + converted;
    }, 0);
  }, [convertSync, userCurrency]);

  return {
    // State
    loading,
    error,
    ratesLoaded,
    userCurrency,

    // Conversion functions
    convert: convertAsync,
    convertSync,
    convertCosts,
    calculateTotal,

    // Utility functions
    getRate,
    formatConverted,

    // Refresh rates
    refreshRates: useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchRates(userCurrency);
        setRatesLoaded(true);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }, [userCurrency])
  };
}

export default useCurrencyConversion;
