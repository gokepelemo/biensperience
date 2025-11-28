/**
 * Time Utilities
 *
 * Handles all time operations across the application:
 * - Normalizing time to UTC for database storage
 * - Converting epoch timestamps
 * - Displaying time in user's preferred timezone
 * - Fallback to system timezone when preference not set
 *
 * @module time-utils
 */

import { getTimezone, detectUserTimezone } from './preferences-utils';

/**
 * Get the effective timezone for display
 * Priority: user preference > system default
 *
 * @param {Object} profile - User profile object (optional)
 * @returns {string} IANA timezone identifier
 */
export function getEffectiveTimezone(profile = null) {
  const prefTimezone = getTimezone(profile);

  // If timezone is 'system-default' or not set, use browser's timezone
  if (!prefTimezone || prefTimezone === 'system-default' || prefTimezone === 'UTC') {
    return detectUserTimezone();
  }

  return prefTimezone;
}

/**
 * Normalize a date/time to UTC for database storage
 * All times should be stored in UTC in the database
 *
 * @param {Date|string|number} date - Date to normalize
 * @returns {string} ISO 8601 UTC string (e.g., '2025-11-28T15:30:00.000Z')
 */
export function toUTC(date) {
  if (!date) return null;

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

/**
 * Convert date to Unix epoch timestamp (seconds since 1970-01-01)
 *
 * @param {Date|string|number} date - Date to convert
 * @returns {number} Unix epoch timestamp in seconds
 */
export function toEpoch(date) {
  if (!date) return null;

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return null;
  }

  return Math.floor(d.getTime() / 1000);
}

/**
 * Convert date to Unix epoch timestamp in milliseconds
 *
 * @param {Date|string|number} date - Date to convert
 * @returns {number} Unix epoch timestamp in milliseconds
 */
export function toEpochMs(date) {
  if (!date) return null;

  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return null;
  }

  return d.getTime();
}

/**
 * Convert epoch timestamp to Date object
 *
 * @param {number} epoch - Unix epoch timestamp (seconds or milliseconds)
 * @returns {Date} Date object
 */
export function fromEpoch(epoch) {
  if (!epoch && epoch !== 0) return null;

  // Detect if epoch is in seconds or milliseconds
  // Timestamps before year 2001 in ms are > 10^12
  const isMilliseconds = epoch > 1e11;
  const ms = isMilliseconds ? epoch : epoch * 1000;

  return new Date(ms);
}

/**
 * Display a UTC date in the user's timezone
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} options - Intl.DateTimeFormat options
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted date string in user's timezone
 */
export function displayInTimezone(utcDate, options = {}, profile = null) {
  if (!utcDate) return '';

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return '';
  }

  const timezone = getEffectiveTimezone(profile);

  const defaultOptions = {
    timeZone: timezone,
    ...options
  };

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(d);
  }
}

/**
 * Display time in user's timezone (e.g., "3:30 PM")
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted time string
 */
export function displayTime(utcDate, profile = null) {
  return displayInTimezone(utcDate, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }, profile);
}

/**
 * Display date in user's timezone (e.g., "Nov 28, 2025")
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted date string
 */
export function displayDate(utcDate, profile = null) {
  return displayInTimezone(utcDate, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }, profile);
}

/**
 * Display date with day of week (e.g., "Thu, Nov 28, 2025")
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted date string with weekday
 */
export function displayDateWithDay(utcDate, profile = null) {
  return displayInTimezone(utcDate, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }, profile);
}

/**
 * Display full datetime in user's timezone (e.g., "Nov 28, 2025, 3:30 PM")
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted datetime string
 */
export function displayDateTime(utcDate, profile = null) {
  return displayInTimezone(utcDate, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }, profile);
}

/**
 * Display full datetime with day of week (e.g., "Thu, Nov 28, 2025, 3:30 PM")
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted datetime string with weekday
 */
export function displayDateTimeWithDay(utcDate, profile = null) {
  return displayInTimezone(utcDate, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }, profile);
}

/**
 * Display relative time (e.g., "2 hours ago", "in 3 days")
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @returns {string} Relative time string
 */
export function displayRelativeTime(utcDate) {
  if (!utcDate) return '';

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return '';
  }

  const now = Date.now();
  const diff = now - d.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  // Less than 1 minute
  if (absDiff < 60 * 1000) {
    return isPast ? 'just now' : 'in a moment';
  }

  // Less than 1 hour
  if (absDiff < 60 * 60 * 1000) {
    const minutes = Math.floor(absDiff / (60 * 1000));
    return isPast
      ? `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
      : `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  // Less than 24 hours
  if (absDiff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(absDiff / (60 * 60 * 1000));
    return isPast
      ? `${hours} hour${hours !== 1 ? 's' : ''} ago`
      : `in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  // Less than 7 days
  if (absDiff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(absDiff / (24 * 60 * 60 * 1000));
    return isPast
      ? `${days} day${days !== 1 ? 's' : ''} ago`
      : `in ${days} day${days !== 1 ? 's' : ''}`;
  }

  // Less than 30 days
  if (absDiff < 30 * 24 * 60 * 60 * 1000) {
    const weeks = Math.floor(absDiff / (7 * 24 * 60 * 60 * 1000));
    return isPast
      ? `${weeks} week${weeks !== 1 ? 's' : ''} ago`
      : `in ${weeks} week${weeks !== 1 ? 's' : ''}`;
  }

  // Less than 365 days
  if (absDiff < 365 * 24 * 60 * 60 * 1000) {
    const months = Math.floor(absDiff / (30 * 24 * 60 * 60 * 1000));
    return isPast
      ? `${months} month${months !== 1 ? 's' : ''} ago`
      : `in ${months} month${months !== 1 ? 's' : ''}`;
  }

  // Over a year
  const years = Math.floor(absDiff / (365 * 24 * 60 * 60 * 1000));
  return isPast
    ? `${years} year${years !== 1 ? 's' : ''} ago`
    : `in ${years} year${years !== 1 ? 's' : ''}`;
}

/**
 * Get current time in UTC as ISO string
 *
 * @returns {string} Current UTC time as ISO string
 */
export function nowUTC() {
  return new Date().toISOString();
}

/**
 * Get current time as epoch timestamp (seconds)
 *
 * @returns {number} Current Unix epoch timestamp in seconds
 */
export function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current time as epoch timestamp (milliseconds)
 *
 * @returns {number} Current Unix epoch timestamp in milliseconds
 */
export function nowEpochMs() {
  return Date.now();
}

/**
 * Check if a date is today in the user's timezone
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {boolean} True if the date is today
 */
export function isToday(utcDate, profile = null) {
  if (!utcDate) return false;

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return false;
  }

  const timezone = getEffectiveTimezone(profile);
  const now = new Date();

  const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone });
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: timezone });

  return dateStr === todayStr;
}

/**
 * Check if a date is in the past in the user's timezone
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {boolean} True if the date is in the past
 */
export function isPast(utcDate, profile = null) {
  if (!utcDate) return false;

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return false;
  }

  return d.getTime() < Date.now();
}

/**
 * Check if a date is in the future in the user's timezone
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {boolean} True if the date is in the future
 */
export function isFuture(utcDate, profile = null) {
  if (!utcDate) return false;

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return false;
  }

  return d.getTime() > Date.now();
}

/**
 * Get the start of day in user's timezone, returned as UTC
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Start of day as UTC ISO string
 */
export function startOfDayUTC(utcDate, profile = null) {
  if (!utcDate) return null;

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return null;
  }

  const timezone = getEffectiveTimezone(profile);

  // Get the date string in the user's timezone
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone }); // 'YYYY-MM-DD'

  // Create a new date at midnight in the user's timezone
  // This is a simplified approach - for full accuracy, use a library like date-fns-tz
  const startOfDay = new Date(`${dateStr}T00:00:00`);

  return startOfDay.toISOString();
}

/**
 * Get the end of day in user's timezone, returned as UTC
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} End of day as UTC ISO string
 */
export function endOfDayUTC(utcDate, profile = null) {
  if (!utcDate) return null;

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return null;
  }

  const timezone = getEffectiveTimezone(profile);

  // Get the date string in the user's timezone
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone }); // 'YYYY-MM-DD'

  // Create a new date at end of day in the user's timezone
  const endOfDay = new Date(`${dateStr}T23:59:59.999`);

  return endOfDay.toISOString();
}

/**
 * Parse a date string in user's local timezone and convert to UTC
 * Useful for form inputs where user enters local time
 *
 * @param {string} localDateStr - Local date string (e.g., '2025-11-28' or '2025-11-28T15:30')
 * @param {Object} profile - User profile object (optional)
 * @returns {string} UTC ISO string
 */
export function localToUTC(localDateStr, profile = null) {
  if (!localDateStr) return null;

  // If it's already an ISO string with Z suffix, just return it
  if (typeof localDateStr === 'string' && localDateStr.endsWith('Z')) {
    return localDateStr;
  }

  // Create date object - JavaScript will interpret this in local time
  const d = new Date(localDateStr);

  if (isNaN(d.getTime())) {
    return null;
  }

  return d.toISOString();
}

/**
 * Format for date input fields (HTML date input)
 * Returns 'YYYY-MM-DD' format
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Date in YYYY-MM-DD format
 */
export function formatForDateInput(utcDate, profile = null) {
  if (!utcDate) return '';

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return '';
  }

  const timezone = getEffectiveTimezone(profile);

  // Use en-CA locale which uses YYYY-MM-DD format
  return d.toLocaleDateString('en-CA', { timeZone: timezone });
}

/**
 * Format for datetime-local input fields
 * Returns 'YYYY-MM-DDTHH:MM' format
 *
 * @param {Date|string|number} utcDate - UTC date from database
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Date in YYYY-MM-DDTHH:MM format
 */
export function formatForDateTimeInput(utcDate, profile = null) {
  if (!utcDate) return '';

  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);

  if (isNaN(d.getTime())) {
    return '';
  }

  const timezone = getEffectiveTimezone(profile);

  const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone });
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return `${dateStr}T${timeStr}`;
}
