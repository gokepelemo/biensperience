/**
 * Frontend Permissions Utility Tests
 *
 * Tests for the frontend permissions utility:
 * - Role checks (isSuperAdmin, isOwner, isCollaborator, etc.)
 * - Action checks (canView, canEdit, canDelete, etc.)
 * - Resource-specific permission checks
 * - Utility functions
 *
 * Run with:
 * npm test -- tests/utils/permissions.test.js
 */

import {
  USER_ROLES,
  ROLES,
  ACTIONS,
  ROLE_PRIORITY,
  isSuperAdmin,
  getUserRole,
  isOwner,
  isCollaborator,
  isContributor,
  hasRole,
  canPerformAction,
  canView,
  canEdit,
  canDelete,
  canManagePermissions,
  canContribute,
  canEditPlan,
  canDeletePlan,
  canEditExperience,
  canEditDestination,
  getOwner,
  getCollaborators,
  getContributors,
  getAllPermissionedUsers,
  hasAnyPermission,
  getPermissionInfo
} from '../../src/utilities/permissions';

describe('Frontend Permissions Utility', () => {
  // Test user fixtures
  const superAdmin = {
    _id: 'admin123',
    name: 'Super Admin',
    role: USER_ROLES.SUPER_ADMIN
  };

  const regularUser = {
    _id: 'user123',
    name: 'Regular User',
    role: USER_ROLES.REGULAR_USER
  };

  const anotherUser = {
    _id: 'user456',
    name: 'Another User',
    role: USER_ROLES.REGULAR_USER
  };

  // Test resource fixtures
  const createResource = (ownerPerm, additionalPerms = []) => ({
    _id: 'resource123',
    name: 'Test Resource',
    permissions: [
      ownerPerm,
      ...additionalPerms
    ]
  });

  describe('isSuperAdmin', () => {
    test('should return true for super admin role', () => {
      expect(isSuperAdmin(superAdmin)).toBe(true);
    });

    test('should return true for isSuperAdmin flag', () => {
      const user = { _id: '123', isSuperAdmin: true };
      expect(isSuperAdmin(user)).toBe(true);
    });

    test('should return false for regular user', () => {
      expect(isSuperAdmin(regularUser)).toBe(false);
    });

    test('should return false for null user', () => {
      expect(isSuperAdmin(null)).toBe(false);
    });

    test('should return false for undefined user', () => {
      expect(isSuperAdmin(undefined)).toBe(false);
    });
  });

  describe('getUserRole', () => {
    test('should return owner role for owner permission', () => {
      const resource = createResource({
        _id: regularUser._id,
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(getUserRole(regularUser, resource)).toBe(ROLES.OWNER);
    });

    test('should return collaborator role for collaborator permission', () => {
      const resource = createResource(
        { _id: 'other123', entity: 'user', type: ROLES.OWNER },
        [{ _id: regularUser._id, entity: 'user', type: ROLES.COLLABORATOR }]
      );
      expect(getUserRole(regularUser, resource)).toBe(ROLES.COLLABORATOR);
    });

    test('should return contributor role for contributor permission', () => {
      const resource = createResource(
        { _id: 'other123', entity: 'user', type: ROLES.OWNER },
        [{ _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR }]
      );
      expect(getUserRole(regularUser, resource)).toBe(ROLES.CONTRIBUTOR);
    });

    test('should return owner role for super admin', () => {
      const resource = createResource({
        _id: 'other123',
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(getUserRole(superAdmin, resource)).toBe(ROLES.OWNER);
    });

    test('should return null for user without permission', () => {
      const resource = createResource({
        _id: 'other123',
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(getUserRole(regularUser, resource)).toBeNull();
    });

    test('should return null for null user', () => {
      const resource = createResource({
        _id: regularUser._id,
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(getUserRole(null, resource)).toBeNull();
    });

    test('should return highest priority role when user has multiple', () => {
      // User has both collaborator and contributor - should return collaborator
      const resource = {
        permissions: [
          { _id: 'other123', entity: 'user', type: ROLES.OWNER },
          { _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR },
          { _id: regularUser._id, entity: 'user', type: ROLES.COLLABORATOR }
        ]
      };
      expect(getUserRole(regularUser, resource)).toBe(ROLES.COLLABORATOR);
    });
  });

  describe('isOwner', () => {
    test('should return true for owner', () => {
      const resource = createResource({
        _id: regularUser._id,
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(isOwner(regularUser, resource)).toBe(true);
    });

    test('should return true for super admin', () => {
      const resource = createResource({
        _id: 'other123',
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(isOwner(superAdmin, resource)).toBe(true);
    });

    test('should return false for collaborator', () => {
      const resource = createResource(
        { _id: 'other123', entity: 'user', type: ROLES.OWNER },
        [{ _id: regularUser._id, entity: 'user', type: ROLES.COLLABORATOR }]
      );
      expect(isOwner(regularUser, resource)).toBe(false);
    });

    test('should return false for non-permissioned user', () => {
      const resource = createResource({
        _id: 'other123',
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(isOwner(regularUser, resource)).toBe(false);
    });
  });

  describe('isCollaborator', () => {
    test('should return true for owner', () => {
      const resource = createResource({
        _id: regularUser._id,
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(isCollaborator(regularUser, resource)).toBe(true);
    });

    test('should return true for collaborator', () => {
      const resource = createResource(
        { _id: 'other123', entity: 'user', type: ROLES.OWNER },
        [{ _id: regularUser._id, entity: 'user', type: ROLES.COLLABORATOR }]
      );
      expect(isCollaborator(regularUser, resource)).toBe(true);
    });

    test('should return false for contributor', () => {
      const resource = createResource(
        { _id: 'other123', entity: 'user', type: ROLES.OWNER },
        [{ _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR }]
      );
      expect(isCollaborator(regularUser, resource)).toBe(false);
    });

    test('should return true for super admin', () => {
      const resource = createResource({
        _id: 'other123',
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(isCollaborator(superAdmin, resource)).toBe(true);
    });
  });

  describe('isContributor', () => {
    test('should return true for any permission', () => {
      const resource = createResource(
        { _id: 'other123', entity: 'user', type: ROLES.OWNER },
        [{ _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR }]
      );
      expect(isContributor(regularUser, resource)).toBe(true);
    });

    test('should return true for owner', () => {
      const resource = createResource({
        _id: regularUser._id,
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(isContributor(regularUser, resource)).toBe(true);
    });

    test('should return false for no permission', () => {
      const resource = createResource({
        _id: 'other123',
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(isContributor(regularUser, resource)).toBe(false);
    });
  });

  describe('hasRole', () => {
    test('should return true if user has required role', () => {
      const resource = createResource({
        _id: regularUser._id,
        entity: 'user',
        type: ROLES.OWNER
      });
      expect(hasRole(regularUser, resource, ROLES.OWNER)).toBe(true);
      expect(hasRole(regularUser, resource, ROLES.COLLABORATOR)).toBe(true);
      expect(hasRole(regularUser, resource, ROLES.CONTRIBUTOR)).toBe(true);
    });

    test('should return false if user has lower role', () => {
      const resource = createResource(
        { _id: 'other123', entity: 'user', type: ROLES.OWNER },
        [{ _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR }]
      );
      expect(hasRole(regularUser, resource, ROLES.OWNER)).toBe(false);
      expect(hasRole(regularUser, resource, ROLES.COLLABORATOR)).toBe(false);
      expect(hasRole(regularUser, resource, ROLES.CONTRIBUTOR)).toBe(true);
    });
  });

  describe('Action Checks', () => {
    describe('canView', () => {
      test('should return true for public resources', () => {
        const resource = { public: true, permissions: [] };
        expect(canView(regularUser, resource)).toBe(true);
      });

      test('should return true for any permission', () => {
        const resource = createResource(
          { _id: 'other123', entity: 'user', type: ROLES.OWNER },
          [{ _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR }]
        );
        expect(canView(regularUser, resource)).toBe(true);
      });

      test('should return false for private resource without permission', () => {
        const resource = createResource({
          _id: 'other123',
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(canView(regularUser, resource)).toBe(false);
      });
    });

    describe('canEdit', () => {
      test('should return true for owner', () => {
        const resource = createResource({
          _id: regularUser._id,
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(canEdit(regularUser, resource)).toBe(true);
      });

      test('should return true for collaborator', () => {
        const resource = createResource(
          { _id: 'other123', entity: 'user', type: ROLES.OWNER },
          [{ _id: regularUser._id, entity: 'user', type: ROLES.COLLABORATOR }]
        );
        expect(canEdit(regularUser, resource)).toBe(true);
      });

      test('should return false for contributor', () => {
        const resource = createResource(
          { _id: 'other123', entity: 'user', type: ROLES.OWNER },
          [{ _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR }]
        );
        expect(canEdit(regularUser, resource)).toBe(false);
      });
    });

    describe('canDelete', () => {
      test('should return true for owner', () => {
        const resource = createResource({
          _id: regularUser._id,
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(canDelete(regularUser, resource)).toBe(true);
      });

      test('should return false for collaborator', () => {
        const resource = createResource(
          { _id: 'other123', entity: 'user', type: ROLES.OWNER },
          [{ _id: regularUser._id, entity: 'user', type: ROLES.COLLABORATOR }]
        );
        expect(canDelete(regularUser, resource)).toBe(false);
      });

      test('should return true for super admin', () => {
        const resource = createResource({
          _id: 'other123',
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(canDelete(superAdmin, resource)).toBe(true);
      });
    });

    describe('canManagePermissions', () => {
      test('should return true for owner', () => {
        const resource = createResource({
          _id: regularUser._id,
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(canManagePermissions(regularUser, resource)).toBe(true);
      });

      test('should return false for collaborator', () => {
        const resource = createResource(
          { _id: 'other123', entity: 'user', type: ROLES.OWNER },
          [{ _id: regularUser._id, entity: 'user', type: ROLES.COLLABORATOR }]
        );
        expect(canManagePermissions(regularUser, resource)).toBe(false);
      });
    });
  });

  describe('Convenience Functions', () => {
    describe('canEditPlan', () => {
      test('should behave like canEdit', () => {
        const plan = createResource({
          _id: regularUser._id,
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(canEditPlan(regularUser, plan)).toBe(true);
      });
    });

    describe('canEditDestination', () => {
      test('should check legacy user field', () => {
        const destination = {
          user: regularUser._id,
          permissions: []
        };
        expect(canEditDestination(regularUser, destination)).toBe(true);
      });

      test('should return false for different user', () => {
        const destination = {
          user: 'other123',
          permissions: []
        };
        expect(canEditDestination(regularUser, destination)).toBe(false);
      });
    });
  });

  describe('Utility Functions', () => {
    describe('getOwner', () => {
      test('should return owner information', () => {
        const resource = createResource({
          _id: regularUser._id,
          entity: 'user',
          type: ROLES.OWNER,
          user: { name: 'Test User' }
        });
        const owner = getOwner(resource);
        expect(owner._id).toBe(regularUser._id);
        expect(owner.name).toBe('Test User');
      });

      test('should return null if no owner', () => {
        const resource = { permissions: [] };
        expect(getOwner(resource)).toBeNull();
      });

      test('should return null for null resource', () => {
        expect(getOwner(null)).toBeNull();
      });
    });

    describe('getCollaborators', () => {
      test('should return array of collaborators', () => {
        const resource = createResource(
          { _id: 'owner123', entity: 'user', type: ROLES.OWNER },
          [
            { _id: 'collab1', entity: 'user', type: ROLES.COLLABORATOR },
            { _id: 'collab2', entity: 'user', type: ROLES.COLLABORATOR }
          ]
        );
        const collaborators = getCollaborators(resource);
        expect(collaborators.length).toBe(2);
      });

      test('should return empty array if none', () => {
        const resource = createResource({
          _id: 'owner123',
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(getCollaborators(resource)).toEqual([]);
      });
    });

    describe('getContributors', () => {
      test('should return array of contributors', () => {
        const resource = createResource(
          { _id: 'owner123', entity: 'user', type: ROLES.OWNER },
          [{ _id: 'contrib1', entity: 'user', type: ROLES.CONTRIBUTOR }]
        );
        const contributors = getContributors(resource);
        expect(contributors.length).toBe(1);
      });
    });

    describe('getAllPermissionedUsers', () => {
      test('should return all user permissions', () => {
        const resource = createResource(
          { _id: 'owner123', entity: 'user', type: ROLES.OWNER },
          [
            { _id: 'collab1', entity: 'user', type: ROLES.COLLABORATOR },
            { _id: 'contrib1', entity: 'user', type: ROLES.CONTRIBUTOR }
          ]
        );
        const users = getAllPermissionedUsers(resource);
        expect(users.length).toBe(3);
      });
    });

    describe('hasAnyPermission', () => {
      test('should return true if user has any permission', () => {
        const resource = createResource(
          { _id: 'owner123', entity: 'user', type: ROLES.OWNER },
          [{ _id: regularUser._id, entity: 'user', type: ROLES.CONTRIBUTOR }]
        );
        expect(hasAnyPermission(regularUser._id, resource)).toBe(true);
      });

      test('should return false if user has no permission', () => {
        const resource = createResource({
          _id: 'owner123',
          entity: 'user',
          type: ROLES.OWNER
        });
        expect(hasAnyPermission(regularUser._id, resource)).toBe(false);
      });
    });

    describe('getPermissionInfo', () => {
      test('should return comprehensive permission info', () => {
        const resource = createResource({
          _id: regularUser._id,
          entity: 'user',
          type: ROLES.OWNER
        });
        const info = getPermissionInfo(regularUser, resource);

        expect(info.role).toBe(ROLES.OWNER);
        expect(info.isOwner).toBe(true);
        expect(info.isCollaborator).toBe(true);
        expect(info.isContributor).toBe(true);
        expect(info.isSuperAdmin).toBe(false);
        expect(info.canView).toBe(true);
        expect(info.canEdit).toBe(true);
        expect(info.canDelete).toBe(true);
        expect(info.canManagePermissions).toBe(true);
        expect(info.canContribute).toBe(true);
      });

      test('should return super admin info', () => {
        const resource = createResource({
          _id: 'other123',
          entity: 'user',
          type: ROLES.OWNER
        });
        const info = getPermissionInfo(superAdmin, resource);

        expect(info.isSuperAdmin).toBe(true);
        expect(info.isOwner).toBe(true);
        expect(info.canDelete).toBe(true);
      });
    });
  });

  describe('Constants', () => {
    test('ROLE_PRIORITY should have correct values', () => {
      expect(ROLE_PRIORITY[ROLES.OWNER]).toBe(100);
      expect(ROLE_PRIORITY[ROLES.COLLABORATOR]).toBe(50);
      expect(ROLE_PRIORITY[ROLES.CONTRIBUTOR]).toBe(10);
    });

    test('ACTIONS should have all required actions', () => {
      expect(ACTIONS.VIEW).toBe('view');
      expect(ACTIONS.EDIT).toBe('edit');
      expect(ACTIONS.DELETE).toBe('delete');
      expect(ACTIONS.MANAGE_PERMISSIONS).toBe('manage_permissions');
      expect(ACTIONS.CONTRIBUTE).toBe('contribute');
    });
  });
});
