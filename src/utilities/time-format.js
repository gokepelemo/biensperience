/**
 * Time formatting utilities for user-friendly time displays
 */

// Re-export the comprehensive formatPlanningTime from planning-time-utils
// This maintains backward compatibility for existing imports
export { formatPlanningTime, getPlanningTimeTooltip, getPlanningTimeLabel } from './planning-time-utils';

/**
 * Format age in milliseconds to friendly relative time string
 * @param {number} ageMs - Age in milliseconds
 * @returns {string} Friendly time string
 */
export function formatRelativeTime(ageMs) {
  if (!ageMs || ageMs < 0) {
    return 'moments ago';
  }

  const minutes = Math.floor(ageMs / 60000);
  const hours = Math.floor(ageMs / 3600000);
  const days = Math.floor(ageMs / 86400000);

  // Less than 5 minutes
  if (minutes < 5) {
    return 'moments ago';
  }

  // Less than 1 hour
  if (hours < 1) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than 1 day
  if (days < 1) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  // 1 day or more
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/**
 * Format age for specific context (creating vs updating)
 * @param {number} ageMs - Age in milliseconds
 * @param {string} context - 'create' or 'update'
 * @returns {string} Friendly message
 */
export function formatRestorationMessage(ageMs, context = 'create') {
  const timeString = formatRelativeTime(ageMs);
  const action = context === 'update' ? 'updating' : 'creating';

  return `Your progress was restored from ${timeString}. You can continue ${action}.`;
}

// Note: formatPlanningTime is now imported from planning-time-utils.js
// which provides comprehensive formatting including:
// - Fractional days (a few hours, half a day, most of a day)
// - Day ranges (1-2 days, 2-3 weeks)
// - Weeks, months, years with proper singular/plural
// - Tooltip text explaining planning time
