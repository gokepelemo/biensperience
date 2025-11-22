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
    // Return minimal owner info
    return {
      _id: ownerPermission._id,
      name: 'Owner'
    };
  }

  return null;
}

/**
 * Check if user can edit a plan (owner, collaborator, or super admin)
 * @param {Object} user - User object to check
 * @param {Object} plan - Plan object
 * @returns {boolean} - True if user can edit the plan
 */
export function canEditPlan(user, plan) {
  // Super admins can edit any plan
  if (isSuperAdmin(user)) {
    return true;
  }

  if (!user || !plan) {
    return false;
  }

  const userIdStr = user._id.toString();

  // Check permissions array for owner or collaborator role
  if (plan.permissions && Array.isArray(plan.permissions)) {
    const hasPermission = plan.permissions.some(p =>
      p.entity === 'user' &&
      (p.type === 'owner' || p.type === 'collaborator') &&
      p._id.toString() === userIdStr
    );

    if (hasPermission) {
      return true;
    }
  }

  return false;
}