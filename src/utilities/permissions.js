/**
 * Frontend permissions utilities
 * Comprehensive permission checking functions for React components
 *
 * This module mirrors the backend permission-enforcer.js patterns for consistency.
 * All permission checks include super admin bypass.
 *
 * @module src/utilities/permissions
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * System-level user roles
 */
export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  REGULAR_USER: 'regular_user'
};

/**
 * Resource-level permission roles (matches backend)
 */
export const ROLES = {
  OWNER: 'owner',
  COLLABORATOR: 'collaborator',
  CONTRIBUTOR: 'contributor'
};

/**
 * Role priority for determining highest permission level
 */
export const ROLE_PRIORITY = {
  [ROLES.OWNER]: 100,
  [ROLES.COLLABORATOR]: 50,
  [ROLES.CONTRIBUTOR]: 10
};

/**
 * Actions that can be performed on resources (matches backend ACTIONS)
 */
export const ACTIONS = {
  VIEW: 'view',
  EDIT: 'edit',
  DELETE: 'delete',
  MANAGE_PERMISSIONS: 'manage_permissions',
  CONTRIBUTE: 'contribute'
};

/**
 * Role-to-actions mapping (matches backend ROLE_ACTIONS)
 */
export const ROLE_ACTIONS = {
  [ROLES.OWNER]: [ACTIONS.VIEW, ACTIONS.EDIT, ACTIONS.DELETE, ACTIONS.MANAGE_PERMISSIONS, ACTIONS.CONTRIBUTE],
  [ROLES.COLLABORATOR]: [ACTIONS.VIEW, ACTIONS.EDIT, ACTIONS.CONTRIBUTE],
  [ROLES.CONTRIBUTOR]: [ACTIONS.VIEW, ACTIONS.CONTRIBUTE]
};

/**
 * Entity types for permission inheritance
 */
export const ENTITY_TYPES = {
  USER: 'user',
  DESTINATION: 'destination',
  EXPERIENCE: 'experience'
};

// ============================================================================
// Core Permission Checks
// ============================================================================

/**
 * Check if a user has super admin privileges
 * @param {Object} user - User object
 * @returns {boolean} - True if user is super admin
 */
export function isSuperAdmin(user) {
  return user && (user.role === USER_ROLES.SUPER_ADMIN || user.isSuperAdmin === true);
}

/**
 * Get user's role for a specific resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {string|null} - Role string ('owner', 'collaborator', 'contributor') or null
 */
export function getUserRole(user, resource) {
  if (!user || !resource) return null;

  // Super admins effectively have owner role
  if (isSuperAdmin(user)) return ROLES.OWNER;

  const userIdStr = user._id?.toString?.() || user._id;

  if (!resource.permissions || !Array.isArray(resource.permissions)) {
    return null;
  }

  // Find direct user permission with highest priority
  let highestRole = null;
  let highestPriority = -1;

  for (const p of resource.permissions) {
    if (p.entity === ENTITY_TYPES.USER && p._id?.toString?.() === userIdStr) {
      const priority = ROLE_PRIORITY[p.type] || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        highestRole = p.type;
      }
    }
  }

  return highestRole;
}

/**
 * Check if user is the owner of a resource
 * Uses the permissions array to determine ownership
 *
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource (experience/destination/plan)
 * @returns {boolean} - True if user is owner or super admin
 */
export function isOwner(user, resource) {
  if (isSuperAdmin(user)) return true;
  return getUserRole(user, resource) === ROLES.OWNER;
}

/**
 * Check if user is a collaborator on a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user is collaborator (or higher)
 */
export function isCollaborator(user, resource) {
  if (isSuperAdmin(user)) return true;
  const role = getUserRole(user, resource);
  return role === ROLES.OWNER || role === ROLES.COLLABORATOR;
}

/**
 * Check if user is a contributor on a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user has any permission on resource
 */
export function isContributor(user, resource) {
  if (isSuperAdmin(user)) return true;
  const role = getUserRole(user, resource);
  return role !== null;
}

/**
 * Check if user has a specific role or higher on a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @param {string} requiredRole - Minimum role required ('owner', 'collaborator', 'contributor')
 * @returns {boolean} - True if user has required role or higher
 */
export function hasRole(user, resource, requiredRole) {
  if (isSuperAdmin(user)) return true;

  const userRole = getUserRole(user, resource);
  if (!userRole) return false;

  const userPriority = ROLE_PRIORITY[userRole] || 0;
  const requiredPriority = ROLE_PRIORITY[requiredRole] || 0;

  return userPriority >= requiredPriority;
}

// ============================================================================
// Action-Based Permission Checks (mirrors backend enforcer)
// ============================================================================

/**
 * Check if user can perform a specific action on a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @param {string} action - Action from ACTIONS enum
 * @returns {boolean} - True if user can perform action
 */
export function canPerformAction(user, resource, action) {
  if (isSuperAdmin(user)) return true;

  const role = getUserRole(user, resource);
  if (!role) return false;

  const allowedActions = ROLE_ACTIONS[role] || [];
  return allowedActions.includes(action);
}

/**
 * Check if user can view a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user can view
 */
export function canView(user, resource) {
  // Public resources can be viewed by anyone
  if (resource?.public === true || resource?.visibility === 'public') {
    return true;
  }
  return canPerformAction(user, resource, ACTIONS.VIEW);
}

/**
 * Check if user can edit a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user can edit
 */
export function canEdit(user, resource) {
  return canPerformAction(user, resource, ACTIONS.EDIT);
}

/**
 * Check if user can delete a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user can delete (owner only)
 */
export function canDelete(user, resource) {
  return canPerformAction(user, resource, ACTIONS.DELETE);
}

/**
 * Check if user can manage permissions on a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user can manage permissions (owner only)
 */
export function canManagePermissions(user, resource) {
  return canPerformAction(user, resource, ACTIONS.MANAGE_PERMISSIONS);
}

/**
 * Check if user can contribute to a resource
 * @param {Object} user - User object to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user can contribute
 */
export function canContribute(user, resource) {
  return canPerformAction(user, resource, ACTIONS.CONTRIBUTE);
}

// ============================================================================
// Convenience Functions (backwards compatible)
// ============================================================================

/**
 * Check if user can edit a plan (owner, collaborator, or super admin)
 * @param {Object} user - User object to check
 * @param {Object} plan - Plan object
 * @returns {boolean} - True if user can edit the plan
 */
export function canEditPlan(user, plan) {
  return canEdit(user, plan);
}

/**
 * Check if user can delete a plan (owner only)
 * @param {Object} user - User object to check
 * @param {Object} plan - Plan object
 * @returns {boolean} - True if user can delete the plan
 */
export function canDeletePlan(user, plan) {
  return canDelete(user, plan);
}

/**
 * Check if user can add collaborators to a plan (owner only)
 * @param {Object} user - User object to check
 * @param {Object} plan - Plan object
 * @returns {boolean} - True if user can manage plan collaborators
 */
export function canManagePlanCollaborators(user, plan) {
  return canManagePermissions(user, plan);
}

/**
 * Check if user can edit an experience
 * @param {Object} user - User object to check
 * @param {Object} experience - Experience object
 * @returns {boolean} - True if user can edit
 */
export function canEditExperience(user, experience) {
  return canEdit(user, experience);
}

/**
 * Check if user can delete an experience (owner only)
 * @param {Object} user - User object to check
 * @param {Object} experience - Experience object
 * @returns {boolean} - True if user can delete
 */
export function canDeleteExperience(user, experience) {
  return canDelete(user, experience);
}

/**
 * Check if user can edit a destination
 * For destinations, the creator is stored in a 'user' field (not permissions)
 * @param {Object} user - User object to check
 * @param {Object} destination - Destination object
 * @returns {boolean} - True if user can edit
 */
export function canEditDestination(user, destination) {
  if (isSuperAdmin(user)) return true;

  // First check standard permissions
  if (canEdit(user, destination)) return true;

  // Destinations also support legacy 'user' field for creator
  if (destination?.user) {
    const userIdStr = user?._id?.toString?.() || user?._id;
    const creatorIdStr = destination.user?.toString?.() || destination.user;
    return userIdStr === creatorIdStr;
  }

  return false;
}

/**
 * Check if user can delete a destination (creator only)
 * @param {Object} user - User object to check
 * @param {Object} destination - Destination object
 * @returns {boolean} - True if user can delete
 */
export function canDeleteDestination(user, destination) {
  if (isSuperAdmin(user)) return true;

  // Check standard permissions
  if (canDelete(user, destination)) return true;

  // Destinations also support legacy 'user' field for creator
  if (destination?.user) {
    const userIdStr = user?._id?.toString?.() || user?._id;
    const creatorIdStr = destination.user?.toString?.() || destination.user;
    return userIdStr === creatorIdStr;
  }

  return false;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the owner information from a resource's permissions array
 * @param {Object} resource - Resource (experience/destination/photo)
 * @returns {Object|null} - Owner information {_id, name, user} or null if not found
 */
export function getOwner(resource) {
  if (!resource || !resource.permissions || !Array.isArray(resource.permissions)) {
    return null;
  }

  const ownerPermission = resource.permissions.find(p =>
    p.entity === ENTITY_TYPES.USER && p.type === ROLES.OWNER
  );

  if (ownerPermission) {
    return {
      _id: ownerPermission._id,
      name: ownerPermission.user?.name || 'Owner',
      user: ownerPermission.user || null
    };
  }

  return null;
}

/**
 * Get all collaborators from a resource's permissions array
 * @param {Object} resource - Resource with permissions array
 * @returns {Array} - Array of collaborator permission objects
 */
export function getCollaborators(resource) {
  if (!resource?.permissions || !Array.isArray(resource.permissions)) {
    return [];
  }

  return resource.permissions.filter(p =>
    p.entity === ENTITY_TYPES.USER && p.type === ROLES.COLLABORATOR
  );
}

/**
 * Get all contributors from a resource's permissions array
 * @param {Object} resource - Resource with permissions array
 * @returns {Array} - Array of contributor permission objects
 */
export function getContributors(resource) {
  if (!resource?.permissions || !Array.isArray(resource.permissions)) {
    return [];
  }

  return resource.permissions.filter(p =>
    p.entity === ENTITY_TYPES.USER && p.type === ROLES.CONTRIBUTOR
  );
}

/**
 * Get all users with any permission on a resource
 * @param {Object} resource - Resource with permissions array
 * @returns {Array} - Array of user permission objects (owner, collaborators, contributors)
 */
export function getAllPermissionedUsers(resource) {
  if (!resource?.permissions || !Array.isArray(resource.permissions)) {
    return [];
  }

  return resource.permissions.filter(p => p.entity === ENTITY_TYPES.USER);
}

/**
 * Check if a specific user ID has any permission on a resource
 * @param {string} userId - User ID to check
 * @param {Object} resource - Resource with permissions array
 * @returns {boolean} - True if user has any permission
 */
export function hasAnyPermission(userId, resource) {
  if (!userId || !resource?.permissions) return false;

  const userIdStr = userId?.toString?.() || userId;
  return resource.permissions.some(p =>
    p.entity === ENTITY_TYPES.USER && (p._id?.toString?.() || p._id) === userIdStr
  );
}

/**
 * Create a permission result object (matches backend pattern)
 * @param {boolean} allowed - Whether action is allowed
 * @param {string} reason - Human-readable reason
 * @param {string|null} role - User's role if any
 * @returns {Object} - Permission result { allowed, reason, role }
 */
export function createPermissionResult(allowed, reason, role = null) {
  return { allowed, reason, role };
}

// ============================================================================
// React Hook Helpers
// ============================================================================

/**
 * Get comprehensive permission info for a user on a resource
 * Useful for components that need to show/hide multiple UI elements
 * @param {Object} user - User object
 * @param {Object} resource - Resource with permissions array
 * @returns {Object} - Permission info object
 */
export function getPermissionInfo(user, resource) {
  const role = getUserRole(user, resource);
  const isAdmin = isSuperAdmin(user);

  return {
    role,
    isOwner: isAdmin || role === ROLES.OWNER,
    isCollaborator: isAdmin || role === ROLES.OWNER || role === ROLES.COLLABORATOR,
    isContributor: isAdmin || role !== null,
    isSuperAdmin: isAdmin,
    canView: canView(user, resource),
    canEdit: canEdit(user, resource),
    canDelete: canDelete(user, resource),
    canManagePermissions: canManagePermissions(user, resource),
    canContribute: canContribute(user, resource)
  };
}