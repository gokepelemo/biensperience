/**
 * Invite Codes Test Suite
 *
 * Tests for invite code generation, validation, and redemption
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const User = require('../../models/user');
const InviteCode = require('../../models/inviteCode');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Plan = require('../../models/plan');
const jwt = require('jsonwebtoken');

let mongoServer;
let testUser;
let testUserToken;
let adminUser;
let adminToken;
let testExperience;
let testDestination;

/**
 * Setup: Start in-memory MongoDB and create test data
 */
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create admin user first (needed for permissions)
  adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    emailConfirmed: true,
    isSuperAdmin: true
  });

  // Create regular user
  testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    emailConfirmed: true
  });

  // Create test destination
  testDestination = await Destination.create({
    name: 'Paris',
    country: 'France',
    description: 'City of Light',
    permissions: [{
      _id: adminUser._id,
      entity: 'user',
      type: 'owner'
    }]
  });

  // Create test experience
  testExperience = await Experience.create({
    name: 'Eiffel Tower Visit',
    description: 'Visit the iconic Eiffel Tower',
    destination: testDestination._id,
    permissions: [{
      _id: adminUser._id,
      entity: 'user',
      type: 'owner'
    }]
  });

  // Generate JWT tokens
  testUserToken = jwt.sign({ user: testUser }, process.env.SECRET || 'test-secret');
  adminToken = jwt.sign({ user: adminUser }, process.env.SECRET || 'test-secret');
});

/**
 * Cleanup: Stop MongoDB and close connections
 */
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

/**
 * Reset: Clear invites before each test
 */
beforeEach(async () => {
  await InviteCode.deleteMany({});
});

describe('Invite Code Management', () => {
  describe('POST /api/invites - Create Invite', () => {
    test('should create a new invite code', async () => {
      const response = await request(app)
        .post('/api/invites')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          email: 'newuser@example.com',
          inviteeName: 'New User',
          experiences: [testExperience._id],
          destinations: [testDestination._id],
          maxUses: 1,
          customMessage: 'Welcome!'
        })
        .expect(201);

      expect(response.body).toHaveProperty('code');
      expect(response.body.code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
      expect(response.body.email).toBe('newuser@example.com');
      expect(response.body.inviteeName).toBe('New User');
      expect(response.body.experiences).toHaveLength(1);
      expect(response.body.destinations).toHaveLength(1);
      expect(response.body.customMessage).toBe('Welcome!');
    });

    test('should create invite without email restriction', async () => {
      const response = await request(app)
        .post('/api/invites')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          inviteeName: 'Anyone',
          maxUses: 10
        })
        .expect(201);

      expect(response.body.code).toBeTruthy();
      expect(response.body.email).toBeUndefined();
      expect(response.body.maxUses).toBe(10);
    });

    test('should generate unique codes', async () => {
      const codes = new Set();

      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/invites')
          .set('Authorization', `Bearer ${testUserToken}`)
          .send({ inviteeName: `User ${i}` })
          .expect(201);

        codes.add(response.body.code);
      }

      expect(codes.size).toBe(10); // All codes should be unique
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/invites')
        .send({ inviteeName: 'Test' })
        .expect(401);
    });
  });

  describe('POST /api/invites/bulk - Bulk Create', () => {
    test('should create multiple invites from array (super admin only)', async () => {
      const invites = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' },
        { email: 'user3@example.com', name: 'User 3' }
      ];

      const response = await request(app)
        .post('/api/invites/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ invites })
        .expect(201);

      expect(response.body.created).toHaveLength(3);
      expect(response.body.errors).toHaveLength(0);

      const codes = response.body.created.map(inv => inv.code);
      expect(new Set(codes).size).toBe(3); // All unique
    });

    test('should fail for non-admin users', async () => {
      const invites = [
        { email: 'user1@example.com', name: 'User 1' }
      ];

      await request(app)
        .post('/api/invites/bulk')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ invites })
        .expect(403);
    });

    test('should handle partial failures', async () => {
      // Create one invite manually to cause duplicate
      await InviteCode.create({
        code: 'ABC-DEF-GHI',
        createdBy: adminUser._id,
        email: 'duplicate@example.com',
        inviteeName: 'Duplicate',
        maxUses: 1
      });

      const invites = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: '', name: 'Invalid' }, // Missing email
        { email: 'user3@example.com', name: 'User 3' }
      ];

      const response = await request(app)
        .post('/api/invites/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ invites })
        .expect(201);

      expect(response.body.created.length).toBeGreaterThan(0);
      // Some may fail due to validation
    });

    test('should require non-empty array', async () => {
      await request(app)
        .post('/api/invites/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ invites: [] })
        .expect(400);
    });
  });

  describe('POST /api/invites/validate - Validate Invite', () => {
    let validInvite;

    beforeEach(async () => {
      validInvite = await InviteCode.create({
        code: 'ABC-DEF-GHI',
        createdBy: adminUser._id,
        email: 'specific@example.com',
        inviteeName: 'Specific User',
        maxUses: 1,
        isActive: true
      });
    });

    test('should validate a valid invite code (public endpoint)', async () => {
      const response = await request(app)
        .post('/api/invites/validate')
        .send({ code: 'ABC-DEF-GHI', email: 'specific@example.com' })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.inviteeName).toBe('Specific User');
    });

    test('should fail for invalid code', async () => {
      const response = await request(app)
        .post('/api/invites/validate')
        .send({ code: 'XXX-YYY-ZZZ' })
        .expect(400);

      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBeTruthy();
    });

    test('should fail for inactive code', async () => {
      await InviteCode.findByIdAndUpdate(validInvite._id, { isActive: false });

      const response = await request(app)
        .post('/api/invites/validate')
        .send({ code: 'ABC-DEF-GHI' })
        .expect(400);

      expect(response.body.valid).toBe(false);
    });

    test('should fail for expired code', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await InviteCode.findByIdAndUpdate(validInvite._id, { expiresAt: yesterday });

      const response = await request(app)
        .post('/api/invites/validate')
        .send({ code: 'ABC-DEF-GHI' })
        .expect(400);

      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    test('should fail when max uses reached', async () => {
      await InviteCode.findByIdAndUpdate(validInvite._id, {
        maxUses: 1,
        usedCount: 1
      });

      const response = await request(app)
        .post('/api/invites/validate')
        .send({ code: 'ABC-DEF-GHI' })
        .expect(400);

      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('maximum uses');
    });

    test('should fail for wrong email when email-restricted', async () => {
      const response = await request(app)
        .post('/api/invites/validate')
        .send({ code: 'ABC-DEF-GHI', email: 'wrong@example.com' })
        .expect(400);

      expect(response.body.valid).toBe(false);
      expect(response.body.error).toContain('different email');
    });

    test('should succeed without email for unrestricted code', async () => {
      const openInvite = await InviteCode.create({
        code: 'OPEN-INV-123',
        createdBy: adminUser._id,
        inviteeName: 'Anyone',
        maxUses: 10,
        isActive: true
      });

      const response = await request(app)
        .post('/api/invites/validate')
        .send({ code: 'OPEN-INV-123' })
        .expect(200);

      expect(response.body.valid).toBe(true);
    });
  });

  describe('POST /api/invites/redeem - Redeem Invite', () => {
    let redeemableInvite;

    beforeEach(async () => {
      redeemableInvite = await InviteCode.create({
        code: 'REDEEM-ME-NOW',
        createdBy: adminUser._id,
        inviteeName: 'Redeemer',
        experiences: [testExperience._id],
        destinations: [testDestination._id],
        maxUses: 1,
        usedCount: 0,
        isActive: true,
        customMessage: 'Welcome to Biensperience!'
      });
    });

    test('should redeem invite and add experiences/destinations', async () => {
      const response = await request(app)
        .post('/api/invites/redeem')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ code: 'REDEEM-ME-NOW' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.experiencesAdded).toHaveLength(1);
      expect(response.body.destinations).toHaveLength(1);
      expect(response.body.customMessage).toBe('Welcome to Biensperience!');

      // Verify invite was updated
      const updatedInvite = await InviteCode.findById(redeemableInvite._id);
      expect(updatedInvite.usedCount).toBe(1);
      expect(updatedInvite.redeemedBy).toContainEqual(testUser._id);

      // Verify plan was created
      const plan = await Plan.findOne({
        user: testUser._id,
        experience: testExperience._id
      });
      expect(plan).toBeTruthy();
    });

    test('should fail to redeem same code twice', async () => {
      // First redemption
      await request(app)
        .post('/api/invites/redeem')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ code: 'REDEEM-ME-NOW' })
        .expect(200);

      // Second redemption should fail
      const response = await request(app)
        .post('/api/invites/redeem')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ code: 'REDEEM-ME-NOW' })
        .expect(400);

      expect(response.body.error).toContain('already used');
    });

    test('should not create duplicate plans for existing experiences', async () => {
      // Create a plan manually first
      await Plan.create({
        user: testUser._id,
        experience: testExperience._id,
        items: [],
        permissions: [{
          entity: 'user',
          type: 'owner',
          _id: testUser._id
        }]
      });

      const response = await request(app)
        .post('/api/invites/redeem')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ code: 'REDEEM-ME-NOW' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.experiencesAdded).toHaveLength(0); // Not added (already exists)

      // Verify only one plan exists
      const plans = await Plan.find({
        user: testUser._id,
        experience: testExperience._id
      });
      expect(plans).toHaveLength(1);
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/invites/redeem')
        .send({ code: 'REDEEM-ME-NOW' })
        .expect(401);
    });

    test('should require code parameter', async () => {
      await request(app)
        .post('/api/invites/redeem')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/invites - List Invites', () => {
    beforeEach(async () => {
      // Create invites for test user
      await InviteCode.create({
        code: 'USER-INV-001',
        createdBy: testUser._id,
        inviteeName: 'User Invite 1'
      });

      await InviteCode.create({
        code: 'USER-INV-002',
        createdBy: testUser._id,
        inviteeName: 'User Invite 2'
      });

      // Create invite for admin
      await InviteCode.create({
        code: 'ADMIN-INV-001',
        createdBy: adminUser._id,
        inviteeName: 'Admin Invite'
      });
    });

    test('should list user\'s own invites', async () => {
      const response = await request(app)
        .get('/api/invites')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body.every(inv => inv.code.startsWith('USER-INV'))).toBe(true);
    });

    test('should list all invites for super admin', async () => {
      const response = await request(app)
        .get('/api/invites')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/invites')
        .expect(401);
    });
  });

  describe('DELETE /api/invites/:id - Deactivate Invite', () => {
    let inviteToDeactivate;

    beforeEach(async () => {
      inviteToDeactivate = await InviteCode.create({
        code: 'DEACT-ME-123',
        createdBy: testUser._id,
        inviteeName: 'Deactivate Me',
        isActive: true
      });
    });

    test('should deactivate own invite', async () => {
      const response = await request(app)
        .delete(`/api/invites/${inviteToDeactivate._id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deactivation
      const deactivated = await InviteCode.findById(inviteToDeactivate._id);
      expect(deactivated.isActive).toBe(false);
    });

    test('should allow super admin to deactivate any invite', async () => {
      const response = await request(app)
        .delete(`/api/invites/${inviteToDeactivate._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should not allow deactivating another user\'s invite', async () => {
      const adminInvite = await InviteCode.create({
        code: 'ADMIN-ONLY-123',
        createdBy: adminUser._id,
        inviteeName: 'Admin Only'
      });

      await request(app)
        .delete(`/api/invites/${adminInvite._id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);

      // Verify still active
      const stillActive = await InviteCode.findById(adminInvite._id);
      expect(stillActive.isActive).toBe(true);
    });

    test('should return 404 for non-existent invite', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .delete(`/api/invites/${fakeId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(404);
    });
  });

  describe('POST /api/invites/email - Email Invite', () => {
    test('should create invite for non-existent user', async () => {
      const response = await request(app)
        .post('/api/invites/email')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          email: 'newcollaborator@example.com',
          name: 'New Collaborator',
          resourceType: 'experience',
          resourceId: testExperience._id,
          resourceName: 'Eiffel Tower Visit',
          customMessage: 'Join me!'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.invite.code).toBeTruthy();
      expect(response.body.invite.email).toBe('newcollaborator@example.com');
      expect(response.body.invite.experiences).toContainEqual(testExperience._id);
    });

    test('should fail if user already exists', async () => {
      const response = await request(app)
        .post('/api/invites/email')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          email: testUser.email, // Existing user
          name: 'Test User',
          resourceType: 'experience',
          resourceId: testExperience._id,
          resourceName: 'Test'
        })
        .expect(400);

      expect(response.body.error).toContain('already exists');
    });

    test('should require all necessary fields', async () => {
      await request(app)
        .post('/api/invites/email')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          email: 'test@example.com'
          // Missing name, resourceType, resourceId
        })
        .expect(400);
    });
  });
});

describe('Invite Code Model Methods', () => {
  beforeEach(async () => {
    await InviteCode.deleteMany({});
  });

  test('should generate code in correct format', () => {
    const code = InviteCode.generateCode();
    expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
  });

  test('should generate unique codes', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(InviteCode.generateCode());
    }
    expect(codes.size).toBe(100);
  });

  test('should exclude confusing characters', () => {
    const confusingChars = ['0', 'O', '1', 'I'];
    const codes = Array(100).fill(null).map(() => InviteCode.generateCode());

    for (const code of codes) {
      for (const char of confusingChars) {
        expect(code).not.toContain(char);
      }
    }
  });

  test('should cleanup expired invites', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create expired invite
    await InviteCode.create({
      code: 'EXPIRED-123',
      createdBy: adminUser._id,
      inviteeName: 'Expired',
      expiresAt: yesterday,
      isActive: true
    });

    // Create valid invite
    await InviteCode.create({
      code: 'VALID-456',
      createdBy: adminUser._id,
      inviteeName: 'Valid',
      expiresAt: tomorrow,
      isActive: true
    });

    const deactivatedCount = await InviteCode.cleanupExpiredInvites();
    expect(deactivatedCount).toBe(1);

    const expired = await InviteCode.findOne({ code: 'EXPIRED-123' });
    expect(expired.isActive).toBe(false);

    const valid = await InviteCode.findOne({ code: 'VALID-456' });
    expect(valid.isActive).toBe(true);
  });
});

describe('Invite Code Edge Cases', () => {
  test('should handle very long custom messages', async () => {
    const longMessage = 'A'.repeat(5000);

    const invite = await InviteCode.createInvite({
      createdBy: adminUser._id,
      inviteeName: 'Test',
      customMessage: longMessage
    });

    expect(invite.customMessage).toBe(longMessage);
  });

  test('should handle special characters in names', async () => {
    const specialName = 'User with "quotes" & <tags> and émojis 🎉';

    const invite = await InviteCode.createInvite({
      createdBy: adminUser._id,
      inviteeName: specialName
    });

    expect(invite.inviteeName).toBe(specialName);
  });

  test('should handle concurrent redemptions', async () => {
    const invite = await InviteCode.create({
      code: 'CONCURRENT-TEST',
      createdBy: adminUser._id,
      inviteeName: 'Concurrent',
      maxUses: 1,
      usedCount: 0
    });

    // Try to redeem twice concurrently
    const promises = [
      InviteCode.redeemCode('CONCURRENT-TEST', testUser._id),
      InviteCode.redeemCode('CONCURRENT-TEST', adminUser._id)
    ];

    const results = await Promise.allSettled(promises);

    // One should succeed, one should fail
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    expect(successes).toBe(1);

    // Verify usage count is correct
    const updated = await InviteCode.findById(invite._id);
    expect(updated.usedCount).toBe(1);
  });
});
