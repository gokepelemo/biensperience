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

/**
 * Check if user is the owner of a resource
 * Uses the permissions array to determine ownership
 *
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource (experience/destination)
 * @returns {boolean} - True if user is owner or super admin
 */
export function isOwner(user, resource) {
  // Check if user is super admin - they have full access
  if (isSuperAdmin(user)) {
    return true;
  }

  if (!user || !resource) {
    return false;
  }

  const userIdStr = user._id.toString();

  // Check permissions array for owner role
  if (resource.permissions && Array.isArray(resource.permissions)) {
    const ownerPermission = resource.permissions.find(p =>
      p.entity === 'user' &&
      p.type === 'owner' &&
      p._id.toString() === userIdStr
    );

    if (ownerPermission) {
      return true;
    }
  }

  return false;
}

/**
 * Get the owner information from a resource's permissions array
 * @param {Object} resource - Resource (experience/destination/photo)
 * @returns {Object|null} - Owner information {_id, name} or null if not found
 */
export function getOwner(resource) {
  if (!resource || !resource.permissions || !Array.isArray(resource.permissions)) {
    return null;
  }

  const ownerPermission = resource.permissions.find(p =>
    p.entity === 'user' && p.type === 'owner'
  );

  if (ownerPermission) {
    // For now, we need to get user info from somewhere else
    // This might require API changes to include user info in permissions
    // For backward compatibility, return minimal info
    return {
      _id: ownerPermission._id,
      name: 'Owner' // Placeholder - will need to be updated when API provides user names
    };
  }

  return null;
}