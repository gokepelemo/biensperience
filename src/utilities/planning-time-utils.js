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
