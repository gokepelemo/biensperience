/**
 * Time formatting utilities for user-friendly time displays
 */

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

/**
 * Format planning time duration in days to human-friendly relative time
 * @param {number} days - Duration in days
 * @returns {string} Friendly duration string (e.g., "1 month", "2 years")
 */
export function formatPlanningTime(days) {
  if (!days || days < 0) {
    return '0 days';
  }

  // Less than 30 days - show days
  if (days < 30) {
    return `${Math.round(days)} ${days === 1 ? 'day' : 'days'}`;
  }

  // 30-364 days - show months
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? 'month' : 'months'}`;
  }

  // 365+ days - show years and months
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  const months = Math.round(remainingDays / 30);

  if (months === 0) {
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }

  return `${years} ${years === 1 ? 'year' : 'years'}, ${months} ${months === 1 ? 'month' : 'months'}`;
}
