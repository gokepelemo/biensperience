/**
 * User role constants for Biensperience application.
 * Defines the different user roles and their permissions.
 *
 * @module user-roles
 */

/**
 * User role enumeration
 * @enum {string}
 */
const USER_ROLES = {
  /**
   * Super Admin - Full access to all resources and user management
   */
  SUPER_ADMIN: 'super_admin',

  /**
   * Regular User - Standard permissions with owner/collaborator/contributor roles
   */
  REGULAR_USER: 'regular_user'
};

/**
 * User role display names for UI
 * @enum {string}
 */
const USER_ROLE_DISPLAY_NAMES = {
  [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
  [USER_ROLES.REGULAR_USER]: 'Regular User'
};

/**
 * Permission levels for resources
 * @enum {string}
 */
const PERMISSION_LEVELS = {
  OWNER: 'owner',
  COLLABORATOR: 'collaborator',
  CONTRIBUTOR: 'contributor'
};

/**
 * Permission level display names for UI
 * @enum {string}
 */
const PERMISSION_LEVEL_DISPLAY_NAMES = {
  [PERMISSION_LEVELS.OWNER]: 'Owner',
  [PERMISSION_LEVELS.COLLABORATOR]: 'Collaborator',
  [PERMISSION_LEVELS.CONTRIBUTOR]: 'Contributor'
};

module.exports = {
  USER_ROLES,
  USER_ROLE_DISPLAY_NAMES,
  PERMISSION_LEVELS,
  PERMISSION_LEVEL_DISPLAY_NAMES
};