/**
 * Permissions and Content Privacy Framework
 *
 * Manages role-based access control for experiences and destinations with inheritance.
 * Supports collaborators (can edit and modify plan items) and contributors (can add posts).
 * Implements permission inheritance with circular dependency prevention (max 3 levels).
 *
 * @module permissions
 */

const mongoose = require('mongoose');
const { USER_ROLES } = require('./user-roles');
const backendLogger = require('./backend-logger');/**
 * Permission roles
 * @enum {string}
 */
const ROLES = {
  OWNER: 'owner',           // Full control (creator)
  COLLABORATOR: 'collaborator', // Can edit and modify plan item states
  CONTRIBUTOR: 'contributor'    // Can add posts (future functionality)
};

/**
 * Entity types that can have permissions
 * @enum {string}
 */
const ENTITY_TYPES = {
  USER: 'user',
  DESTINATION: 'destination',
  EXPERIENCE: 'experience'
};

/**
 * Maximum depth for permission inheritance to prevent infinite loops
 * @const {number}
 */
const MAX_INHERITANCE_DEPTH = 3;

/**
 * Check if user has super admin role
 * @param {Object} user - User object
 * @returns {boolean} - True if user is super admin
 */
function isSuperAdmin(user) {
  return user && (user.role === USER_ROLES.SUPER_ADMIN || user.isSuperAdmin === true);
}

/**
 * Check if user has regular user role
 * @param {Object} user - User object
 * @returns {boolean} - True if user is regular user
 */
function isRegularUser(user) {
  return user && user.role === USER_ROLES.REGULAR_USER;
}

/**
 * Validate permission object structure
 * @param {Object} permission - Permission object to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validatePermission(permission) {
  if (!permission || typeof permission !== 'object') {
    return { valid: false, error: 'Permission must be an object' };
  }

  // Check required _id field
  if (!permission._id) {
    return { valid: false, error: 'Permission must have an _id field' };
  }

  // Validate _id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(permission._id)) {
    return { valid: false, error: 'Permission _id must be a valid ObjectId' };
  }

  // Check required entity field
  if (!permission.entity) {
    return { valid: false, error: 'Permission must have an entity field' };
  }

  // Validate entity type
  const validEntityTypes = Object.values(ENTITY_TYPES);
  if (!validEntityTypes.includes(permission.entity)) {
    return { 
      valid: false, 
      error: `Permission entity must be one of: ${validEntityTypes.join(', ')}` 
    };
  }

  // Validate type field if present (only required for user entities)
  if (permission.entity === ENTITY_TYPES.USER && !permission.type) {
    return { valid: false, error: 'User permission must have a type field' };
  }

  if (permission.type) {
    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(permission.type)) {
      return { 
        valid: false, 
        error: `Permission type must be one of: ${validRoles.join(', ')}` 
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Validate an array of permissions
 * @param {Array} permissions - Array of permission objects
 * @returns {Object} - { valid: boolean, error: string|null, validPermissions: Array }
 */
function validatePermissions(permissions) {
  if (!Array.isArray(permissions)) {
    return { valid: false, error: 'Permissions must be an array', validPermissions: [] };
  }

  const validPermissions = [];
  const seenIds = new Set();

  for (let i = 0; i < permissions.length; i++) {
    const validation = validatePermission(permissions[i]);
    
    if (!validation.valid) {
      return { 
        valid: false, 
        error: `Permission at index ${i}: ${validation.error}`,
        validPermissions: []
      };
    }

    // Check for duplicate permissions
    const key = `${permissions[i].entity}:${permissions[i]._id}`;
    if (seenIds.has(key)) {
      return {
        valid: false,
        error: `Duplicate permission found for ${permissions[i].entity} ${permissions[i]._id}`,
        validPermissions: []
      };
    }
    seenIds.add(key);

    validPermissions.push(permissions[i]);
  }

  return { valid: true, error: null, validPermissions };
}

/**
 * Resolve permissions with inheritance, preventing circular dependencies
 * @param {Object} resource - The resource (experience/destination) to resolve permissions for
 * @param {Object} models - Object containing Destination and Experience models
 * @param {Set} visited - Set of visited resource IDs (for circular dependency detection)
 * @param {number} depth - Current recursion depth
 * @returns {Promise<Map>} - Map of userId -> highest role
 */
async function resolvePermissionsWithInheritance(resource, models, visited = new Set(), depth = 0) {
  const resolvedPermissions = new Map();

  // Stop at max depth
  if (depth >= MAX_INHERITANCE_DEPTH) {
    return resolvedPermissions;
  }

  // Prevent circular dependencies
  const resourceKey = `${resource.constructor.modelName}:${resource._id}`;
  if (visited.has(resourceKey)) {
    return resolvedPermissions;
  }
  visited.add(resourceKey);

  // Add owner as highest permission
  if (resource.user) {
    const userId = resource.user._id || resource.user;
    resolvedPermissions.set(userId.toString(), ROLES.OWNER);
  }

  // Process permissions array if it exists
  if (resource.permissions && Array.isArray(resource.permissions)) {
    for (const permission of resource.permissions) {
      if (permission.entity === ENTITY_TYPES.USER) {
        // Direct user permission
        const userId = permission._id.toString();
        const currentRole = resolvedPermissions.get(userId);
        
        // Only update if no existing role or new role is higher priority
        if (!currentRole || getRolePriority(permission.type) > getRolePriority(currentRole)) {
          resolvedPermissions.set(userId, permission.type);
        }
      } else if (permission.entity === ENTITY_TYPES.DESTINATION) {
        // Inherit from destination
        try {
          // Validate ObjectId format before querying database
          if (!mongoose.Types.ObjectId.isValid(permission._id)) {
            backendLogger.error('Invalid destination ObjectId format in permissions', { permissionId: permission._id });
            continue;
          }
          
          const destination = await models.Destination.findById(permission._id);
          if (destination) {
            const inheritedPerms = await resolvePermissionsWithInheritance(
              destination, 
              models, 
              new Set(visited), 
              depth + 1
            );
            
            // Merge inherited permissions (don't override higher roles)
            for (const [userId, role] of inheritedPerms) {
              const currentRole = resolvedPermissions.get(userId);
              if (!currentRole || getRolePriority(role) > getRolePriority(currentRole)) {
                resolvedPermissions.set(userId, role);
              }
            }
          }
        } catch (err) {
          // Use static string to prevent format string injection
          backendLogger.error('Error resolving destination permissions', { error: err.message, permission });
        }
      } else if (permission.entity === ENTITY_TYPES.EXPERIENCE) {
        // Inherit from experience
        try {
          // Validate ObjectId format before querying database
          if (!mongoose.Types.ObjectId.isValid(permission._id)) {
            backendLogger.error('Invalid experience ObjectId format in permissions', { permissionId: permission._id });
            continue;
          }
          
          const experience = await models.Experience.findById(permission._id);
          if (experience) {
            const inheritedPerms = await resolvePermissionsWithInheritance(
              experience, 
              models, 
              new Set(visited), 
              depth + 1
            );
            
            // Merge inherited permissions (don't override higher roles)
            for (const [userId, role] of inheritedPerms) {
              const currentRole = resolvedPermissions.get(userId);
              if (!currentRole || getRolePriority(role) > getRolePriority(currentRole)) {
                resolvedPermissions.set(userId, role);
              }
            }
          }
        } catch (err) {
          // Use static string to prevent format string injection
          backendLogger.error('Error resolving experience permissions', { error: err.message, permission });
        }
      }
    }
  }

  return resolvedPermissions;
}

/**
 * Get priority of a role (higher number = higher priority)
 * @param {string} role - Role name
 * @returns {number} - Priority level
 */
function getRolePriority(role) {
  const priorities = {
    [ROLES.OWNER]: 100,
    [ROLES.COLLABORATOR]: 50,
    [ROLES.CONTRIBUTOR]: 10
  };
  return priorities[role] || 0;
}

/**
 * Check if user has a specific role or higher for a resource
 * @param {string} userId - User ID to check
 * @param {Object} resource - Resource (experience/destination)
 * @param {string} requiredRole - Minimum required role
 * @param {Object} models - Object containing Destination and Experience models
 * @returns {Promise<boolean>} - True if user has required role or higher
 */
async function hasRole(userId, resource, requiredRole, models) {
  // Check if user is super admin - they have owner-level permissions on everything
  if (models && models.User) {
    try {
      const user = await models.User.findById(userId);
      if (user && user.isSuperAdmin) {
        return true; // Super admins have all permissions
      }
    } catch (error) {
      backendLogger.error('Error checking super admin status in hasRole', { error: error.message, userId });
    }
  }

  const permissions = await resolvePermissionsWithInheritance(resource, models);
  const userRole = permissions.get(userId.toString());

  if (!userRole) {
    return false;
  }

  return getRolePriority(userRole) >= getRolePriority(requiredRole);
}

/**
 * Check if user can edit a resource (owner or collaborator)
 * @param {string} userId - User ID to check
 * @param {Object} resource - Resource (experience/destination)
 * @param {Object} models - Object containing Destination and Experience models
 * @returns {Promise<boolean>} - True if user can edit
 */
async function canEdit(userId, resource, models) {
  // Check if user is super admin - they have full access
  if (typeof userId === 'object' && isSuperAdmin(userId)) {
    return true;
  }

  // If models are provided, check for super admin in database
  if (models && models.User) {
    try {
      const user = await models.User.findById(userId);
      if (user && isSuperAdmin(user)) {
        return true;
      }
    } catch (error) {
      backendLogger.error('Error checking super admin status in canEdit', { error: error.message, userId });
    }
  }  return await hasRole(userId, resource, ROLES.COLLABORATOR, models);
}

/**
 * Check if user is the owner of a resource
 * Maintains backwards compatibility by checking both:
 * 1. Legacy `user` attribute (creator)
 * 2. Owner role in permissions array
 * 
 * @param {string|Object} userId - User ID or User object to check
 * @param {Object} resource - Resource (experience/destination)
 * @returns {boolean} - True if user is owner or super admin
 */
function isOwner(userId, resource) {
  // Check if user is super admin - they have full access
  if (typeof userId === 'object' && isSuperAdmin(userId)) {
    return true;
  }
  
  const userIdStr = (typeof userId === 'object' ? userId._id : userId).toString();
  
  // Check legacy user attribute (backwards compatibility)
  if (resource.user) {
    const ownerId = resource.user._id || resource.user;
    if (userIdStr === ownerId.toString()) {
      return true;
    }
  }
  
  // Check permissions array for owner role
  if (resource.permissions && Array.isArray(resource.permissions)) {
    const ownerPermission = resource.permissions.find(p => 
      p.entity === ENTITY_TYPES.USER && 
      p.type === ROLES.OWNER &&
      p._id.toString() === userIdStr
    );
    
    if (ownerPermission) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if user is a collaborator on a resource
 * Collaborators can edit content but cannot manage permissions or delete
 * 
 * @param {string|Object} userId - User ID or User object to check
 * @param {Object} resource - Resource (experience/destination)
 * @param {Object} models - Object containing Destination and Experience models for inheritance
 * @returns {Promise<boolean>} - True if user is collaborator or super admin
 */
async function isCollaborator(userId, resource, models) {
  // Check if user is super admin - they have full access including collaborator permissions
  if (typeof userId === 'object' && userId.isSuperAdmin) {
    return true;
  }
  
  const userIdStr = (typeof userId === 'object' ? userId._id : userId).toString();
  
  // Check direct permissions for collaborator role
  if (resource.permissions && Array.isArray(resource.permissions)) {
    const collaboratorPermission = resource.permissions.find(p => 
      p.entity === ENTITY_TYPES.USER && 
      p.type === ROLES.COLLABORATOR &&
      p._id.toString() === userIdStr
    );
    
    if (collaboratorPermission) {
      return true;
    }
  }
  
  // Check inherited permissions
  if (models) {
    const permissions = await resolvePermissionsWithInheritance(resource, models);
    const userRole = permissions.get(userIdStr);
    return userRole === ROLES.COLLABORATOR;
  }
  
  return false;
}

/**
 * Get all users with permissions for a resource
 * @param {Object} resource - Resource (experience/destination)
 * @param {Object} models - Object containing Destination and Experience models
 * @returns {Promise<Array>} - Array of { userId, role } objects
 */
async function getAllPermissions(resource, models) {
  const permissions = await resolvePermissionsWithInheritance(resource, models);
  
  return Array.from(permissions.entries()).map(([userId, role]) => ({
    userId,
    role
  }));
}

/**
 * Add a permission to a resource (atomic operation)
 * @param {Object} resource - Resource to add permission to
 * @param {Object} permission - Permission object to add
 * @returns {Object} - { success: boolean, error: string|null }
 */
function addPermission(resource, permission) {
  const validation = validatePermission(permission);
  
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Check for duplicate using atomic operation
  const existingIndex = resource.permissions?.findIndex(p => 
    p._id.toString() === permission._id.toString() && 
    p.entity === permission.entity
  );

  if (existingIndex !== -1) {
    return { success: false, error: 'Permission already exists' };
  }

  // Initialize permissions array if it doesn't exist
  if (!resource.permissions) {
    resource.permissions = [];
  }

  resource.permissions.push(permission);
  
  // Audit logging for permission addition
  backendLogger.info('Permission added', {
    audit: true,
    action: 'permission_added',
    userId: permission._id,
    permissionType: permission.type || 'entity',
    entity: permission.entity,
    resourceType: resource.constructor.modelName,
    resourceId: resource._id
  });
  
  return { success: true, error: null };
}

/**
 * Remove a permission from a resource (atomic operation)
 * @param {Object} resource - Resource to remove permission from
 * @param {string} entityId - ID of the entity to remove
 * @param {string} entityType - Type of entity (user/destination/experience)
 * @returns {Object} - { success: boolean, error: string|null, removed: Object|null }
 */
function removePermission(resource, entityId, entityType) {
  if (!resource.permissions || !Array.isArray(resource.permissions)) {
    return { success: false, error: 'No permissions to remove', removed: null };
  }

  const index = resource.permissions.findIndex(p => 
    p._id.toString() === entityId.toString() && 
    p.entity === entityType
  );

  if (index === -1) {
    return { success: false, error: 'Permission not found', removed: null };
  }

  const removed = resource.permissions.splice(index, 1)[0];
  
  // Audit logging for permission removal
  backendLogger.info('Permission removed', {
    audit: true,
    action: 'permission_removed',
    userId: removed._id,
    permissionType: removed.type || 'entity',
    entity: removed.entity,
    resourceType: resource.constructor.modelName,
    resourceId: resource._id
  });
  
  return { success: true, error: null, removed };
}

/**
 * Update a permission type (only for user entities)
 * @param {Object} resource - Resource to update permission on
 * @param {string} userId - User ID to update
 * @param {string} newType - New permission type
 * @returns {Object} - { success: boolean, error: string|null }
 */
function updatePermissionType(resource, userId, newType) {
  if (!Object.values(ROLES).includes(newType)) {
    return { 
      success: false, 
      error: `Invalid role type. Must be one of: ${Object.values(ROLES).join(', ')}` 
    };
  }

  if (!resource.permissions || !Array.isArray(resource.permissions)) {
    return { success: false, error: 'No permissions to update' };
  }

  const permission = resource.permissions.find(p => 
    p._id.toString() === userId.toString() && 
    p.entity === ENTITY_TYPES.USER
  );

  if (!permission) {
    return { success: false, error: 'Permission not found' };
  }

  const oldType = permission.type;
  permission.type = newType;
  
  // Audit logging for permission type update
  backendLogger.info('Permission updated', {
    audit: true,
    action: 'permission_updated',
    userId,
    oldType,
    newType,
    resourceType: resource.constructor.modelName,
    resourceId: resource._id
  });
  
  return { success: true, error: null };
}

/**
 * Check for circular dependencies in permission inheritance
 * @param {Object} resource - Starting resource
 * @param {string} targetId - ID to check for circular reference
 * @param {string} targetEntity - Entity type of target
 * @param {Object} models - Object containing Destination and Experience models
 * @returns {Promise<boolean>} - True if adding this permission would create a circular dependency
 */
async function wouldCreateCircularDependency(resource, targetId, targetEntity, models) {
  const visited = new Set();
  const queue = [{ resource, depth: 0 }];
  const resourceKey = `${resource.constructor.modelName}:${resource._id}`;
  visited.add(resourceKey);

  while (queue.length > 0) {
    const { resource: current, depth } = queue.shift();

    if (depth >= MAX_INHERITANCE_DEPTH) {
      continue;
    }

    if (!current.permissions || !Array.isArray(current.permissions)) {
      continue;
    }

    for (const permission of current.permissions) {
      // Check if we found the target (circular reference)
      if (permission._id.toString() === targetId.toString() && 
          permission.entity === targetEntity) {
        return true;
      }

      // Only check destination and experience entities for deeper circular deps
      if (permission.entity === ENTITY_TYPES.DESTINATION || 
          permission.entity === ENTITY_TYPES.EXPERIENCE) {
        
        const key = `${permission.entity}:${permission._id}`;
        if (!visited.has(key)) {
          visited.add(key);

          try {
            let nextResource;
            if (permission.entity === ENTITY_TYPES.DESTINATION) {
              nextResource = await models.Destination.findById(permission._id);
            } else {
              nextResource = await models.Experience.findById(permission._id);
            }

            if (nextResource) {
              queue.push({ resource: nextResource, depth: depth + 1 });
            }
          } catch (err) {
            backendLogger.error('Error checking circular dependency', { 
              error: err.message, 
              permissionEntity: permission.entity, 
              permissionId: permission._id 
            });
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if user has a specific permission type on a resource (synchronous, no inheritance)
 * For simple permission checks directly on the permissions array
 * 
 * @param {Object} resource - Resource with permissions array
 * @param {string} userId - User ID to check
 * @param {string} permissionType - Permission type (owner, collaborator, contributor)
 * @returns {boolean} - True if user has the permission
 */
function hasDirectPermission(resource, userId, permissionType) {
  if (!resource || !resource.permissions || !Array.isArray(resource.permissions)) {
    return false;
  }
  
  return resource.permissions.some(
    p => p.entity === ENTITY_TYPES.USER && 
         p._id.toString() === userId.toString() && 
         p.type === permissionType
  );
}

module.exports = {
  ROLES,
  ENTITY_TYPES,
  MAX_INHERITANCE_DEPTH,
  validatePermission,
  validatePermissions,
  resolvePermissionsWithInheritance,
  getRolePriority,
  hasRole,
  canEdit,
  isOwner,
  isCollaborator,
  getAllPermissions,
  addPermission,
  removePermission,
  updatePermissionType,
  wouldCreateCircularDependency,
  hasDirectPermission
};
