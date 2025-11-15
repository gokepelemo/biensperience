/**
 * Date utility functions for consistent date formatting across the application
 */

/**
 * Formats a date string or Date object to a localized date string
 * @param {string|Date} date - The date to format
 * @param {string} locale - The locale to use (default: 'en-US')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, locale = 'en-US', options = {}) {
  if (!date) return '';

  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };

  try {
    const dateObj = toLocalDate(date);
    if (!dateObj) return '';
    return dateObj.toLocaleDateString(locale, defaultOptions);
  } catch (error) {
    return '';
  }
}

/**
 * Formats a date with time for display (e.g., "Jan 15, 2024 at 3:45 PM")
 * @param {string|Date} date - The date to format
 * @param {string} locale - The locale for formatting (default: 'en-US')
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date, locale = 'en-US') {
  if (!date) return '';

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };

  try {
    const dateObj = toLocalDate(date) || (date instanceof Date ? date : new Date(date));
    return dateObj.toLocaleString(locale, options);
  } catch (error) {
    return '';
  }
}

/**
 * Formats a date to ISO format (YYYY-MM-DD) for date inputs
 * @param {string|Date} date - The date to format
 * @returns {string} ISO formatted date string (YYYY-MM-DD)
 */
export function formatDateForInput(date) {
  if (!date) return '';

  try {
    // Normalize to a date-only (YYYY-MM-DD) using local date components
    const dateObj = toLocalDate(date);
    if (!dateObj) return '';
    const y = dateObj.getFullYear();
    const m = `${dateObj.getMonth() + 1}`.padStart(2, '0');
    const d = `${dateObj.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch (error) {
    return '';
  }
}

/**
 * Calculates the minimum date allowed based on planning days required
 * @param {number} planningDays - Number of days required for planning
 * @returns {string} ISO formatted date string (YYYY-MM-DD)
 */
export function getMinimumPlanningDate(planningDays) {
  const min = new Date();
  min.setDate(min.getDate() + (planningDays || 0));
  // Use local date-only string
  return formatDateForInput(min);
}

/**
 * Checks if a date meets the minimum planning requirements
 * @param {string|Date} plannedDate - The planned date
 * @param {number} planningDays - Number of days required for planning
 * @returns {boolean} True if the date is valid
 */
export function isValidPlannedDate(plannedDate, planningDays) {
  if (!plannedDate) return false;

  try {
    // Compare using local date-only values to avoid timezone shifts
    const planned = toLocalDate(plannedDate);
    if (!planned) return false;
    const minimum = new Date();
    minimum.setDate(minimum.getDate() + (planningDays || 0));
    // zero time components for comparison
    planned.setHours(0,0,0,0);
    minimum.setHours(0,0,0,0);
    return planned >= minimum;
  } catch (error) {
    return false;
  }
}

/**
 * Formats a date to a short format (e.g., "1/15/2024")
 * @param {string|Date} date - The date to format
 * @returns {string} Short formatted date string
 */
export function formatDateShort(date) {
  return formatDate(date, 'en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
}

/**
 * Formats a date to metric card format (e.g., "Mon, Jan 15 2025")
 * @param {string|Date} date - The date to format
 * @returns {string} Metric card formatted date string
 */
export function formatDateMetricCard(date) {
  if (!date) return '';

  try {
    const dateObj = toLocalDate(date);
    if (!dateObj) return '';
    const options = {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    };
    
    const formattedDate = dateObj.toLocaleDateString('en-US', options);
    const year = dateObj.getFullYear().toString();
    
    return `${formattedDate} ${year}`;
  } catch (error) {
    return '';
  }
}

/**
 * Parse a date input (Date or string) and return a Date object representing
 * the same calendar date in the local timezone (midnight local time).
 * This avoids timezone shifts that move the displayed date one day earlier
 * when the backend stores dates as UTC midnight.
 *
 * Accepts values like:
 * - Date objects
 * - 'YYYY-MM-DD' strings
 * - ISO strings like 'YYYY-MM-DDTHH:mm:ss.sssZ' (we will use the date part only)
 */
function toLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  const s = String(input);
  // Extract date part before 'T' if present
  const datePart = s.split('T')[0];
  const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mo - 1, d);
  }
  // fallback: try Date parse and use local components
  try {
    const parsed = new Date(s);
    if (isNaN(parsed.getTime())) return null;
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  } catch (err) {
    return null;
  }
}
