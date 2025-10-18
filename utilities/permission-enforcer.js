/**
 * Permission Enforcer - Unified Abstraction for Permission Validation
 * 
 * Provides a consistent API for checking permissions across the entire application.
 * Works with any entity type (experiences, destinations, photos) and supports
 * both direct permissions and inherited permissions from related resources.
 * 
 * @module permission-enforcer
 */

const backendLogger = require('./backend-logger');
const {
  ROLES,
  ENTITY_TYPES,
  isOwner,
  isCollaborator,
  isSuperAdmin,
  resolvePermissionsWithInheritance
} = require('./permissions');

/**
 * Permission action types
 * @enum {string}
 */
const ACTIONS = {
  VIEW: 'view',           // Can view the resource
  EDIT: 'edit',           // Can edit the resource
  DELETE: 'delete',       // Can delete the resource
  MANAGE_PERMISSIONS: 'manage_permissions', // Can add/remove permissions
  CONTRIBUTE: 'contribute' // Can contribute (add posts, etc.)
};

/**
 * Visibility levels for resources
 * @enum {string}
 */
const VISIBILITY = {
  PUBLIC: 'public',       // Everyone can view
  AUTHENTICATED: 'authenticated', // Any logged-in user can view
  RESTRICTED: 'restricted' // Only users with permissions can view
};

/**
 * PermissionEnforcer class - Main abstraction for permission checking
 */
class PermissionEnforcer {
  constructor(models = {}) {
    // Store references to models for permission resolution
    this.models = {
      Destination: models.Destination || null,
      Experience: models.Experience || null,
      Photo: models.Photo || null,
      User: models.User || null
    };
  }

  /**
   * Set or update models (useful for lazy initialization)
   * @param {Object} models - Model references
   */
  setModels(models) {
    this.models = { ...this.models, ...models };
  }

  /**
   * Check if a user can perform an action on a resource
   * @param {Object} options - Options object
   * @param {string} options.userId - User ID performing the action
   * @param {Object} options.resource - Resource to check permissions on
   * @param {string} options.action - Action to perform (from ACTIONS enum)
   * @param {Object} options.context - Optional context (e.g., related resources)
   * @returns {Promise<Object>} - { allowed: boolean, reason: string|null, role: string|null }
   */
  async can({ userId, resource, action, context = {} }) {
    try {
      // Validate inputs
      if (!userId || !resource || !action) {
        return {
          allowed: false,
          reason: 'Missing required parameters: userId, resource, or action',
          role: null
        };
      }

      // Convert userId to string for consistent comparison
      const userIdStr = userId.toString ? userId.toString() : userId;

      // Handle resource visibility first (for VIEW action)
      if (action === ACTIONS.VIEW) {
        const visibilityCheck = await this._checkVisibility(userIdStr, resource, context);
        if (!visibilityCheck.allowed) {
          return visibilityCheck;
        }
      }

      // Get user's role and permissions for this resource
      const permissionInfo = await this._getUserPermissions(userIdStr, resource, context);

      // Check if action is allowed based on role
      const actionAllowed = this._isActionAllowed(action, permissionInfo.role);

      return {
        allowed: actionAllowed,
        reason: actionAllowed ? null : `Insufficient permissions. Required role for ${action} not met.`,
        role: permissionInfo.role
      };
    } catch (error) {
      backendLogger.error('Permission check error', { error: error.message, userId: userId, resourceId: resource._id, action });
      return {
        allowed: false,
        reason: 'Error checking permissions',
        role: null
      };
    }
  }

  /**
   * Check if user can view a resource
   * @param {string} userId - User ID
   * @param {Object} resource - Resource to check
   * @param {Object} context - Optional context
   * @returns {Promise<boolean>}
   */
  async canView(userId, resource, context = {}) {
    const result = await this.can({ userId, resource, action: ACTIONS.VIEW, context });
    return result.allowed;
  }

  /**
   * Check if user can edit a resource
   * @param {string} userId - User ID
   * @param {Object} resource - Resource to check
   * @param {Object} context - Optional context
   * @returns {Promise<boolean>}
   */
  async canEdit(userId, resource, context = {}) {
    const result = await this.can({ userId, resource, action: ACTIONS.EDIT, context });
    return result.allowed;
  }

  /**
   * Check if user can delete a resource
   * @param {string} userId - User ID
   * @param {Object} resource - Resource to check
   * @param {Object} context - Optional context
   * @returns {Promise<boolean>}
   */
  async canDelete(userId, resource, context = {}) {
    const result = await this.can({ userId, resource, action: ACTIONS.DELETE, context });
    return result.allowed;
  }

  /**
   * Check if user can manage permissions for a resource
   * @param {string} userId - User ID
   * @param {Object} resource - Resource to check
   * @param {Object} context - Optional context
   * @returns {Promise<boolean>}
   */
  async canManagePermissions(userId, resource, context = {}) {
    const result = await this.can({ userId, resource, action: ACTIONS.MANAGE_PERMISSIONS, context });
    return result.allowed;
  }

  /**
   * Check if user can contribute to a resource (add posts, comments, etc.)
   * @param {string} userId - User ID
   * @param {Object} resource - Resource to check
   * @param {Object} context - Optional context
   * @returns {Promise<boolean>}
   */
  async canContribute(userId, resource, context = {}) {
    const result = await this.can({ userId, resource, action: ACTIONS.CONTRIBUTE, context });
    return result.allowed;
  }

  /**
   * Get user's role for a resource
   * @param {string} userId - User ID
   * @param {Object} resource - Resource to check
   * @param {Object} context - Optional context
   * @returns {Promise<string|null>} - User's role or null
   */
  async getUserRole(userId, resource, context = {}) {
    const permissionInfo = await this._getUserPermissions(userId, resource, context);
    return permissionInfo.role;
  }

  /**
   * Filter a list of resources to only include those the user can view
   * @param {string} userId - User ID (null for anonymous)
   * @param {Array} resources - Array of resources
   * @param {Object} context - Optional context
   * @returns {Promise<Array>} - Filtered array of resources
   */
  async filterViewable(userId, resources, context = {}) {
    if (!Array.isArray(resources)) {
      return [];
    }

    const viewable = [];
    for (const resource of resources) {
      const canView = await this.canView(userId, resource, context);
      if (canView) {
        viewable.push(resource);
      }
    }
    return viewable;
  }

  /**
   * Add permission metadata to resources (useful for UI display)
   * @param {string} userId - User ID
   * @param {Array} resources - Array of resources
   * @param {Object} context - Optional context
   * @returns {Promise<Array>} - Resources with added permission metadata
   */
  async enrichWithPermissions(userId, resources, context = {}) {
    if (!Array.isArray(resources)) {
      return [];
    }

    const enriched = [];
    for (const resource of resources) {
      const role = await this.getUserRole(userId, resource, context);
      const canEditRes = await this.canEdit(userId, resource, context);
      const canDeleteRes = await this.canDelete(userId, resource, context);
      const canManage = await this.canManagePermissions(userId, resource, context);

      enriched.push({
        ...resource.toObject ? resource.toObject() : resource,
        _permissions: {
          role,
          canEdit: canEditRes,
          canDelete: canDeleteRes,
          canManagePermissions: canManage,
          isOwner: isOwner(userId, resource)
        }
      });
    }
    return enriched;
  }

  /**
   * Express middleware factory for protecting routes
   * @param {string} action - Action to check (from ACTIONS enum)
   * @param {Function} resourceGetter - Function to get resource from req (req => resource)
   * @returns {Function} - Express middleware
   */
  requirePermission(action, resourceGetter) {
    return async (req, res, next) => {
      try {
        if (!req.user || !req.user._id) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const resource = await resourceGetter(req);
        if (!resource) {
          return res.status(404).json({ error: 'Resource not found' });
        }

        const result = await this.can({
          userId: req.user._id,
          resource,
          action,
          context: { req }
        });

        if (!result.allowed) {
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            reason: result.reason 
          });
        }

        // Attach permission info to request for later use
        req.permissions = {
          role: result.role,
          resource
        };

        next();
      } catch (error) {
        backendLogger.error('Permission middleware error', { error: error.message, userId: req.user?._id, resourceType, resourceId });
        res.status(500).json({ error: 'Error checking permissions' });
      }
    };
  }

  // ============ PRIVATE METHODS ============

  /**
   * Get user's permissions for a resource
   * @private
   */
  async _getUserPermissions(userId, resource, context = {}) {
    const userIdStr = userId.toString();

    // Check if user is super admin - they have full access to everything
    if (this.models.User) {
      try {
        const user = await this.models.User.findById(userIdStr);
        if (user && isSuperAdmin(user)) {
          return { role: ROLES.OWNER, inherited: false, superAdmin: true };
        }
      } catch (error) {
        backendLogger.error('Error checking super admin status', { error: error.message, userId: userIdStr });
      }
    }

    // Check if user is owner (highest priority)
    if (isOwner(userIdStr, resource)) {
      return { role: ROLES.OWNER, inherited: false };
    }

    // Check direct permissions
    if (resource.permissions && Array.isArray(resource.permissions)) {
      const directPermission = resource.permissions.find(p =>
        p.entity === ENTITY_TYPES.USER &&
        p._id.toString() === userIdStr
      );

      if (directPermission) {
        return { role: directPermission.type, inherited: false };
      }
    }

    // Check inherited permissions (if models are available)
    if (this.models.Destination || this.models.Experience) {
      try {
        const resolvedPermissions = await resolvePermissionsWithInheritance(
          resource,
          this.models
        );

        const userRole = resolvedPermissions.get(userIdStr);
        if (userRole) {
          return { role: userRole, inherited: true };
        }
      } catch (error) {
        backendLogger.error('Error resolving inherited permissions', { error: error.message, userId: userIdStr, resourceId: resource._id });
      }
    }

    return { role: null, inherited: false };
  }

  /**
   * Check if user can view based on resource visibility
   * @private
   */
  async _checkVisibility(userId, resource, context = {}) {
    // Public resources are always visible
    if (resource.visibility === VISIBILITY.PUBLIC) {
      return { allowed: true, reason: null, role: null };
    }

    // If no visibility set, default behavior based on resource type
    const defaultVisibility = this._getDefaultVisibility(resource);

    if (defaultVisibility === VISIBILITY.PUBLIC) {
      return { allowed: true, reason: null, role: null };
    }

    // Authenticated users can view authenticated resources
    if (userId && defaultVisibility === VISIBILITY.AUTHENTICATED) {
      return { allowed: true, reason: null, role: null };
    }

    // For restricted resources, check permissions
    const permissionInfo = await this._getUserPermissions(userId, resource, context);
    if (permissionInfo.role) {
      return { allowed: true, reason: null, role: permissionInfo.role };
    }

    return {
      allowed: false,
      reason: 'Resource is not public and you do not have permission to view it',
      role: null
    };
  }

  /**
   * Get default visibility for a resource type
   * @private
   */
  _getDefaultVisibility(resource) {
    // Photos are typically public
    if (resource.constructor.modelName === 'Photo') {
      return VISIBILITY.PUBLIC;
    }

    // Destinations are typically public (for discovery)
    if (resource.constructor.modelName === 'Destination') {
      return VISIBILITY.PUBLIC;
    }

    // Experiences default to public (can be overridden)
    if (resource.constructor.modelName === 'Experience') {
      return VISIBILITY.PUBLIC;
    }

    // Default to authenticated for unknown types
    return VISIBILITY.AUTHENTICATED;
  }

  /**
   * Check if an action is allowed for a given role
   * @private
   */
  _isActionAllowed(action, role) {
    if (!role) {
      return false;
    }

    const rolePermissions = {
      [ROLES.OWNER]: [
        ACTIONS.VIEW,
        ACTIONS.EDIT,
        ACTIONS.DELETE,
        ACTIONS.MANAGE_PERMISSIONS,
        ACTIONS.CONTRIBUTE
      ],
      [ROLES.COLLABORATOR]: [
        ACTIONS.VIEW,
        ACTIONS.EDIT,
        ACTIONS.CONTRIBUTE
      ],
      [ROLES.CONTRIBUTOR]: [
        ACTIONS.VIEW,
        ACTIONS.CONTRIBUTE
      ]
    };

    const allowedActions = rolePermissions[role] || [];
    return allowedActions.includes(action);
  }
}

/**
 * Create a singleton instance for application-wide use
 */
let enforcerInstance = null;

/**
 * Get or create the singleton enforcer instance
 * @param {Object} models - Optional models to initialize with
 * @returns {PermissionEnforcer}
 */
function getEnforcer(models = null) {
  if (!enforcerInstance) {
    enforcerInstance = new PermissionEnforcer(models || {});
  } else if (models) {
    enforcerInstance.setModels(models);
  }
  return enforcerInstance;
}

module.exports = {
  PermissionEnforcer,
  getEnforcer,
  ACTIONS,
  VISIBILITY
};
