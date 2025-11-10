/**
 * Permission Enforcer - Unified Abstraction for Permission Validation
 * 
 * Provides a consistent API for checking permissions across the entire application.
 * Works with any entity type (experiences, destinations, photos) and supports
 * both direct permissions and inherited permissions from related resources.
 * 
 * @module permission-enforcer
 */

const mongoose = require('mongoose');
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

      backendLogger.info('PERMISSION_DEBUG: can() called', { userId, resourceId: resource?._id, action });

      // Convert userId to string for consistent comparison
      const userIdStr = userId.toString ? userId.toString() : userId;
      backendLogger.info('PERMISSION_DEBUG: userIdStr', { userIdStr });

      // Check email verification requirements for actions that require it
      if (action === ACTIONS.EDIT || action === ACTIONS.DELETE || action === ACTIONS.MANAGE_PERMISSIONS) {
        const emailCheck = await this._checkEmailVerification(userIdStr);
        if (!emailCheck.allowed) {
          return emailCheck;
        }
      }

      // Handle resource visibility first (for VIEW action)
      if (action === ACTIONS.VIEW) {
        const visibilityCheck = await this._checkVisibility(userIdStr, resource, context);
        if (visibilityCheck.allowed) {
          return visibilityCheck;  // Return success if visibility allows view
        }
        // If visibility doesn't allow, continue to permission check
      }

      // Get user's role and permissions for this resource
      const permissionInfo = await this._getUserPermissions(userIdStr, resource, context);

      // Diagnostic logging: record resolved permission info for debugging
      try {
        const resourceSummary = {
          resourceId: resource?._id,
          resourceType: resource?.constructor?.modelName || (resource && resource.type) || null,
          resourceUser: resource?.user ? (resource.user._id ? resource.user._id : resource.user) : resource?.user
        };
        const samplePermissions = (resource.permissions && Array.isArray(resource.permissions)) ? resource.permissions.slice(0,5).map(p => ({ _id: p._id, entity: p.entity, type: p.type })) : [];
        backendLogger.info('PERMISSION_DEBUG: resolved permissions', { userId: userIdStr, action, resourceSummary, samplePermissions, permissionInfo });
      } catch (logErr) {
        backendLogger.error('PERMISSION_DEBUG: failed to log resolved permissions', { error: logErr?.message });
      }

      // Check if action is allowed based on role
      const actionAllowed = this._isActionAllowed(action, permissionInfo.role);

      backendLogger.info('PERMISSION_DEBUG: action decision', { userId: userIdStr, action, role: permissionInfo.role, allowed: actionAllowed });

      return {
        allowed: actionAllowed,
        reason: actionAllowed ? null : `Insufficient permissions. Required role for ${action} not met.`,
        role: permissionInfo.role
      };
    } catch (error) {
      backendLogger.error('Permission check error', { error: error.message, userId: userId, resourceId: resource?.toString(), action });
      return {
        allowed: false,
        reason: 'Error checking permissions',
        role: null
      };
    }
  }

  /**
   * Check if user can view a resource
   * @param {Object} params - Parameters object
   * @param {string} params.userId - User ID to check
   * @param {Object} params.resource - Resource to check
   * @param {Object} params.context - Optional context
   * @returns {Promise<boolean>}
   */
  async canView({ userId, resource, context = {} }) {
    return await this.can({ userId, resource, action: ACTIONS.VIEW, context });
  }

  /**
   * Check if user can edit a resource
   * @param {Object} params - Parameters object
   * @param {string} params.userId - User ID to check
   * @param {Object} params.resource - Resource to check
   * @param {Object} params.context - Optional context
   * @returns {Promise<boolean>}
   */
  async canEdit({ userId, resource, context = {} }) {
    return await this.can({ userId, resource, action: ACTIONS.EDIT, context });
  }

  /**
   * Check if user can delete a resource
   * @param {Object} params - Parameters object
   * @param {string} params.userId - User ID to check
   * @param {Object} params.resource - Resource to check
   * @param {Object} params.context - Optional context
   * @returns {Promise<boolean>}
   */
  async canDelete({ userId, resource, context = {} }) {
    return await this.can({ userId, resource, action: ACTIONS.DELETE, context });
  }

  /**
   * Check if user can manage permissions for a resource
   * @param {Object} params - Parameters object
   * @param {string} params.userId - User ID to check
   * @param {Object} params.resource - Resource to check
   * @param {Object} params.context - Optional context
   * @returns {Promise<boolean>}
   */
  async canManagePermissions({ userId, resource, context = {} }) {
    return await this.can({ userId, resource, action: ACTIONS.MANAGE_PERMISSIONS, context });
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
        backendLogger.error('Permission middleware error', { error: error.message, userId: req.user?._id });
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
    backendLogger.info('PERMISSION_DEBUG: _getUserPermissions called for userId:', userIdStr);

    // Check if user is super admin - they have full access to everything
    if (this.models.User) {
      try {
        backendLogger.info('PERMISSION_DEBUG: Checking super admin status for userId:', userIdStr);
        const user = await this.models.User.findById(userIdStr);
        backendLogger.info('PERMISSION_DEBUG: User found:', !!user);
        if (user) {
          backendLogger.info('PERMISSION_DEBUG: User details:', {
            _id: user._id,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
            email: user.email
          });
          if (isSuperAdmin(user)) {
            backendLogger.info('PERMISSION_DEBUG: User is super admin - granting OWNER role');
            return { role: ROLES.OWNER, inherited: false, superAdmin: true };
          } else {
            backendLogger.info('PERMISSION_DEBUG: User is NOT super admin');
          }
        }
      } catch (error) {
        backendLogger.error('Error checking super admin status', { error: error.message, userId: userIdStr });
      }
    } else {
      backendLogger.info('PERMISSION_DEBUG: No User model available');
    }

    // Check if user is owner (highest priority)
    const ownerCheck = isOwner(userIdStr, resource);
    backendLogger.info('COLLAB_DEBUG: isOwner check', {
      userIdStr,
      resourceId: resource._id,
      resourceUser: resource.user?.toString ? resource.user.toString() : resource.user,
      ownerCheck,
      hasPermissions: !!resource.permissions,
      permissionsLength: resource.permissions?.length
    });

    if (ownerCheck) {
      return { role: ROLES.OWNER, inherited: false };
    }

    // Check direct permissions
    if (resource.permissions && Array.isArray(resource.permissions)) {
      const directPermission = resource.permissions.find(p =>
        p.entity === ENTITY_TYPES.USER &&
        p._id.toString() === userIdStr
      );

      backendLogger.info('COLLAB_DEBUG: Direct permission check', {
        userIdStr,
        foundPermission: !!directPermission,
        permissionType: directPermission?.type,
        allPermissions: resource.permissions.map(p => ({
          _id: p._id?.toString(),
          entity: p.entity,
          type: p.type
        }))
      });

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

  /**
   * Check if user meets email verification requirements
   * @private
   */
  async _checkEmailVerification(userId) {
    const userIdStr = userId.toString();

    if (!this.models.User) {
      backendLogger.info('PERMISSION_DEBUG: No User model available for email verification check');
      return { allowed: false, reason: 'User model not available for email verification' };
    }

    try {
      backendLogger.info('PERMISSION_DEBUG: Checking email verification for user', userIdStr);
      const user = await this.models.User.findById(userIdStr);

      if (!user) {
        backendLogger.info('PERMISSION_DEBUG: User not found for email verification', userIdStr);
        return { allowed: false, reason: 'User not found' };
      }

      backendLogger.info('PERMISSION_DEBUG: User details for email check', {
        userId: userIdStr,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        role: user.role,
        provider: user.provider,
        emailConfirmed: user.emailConfirmed
      });

      // OAuth users are automatically verified
      if (user.provider && user.provider !== 'local') {
        backendLogger.info('PERMISSION_DEBUG: OAuth user - email verification bypassed', userIdStr);
        return { allowed: true };
      }

      // Super admins bypass email verification
      if (isSuperAdmin(user)) {
        backendLogger.info('PERMISSION_DEBUG: Super admin user - email verification bypassed', userIdStr);
        return { allowed: true };
      }

      // Check if email is confirmed
      if (!user.emailConfirmed) {
        backendLogger.info('PERMISSION_DEBUG: Email not confirmed - blocking action', userIdStr);
        return {
          allowed: false,
          reason: 'Email verification required. Please check your email for a verification link.',
          code: 'EMAIL_NOT_VERIFIED'
        };
      }

      backendLogger.info('PERMISSION_DEBUG: Email verification passed', userIdStr);
      return { allowed: true };
    } catch (error) {
      backendLogger.info('PERMISSION_DEBUG: Error checking email verification', error.message, userIdStr);
      return { allowed: false, reason: 'Error checking email verification status' };
    }
  }

  /**
   * MUTATION METHODS - ONLY WAY TO MODIFY PERMISSIONS
   * All mutations are audited and validated
   */

  /**
   * Add a permission to a resource (ONLY way to add permissions)
   * @param {Object} options - Options object
   * @param {Object} options.resource - Resource to add permission to
   * @param {Object} options.permission - Permission object { _id, entity, type }
   * @param {string} options.actorId - User ID performing the action
   * @param {string} options.reason - Reason for adding permission
   * @param {Object} options.metadata - Request metadata (IP, user agent, etc.)
   * @param {boolean} options.allowSelfContributor - Allow users to add themselves as contributor (for auto-assignment)
   * @returns {Promise<Object>} - { success: boolean, error: string|null, rollbackToken: string|null }
   */
  async addPermission({ resource, permission, actorId, reason, metadata = {}, allowSelfContributor = false }) {
    try {
      backendLogger.info('ENFORCER: addPermission called', {
        resourceId: resource?._id?.toString ? resource._id.toString() : resource?._id,
        permission: { _id: permission?._id, entity: permission?.entity, type: permission?.type },
        actorId: actorId?.toString ? actorId.toString() : actorId
      });
      // 1. Validate permission object
      const { ROLES, ENTITY_TYPES, validatePermission } = require('./permissions');
      const validation = validatePermission(permission);
      
      if (!validation.valid) {
        backendLogger.error('Permission validation failed', { error: validation.error, permission });
        return { success: false, error: validation.error, rollbackToken: null };
      }

      // 2. Check for duplicates (pre-check before expensive operations)
      const existingIndex = resource.permissions?.findIndex(p => 
        p._id.toString() === permission._id.toString() && 
        p.entity === permission.entity
      );

      if (existingIndex !== -1) {
        return { success: false, error: 'Permission already exists', rollbackToken: null };
      }

      // 3. Verify actor authorization
      const actorIdStr = actorId.toString();
      const isResourceOwner = await this._isOwner(actorIdStr, resource);
      const actor = this.models.User ? await this.models.User.findById(actorIdStr) : null;
      const isSuperAdminUser = actor ? require('./permissions').isSuperAdmin(actor) : false;
      
      // Special case: Allow users to add themselves as contributor (auto-assignment)
      const isSelfContributorAssignment = allowSelfContributor && 
        permission.type === 'contributor' && 
        permission.entity === 'user' &&
        permission._id.toString() === actorIdStr;

      if (!isResourceOwner && !isSuperAdminUser && !isSelfContributorAssignment) {
        backendLogger.warn('Unauthorized permission addition attempt', {
          actorId: actorIdStr,
          resourceId: resource._id,
          resourceType: resource.constructor.modelName,
          attemptedPermission: permission
        });
        return { success: false, error: 'Unauthorized: only owners can add permissions', rollbackToken: null };
      }

      // 4. Capture state before change
      const previousState = JSON.parse(JSON.stringify(resource.permissions || []));

      // 5. Initialize permissions array if needed
      if (!resource.permissions) {
        resource.permissions = [];
      }

      // 6. Reload resource from database to get latest state (race condition protection)
      // Use optimistic locking - reload and check version
      let freshResource;
      const originalVersion = resource.__v;
      
      try {
        const Model = resource.constructor;
        freshResource = await Model.findById(resource._id);
        if (!freshResource) {
          return { success: false, error: 'Resource not found', rollbackToken: null };
        }
        
        // Check if resource was modified by another operation (version changed)
        if (originalVersion !== undefined && freshResource.__v !== originalVersion) {
          backendLogger.warn('Resource modified by concurrent operation (version mismatch)', {
            resourceId: resource._id,
            originalVersion,
            currentVersion: freshResource.__v
          });
          // Resource was modified - need to re-validate
          // Check for duplicates in fresh data
          const freshDuplicateCheck = freshResource.permissions?.findIndex(p => 
            p._id.toString() === permission._id.toString() && 
            p.entity === permission.entity
          );
          
          if (freshDuplicateCheck !== -1) {
            return { success: false, error: 'Permission already exists', rollbackToken: null };
          }
        }
        
        // Final duplicate check in fresh data
        const freshDuplicateCheck = freshResource.permissions?.findIndex(p => 
          p._id.toString() === permission._id.toString() && 
          p.entity === permission.entity
        );
        
        if (freshDuplicateCheck !== -1) {
          backendLogger.warn('Race condition detected: duplicate found in database', {
            resourceId: resource._id,
            permissionId: permission._id
          });
          return { success: false, error: 'Permission already exists', rollbackToken: null };
        }
        
        // Update the passed-in resource object to match DB state
        resource.permissions = freshResource.permissions || [];
        resource.__v = freshResource.__v;
      } catch (reloadError) {
        backendLogger.error('Error reloading resource for race condition check', {
          error: reloadError.message,
          resourceId: resource._id
        });
        // Continue with existing resource if reload fails
      }

      // 7. Add permission with metadata
      // Ensure the permission._id is stored as an ObjectId instance in DB
      // (some callers may pass a string). Storing consistent types prevents
      // query mismatches when searching by ObjectId later.
      const permId = (typeof permission._id === 'string') ? new mongoose.Types.ObjectId(permission._id) : permission._id;
      const newPermission = {
        ...permission,
        _id: permId,
        granted_at: new Date(),
        granted_by: actorId
      };
      
      resource.permissions.push(newPermission);

      // 8. Save to database using atomic update to prevent "Can't save() the same doc multiple times in parallel" error
      backendLogger.info('ENFORCER: about to enter atomic update loop', {
        resourceId: resource._id,
        currentPermissionsCount: (resource.permissions || []).length,
        originalVersion
      });
      let saved = false;
      let saveAttempts = 0;
      const maxAttempts = 3;
      
      while (!saved && saveAttempts < maxAttempts) {
        try {
          // Use atomic $push to add permission (prevents parallel save conflicts)
          const Model = resource.constructor;
          const result = await Model.findOneAndUpdate(
            { 
              _id: resource._id,
              __v: resource.__v,  // Optimistic locking
              'permissions._id': { $ne: newPermission._id }  // Ensure no duplicate
            },
            { 
              $push: { permissions: newPermission },
              $inc: { __v: 1 }
            },
            { new: true }
          );
          
          if (result) {
            // Update local resource to match saved state
            resource.permissions = result.permissions;
            resource.__v = result.__v;
            saved = true;
            backendLogger.info('ENFORCER: atomic update succeeded', {
              resourceId: resource._id,
              newVersion: result.__v,
              permissionsCount: result.permissions.length
            });
          } else {
            // Update failed - either version conflict or duplicate
            saveAttempts++;
            
            if (saveAttempts < maxAttempts) {
              backendLogger.warn('Atomic update failed, retrying', {
                resourceId: resource._id,
                attempt: saveAttempts
              });
              
              // Reload and check for duplicate
              const freshResource = await Model.findById(resource._id);
              const dupCheck = freshResource.permissions?.findIndex(p => 
                p._id.toString() === permission._id.toString() && 
                p.entity === permission.entity
              );
              
              if (dupCheck !== -1) {
                // Duplicate was added by concurrent operation
                return { success: false, error: 'Permission already exists', rollbackToken: null };
              }
              
              // Update resource and retry
              resource.permissions = freshResource.permissions || [];
              resource.permissions.push(newPermission);
              resource.__v = freshResource.__v;
            } else {
              return { success: false, error: 'Failed to save permission after multiple attempts', rollbackToken: null };
            }
          }
        } catch (saveError) {
          saveAttempts++;
          backendLogger.error('Error saving permission', {
            error: saveError.message,
            resourceId: resource._id,
            attempt: saveAttempts
          });
          
          if (saveAttempts >= maxAttempts) {
            throw saveError;
          }
        }
      }

  backendLogger.info('ENFORCER: atomic update loop exited', { resourceId: resource._id, saved, saveAttempts });
      // 9. Capture state after change
      const newState = JSON.parse(JSON.stringify(resource.permissions));

      // 10. Generate rollback token
      const crypto = require('crypto');
      const rollbackToken = crypto.randomBytes(32).toString('hex');

      // 11. Create audit log
      backendLogger.info('ENFORCER: creating audit log', { resourceId: resource._id, action: 'permission_added' });
      const auditResult = await this._createAuditLog({
        action: 'permission_added',
        actor,
        resource,
        permission: newPermission,
        previousState,
        newState,
        reason,
        metadata,
        rollbackToken
      });

      backendLogger.info('ENFORCER: audit log created (result)', { success: !!auditResult.success, resourceId: resource._id });
      if (!auditResult.success) {
        backendLogger.error('Failed to create audit log', { error: auditResult.error });
        // Continue anyway - mutation succeeded but audit failed
      }

      backendLogger.info('Permission added successfully', {
        resourceType: resource.constructor.modelName,
        resourceId: resource._id,
        permissionEntity: permission.entity,
        permissionId: permission._id,
        actorId: actorIdStr,
        rollbackToken
      });

      return { success: true, error: null, rollbackToken };
    } catch (error) {
      backendLogger.error('Error adding permission', { error: error.message, stack: error.stack });
      return { success: false, error: error.message, rollbackToken: null };
    }
  }

  /**
   * Remove a permission from a resource (ONLY way to remove permissions)
   * @param {Object} options - Options object
   * @param {Object} options.resource - Resource to remove permission from
   * @param {string} options.permissionId - ID of the entity whose permission to remove
   * @param {string} options.entityType - Type of entity (user/destination/experience)
   * @param {string} options.actorId - User ID performing the action
   * @param {string} options.reason - Reason for removing permission
   * @param {Object} options.metadata - Request metadata
   * @returns {Promise<Object>} - { success: boolean, error: string|null, rollbackToken: string|null }
   */
  async removePermission({ resource, permissionId, entityType, actorId, reason, metadata = {} }) {
    try {
      // 1. Validate inputs
      if (!resource.permissions || !Array.isArray(resource.permissions)) {
        return { success: false, error: 'No permissions to remove', rollbackToken: null };
      }

      // 2. Find permission
      const index = resource.permissions.findIndex(p => 
        p._id.toString() === permissionId.toString() && 
        p.entity === entityType
      );

      if (index === -1) {
        return { success: false, error: 'Permission not found', rollbackToken: null };
      }

      // 3. Verify actor authorization
      const actorIdStr = actorId.toString();
      const isResourceOwner = await this._isOwner(actorIdStr, resource);
      const actor = this.models.User ? await this.models.User.findById(actorIdStr) : null;
      const isSuperAdminUser = actor ? require('./permissions').isSuperAdmin(actor) : false;

      if (!isResourceOwner && !isSuperAdminUser) {
        backendLogger.warn('Unauthorized permission removal attempt', {
          actorId: actorIdStr,
          resourceId: resource._id,
          resourceType: resource.constructor.modelName
        });
        return { success: false, error: 'Unauthorized: only owners can remove permissions', rollbackToken: null };
      }

      // 4. Check "at least one owner" rule
      const { ROLES } = require('./permissions');
      const permissionToRemove = resource.permissions[index];
      
      if (permissionToRemove.entity === 'user' && permissionToRemove.type === ROLES.OWNER) {
        const ownerCount = resource.permissions.filter(p => 
          p.entity === 'user' && p.type === ROLES.OWNER
        ).length;

        if (ownerCount <= 1) {
          return { 
            success: false, 
            error: 'Cannot remove last owner - resource must have at least one owner', 
            rollbackToken: null 
          };
        }
      }

      // 5. Capture state before change
      const previousState = JSON.parse(JSON.stringify(resource.permissions));

      // 6. Remove permission
      const removed = resource.permissions.splice(index, 1)[0];

      // 7. Capture state after change
      const newState = JSON.parse(JSON.stringify(resource.permissions));

      // 8. Generate rollback token
      const crypto = require('crypto');
      const rollbackToken = crypto.randomBytes(32).toString('hex');

      // 9. Create audit log
      const auditResult = await this._createAuditLog({
        action: 'permission_removed',
        actor,
        resource,
        permission: removed,
        previousState,
        newState,
        reason,
        metadata,
        rollbackToken
      });

      if (!auditResult.success) {
        backendLogger.error('Failed to create audit log', { error: auditResult.error });
      }

      backendLogger.info('Permission removed successfully', {
        resourceType: resource.constructor.modelName,
        resourceId: resource._id,
        removedPermission: removed,
        actorId: actorIdStr,
        rollbackToken
      });

      return { success: true, error: null, rollbackToken };
    } catch (error) {
      backendLogger.error('Error removing permission', { error: error.message, stack: error.stack });
      return { success: false, error: error.message, rollbackToken: null };
    }
  }

  /**
   * Update a permission type (ONLY way to update permissions)
   * @param {Object} options - Options object
   * @param {Object} options.resource - Resource containing the permission
   * @param {string} options.permissionId - ID of the entity whose permission to update
   * @param {string} options.entityType - Type of entity
   * @param {string} options.newType - New permission type (owner/collaborator/contributor)
   * @param {string} options.actorId - User ID performing the action
   * @param {string} options.reason - Reason for updating
   * @param {Object} options.metadata - Request metadata
   * @returns {Promise<Object>} - { success: boolean, error: string|null, rollbackToken: string|null }
   */
  async updatePermission({ resource, permissionId, entityType, newType, actorId, reason, metadata = {} }) {
    try {
      // Atomic operation: remove old + add new
      const removeResult = await this.removePermission({
        resource,
        permissionId,
        entityType,
        actorId,
        reason: `Update permission type to ${newType}: ${reason}`,
        metadata
      });

      if (!removeResult.success) {
        return removeResult;
      }

      const addResult = await this.addPermission({
        resource,
        permission: {
          _id: permissionId,
          entity: entityType,
          type: newType
        },
        actorId,
        reason: `Update permission type to ${newType}: ${reason}`,
        metadata
      });

      if (!addResult.success) {
        // Rollback the removal if add fails
        backendLogger.error('Permission update failed, attempting rollback', {
          removeRollbackToken: removeResult.rollbackToken
        });
        // Note: Rollback would be implemented in production
        return addResult;
      }

      return { success: true, error: null, rollbackToken: addResult.rollbackToken };
    } catch (error) {
      backendLogger.error('Error updating permission', { error: error.message, stack: error.stack });
      return { success: false, error: error.message, rollbackToken: null };
    }
  }

  /**
   * Transfer ownership (ONLY way to change owners)
   * @param {Object} options - Options object
   * @param {Object} options.resource - Resource to transfer
   * @param {string} options.oldOwnerId - Current owner user ID
   * @param {string} options.newOwnerId - New owner user ID
   * @param {string} options.actorId - User ID performing the action
   * @param {string} options.reason - Reason for transfer
   * @param {Object} options.metadata - Request metadata
   * @returns {Promise<Object>} - { success: boolean, error: string|null, rollbackToken: string|null }
   */
  async transferOwnership({ resource, oldOwnerId, newOwnerId, actorId, reason, metadata = {} }) {
    try {
      const { ROLES } = require('./permissions');

      // 1. Verify actor is current owner or super admin
      const actorIdStr = actorId.toString();
      // Normalize owner IDs to ObjectId instances when provided as strings
      const oldOwnerObjId = (typeof oldOwnerId === 'string') ? new mongoose.Types.ObjectId(oldOwnerId) : oldOwnerId;
      const newOwnerObjId = (typeof newOwnerId === 'string') ? new mongoose.Types.ObjectId(newOwnerId) : newOwnerId;
      const isCurrentOwner = oldOwnerObjId.toString() === actorIdStr;
      const actor = this.models.User ? await this.models.User.findById(actorIdStr) : null;
      const isSuperAdminUser = actor ? require('./permissions').isSuperAdmin(actor) : false;

      if (!isCurrentOwner && !isSuperAdminUser) {
        return { success: false, error: 'Unauthorized: only current owner can transfer ownership', rollbackToken: null };
      }

      // 2. Capture state before change
      const previousState = JSON.parse(JSON.stringify(resource.permissions || []));

      // 3. Remove old owner's owner permission, make them contributor
      const oldOwnerIndex = resource.permissions.findIndex(p => 
        p._id.toString() === oldOwnerObjId.toString() && 
        p.entity === 'user' &&
        p.type === ROLES.OWNER
      );

      if (oldOwnerIndex !== -1) {
        resource.permissions[oldOwnerIndex] = {
          _id: oldOwnerObjId,
          entity: 'user',
          type: ROLES.CONTRIBUTOR,
          granted_at: new Date(),
          granted_by: actorId
        };
      }

      // 4. Add or update new owner's permission
      const newOwnerIndex = resource.permissions.findIndex(p => 
        p._id.toString() === newOwnerObjId.toString() && 
        p.entity === 'user'
      );

      if (newOwnerIndex !== -1) {
        // Update existing permission to owner
        resource.permissions[newOwnerIndex] = {
          _id: newOwnerObjId,
          entity: 'user',
          type: ROLES.OWNER,
          granted_at: new Date(),
          granted_by: actorId
        };
      } else {
        // Add new owner permission
        resource.permissions.push({
          _id: newOwnerObjId,
          entity: 'user',
          type: ROLES.OWNER,
          granted_at: new Date(),
          granted_by: actorId
        });
      }

      // 5. Update user field
  resource.user = newOwnerObjId;

      // 6. Capture state after change
      const newState = JSON.parse(JSON.stringify(resource.permissions));

      // 7. Generate rollback token
      const crypto = require('crypto');
      const rollbackToken = crypto.randomBytes(32).toString('hex');

      // 8. Create audit log
      const auditResult = await this._createAuditLog({
        action: 'ownership_transferred',
        actor,
        resource,
        permission: {
          _id: newOwnerId,
          entity: 'user',
          type: ROLES.OWNER
        },
        previousState,
        newState,
        reason,
        metadata,
        rollbackToken
      });

      if (!auditResult.success) {
        backendLogger.error('Failed to create audit log', { error: auditResult.error });
      }

      backendLogger.info('Ownership transferred successfully', {
        resourceType: resource.constructor.modelName,
        resourceId: resource._id,
        oldOwnerId: oldOwnerId.toString(),
        newOwnerId: newOwnerId.toString(),
        actorId: actorIdStr,
        rollbackToken
      });

      return { success: true, error: null, rollbackToken };
    } catch (error) {
      backendLogger.error('Error transferring ownership', { error: error.message, stack: error.stack });
      return { success: false, error: error.message, rollbackToken: null };
    }
  }

  /**
   * Rollback a permission change using audit log
   * @param {Object} options - Options object
   * @param {string} options.rollbackToken - Token from original mutation
   * @param {string} options.actorId - User ID performing rollback
   * @param {string} options.reason - Reason for rollback
   * @returns {Promise<Object>} - { success: boolean, error: string|null }
   */
  async rollbackChange({ rollbackToken, actorId, reason }) {
    try {
      const Activity = require('../models/activity');
      
      const result = await Activity.restoreState(rollbackToken, actorId, reason);
      
      if (!result.success) {
        backendLogger.warn('Rollback failed', {
          rollbackToken,
          actorId,
          reason,
          error: result.error
        });
        return { success: false, error: result.error };
      }

      backendLogger.info('Successfully rolled back change', {
        rollbackToken,
        actorId,
        reason
      });

      return { success: true };
    } catch (error) {
      backendLogger.error('Error rolling back permission change', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get audit log for a resource
   * @param {Object} options - Options object
   * @param {Object} options.resource - Resource to get audit log for
   * @param {Date} options.startDate - Start date filter
   * @param {Date} options.endDate - End date filter
   * @param {string} options.actorId - Filter by actor
   * @returns {Promise<Array>} - Array of audit log entries
   */
  async getAuditLog({ resource, startDate, endDate, actorId }) {
    try {
      const Activity = require('../models/activity');

      const filters = {
        'resource.id': resource._id,
        'resource.type': resource.constructor.modelName
      };

      if (startDate || endDate) {
        filters.timestamp = {};
        if (startDate) filters.timestamp.$gte = startDate;
        if (endDate) filters.timestamp.$lte = endDate;
      }

      if (actorId) {
        filters['actor._id'] = actorId;
      }

      const activities = await Activity.find(filters)
        .sort({ timestamp: -1 })
        .lean();

      backendLogger.info('Audit log retrieved', {
        resourceType: resource.constructor.modelName,
        resourceId: resource._id,
        count: activities.length,
        startDate,
        endDate,
        actorId
      });

      return activities;
    } catch (error) {
      backendLogger.error('Error fetching audit log', { error: error.message });
      return [];
    }
  }

  /**
   * PRIVATE HELPER METHODS
   */

  /**
   * Check if user is owner of resource
   * @private
   */
  async _isOwner(userId, resource) {
    const { isOwner } = require('./permissions');
    return isOwner({ _id: userId }, resource);
  }

  /**
   * Create activity log entry
   * @private
   */
  async _createAuditLog({ action, actor, resource, permission, previousState, newState, reason, metadata, rollbackToken }) {
    try {
      const Activity = require('../models/activity');

      const activityData = {
        timestamp: new Date(),
        action,
        actor: {
          _id: actor._id,
          email: actor.email,
          name: actor.name,
          role: actor.role
        },
        resource: {
          id: resource._id,
          type: resource.constructor.modelName,
          name: resource.name || resource.title || null
        },
        permission: permission ? {
          _id: permission._id,
          entity: permission.entity,
          type: permission.type
        } : undefined,
        previousState,
        newState,
        reason: reason || 'No reason provided',
        metadata: {
          ipAddress: metadata.ipAddress || null,
          userAgent: metadata.userAgent || null,
          requestPath: metadata.requestPath || null,
          requestMethod: metadata.requestMethod || null
        },
        rollbackToken,
        tags: ['permission', action],
        status: 'success'
      };

      const activity = await Activity.log(activityData);
      
      if (!activity.success) {
        backendLogger.error('Failed to create activity log', { error: activity.error });
        return { success: false, error: activity.error };
      }
      
      return { success: true, activityId: activity.activity._id };
    } catch (error) {
      backendLogger.error('Failed to create activity log', {
        error: error.message,
        stack: error.stack,
        action,
        resourceId: resource._id
      });
      return { success: false, error: error.message };
    }
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
