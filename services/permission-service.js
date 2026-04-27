/**
 * Permission Service
 *
 * Centralizes the mutation logic for adding, removing, and transferring
 * permissions on resources. This is the substrate the PermissionEnforcer
 * delegates to so its public API does not need to inline-require the
 * lower-level `utilities/permissions` module.
 *
 * Service rules:
 *  - Depends on models + utilities only (never on controllers).
 *  - Stateless module exporting plain async functions.
 *  - Returns plain `{ success, error, ... }` shapes — no Express types.
 *
 * @module services/permission-service
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const backendLogger = require('../utilities/backend-logger');
const {
  ROLES,
  ENTITY_TYPES,
  validatePermission,
  isSuperAdmin
} = require('../utilities/permissions');

const MAX_SAVE_ATTEMPTS = 3;

/**
 * Add a permission to a resource using optimistic-locking + atomic $push.
 *
 * The PermissionEnforcer calls this from `addPermission()`. All authorization
 * (owner check, super-admin override, self-contributor allowance) is done
 * by the enforcer before delegation; this service performs the validation
 * and database mutation.
 *
 * @param {object} options
 * @param {object} options.resource - Mongoose document being mutated.
 * @param {object} options.permission - Permission to add: { _id, entity, type }.
 * @param {string|object} options.actorId - User performing the action.
 * @returns {Promise<{ success: boolean, error: string|null, newPermission: object|null, previousState: array|null, newState: array|null, rollbackToken: string|null }>}
 */
async function addPermissionToResource({ resource, permission, actorId }) {
  // 1. Validate permission shape
  const validation = validatePermission(permission);
  if (!validation.valid) {
    backendLogger.error('Permission validation failed', { error: validation.error, permission });
    return { success: false, error: validation.error, newPermission: null, previousState: null, newState: null, rollbackToken: null };
  }

  // 2. Pre-check duplicate against in-memory state
  const existingIndex = resource.permissions?.findIndex(p =>
    p._id.toString() === permission._id.toString() &&
    p.entity === permission.entity
  );

  if (existingIndex !== -1) {
    return { success: false, error: 'Permission already exists', newPermission: null, previousState: null, newState: null, rollbackToken: null };
  }

  // 3. Snapshot state for audit
  const previousState = JSON.parse(JSON.stringify(resource.permissions || []));

  if (!resource.permissions) {
    resource.permissions = [];
  }

  // 4. Reload from DB to detect concurrent mutations (optimistic lock)
  const originalVersion = resource.__v;
  try {
    const Model = resource.constructor;
    const freshResource = await Model.findById(resource._id);
    if (!freshResource) {
      return { success: false, error: 'Resource not found', newPermission: null, previousState: null, newState: null, rollbackToken: null };
    }

    if (originalVersion !== undefined && freshResource.__v !== originalVersion) {
      backendLogger.warn('Resource modified by concurrent operation (version mismatch)', {
        resourceId: resource._id,
        originalVersion,
        currentVersion: freshResource.__v
      });
    }

    const freshDuplicateCheck = freshResource.permissions?.findIndex(p =>
      p._id.toString() === permission._id.toString() &&
      p.entity === permission.entity
    );

    if (freshDuplicateCheck !== -1) {
      backendLogger.warn('Race condition detected: duplicate found in database', {
        resourceId: resource._id,
        permissionId: permission._id
      });
      return { success: false, error: 'Permission already exists', newPermission: null, previousState: null, newState: null, rollbackToken: null };
    }

    resource.permissions = freshResource.permissions || [];
    resource.__v = freshResource.__v;
  } catch (reloadError) {
    backendLogger.error('Error reloading resource for race condition check', {
      error: reloadError.message,
      resourceId: resource._id
    });
    // Continue with existing state
  }

  // 5. Build the new permission (normalising _id to ObjectId)
  const permId = (typeof permission._id === 'string')
    ? new mongoose.Types.ObjectId(permission._id)
    : permission._id;
  const newPermission = {
    ...permission,
    _id: permId,
    granted_at: new Date(),
    granted_by: actorId
  };

  resource.permissions.push(newPermission);

  // 6. Atomic update with retry-on-version-conflict
  backendLogger.info('PERMISSION-SERVICE: about to enter atomic update loop', {
    resourceId: resource._id,
    currentPermissionsCount: (resource.permissions || []).length,
    originalVersion
  });

  let saved = false;
  let saveAttempts = 0;

  while (!saved && saveAttempts < MAX_SAVE_ATTEMPTS) {
    try {
      const Model = resource.constructor;
      const result = await Model.findOneAndUpdate(
        {
          _id: resource._id,
          __v: resource.__v,
          'permissions._id': { $ne: newPermission._id }
        },
        {
          $push: { permissions: newPermission },
          $inc: { __v: 1 }
        },
        { new: true }
      );

      if (result) {
        resource.permissions = result.permissions;
        resource.__v = result.__v;
        saved = true;
        backendLogger.info('PERMISSION-SERVICE: atomic update succeeded', {
          resourceId: resource._id,
          newVersion: result.__v,
          permissionsCount: result.permissions.length
        });
      } else {
        saveAttempts++;
        if (saveAttempts < MAX_SAVE_ATTEMPTS) {
          backendLogger.warn('Atomic update failed, retrying', {
            resourceId: resource._id,
            attempt: saveAttempts
          });
          const freshResource = await Model.findById(resource._id);
          const dupCheck = freshResource.permissions?.findIndex(p =>
            p._id.toString() === permission._id.toString() &&
            p.entity === permission.entity
          );
          if (dupCheck !== -1) {
            return { success: false, error: 'Permission already exists', newPermission: null, previousState: null, newState: null, rollbackToken: null };
          }
          resource.permissions = freshResource.permissions || [];
          resource.permissions.push(newPermission);
          resource.__v = freshResource.__v;
        } else {
          return { success: false, error: 'Failed to save permission after multiple attempts', newPermission: null, previousState: null, newState: null, rollbackToken: null };
        }
      }
    } catch (saveError) {
      saveAttempts++;
      backendLogger.error('Error saving permission', {
        error: saveError.message,
        resourceId: resource._id,
        attempt: saveAttempts
      });
      if (saveAttempts >= MAX_SAVE_ATTEMPTS) {
        throw saveError;
      }
    }
  }

  backendLogger.info('PERMISSION-SERVICE: atomic update loop exited', {
    resourceId: resource._id,
    saved,
    saveAttempts
  });

  const newState = JSON.parse(JSON.stringify(resource.permissions));
  const rollbackToken = crypto.randomBytes(32).toString('hex');

  return { success: true, error: null, newPermission, previousState, newState, rollbackToken };
}

/**
 * Helper to expose super-admin check without enforcer needing to inline-require
 * the permissions module.
 *
 * @param {object} user
 * @returns {boolean}
 */
function checkSuperAdmin(user) {
  return isSuperAdmin(user);
}

module.exports = {
  addPermissionToResource,
  checkSuperAdmin,
  // Re-export shared constants so callers can rely on the service surface
  ROLES,
  ENTITY_TYPES
};
