/**
 * Cost Estimate Utilities
 *
 * Utilities for formatting cost estimates and actual costs into human-readable strings.
 * Provides smart rounding based on magnitude and friendly display options.
 *
 * Used for:
 * - Experience cost estimates (approximate, label "Estimated" implies approximation)
 * - Plan item costs (actual costs, may show exact or rounded)
 * - Plan total costs (sum of items)
 *
 * @module cost-utils
 */

import { formatCurrency, formatCurrencyDisambiguated, getCurrencySymbol } from './currency-utils';

/**
 * Round cost to a friendly number based on magnitude.
 * MINIMUM rounding is $10 - never rounds to odd dollar amounts.
 *
 * Rounding increments:
 * - Under $100: round to nearest $10
 * - $100-$999: round to nearest $50
 * - $1,000-$9,999: round to nearest $100
 * - $10,000-$99,999: round to nearest $500
 * - $100,000+: round to nearest $1,000
 *
 * @param {number} cost - The cost to round
 * @param {string} direction - 'up', 'down', or 'nearest' (default: 'up')
 * @returns {number} Rounded cost (always a multiple of at least 10)
 */
export function roundCostFriendly(cost, direction = 'up') {
  if (cost === null || cost === undefined || isNaN(cost) || cost <= 0) {
    return 0;
  }

  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;

  let roundTo;
  if (numCost < 100) {
    roundTo = 10;
  } else if (numCost < 1000) {
    roundTo = 50;
  } else if (numCost < 10000) {
    roundTo = 100;
  } else if (numCost < 100000) {
    roundTo = 500;
  } else {
    roundTo = 1000;
  }

  if (direction === 'up') {
    return Math.ceil(numCost / roundTo) * roundTo;
  } else if (direction === 'down') {
    return Math.floor(numCost / roundTo) * roundTo;
  } else {
    return Math.round(numCost / roundTo) * roundTo;
  }
}

/**
 * Format a cost estimate into a human-readable string.
 * Uses smart rounding and magnitude-appropriate formatting.
 *
 * Since the label "Estimated Cost" already implies approximation,
 * the "~" prefix is disabled by default (showApprox: false).
 *
 * - Rounds to friendly increments (see roundCostFriendly)
 * - Uses compact notation for large numbers (1K, 1.5M)
 *
 * @param {number|null|undefined} cost - Cost value
 * @param {Object} options - Formatting options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @param {boolean} options.showApprox - Show "~" prefix for approximations (default: false)
 * @param {boolean} options.compact - Use compact notation for large numbers (default: true)
 * @param {boolean} options.exact - Show exact amount without rounding (default: false)
 * @returns {string|null} Formatted string or null if invalid/empty
 *
 * @example
 * // Estimates (default - no "~" prefix since "Estimated" label implies approximation)
 * formatCostEstimate(75)        // '$80'
 * formatCostEstimate(150)       // '$150'
 * formatCostEstimate(1350)      // '$1.4K'
 * formatCostEstimate(15000)     // '$15K'
 *
 * // Exact costs
 * formatCostEstimate(1350, { exact: true })  // '$1,350'
 */
export function formatCostEstimate(cost, options = {}) {
  const {
    currency = 'USD',
    showApprox = false,
    compact = true,
    exact = false
  } = options;

  // Handle invalid inputs
  if (cost === null || cost === undefined || cost === '') {
    return null;
  }

  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;

  if (typeof numCost !== 'number' || isNaN(numCost) || numCost < 0) {
    return null;
  }

  if (numCost === 0) {
    return null;
  }

  const prefix = showApprox ? '~' : '';

  // Exact mode - no rounding, use formatCurrency for proper locale handling
  if (exact) {
    // formatCurrency handles symbol position, locale separators, and decimal places
    // showCode=false to not show currency code prefix (e.g., "USD")
    const formatted = formatCurrency(numCost, currency, true, false);
    return prefix ? `${prefix}${formatted}` : formatted;
  }

  // Round to friendly amount
  const rounded = roundCostFriendly(numCost, 'up');
  const symbol = getCurrencySymbol(currency);

  // Compact notation for large numbers (K, M suffixes)
  // Note: We use symbol directly here since K/M notation is non-standard
  // and formatCurrency doesn't support compact notation
  if (compact && rounded >= 1000) {
    if (rounded >= 1000000) {
      const millions = rounded / 1000000;
      const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1);
      return `${prefix}${symbol}${formatted}M`;
    }
    if (rounded >= 1000) {
      const thousands = rounded / 1000;
      const formatted = thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1);
      return `${prefix}${symbol}${formatted}K`;
    }
  }

  // Standard formatting - use formatCurrency for proper locale handling
  const formatted = formatCurrency(rounded, currency, true, false);
  return prefix ? `${prefix}${formatted}` : formatted;
}

/**
 * Get the cost estimate tooltip text showing the exact amount.
 * Cost estimates are forecasts from the experience creator/curator.
 * All cost estimates are per person.
 *
 * @param {number} exactCost - The exact cost value for display in tooltip
 * @param {Object} options - Formatting options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @param {boolean} options.isActual - Whether this is actual tracked cost (default: false)
 * @returns {string} Tooltip text with exact amount and explanation
 */
export function getCostEstimateTooltip(exactCost, options = {}) {
  const { currency = 'USD', isActual = false } = options;

  // If this is an actual/tracked cost, use the tracked cost tooltip instead
  if (isActual) {
    return getTrackedCostTooltip(exactCost, 0, { currency });
  }

  const symbol = getCurrencySymbol(currency);

  if (!exactCost || exactCost <= 0) {
    return 'Estimated cost per person. Forecasted budget from the experience creator. Your costs may vary.';
  }

  const formatted = exactCost.toLocaleString('en-US', {
    minimumFractionDigits: exactCost % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });

  return `Estimated: ${symbol}${formatted} per person — Forecasted budget from the experience creator.`;
}

/**
 * Get the tracked cost tooltip text showing expenses you've tracked.
 * Tracked costs are real expenses incurred by the user.
 *
 * @param {number} totalCost - The total tracked cost value
 * @param {number} costCount - Number of cost entries tracked
 * @param {Object} options - Formatting options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @returns {string} Tooltip text with total and explanation
 */
export function getTrackedCostTooltip(totalCost, costCount = 0, options = {}) {
  const { currency = 'USD' } = options;
  const symbol = getCurrencySymbol(currency);

  if (!totalCost || totalCost <= 0) {
    return 'Track your expenses here. Add receipts, bookings, and payments as you incur them.';
  }

  const formatted = totalCost.toLocaleString('en-US', {
    minimumFractionDigits: totalCost % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });

  const entryText = costCount === 1 ? '1 expense' : `${costCount} expenses`;
  return `Total: ${symbol}${formatted} (${entryText})`;
}

/**
 * Get the cost estimate label.
 * Cost estimates are per person.
 *
 * @returns {string} Label for cost estimate field
 */
export function getCostEstimateLabel() {
  return 'Est. Cost/Person';
}

/**
 * Format an actual cost (not an estimate).
 * Convenience function that sets appropriate defaults for actual costs.
 *
 * @param {number} cost - The actual cost value
 * @param {Object} options - Formatting options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @param {boolean} options.compact - Use compact notation (default: true)
 * @param {boolean} options.exact - Show exact amount (default: false for large amounts)
 * @returns {string|null} Formatted string or null if invalid
 *
 * @example
 * formatActualCost(1350)                          // '$1.4K'
 * formatActualCost(1350, { exact: true })         // '$1,350'
 * formatActualCost(85)                            // '$90'
 * formatActualCost(85, { exact: true })           // '$85'
 */
export function formatActualCost(cost, options = {}) {
  return formatCostEstimate(cost, {
    showApprox: false,
    ...options
  });
}

/**
 * Format a tracked cost with disambiguated currency symbol.
 * Use this for displaying individual tracked costs to avoid confusion
 * between currencies that share symbols (e.g., USD, AUD, CAD all use $).
 *
 * @param {number} cost - The cost value
 * @param {Object} options - Formatting options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @returns {string|null} Formatted string with disambiguated symbol or null if invalid
 *
 * @example
 * formatTrackedCost(100, { currency: 'USD' })   // 'US$100'
 * formatTrackedCost(100, { currency: 'AUD' })   // 'A$100'
 * formatTrackedCost(100, { currency: 'EUR' })   // '100€'
 * formatTrackedCost(100, { currency: 'GBP' })   // '£100'
 * formatTrackedCost(100, { currency: 'JPY' })   // 'JP¥100'
 * formatTrackedCost(100, { currency: 'CAD' })   // 'C$100'
 * formatTrackedCost(100, { currency: 'MXN' })   // 'MX$100'
 */
export function formatTrackedCost(cost, options = {}) {
  const { currency = 'USD' } = options;

  // Handle invalid inputs
  if (cost === null || cost === undefined || cost === '') {
    return null;
  }

  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;

  if (typeof numCost !== 'number' || isNaN(numCost) || numCost < 0) {
    return null;
  }

  if (numCost === 0) {
    return null;
  }

  // Use disambiguated format for clear currency identification
  return formatCurrencyDisambiguated(numCost, currency);
}

/**
 * Get cost level indicator (1-5 dollar signs based on cost magnitude).
 *
 * @param {number} cost - Cost value
 * @param {Object} options - Options
 * @param {number} options.maxLevel - Maximum level (default: 5)
 * @param {number[]} options.thresholds - Cost thresholds for each level
 * @returns {number} Level from 1 to maxLevel
 *
 * @example
 * getCostLevel(50)     // 1 ($)
 * getCostLevel(200)    // 2 ($$)
 * getCostLevel(750)    // 3 ($$$)
 * getCostLevel(2000)   // 4 ($$$$)
 * getCostLevel(5000)   // 5 ($$$$$)
 */
export function getCostLevel(cost, options = {}) {
  const {
    maxLevel = 5,
    thresholds = [100, 500, 1500, 3500] // Default thresholds
  } = options;

  if (!cost || cost <= 0) {
    return 1;
  }

  const numCost = typeof cost === 'string' ? parseFloat(cost) : cost;

  for (let i = 0; i < thresholds.length; i++) {
    if (numCost <= thresholds[i]) {
      return i + 1;
    }
  }

  return maxLevel;
}

/**
 * Generate dollar sign string based on cost level.
 *
 * @param {number} cost - Cost value
 * @param {Object} options - Options
 * @param {number} options.maxSigns - Maximum dollar signs (default: 5)
 * @returns {Object} Object with filled and empty dollar sign counts
 *
 * @example
 * getDollarSigns(750)
 * // { filled: 3, empty: 2, filledStr: '$$$', emptyStr: '$$', total: 5 }
 */
export function getDollarSigns(cost, options = {}) {
  const { maxSigns = 5 } = options;
  const level = getCostLevel(cost);
  const filled = Math.min(level, maxSigns);
  const empty = maxSigns - filled;

  return {
    filled,
    empty,
    filledStr: '$'.repeat(filled),
    emptyStr: '$'.repeat(empty),
    total: maxSigns
  };
}

/**
 * Get enhanced tooltip for total cost showing breakdown.
 * Note: totalCost should already be converted to user's preferred currency
 * Individual cost entries are shown in their original currencies
 *
 * @param {number} totalCost - Total cost amount (already converted to display currency)
 * @param {Array} costEntries - Array of individual cost entries with their original currencies
 * @param {Object} options - Options
 * @param {string} options.currency - Display currency code for the total (default: 'USD')
 * @returns {string} Enhanced total cost tooltip
 */
export function getTotalCostTooltip(totalCost, costEntries = [], options = {}) {
  const { currency = 'USD' } = options;
  const symbol = getCurrencySymbol(currency);

  if (!totalCost || totalCost <= 0) {
    return 'Total cost breakdown';
  }

  const formatted = totalCost.toLocaleString('en-US', {
    minimumFractionDigits: totalCost % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });

  // Show total in user's preferred currency
  let tooltip = `Total (${currency}): ${symbol}${formatted}`;

  // Show individual cost entries in their original currencies
  if (costEntries && costEntries.length > 0) {
    const entryCount = costEntries.length;
    tooltip += `\n${entryCount} expense${entryCount === 1 ? '' : 's'} tracked`;

    // Group by currency for summary
    const byCurrency = costEntries.reduce((acc, c) => {
      const costCurrency = c.currency || 'USD';
      if (!acc[costCurrency]) {
        acc[costCurrency] = 0;
      }
      acc[costCurrency] += c.cost || 0;
      return acc;
    }, {});

    // If there are multiple currencies, show breakdown
    const currencies = Object.keys(byCurrency);
    if (currencies.length > 1) {
      tooltip += '\nBy currency:';
      currencies.forEach(cur => {
        const curSymbol = getCurrencySymbol(cur);
        const curTotal = byCurrency[cur];
        const curFormatted = curTotal.toLocaleString('en-US', {
          minimumFractionDigits: curTotal % 1 !== 0 ? 2 : 0,
          maximumFractionDigits: 2
        });
        tooltip += `\n  ${cur}: ${curSymbol}${curFormatted}`;
      });
    }
  }

  return tooltip;
}

export default {
  formatCostEstimate,
  formatActualCost,
  formatTrackedCost,
  getCostEstimateTooltip,
  getTrackedCostTooltip,
  getCostEstimateLabel,
  getTotalCostTooltip,
  roundCostFriendly,
  getCostLevel,
  getDollarSigns
};
