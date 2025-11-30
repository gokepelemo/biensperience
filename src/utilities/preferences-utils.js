/**
 * User Preferences Utilities
 *
 * Provides application-wide access to user preferences with localStorage fallback.
 * Preferences are synced from user profile and stored locally for fast access.
 *
 * @module preferences-utils
 */

// Default preferences when no user is logged in or preferences not set
const DEFAULT_PREFERENCES = {
  theme: 'system-default',
  currency: 'USD',
  language: 'en',
  timezone: 'system-default',
  profileVisibility: 'public',
  notifications: {
    enabled: true,
    channels: ['email'],
    types: ['activity', 'reminder']
  }
};

// localStorage key for preferences
const STORAGE_KEY = 'biensperience:preferences';

/**
 * Common timezone list with user-friendly labels
 * Grouped by region for easier navigation
 */
const TIMEZONE_OPTIONS = [
  // System default option (uses browser timezone)
  { value: 'system-default', label: 'System Default' },

  // Americas
  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time - New York' },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time - Chicago' },
  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time - Denver' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time - Los Angeles' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
  { value: 'America/Toronto', label: '(UTC-05:00) Eastern Time - Toronto' },
  { value: 'America/Vancouver', label: '(UTC-08:00) Pacific Time - Vancouver' },
  { value: 'America/Mexico_City', label: '(UTC-06:00) Central Time - Mexico City' },
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) Brasilia' },
  { value: 'America/Buenos_Aires', label: '(UTC-03:00) Buenos Aires' },

  // Europe
  { value: 'UTC', label: '(UTC+00:00) UTC' },
  { value: 'Europe/London', label: '(UTC+00:00) London' },
  { value: 'Europe/Paris', label: '(UTC+01:00) Paris, Berlin, Rome' },
  { value: 'Europe/Amsterdam', label: '(UTC+01:00) Amsterdam' },
  { value: 'Europe/Berlin', label: '(UTC+01:00) Berlin' },
  { value: 'Europe/Madrid', label: '(UTC+01:00) Madrid' },
  { value: 'Europe/Rome', label: '(UTC+01:00) Rome' },
  { value: 'Europe/Athens', label: '(UTC+02:00) Athens' },
  { value: 'Europe/Istanbul', label: '(UTC+03:00) Istanbul' },
  { value: 'Europe/Moscow', label: '(UTC+03:00) Moscow' },

  // Africa & Middle East
  { value: 'Africa/Cairo', label: '(UTC+02:00) Cairo' },
  { value: 'Africa/Johannesburg', label: '(UTC+02:00) Johannesburg' },
  { value: 'Africa/Lagos', label: '(UTC+01:00) Lagos' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai' },
  { value: 'Asia/Jerusalem', label: '(UTC+02:00) Jerusalem' },

  // Asia Pacific
  { value: 'Asia/Kolkata', label: '(UTC+05:30) Mumbai, Delhi' },
  { value: 'Asia/Shanghai', label: '(UTC+08:00) Beijing, Shanghai' },
  { value: 'Asia/Hong_Kong', label: '(UTC+08:00) Hong Kong' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo' },
  { value: 'Asia/Seoul', label: '(UTC+09:00) Seoul' },
  { value: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok' },
  { value: 'Asia/Jakarta', label: '(UTC+07:00) Jakarta' },

  // Australia & Pacific
  { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney' },
  { value: 'Australia/Melbourne', label: '(UTC+10:00) Melbourne' },
  { value: 'Australia/Perth', label: '(UTC+08:00) Perth' },
  { value: 'Australia/Brisbane', label: '(UTC+10:00) Brisbane' },
  { value: 'Pacific/Auckland', label: '(UTC+12:00) Auckland' },
  { value: 'Pacific/Fiji', label: '(UTC+12:00) Fiji' }
];

/**
 * Get timezone options for select dropdown
 * @returns {Array<{value: string, label: string}>} Array of timezone options
 */
export function getTimezoneOptions() {
  return TIMEZONE_OPTIONS;
}

/**
 * Detect user's timezone from browser
 * @returns {string} IANA timezone identifier (e.g., 'America/New_York')
 */
export function detectUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Get preferences from localStorage
 * Falls back to defaults if not available
 * @returns {Object} User preferences object
 */
export function getStoredPreferences() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Store preferences in localStorage
 * @param {Object} preferences - Preferences to store
 */
export function storePreferences(preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    // Also store individual keys for backward compatibility
    if (preferences.currency) localStorage.setItem('biensperience:currency', preferences.currency);
    if (preferences.language) localStorage.setItem('biensperience:language', preferences.language);
    if (preferences.timezone) localStorage.setItem('biensperience:timezone', preferences.timezone);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get a specific preference value
 * Checks profile first, then localStorage, then defaults
 *
 * @param {string} key - Preference key (e.g., 'currency', 'timezone')
 * @param {Object} profile - User profile object (optional)
 * @returns {*} Preference value
 */
export function getPreference(key, profile = null) {
  // Check profile first
  if (profile?.preferences?.[key] !== undefined) {
    return profile.preferences[key];
  }

  // Check localStorage
  const stored = getStoredPreferences();
  if (stored[key] !== undefined) {
    return stored[key];
  }

  // Return default
  return DEFAULT_PREFERENCES[key];
}

/**
 * Get user's preferred currency
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Currency code (e.g., 'USD')
 */
export function getCurrency(profile = null) {
  return getPreference('currency', profile);
}

/**
 * Get user's preferred language
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Language code (e.g., 'en')
 */
export function getLanguage(profile = null) {
  return getPreference('language', profile);
}

/**
 * Get user's preferred timezone
 * @param {Object} profile - User profile object (optional)
 * @returns {string} IANA timezone identifier
 */
export function getTimezone(profile = null) {
  const tz = getPreference('timezone', profile);
  // If not set, detect from browser
  if (!tz || tz === 'UTC') {
    const detected = detectUserTimezone();
    // Only use detected if it's a valid timezone from our list
    if (TIMEZONE_OPTIONS.some(opt => opt.value === detected)) {
      return detected;
    }
  }
  return tz || 'UTC';
}

/**
 * Get user's preferred theme
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Theme name ('light', 'dark', 'system-default')
 */
export function getTheme(profile = null) {
  return getPreference('theme', profile);
}

/**
 * Format a date in user's timezone
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted date string
 */
export function formatDateInTimezone(date, options = {}, profile = null) {
  const timezone = getTimezone(profile);
  const d = new Date(date);

  const defaultOptions = {
    timeZone: timezone,
    ...options
  };

  try {
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch {
    // Fallback if timezone is invalid
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(d);
  }
}

/**
 * Format a time in user's timezone
 * @param {Date|string} date - Date to format
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted time string (e.g., '3:30 PM')
 */
export function formatTimeInTimezone(date, profile = null) {
  return formatDateInTimezone(date, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }, profile);
}

/**
 * Format a date and time in user's timezone
 * @param {Date|string} date - Date to format
 * @param {Object} profile - User profile object (optional)
 * @returns {string} Formatted datetime string
 */
export function formatDateTimeInTimezone(date, profile = null) {
  return formatDateInTimezone(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }, profile);
}

/**
 * Get the current time in user's timezone as a Date object
 * @param {Object} profile - User profile object (optional)
 * @returns {Date} Current time
 */
export function getCurrentTimeInTimezone(profile = null) {
  // JavaScript Date objects are always in UTC internally
  // Use this with formatDateInTimezone for display
  return new Date();
}

/**
 * Get timezone offset string (e.g., '+05:30' or '-08:00')
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} Offset string
 */
export function getTimezoneOffset(timezone = 'UTC') {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    return offsetPart?.value || '+00:00';
  } catch {
    return '+00:00';
  }
}

/**
 * Check if a timezone is valid
 * @param {string} timezone - IANA timezone identifier
 * @returns {boolean} True if valid
 */
export function isValidTimezone(timezone) {
  if (!timezone) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

// Export default preferences for reference
export { DEFAULT_PREFERENCES };
