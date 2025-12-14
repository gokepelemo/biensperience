/**
 * Date utility functions for consistent date formatting across the application
 */

import { logger } from './logger';

/**
 * @typedef {Object} TimeOfDay
 * @property {'morning'|'afternoon'|'evening'|'night'} period - Time period of the day
 * @property {string} label - Human-readable label (e.g., "Morning", "Afternoon")
 * @property {string} emoji - Emoji representing the time period
 * @property {number} hour - Hour in 24-hour format (0-23)
 */

/**
 * @typedef {Object} ParsedDateTime
 * @property {Date} date - JavaScript Date object in local timezone
 * @property {string} dateFormatted - Formatted date string (e.g., "Monday, January 15, 2025")
 * @property {string} dateShort - Short formatted date (e.g., "Jan 15, 2025")
 * @property {string} dateISO - ISO date string (YYYY-MM-DD)
 * @property {string} timeFormatted - Formatted time string (e.g., "3:45 PM")
 * @property {string} time24h - 24-hour format time (e.g., "15:45")
 * @property {TimeOfDay} timeOfDay - Time of day information (morning/afternoon/evening/night)
 * @property {string} dayOfWeek - Day of the week (e.g., "Monday")
 * @property {string} dayOfWeekShort - Short day of week (e.g., "Mon")
 * @property {number} dayNumber - Day of month (1-31)
 * @property {string} month - Full month name (e.g., "January")
 * @property {string} monthShort - Short month name (e.g., "Jan")
 * @property {number} monthNumber - Month number (1-12)
 * @property {number} year - Full year (e.g., 2025)
 * @property {number} hour - Hour in 24-hour format (0-23)
 * @property {number} minute - Minute (0-59)
 * @property {number} second - Second (0-59)
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {number} unixTimestamp - Unix timestamp in seconds
 * @property {string} timezone - Detected or provided timezone
 * @property {string} timezoneOffset - Timezone offset string (e.g., "-05:00")
 * @property {string} relativeTime - Relative time description (e.g., "in 2 days", "3 hours ago")
 * @property {boolean} isPast - Whether the date is in the past
 * @property {boolean} isToday - Whether the date is today
 * @property {boolean} isTomorrow - Whether the date is tomorrow
 * @property {boolean} isThisWeek - Whether the date is within this week
 * @property {string} inputFormat - Detected input format type
 */

/**
 * Time period boundaries (24-hour format)
 * @constant
 */
const TIME_PERIODS = {
  NIGHT_END: 6,      // Night ends at 6:00 AM
  MORNING_END: 12,   // Morning ends at 12:00 PM
  AFTERNOON_END: 17, // Afternoon ends at 5:00 PM
  EVENING_END: 21    // Evening ends at 9:00 PM
};

/**
 * Detects the format of the input date/time value
 *
 * @param {string|number|Date} input - The input to analyze
 * @returns {string} The detected format type
 */
function detectDateFormat(input) {
  if (input instanceof Date) {
    return 'Date';
  }

  if (typeof input === 'number') {
    // Epoch time in milliseconds (13+ digits, after year 2001)
    if (input > 1000000000000) {
      return 'epoch_ms';
    }
    // Unix timestamp in seconds (10 digits, typical range)
    if (input > 1000000000 && input < 10000000000) {
      return 'unix_seconds';
    }
    return 'unknown_number';
  }

  if (typeof input !== 'string') {
    return 'unknown';
  }

  const str = input.trim();

  // ISO 8601 with timezone (e.g., "2025-01-15T14:30:00Z" or "2025-01-15T14:30:00+05:00")
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(str)) {
    return 'ISO8601_tz';
  }

  // ISO 8601 without timezone (e.g., "2025-01-15T14:30:00")
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    return 'ISO8601_local';
  }

  // ISO date only (e.g., "2025-01-15")
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return 'ISO_date';
  }

  // RFC 2822 (e.g., "Mon, 15 Jan 2025 14:30:00 GMT")
  if (/^[A-Za-z]{3},\s\d{1,2}\s[A-Za-z]{3}\s\d{4}\s\d{2}:\d{2}:\d{2}/.test(str)) {
    return 'RFC2822';
  }

  // US format with time (e.g., "01/15/2025 2:30 PM")
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s\d{1,2}:\d{2}\s?(AM|PM)?$/i.test(str)) {
    return 'US_datetime';
  }

  // US date only (e.g., "01/15/2025")
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    return 'US_date';
  }

  // European format (e.g., "15/01/2025" or "15-01-2025")
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(str)) {
    return 'EU_date';
  }

  // Time only 24h (e.g., "14:30" or "14:30:00")
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    return 'time_24h';
  }

  // Time only 12h (e.g., "2:30 PM")
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(str)) {
    return 'time_12h';
  }

  // Epoch/Unix as string
  if (/^\d{10,13}$/.test(str)) {
    return str.length >= 13 ? 'epoch_ms_string' : 'unix_seconds_string';
  }

  return 'unknown';
}

/**
 * Determines the time of day period based on the hour
 *
 * @param {number} hour - Hour in 24-hour format (0-23)
 * @returns {TimeOfDay} Time of day information
 */
function getTimeOfDayInfo(hour) {
  if (hour >= TIME_PERIODS.EVENING_END || hour < TIME_PERIODS.NIGHT_END) {
    return {
      period: 'night',
      label: 'Night',
      emoji: '🌙',
      hour
    };
  }
  if (hour < TIME_PERIODS.MORNING_END) {
    return {
      period: 'morning',
      label: 'Morning',
      emoji: '🌅',
      hour
    };
  }
  if (hour < TIME_PERIODS.AFTERNOON_END) {
    return {
      period: 'afternoon',
      label: 'Afternoon',
      emoji: '☀️',
      hour
    };
  }
  return {
    period: 'evening',
    label: 'Evening',
    emoji: '🌆',
    hour
  };
}

/**
 * Calculates relative time description
 *
 * @param {Date} date - The date to compare
 * @param {Date} [now=new Date()] - Reference date (defaults to now)
 * @returns {string} Relative time description
 */
function getRelativeTime(date, now = new Date()) {
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const isPast = diffMs < 0;

  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let unit, value;

  if (seconds < 60) {
    return isPast ? 'just now' : 'in a moment';
  } else if (minutes < 60) {
    unit = minutes === 1 ? 'minute' : 'minutes';
    value = minutes;
  } else if (hours < 24) {
    unit = hours === 1 ? 'hour' : 'hours';
    value = hours;
  } else if (days < 7) {
    unit = days === 1 ? 'day' : 'days';
    value = days;
  } else if (weeks < 4) {
    unit = weeks === 1 ? 'week' : 'weeks';
    value = weeks;
  } else if (months < 12) {
    unit = months === 1 ? 'month' : 'months';
    value = months;
  } else {
    unit = years === 1 ? 'year' : 'years';
    value = years;
  }

  return isPast ? `${value} ${unit} ago` : `in ${value} ${unit}`;
}

/**
 * Parses a date/time input from various formats and returns a comprehensive
 * datetime object with formatted strings and metadata for timeline organization.
 *
 * Supports the following input formats:
 * - JavaScript Date objects
 * - Epoch time in milliseconds (13+ digit numbers)
 * - Unix timestamp in seconds (10 digit numbers)
 * - ISO 8601 strings with timezone ("2025-01-15T14:30:00Z", "2025-01-15T14:30:00+05:00")
 * - ISO 8601 strings without timezone ("2025-01-15T14:30:00")
 * - ISO date strings ("2025-01-15")
 * - RFC 2822 strings ("Mon, 15 Jan 2025 14:30:00 GMT")
 * - US datetime format ("01/15/2025 2:30 PM")
 * - US date format ("01/15/2025")
 * - European date format ("15/01/2025")
 * - 24-hour time ("14:30", "14:30:00")
 * - 12-hour time ("2:30 PM")
 *
 * @param {string|number|Date} dateInput - The date/time value to parse
 * @param {string} [timeInput] - Optional separate time string (for date + time inputs)
 * @param {string} [timezone] - Optional timezone identifier (e.g., "America/New_York", "UTC")
 * @param {string} [locale='en-US'] - Locale for formatting
 * @returns {ParsedDateTime|null} Parsed datetime object or null if parsing fails
 *
 * @example
 * // Parse epoch time
 * parseDateTime(1705334400000)
 * // => { dateFormatted: "Monday, January 15, 2025", timeOfDay: { period: "afternoon", ... }, ... }
 *
 * @example
 * // Parse ISO string
 * parseDateTime("2025-01-15T14:30:00Z")
 * // => { dateFormatted: "Wednesday, January 15, 2025", timeFormatted: "2:30 PM", ... }
 *
 * @example
 * // Parse date and time separately
 * parseDateTime("2025-01-15", "14:30", "America/New_York")
 * // => { ..., timezone: "America/New_York", ... }
 *
 * @example
 * // Use for timeline organization
 * const parsed = parseDateTime(planItem.scheduled_at);
 * if (parsed) {
 *   console.log(`Day: ${parsed.dateShort}, ${parsed.timeOfDay.label}: ${parsed.timeFormatted}`);
 *   // => "Day: Jan 15, 2025, Afternoon: 2:30 PM"
 * }
 */
export function parseDateTime(dateInput, timeInput = null, timezone = null, locale = 'en-US') {
  if (!dateInput && dateInput !== 0) return null;

  try {
    const inputFormat = detectDateFormat(dateInput);
    let date;

    // Parse based on detected format
    switch (inputFormat) {
      case 'Date':
        date = new Date(dateInput);
        break;

      case 'epoch_ms':
      case 'epoch_ms_string':
        date = new Date(Number(dateInput));
        break;

      case 'unix_seconds':
      case 'unix_seconds_string':
        date = new Date(Number(dateInput) * 1000);
        break;

      case 'ISO8601_tz':
      case 'ISO8601_local':
      case 'RFC2822':
        date = new Date(dateInput);
        break;

      case 'ISO_date':
        // Parse as local date to avoid timezone shift
        const [y, m, d] = dateInput.split('-').map(Number);
        date = new Date(y, m - 1, d);
        break;

      case 'time_24h':
      case 'time_12h':
        // Time-only input: use today's date
        date = new Date();
        const timeParsed = parseTimeString(dateInput);
        if (timeParsed) {
          date.setHours(timeParsed.hours, timeParsed.minutes, timeParsed.seconds || 0, 0);
        }
        break;

      default:
        // Try native Date parsing as fallback
        date = new Date(dateInput);
    }

    // Handle separate time input
    if (timeInput) {
      const timeParsed = parseTimeString(timeInput);
      if (timeParsed) {
        date.setHours(timeParsed.hours, timeParsed.minutes, timeParsed.seconds || 0, 0);
      }
    }

    // Validate parsed date
    if (isNaN(date.getTime())) {
      return null;
    }

    // Apply timezone if specified (for display purposes)
    const displayTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Calculate timezone offset
    const offsetMinutes = date.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetMins = Math.abs(offsetMinutes % 60);
    const offsetSign = offsetMinutes <= 0 ? '+' : '-';
    const timezoneOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`;

    // Get current date for comparisons
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Build formatted strings
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateShortOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const time24Options = { hour: '2-digit', minute: '2-digit', hour12: false };

    return {
      date,
      dateFormatted: date.toLocaleDateString(locale, dateOptions),
      dateShort: date.toLocaleDateString(locale, dateShortOptions),
      dateISO: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      timeFormatted: date.toLocaleTimeString(locale, timeOptions),
      time24h: date.toLocaleTimeString(locale, time24Options),
      timeOfDay: getTimeOfDayInfo(date.getHours()),
      dayOfWeek: date.toLocaleDateString(locale, { weekday: 'long' }),
      dayOfWeekShort: date.toLocaleDateString(locale, { weekday: 'short' }),
      dayNumber: date.getDate(),
      month: date.toLocaleDateString(locale, { month: 'long' }),
      monthShort: date.toLocaleDateString(locale, { month: 'short' }),
      monthNumber: date.getMonth() + 1,
      year: date.getFullYear(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      timestamp: date.getTime(),
      unixTimestamp: Math.floor(date.getTime() / 1000),
      timezone: displayTimezone,
      timezoneOffset,
      relativeTime: getRelativeTime(date, now),
      isPast: date < now,
      isToday: dateOnly.getTime() === today.getTime(),
      isTomorrow: dateOnly.getTime() === tomorrow.getTime(),
      isThisWeek: dateOnly >= today && dateOnly < nextWeek,
      inputFormat
    };
  } catch (error) {
    logger.error('parseDateTime error:', { error: error.message }, error);
    return null;
  }
}

/**
 * Parses a time string into hours, minutes, and seconds
 *
 * @param {string} timeStr - Time string to parse (e.g., "14:30", "2:30 PM")
 * @returns {{hours: number, minutes: number, seconds: number}|null} Parsed time or null
 */
function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;

  const str = timeStr.trim();

  // 12-hour format (e.g., "2:30 PM", "12:00 AM")
  const match12h = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12h) {
    let hours = parseInt(match12h[1], 10);
    const minutes = parseInt(match12h[2], 10);
    const seconds = match12h[3] ? parseInt(match12h[3], 10) : 0;
    const isPM = match12h[4].toUpperCase() === 'PM';

    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }

    return { hours, minutes, seconds };
  }

  // 24-hour format (e.g., "14:30", "14:30:00")
  const match24h = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24h) {
    return {
      hours: parseInt(match24h[1], 10),
      minutes: parseInt(match24h[2], 10),
      seconds: match24h[3] ? parseInt(match24h[3], 10) : 0
    };
  }

  return null;
}

/**
 * Groups an array of items by date and time of day for timeline display
 *
 * @param {Array} items - Array of items with date properties
 * @param {string|Function} dateField - Field name or accessor function for the date
 * @returns {Object} Grouped items by date and time period
 *
 * @example
 * const grouped = groupByDateAndTime(planItems, 'scheduled_at');
 * // => {
 * //   "2025-01-15": {
 * //     dateFormatted: "Wednesday, January 15, 2025",
 * //     morning: [...items],
 * //     afternoon: [...items],
 * //     evening: [...items],
 * //     night: [...items]
 * //   },
 * //   ...
 * // }
 */
export function groupByDateAndTime(items, dateField) {
  if (!items || !Array.isArray(items)) return {};

  const groups = {};
  const getDate = typeof dateField === 'function'
    ? dateField
    : (item) => item[dateField];

  for (const item of items) {
    const dateValue = getDate(item);
    if (!dateValue) continue;

    const parsed = parseDateTime(dateValue);
    if (!parsed) continue;

    const dateKey = parsed.dateISO;

    if (!groups[dateKey]) {
      groups[dateKey] = {
        dateFormatted: parsed.dateFormatted,
        dateShort: parsed.dateShort,
        dayOfWeek: parsed.dayOfWeek,
        isToday: parsed.isToday,
        isTomorrow: parsed.isTomorrow,
        morning: [],
        afternoon: [],
        evening: [],
        night: [],
        unscheduled: []
      };
    }

    // Add item to appropriate time period
    const period = parsed.timeOfDay.period;
    groups[dateKey][period].push({
      ...item,
      _parsedDateTime: parsed
    });
  }

  // Sort groups by date
  const sortedKeys = Object.keys(groups).sort();
  const sortedGroups = {};
  for (const key of sortedKeys) {
    sortedGroups[key] = groups[key];
    // Sort items within each period by time
    for (const period of ['morning', 'afternoon', 'evening', 'night']) {
      sortedGroups[key][period].sort((a, b) =>
        a._parsedDateTime.timestamp - b._parsedDateTime.timestamp
      );
    }
  }

  return sortedGroups;
}

/**
 * Formats a time for input elements (HH:MM format)
 *
 * @param {string|number|Date} time - Time value to format
 * @returns {string} Time in HH:MM format for input elements
 */
export function formatTimeForInput(time) {
  if (!time) return '';

  const parsed = parseDateTime(time);
  if (!parsed) return '';

  return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
}

/**
 * Combines a date and time into a single Date object
 *
 * @param {string|Date} date - Date value
 * @param {string} time - Time string (e.g., "14:30" or "2:30 PM")
 * @returns {Date|null} Combined Date object or null if invalid
 */
export function combineDateAndTime(date, time) {
  if (!date) return null;

  const parsed = parseDateTime(date, time);
  return parsed ? parsed.date : null;
}

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
 * Respects user's timezone preference from profile or localStorage.
 * @param {string|Date} date - The date to format
 * @param {Object} options - Additional options
 * @param {string} options.locale - The locale for formatting (default: 'en-US')
 * @param {Object} options.profile - User profile for timezone preference
 * @param {string} options.timezone - Override timezone (IANA format)
 * @returns {string} Formatted date and time string
 */
export function formatDateTime(date, options = {}) {
  if (!date) return '';

  const { locale = 'en-US', profile = null, timezone: overrideTimezone } = options;

  // Get user's preferred timezone
  let timezone;
  if (overrideTimezone) {
    timezone = overrideTimezone;
  } else if (profile?.preferences?.timezone && profile.preferences.timezone !== 'system-default') {
    timezone = profile.preferences.timezone;
  } else {
    // Check localStorage for timezone preference
    try {
      const stored = localStorage.getItem('biensperience:timezone');
      if (stored && stored !== 'system-default') {
        timezone = stored;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  const formatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(timezone && { timeZone: timezone })
  };

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleString(locale, formatOptions);
  } catch (error) {
    // Fallback without timezone if invalid
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
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
 * Gets the ordinal suffix for a day number (st, nd, rd, th)
 * @param {number} day - Day of month (1-31)
 * @returns {string} Ordinal suffix
 */
function getOrdinalSuffix(day) {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Formats a date with ordinal day (e.g., "Jan 2nd, 2026")
 * @param {string|Date} date - The date to format
 * @returns {string} Formatted date string with ordinal day
 */
export function formatDateOrdinal(date) {
  if (!date) return '';

  try {
    const dateObj = toLocalDate(date);
    if (!dateObj) return '';

    const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();
    const suffix = getOrdinalSuffix(day);

    return `${month} ${day}${suffix}, ${year}`;
  } catch (error) {
    return '';
  }
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
