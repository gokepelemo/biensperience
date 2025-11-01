const mongoose = require('mongoose');
const {
  ROLES,
  ENTITY_TYPES,
  validatePermission,
  validatePermissions,
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