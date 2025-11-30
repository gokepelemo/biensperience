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

import { getCurrencySymbol } from './currency-utils';

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

  const symbol = getCurrencySymbol(currency);
  const prefix = showApprox ? '~' : '';

  // Exact mode - no rounding, show precise amount
  if (exact) {
    const formatted = numCost.toLocaleString('en-US', {
      minimumFractionDigits: numCost % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${symbol}${formatted}`;
  }

  // Round to friendly amount
  const rounded = roundCostFriendly(numCost, 'up');

  // Compact notation for large numbers
  if (compact && rounded >= 1000) {
    if (rounded >= 1000000) {
      const millions = rounded / 1000000;
      // Show one decimal if not a whole number
      const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1);
      return `${prefix}${symbol}${formatted}M`;
    }
    if (rounded >= 1000) {
      const thousands = rounded / 1000;
      // Show one decimal if not a whole number (e.g., 1.4K for $1,400)
      const formatted = thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1);
      return `${prefix}${symbol}${formatted}K`;
    }
  }

  // Standard formatting with thousands separators
  const formatted = rounded.toLocaleString('en-US');
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Get the cost estimate tooltip text showing the exact amount.
 *
 * @param {number} exactCost - The exact cost value for display in tooltip
 * @param {Object} options - Formatting options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @param {boolean} options.isActual - Whether this is an actual cost vs estimate (default: false)
 * @returns {string} Tooltip text with exact amount
 */
export function getCostEstimateTooltip(exactCost, options = {}) {
  const { currency = 'USD', isActual = false } = options;
  const symbol = getCurrencySymbol(currency);

  if (!exactCost || exactCost <= 0) {
    return isActual ? 'Actual cost for this item' : 'Actual estimated cost for this experience';
  }

  const formatted = exactCost.toLocaleString('en-US', {
    minimumFractionDigits: exactCost % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });

  return isActual ? `Actual cost: ${symbol}${formatted}` : `Actual estimated cost: ${symbol}${formatted}`;
}

/**
 * Get the cost estimate label.
 *
 * @returns {string} Label for cost estimate field
 */
export function getCostEstimateLabel() {
  return 'Est. Cost';
}

/**
 * Format cost estimate with a label prefix.
 *
 * @param {number|null|undefined} cost - Cost value
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeLabel - Include label prefix
 * @param {string} options.currency - Currency code
 * @returns {string|null} Formatted string with optional label, or null if invalid
 *
 * @example
 * formatCostEstimateWithLabel(1500, { includeLabel: true })
 * // 'Est. Cost: ~$1.5K'
 */
export function formatCostEstimateWithLabel(cost, options = {}) {
  const { includeLabel = false, ...formatOptions } = options;
  const formatted = formatCostEstimate(cost, formatOptions);

  if (!formatted) {
    return null;
  }

  if (includeLabel) {
    return `${getCostEstimateLabel()}: ${formatted}`;
  }

  return formatted;
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
 * Get enhanced tooltip for individual cost entries showing shared cost or plan item/collaborator details.
 *
 * @param {Object} costEntry - The cost entry object
 * @param {Object} options - Options
 * @param {string} options.currency - Currency code (default: 'USD')
 * @param {Array} options.planItems - Array of plan items for lookup
 * @param {Array} options.collaborators - Array of collaborators for lookup
 * @returns {string} Enhanced tooltip text
 */
export function getIndividualCostTooltip(costEntry, options = {}) {
  const { currency = 'USD', planItems = [], collaborators = [] } = options;
  const symbol = getCurrencySymbol(currency);

  if (!costEntry || !costEntry.cost || costEntry.cost <= 0) {
    return 'Cost entry details';
  }

  const formatted = costEntry.cost.toLocaleString('en-US', {
    minimumFractionDigits: costEntry.cost % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2
  });

  // Priority: Show collaborator info first if available
  if (costEntry.collaborator) {
    const collaborator = collaborators.find(c =>
      c._id === costEntry.collaborator
    );
    if (collaborator && collaborator.name) {
      return `Paid for ${collaborator.name}: ${symbol}${formatted}`;
    }
    // If collaborator not found in provided array, show generic message
    return `Paid for collaborator: ${symbol}${formatted}`;
  }

  // If cost is linked to a plan item, show "Plan item: [Item Text]"
  if (costEntry.plan_item) {
    const planItem = planItems.find(item =>
      (item._id || item.plan_item_id) === costEntry.plan_item
    );
    if (planItem && planItem.text) {
      return `Plan item: ${planItem.text} - ${symbol}${formatted}`;
    }
    // If plan item not found, show generic message
    return `Plan item: ${symbol}${formatted}`;
  }

  // If no specific linkage, it's a shared cost
  return `Shared cost: ${symbol}${formatted}`;
}

/**
 * Get enhanced tooltip for total cost showing breakdown.
 *
 * @param {number} totalCost - Total cost amount
 * @param {Array} costEntries - Array of individual cost entries
 * @param {Object} options - Options
 * @param {string} options.currency - Currency code (default: 'USD')
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

  let tooltip = `Total cost: ${symbol}${formatted}`;

  // Calculate shared vs assigned costs
  const sharedCosts = costEntries.filter(c => !c.plan_item && !c.collaborator);
  const assignedCosts = costEntries.filter(c => c.plan_item || c.collaborator);

  const sharedTotal = sharedCosts.reduce((sum, c) => sum + (c.cost || 0), 0);
  const assignedTotal = assignedCosts.reduce((sum, c) => sum + (c.cost || 0), 0);

  if (sharedTotal > 0) {
    const sharedFormatted = sharedTotal.toLocaleString('en-US', {
      minimumFractionDigits: sharedTotal % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
    tooltip += `\nShared cost: ${symbol}${sharedFormatted}`;
  }

  if (assignedTotal > 0) {
    const assignedFormatted = assignedTotal.toLocaleString('en-US', {
      minimumFractionDigits: assignedTotal % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
    tooltip += `\nAssigned cost: ${symbol}${assignedFormatted}`;
  }

  return tooltip;
}

export default {
  formatCostEstimate,
  formatCostEstimateWithLabel,
  formatActualCost,
  getCostEstimateTooltip,
  getCostEstimateLabel,
  getIndividualCostTooltip,
  getTotalCostTooltip,
  roundCostFriendly,
  getCostLevel,
  getDollarSigns
};
