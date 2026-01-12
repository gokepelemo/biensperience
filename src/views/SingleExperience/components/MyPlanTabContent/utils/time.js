/**
 * Time utilities for MyPlanTabContent timeline view.
 */

/**
 * @typedef {'morning'|'afternoon'|'evening'|null} TimeOfDay
 */

/**
 * Get time of day category based on hour.
 * @param {string|null|undefined} timeString - Expected format "HH:mm" (24-hour).
 * @returns {TimeOfDay}
 */
export function getTimeOfDay(timeString) {
  if (!timeString) return null;
  const match = timeString.match(/^(\d{1,2}):/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Format time for display (12-hour format).
 * @param {string|null|undefined} timeString - Expected format "HH:mm" (24-hour).
 * @returns {string|null}
 */
export function formatTimeForDisplay(timeString) {
  if (!timeString) return null;
  const match = timeString.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeString;
  const hour = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}
