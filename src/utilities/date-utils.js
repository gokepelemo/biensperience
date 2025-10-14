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
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString(locale, defaultOptions);
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
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toISOString().split('T')[0];
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
  const minDate = new Date(Date.now() + planningDays * 24 * 60 * 60 * 1000);
  return formatDateForInput(minDate);
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
    const planned = new Date(plannedDate);
    const minimum = new Date(Date.now() + planningDays * 24 * 60 * 60 * 1000);
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
    const dateObj = date instanceof Date ? date : new Date(date);
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
