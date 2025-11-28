/**
 * Planning Time Utilities
 *
 * Utilities for formatting planning time (stored in days) into human-readable strings.
 * Planning time represents the recommended time to plan and prepare for an experience
 * before the trip, NOT including travel time to the destination.
 *
 * @module planning-time-utils
 */

/**
 * Time unit thresholds in days
 * @constant
 */
const TIME_UNITS = {
  HOUR_FRACTION: 0.25,    // 6 hours
  HALF_DAY: 0.5,          // 12 hours
  MOST_DAY: 0.75,         // 18 hours
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365
};

/**
 * Format a number of days into a human-readable planning time string.
 *
 * @param {number|null|undefined} days - Number of days (can be fractional)
 * @returns {string|null} Formatted string or null if invalid/empty
 *
 * @example
 * formatPlanningTime(0.25)  // 'a few hours'
 * formatPlanningTime(0.5)   // 'about half a day'
 * formatPlanningTime(1)     // '1 day'
 * formatPlanningTime(7)     // '1 week'
 * formatPlanningTime(30)    // '1 month'
 * formatPlanningTime(365)   // '1 year'
 * formatPlanningTime(null)  // null
 */
export function formatPlanningTime(days) {
  // Handle invalid inputs
  if (days === null || days === undefined || days === '') {
    return null;
  }

  // Convert to number if string
  const numDays = typeof days === 'string' ? parseFloat(days) : days;

  // Validate numeric input
  if (typeof numDays !== 'number' || isNaN(numDays) || numDays < 0) {
    return null;
  }

  // Zero means no planning time specified
  if (numDays === 0) {
    return null;
  }

  // Less than a day (fractional days)
  if (numDays < 1) {
    if (numDays <= TIME_UNITS.HOUR_FRACTION) {
      return 'a few hours';
    }
    if (numDays <= TIME_UNITS.HALF_DAY) {
      return 'about half a day';
    }
    return 'most of a day';
  }

  // 1-6 days
  if (numDays < TIME_UNITS.WEEK) {
    if (numDays === 1) {
      return '1 day';
    }
    if (numDays < 2) {
      return '1-2 days';
    }
    const roundedDays = Math.round(numDays);
    return `${roundedDays} days`;
  }

  // 1-4 weeks (7-27 days)
  if (numDays < TIME_UNITS.MONTH - 3) {
    const weeks = numDays / TIME_UNITS.WEEK;

    if (numDays <= 8) {
      return '1 week';
    }
    if (numDays <= 11) {
      return 'about 1-2 weeks';
    }
    if (numDays <= 15) {
      return '2 weeks';
    }
    if (numDays <= 18) {
      return 'about 2-3 weeks';
    }
    if (numDays <= 22) {
      return '3 weeks';
    }
    return 'about 3-4 weeks';
  }

  // 1-11 months (28-334 days)
  if (numDays < TIME_UNITS.YEAR - 30) {
    const months = numDays / TIME_UNITS.MONTH;

    if (numDays <= 35) {
      return '1 month';
    }
    if (numDays <= 50) {
      return '1-2 months';
    }
    if (numDays <= 75) {
      return '2 months';
    }
    if (numDays <= 105) {
      return '3 months';
    }
    if (numDays <= 135) {
      return '4 months';
    }
    if (numDays <= 165) {
      return '5 months';
    }
    if (numDays <= 195) {
      return '6 months';
    }
    if (numDays <= 225) {
      return '7 months';
    }
    if (numDays <= 255) {
      return '8 months';
    }
    if (numDays <= 285) {
      return '9 months';
    }
    if (numDays <= 315) {
      return '10 months';
    }
    return '11 months';
  }

  // Years (335+ days)
  const years = numDays / TIME_UNITS.YEAR;

  if (numDays <= 400) {
    return '1 year';
  }
  if (numDays <= 548) {
    return '1-2 years';
  }
  if (numDays <= 730) {
    return '2 years';
  }
  if (numDays <= 912) {
    return '2-3 years';
  }
  if (numDays <= 1095) {
    return '3 years';
  }

  // Beyond 3 years, just show the approximate number
  const roundedYears = Math.round(years);
  return `${roundedYears} years`;
}

/**
 * Get the planning time tooltip text.
 *
 * @returns {string} Tooltip text explaining planning time
 */
export function getPlanningTimeTooltip() {
  return 'Recommended time to plan and prepare for this experience before your trip. Does not include travel time to the destination.';
}

/**
 * Get the planning time label.
 *
 * @returns {string} Label for planning time field
 */
export function getPlanningTimeLabel() {
  return 'Planning Time';
}

/**
 * Format planning time with a label prefix.
 *
 * @param {number|null|undefined} days - Number of days
 * @param {Object} options - Formatting options
 * @param {boolean} options.includeLabel - Include "Planning Time:" prefix
 * @returns {string|null} Formatted string with optional label, or null if invalid
 *
 * @example
 * formatPlanningTimeWithLabel(7, { includeLabel: true })
 * // 'Planning Time: 1 week'
 */
export function formatPlanningTimeWithLabel(days, options = {}) {
  const { includeLabel = false } = options;
  const formatted = formatPlanningTime(days);

  if (!formatted) {
    return null;
  }

  if (includeLabel) {
    return `${getPlanningTimeLabel()}: ${formatted}`;
  }

  return formatted;
}

/**
 * Convert various time inputs to days for storage.
 * Useful for form inputs that might accept different units.
 *
 * @param {number} value - The numeric value
 * @param {'hours'|'days'|'weeks'|'months'|'years'} unit - The unit of the value
 * @returns {number} Value converted to days
 *
 * @example
 * convertToDays(12, 'hours')  // 0.5
 * convertToDays(2, 'weeks')   // 14
 * convertToDays(3, 'months')  // 90
 */
export function convertToDays(value, unit) {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }

  switch (unit) {
    case 'hours':
      return value / 24;
    case 'days':
      return value;
    case 'weeks':
      return value * TIME_UNITS.WEEK;
    case 'months':
      return value * TIME_UNITS.MONTH;
    case 'years':
      return value * TIME_UNITS.YEAR;
    default:
      return value; // Assume days if unknown unit
  }
}

/**
 * Parse a formatted planning time string back to approximate days.
 * Useful for search/filtering by planning time.
 *
 * @param {string} formatted - Formatted planning time string
 * @returns {number|null} Approximate number of days, or null if unparseable
 *
 * @example
 * parsePlanningTime('1 week')     // 7
 * parsePlanningTime('2 months')   // 60
 * parsePlanningTime('1-2 weeks')  // 10.5 (midpoint)
 */
export function parsePlanningTime(formatted) {
  if (!formatted || typeof formatted !== 'string') {
    return null;
  }

  const lower = formatted.toLowerCase().trim();

  // Handle special cases
  if (lower === 'a few hours') return 0.25;
  if (lower === 'about half a day') return 0.5;
  if (lower === 'most of a day') return 0.75;

  // Handle ranges (return midpoint)
  const rangeMatch = lower.match(/(\d+)-(\d+)\s+(day|week|month|year)s?/);
  if (rangeMatch) {
    const [, min, max, unit] = rangeMatch;
    const midpoint = (parseInt(min) + parseInt(max)) / 2;
    return convertToDays(midpoint, `${unit}s`);
  }

  // Handle "about X-Y" format
  const aboutRangeMatch = lower.match(/about\s+(\d+)-(\d+)\s+(day|week|month|year)s?/);
  if (aboutRangeMatch) {
    const [, min, max, unit] = aboutRangeMatch;
    const midpoint = (parseInt(min) + parseInt(max)) / 2;
    return convertToDays(midpoint, `${unit}s`);
  }

  // Handle single values
  const singleMatch = lower.match(/(\d+)\s+(day|week|month|year)s?/);
  if (singleMatch) {
    const [, value, unit] = singleMatch;
    return convertToDays(parseInt(value), `${unit}s`);
  }

  return null;
}

export default {
  formatPlanningTime,
  formatPlanningTimeWithLabel,
  getPlanningTimeTooltip,
  getPlanningTimeLabel,
  convertToDays,
  parsePlanningTime
};
