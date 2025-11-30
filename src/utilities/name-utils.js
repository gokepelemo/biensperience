/**
 * Name utility functions
 * Provides helpers for working with user names
 */

/**
 * Extracts the first name from a full name string
 * Handles various name formats gracefully
 *
 * @param {string} fullName - The full name to extract from
 * @param {string} fallback - Fallback value if name is empty (default: 'This user')
 * @returns {string} The first name or fallback
 *
 * @example
 * getFirstName('Louis Doherty') // 'Louis'
 * getFirstName('Madonna') // 'Madonna'
 * getFirstName('') // 'This user'
 * getFirstName(null, 'Someone') // 'Someone'
 */
export function getFirstName(fullName, fallback = 'This user') {
  if (!fullName || typeof fullName !== 'string') {
    return fallback;
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return fallback;
  }

  // Split by whitespace and take the first part
  const parts = trimmed.split(/\s+/);
  return parts[0] || fallback;
}

/**
 * Gets initials from a full name (up to 2 characters)
 *
 * @param {string} fullName - The full name to extract initials from
 * @param {string} fallback - Fallback value if name is empty (default: '?')
 * @returns {string} The initials (1-2 characters)
 *
 * @example
 * getInitials('Louis Doherty') // 'LD'
 * getInitials('Madonna') // 'M'
 * getInitials('Jean-Pierre Dupont') // 'JD'
 */
export function getInitials(fullName, fallback = '?') {
  if (!fullName || typeof fullName !== 'string') {
    return fallback;
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return fallback;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  // Take first letter of first and last name
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default {
  getFirstName,
  getInitials
};
