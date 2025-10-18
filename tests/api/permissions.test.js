const mongoose = require('mongoose');
const {
  ROLES,
  ENTITY_TYPES,
  validatePermission,
  validatePermissions,
  addPermission,
  removePermission,
  updatePermissionType,
  isOwner,
  hasRole,
  canEdit
} = require('../../utilities/permissions');

// Mock mongoose models
const mockDestination = {
  _id: new mongoose.Types.ObjectId(),
  constructor: { modelName: 'Destination' },
  permissions: []
};

const mockExperience = {
  _id: new mongoose.Types.ObjectId(),
  constructor: { modelName: 'Experience' },
  permissions: []
};

const mockUser = {
  _id: new mongoose.Types.ObjectId(),
  isSuperAdmin: false
};

const mockSuperAdmin = {
  _id: new mongoose.Types.ObjectId(),
  isSuperAdmin: true
};

describe('Permissions Utility Tests', () => {
  describe('validatePermission', () => {
    test('should validate correct permission object', () => {
      const permission = {
        _id: mockUser._id,
        entity: ENTITY_TYPES.USER,
        type: ROLES.COLLABORATOR
      };

      const result = validatePermission(permission);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('should reject permission without _id', () => {
      const permission = {
        entity: ENTITY_TYPES.USER,
        type: ROLES.COLLABORATOR
      };

      const result = validatePermission(permission);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Permission must have an _id field');
    });

    test('should reject permission with invalid entity', () => {
      const permission = {
        _id: mockUser._id,
        entity: 'invalid_entity',
        type: ROLES.COLLABORATOR
      };

      const result = validatePermission(permission);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Permission entity must be one of');
    });
  });

  describe('addPermission', () => {
    test('should add valid permission', () => {
      const resource = { ...mockDestination };
      const permission = {
        _id: mockUser._id,
        entity: ENTITY_TYPES.USER,
        type: ROLES.COLLABORATOR
      };

      const result = addPermission(resource, permission);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(resource.permissions).toHaveLength(1);
      expect(resource.permissions[0]).toEqual(permission);
    });

    test('should reject duplicate permission', () => {
      const resource = {
        ...mockDestination,
        permissions: [{
          _id: mockUser._id,
          entity: ENTITY_TYPES.USER,
          type: ROLES.COLLABORATOR
        }]
      };
      const permission = {
        _id: mockUser._id,
        entity: ENTITY_TYPES.USER,
        type: ROLES.CONTRIBUTOR
      };

      const result = addPermission(resource, permission);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission already exists');
    });
  });

  describe('removePermission', () => {
    test('should remove existing permission', () => {
      const resource = {
        ...mockDestination,
        permissions: [{
          _id: mockUser._id,
          entity: ENTITY_TYPES.USER,
          type: ROLES.COLLABORATOR
        }]
      };

      const result = removePermission(resource, mockUser._id, ENTITY_TYPES.USER);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.removed).toEqual({
        _id: mockUser._id,
        entity: ENTITY_TYPES.USER,
        type: ROLES.COLLABORATOR
      });
      expect(resource.permissions).toHaveLength(0);
    });

    test('should return error for non-existent permission', () => {
      const resource = { 
        ...mockDestination, 
        permissions: [] // Explicitly set empty permissions
      };

      const result = removePermission(resource, mockUser._id, ENTITY_TYPES.USER);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission not found');
      expect(result.removed).toBeNull();
    });
  });

  describe('updatePermissionType', () => {
    test('should update permission type', () => {
      const resource = {
        ...mockDestination,
        permissions: [{
          _id: mockUser._id,
          entity: ENTITY_TYPES.USER,
          type: ROLES.CONTRIBUTOR
        }]
      };

      const result = updatePermissionType(resource, mockUser._id, ROLES.COLLABORATOR);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(resource.permissions[0].type).toBe(ROLES.COLLABORATOR);
    });

    test('should reject invalid role type', () => {
      const resource = {
        ...mockDestination,
        permissions: [{
          _id: mockUser._id,
          entity: ENTITY_TYPES.USER,
          type: ROLES.CONTRIBUTOR
        }]
      };

      const result = updatePermissionType(resource, mockUser._id, 'invalid_role');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid role type');
    });
  });

  describe('isOwner', () => {
    test('should return true for resource owner', () => {
      const resource = {
        ...mockDestination,
        user: mockUser._id
      };

      const result = isOwner(mockUser, resource);
      expect(result).toBe(true);
    });

    test('should return true for super admin', () => {
      const resource = {
        ...mockDestination,
        user: new mongoose.Types.ObjectId() // Different user
      };

      const result = isOwner(mockSuperAdmin, resource);
      expect(result).toBe(true); // Super admin should have owner access
    });

    test('should return false for non-owner non-super-admin', () => {
      const resource = {
        ...mockDestination,
        user: new mongoose.Types.ObjectId()
      };

      const result = isOwner(mockUser, resource);
      expect(result).toBe(false);
    });
  });

  describe('canEdit', () => {
    test('should allow super admin to edit any resource', async () => {
      const resource = {
        ...mockDestination,
        user: new mongoose.Types.ObjectId() // Different user
      };

      // For this test, we'll assume the database check works
      // In real usage, the User model would be provided by the controller
      const result = await canEdit(mockSuperAdmin._id, resource, { User: { findById: async () => mockSuperAdmin } });
      expect(result).toBe(true);
    });
  });
});