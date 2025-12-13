/**
 * Timezone utilities for backend
 *
 * Shared timezone options list matching frontend preferences-utils.js
 * This avoids the need to dynamically import the frontend ESM module.
 */

/**
 * List of supported timezones with labels
 * Must be kept in sync with src/utilities/preferences-utils.js TIMEZONE_OPTIONS
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
 * Pre-built Set for O(1) timezone validation
 */
const VALID_TIMEZONES = new Set(TIMEZONE_OPTIONS.map(opt => opt.value));

/**
 * Get all timezone options
 * @returns {Array<{value: string, label: string}>}
 */
function getTimezoneOptions() {
  return TIMEZONE_OPTIONS;
}

/**
 * Check if a timezone value is valid
 * @param {string} timezone - Timezone value to check
 * @returns {boolean}
 */
function isValidTimezone(timezone) {
  return VALID_TIMEZONES.has(timezone);
}

/**
 * Get valid timezone values as array
 * @returns {string[]}
 */
function getValidTimezoneValues() {
  return Array.from(VALID_TIMEZONES);
}

module.exports = {
  TIMEZONE_OPTIONS,
  VALID_TIMEZONES,
  getTimezoneOptions,
  isValidTimezone,
  getValidTimezoneValues
};
