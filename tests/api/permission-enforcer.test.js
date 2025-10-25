const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getEnforcer } = require('../../utilities/permission-enforcer');

// Mock models
const mockUser = {
  _id: new mongoose.Types.ObjectId(),
  email: 'test@example.com',
  role: 'regular_user',
  isSuperAdmin: false,
  emailConfirmed: true,
  provider: 'local'
};

const mockSuperAdmin = {
  _id: new mongoose.Types.ObjectId(),
  email: 'admin@example.com',
  role: 'super_admin',
  isSuperAdmin: true,
  emailConfirmed: true,
  provider: 'local'
};

const mockUnconfirmedUser = {
  _id: new mongoose.Types.ObjectId(),
  email: 'unconfirmed@example.com',
  role: 'regular_user',
  isSuperAdmin: false,
  emailConfirmed: false,
  provider: 'local'
};

const mockOAuthUser = {
  _id: new mongoose.Types.ObjectId(),
  email: 'oauth@example.com',
  role: 'regular_user',
  isSuperAdmin: false,
  emailConfirmed: false, // OAuth users are auto-confirmed
  provider: 'google'
};

const mockDestination = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Destination',
  permissions: [{
    _id: mockUser._id,
    entity: 'user',
    type: 'owner'
  }]
};

const mockExperience = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Test Experience',
  constructor: { modelName: 'Experience' },
  visibility: 'public', // Explicitly set visibility
  permissions: [{
    _id: mockUser._id,
    entity: 'user',
    type: 'owner'
  }, {
    _id: mockOAuthUser._id,
    entity: 'user',
    type: 'collaborator'
  }]
};

// Mock Mongoose models
const MockUser = {
  findById: jest.fn()
};

const MockDestination = jest.fn();
const MockExperience = jest.fn();

describe('PermissionEnforcer Tests', () => {
  let mongoServer;
  let enforcer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    enforcer = getEnforcer({
      User: MockUser,
      Destination: MockDestination,
      Experience: MockExperience
    });
  });

  describe('Super Admin Override', () => {
    test('should allow super admin to edit any resource', async () => {
      MockUser.findById.mockResolvedValue(mockSuperAdmin);

      const result = await enforcer.canEdit({
        userId: mockSuperAdmin._id,
        resource: mockDestination
      });

      expect(result.allowed).toBe(true);
      expect(result.role).toBe('owner');
      expect(MockUser.findById).toHaveBeenCalledWith(mockSuperAdmin._id.toString());
    });

    test('should allow super admin to delete any resource', async () => {
      MockUser.findById.mockResolvedValue(mockSuperAdmin);

      const result = await enforcer.canDelete({
        userId: mockSuperAdmin._id,
        resource: mockDestination
      });

      expect(result.allowed).toBe(true);
    });

    test('should allow super admin to manage permissions on any resource', async () => {
      MockUser.findById.mockResolvedValue(mockSuperAdmin);

      const result = await enforcer.canManagePermissions({
        userId: mockSuperAdmin._id,
        resource: mockDestination
      });

      expect(result.allowed).toBe(true);
    });

    test('should allow super admin to view any resource', async () => {
      MockUser.findById.mockResolvedValue(mockSuperAdmin);

      const result = await enforcer.canView({
        userId: mockSuperAdmin._id,
        resource: mockDestination
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Email Verification Enforcement', () => {
    test('should block edit action for unconfirmed email user', async () => {
      MockUser.findById.mockResolvedValue(mockUnconfirmedUser);

      const result = await enforcer.canEdit({
        userId: mockUnconfirmedUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Email verification required');
    });

    test('should block delete action for unconfirmed email user', async () => {
      MockUser.findById.mockResolvedValue(mockUnconfirmedUser);

      const result = await enforcer.canDelete({
        userId: mockUnconfirmedUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Email verification required');
    });

    test('should block manage permissions action for unconfirmed email user', async () => {
      MockUser.findById.mockResolvedValue(mockUnconfirmedUser);

      const result = await enforcer.canManagePermissions({
        userId: mockUnconfirmedUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Email verification required');
    });

    test('should allow view action for unconfirmed email user', async () => {
      MockUser.findById.mockResolvedValue(mockUnconfirmedUser);

      const result = await enforcer.canView({
        userId: mockUnconfirmedUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(true);
    });

    test('should bypass email verification for OAuth users', async () => {
      MockUser.findById.mockResolvedValue(mockOAuthUser);

      const result = await enforcer.canEdit({
        userId: mockOAuthUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(true);
    });

    test('should bypass email verification for super admin', async () => {
      MockUser.findById.mockResolvedValue(mockSuperAdmin);

      const result = await enforcer.canEdit({
        userId: mockSuperAdmin._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Regular User Permissions', () => {
    test('should allow owner to edit their resource', async () => {
      MockUser.findById.mockResolvedValue(mockUser);

      const result = await enforcer.canEdit({
        userId: mockUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(true);
      expect(result.role).toBe('owner');
    });

    test('should allow owner to delete their resource', async () => {
      MockUser.findById.mockResolvedValue(mockUser);

      const result = await enforcer.canDelete({
        userId: mockUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(true);
    });

    test('should allow owner to manage permissions on their resource', async () => {
      MockUser.findById.mockResolvedValue(mockUser);

      const result = await enforcer.canManagePermissions({
        userId: mockUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(true);
    });

    test('should allow owner to view their resource', async () => {
      MockUser.findById.mockResolvedValue(mockUser);

      const result = await enforcer.canView({
        userId: mockUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing userId', async () => {
      const result = await enforcer.can({
        resource: mockExperience,
        action: 'edit'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Missing required parameters');
    });

    test('should handle missing resource', async () => {
      const result = await enforcer.can({
        userId: mockUser._id,
        action: 'edit'
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Missing required parameters');
    });

    test('should handle missing action', async () => {
      const result = await enforcer.can({
        userId: mockUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Missing required parameters');
    });

    test('should handle database errors gracefully', async () => {
      MockUser.findById.mockRejectedValue(new Error('Database connection failed'));

      const result = await enforcer.canEdit({
        userId: mockUser._id,
        resource: mockExperience
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Error checking email verification');
    });
  });
});