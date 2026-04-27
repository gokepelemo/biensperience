/**
 * Invite Tracking API Integration Tests
 *
 * Covers:
 *  - GET /api/invite-tracking/my-invites
 *  - GET /api/invite-tracking/invite/:code
 *  - GET /api/invite-tracking/users-by-invite (super admin only)
 *  - GET /api/invite-tracking/analytics
 *
 * Auth-only routes; super-admin gates verified.
 */

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const InviteCode = require('../../models/inviteCode');
const User = require('../../models/user');
const {
  createTestUser,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');

describe('Invite Tracking API', () => {
  let regularUser;
  let regularToken;
  let superAdmin;
  let superAdminToken;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    await InviteCode.deleteMany({});

    regularUser = await createTestUser({
      email: `regular-${Date.now()}@test.com`
    });
    regularToken = generateAuthToken(regularUser);

    superAdmin = await createTestUser({
      email: `admin-${Date.now()}@test.com`,
      role: 'super_admin'
    });
    superAdminToken = generateAuthToken(superAdmin);
  });

  afterEach(async () => {
    await clearTestData();
    await InviteCode.deleteMany({});
  });

  describe('GET /api/invite-tracking/my-invites', () => {
    it('returns invites created by the requesting user (happy path)', async () => {
      await InviteCode.create({
        code: 'CODEONE',
        createdBy: regularUser._id,
        maxUses: 5,
        isActive: true
      });
      await InviteCode.create({
        code: 'CODETWO',
        createdBy: superAdmin._id,
        maxUses: 1,
        isActive: true
      });

      const res = await request(app)
        .get('/api/invite-tracking/my-invites')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.invites)).toBe(true);
      expect(res.body.invites.length).toBe(1);
      expect(res.body.invites[0].code).toBe('CODEONE');
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalInvites).toBe(1);
      expect(res.body.stats.activeInvites).toBe(1);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/invite-tracking/my-invites');
      expect(res.status).toBe(401);
    });

    it('returns ALL invites when requested by super admin', async () => {
      await InviteCode.create({
        code: 'ABCONE',
        createdBy: regularUser._id,
        isActive: true
      });
      await InviteCode.create({
        code: 'XYZTWO',
        createdBy: superAdmin._id,
        isActive: true
      });

      const res = await request(app)
        .get('/api/invite-tracking/my-invites')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.invites.length).toBe(2);
    });
  });

  describe('GET /api/invite-tracking/invite/:code', () => {
    it('returns details for an invite owned by the requesting user', async () => {
      await InviteCode.create({
        code: 'OWNED1',
        createdBy: regularUser._id,
        maxUses: 10,
        usedCount: 3,
        isActive: true
      });

      const res = await request(app)
        .get('/api/invite-tracking/invite/OWNED1')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('OWNED1');
      expect(res.body.usagePercentage).toBe('30.0');
      expect(res.body.isAvailable).toBe(true);
    });

    it('returns 404 when invite does not belong to user (regular user)', async () => {
      await InviteCode.create({
        code: 'OTHERS',
        createdBy: superAdmin._id,
        isActive: true
      });

      const res = await request(app)
        .get('/api/invite-tracking/invite/OTHERS')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  describe('GET /api/invite-tracking/users-by-invite', () => {
    it('returns 403 for non-super-admin users', async () => {
      const res = await request(app)
        .get('/api/invite-tracking/users-by-invite')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it('returns users-with-invite info for super admin (happy path)', async () => {
      // Create a user with inviteCode field set
      await User.create({
        name: 'Invitee',
        email: `invitee-${Date.now()}@test.com`,
        password: 'password123',
        emailConfirmed: true,
        inviteCode: 'PROMO1'
      });
      await InviteCode.create({
        code: 'PROMO1',
        createdBy: superAdmin._id,
        isActive: true
      });

      const res = await request(app)
        .get('/api/invite-tracking/users-by-invite')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('uniqueInviteCodes');
    });
  });

  describe('GET /api/invite-tracking/analytics', () => {
    it('returns analytics object with all expected fields', async () => {
      await InviteCode.create({
        code: 'ANALY1',
        createdBy: regularUser._id,
        isActive: true,
        maxUses: 5,
        usedCount: 2
      });

      const res = await request(app)
        .get('/api/invite-tracking/analytics')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalInvites');
      expect(res.body).toHaveProperty('activeInvites');
      expect(res.body).toHaveProperty('totalRedemptions');
      expect(res.body).toHaveProperty('redemptionsLast7Days');
      expect(res.body).toHaveProperty('redemptionsLast30Days');
      expect(res.body).toHaveProperty('redemptionRate');
      expect(res.body.totalInvites).toBe(1);
      expect(res.body.totalRedemptions).toBe(2);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/invite-tracking/analytics');
      expect(res.status).toBe(401);
    });
  });
});
