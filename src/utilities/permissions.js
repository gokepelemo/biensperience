/**
 * Frontend permissions utilities
 * Shared permission checking functions for React components
 */

const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  REGULAR_USER: 'regular_user'
};

/**
 * Check if a user has super admin privileges
 * @param {Object} user - User object
 * @returns {boolean} - True if user is super admin
 */
export function isSuperAdmin(user) {
  return user && (user.role === USER_ROLES.SUPER_ADMIN || user.isSuperAdmin === true);
}