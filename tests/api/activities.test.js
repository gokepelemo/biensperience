/**
 * Activities API Integration Tests
 *
 * Covers:
 *   GET  /api/activities                          (super admin only)
 *   GET  /api/activities/stats                    (super admin only)
 *   GET  /api/activities/resource/:resourceId
 *   GET  /api/activities/actor/:actorId
 *   POST /api/activities/restore/:rollbackToken   (super admin only)
 *
 * Authentication and super-admin gating verified.
 */

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const Activity = require('../../models/activity');
const {
  createTestUser,
  createTestExperience,
  createTestDestination,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');

describe('Activities API', () => {
  let regularUser;
  let regularToken;
  let superAdmin;
  let superAdminToken;
  let destination;
  let experience;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    await Activity.deleteMany({});

    regularUser = await createTestUser({
      email: `regular-act-${Date.now()}@test.com`
    });
    regularToken = generateAuthToken(regularUser);

    superAdmin = await createTestUser({
      email: `admin-act-${Date.now()}@test.com`,
      role: 'super_admin'
    });
    superAdminToken = generateAuthToken(superAdmin);

    destination = await createTestDestination(superAdmin);
    experience = await createTestExperience(superAdmin, destination);
  });

  afterEach(async () => {
    await clearTestData();
    await Activity.deleteMany({});
  });

  describe('GET /api/activities — getAllActivities', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/activities');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-super-admin users', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('returns activities list for super admin (happy path)', async () => {
      // Seed an activity
      await Activity.log({
        action: 'resource_created',
        actor: { _id: superAdmin._id, name: superAdmin.name, email: superAdmin.email, role: 'super_admin' },
        resource: { id: experience._id, type: 'Experience', name: experience.name },
        reason: 'Created in test setup'
      });

      const res = await request(app)
        .get('/api/activities')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.activities)).toBe(true);
      expect(res.body.activities.length).toBeGreaterThanOrEqual(1);
      expect(res.body).toHaveProperty('totalCount');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('totalPages');
    });

    it('rejects invalid resourceType filter with 400', async () => {
      const res = await request(app)
        .get('/api/activities?resourceType=NotAType')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid resourcetype/i);
    });
  });

  describe('GET /api/activities/stats — getActivityStats', () => {
    it('returns aggregated stats for super admin', async () => {
      await Activity.log({
        action: 'resource_created',
        actor: { _id: superAdmin._id, name: superAdmin.name, email: superAdmin.email, role: 'super_admin' },
        resource: { id: experience._id, type: 'Experience', name: experience.name },
        reason: 'Stats seed'
      });

      const res = await request(app)
        .get('/api/activities/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats).toHaveProperty('totalActivities');
      expect(res.body.stats).toHaveProperty('byAction');
      expect(res.body.stats).toHaveProperty('byResourceType');
      expect(res.body.stats).toHaveProperty('byStatus');
      expect(res.body.stats).toHaveProperty('recentActivities');
    });

    it('returns 403 for non-super-admin users', async () => {
      const res = await request(app)
        .get('/api/activities/stats')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/activities/actor/:actorId — getActorHistory', () => {
    it('returns history when user requests their own activity', async () => {
      await Activity.log({
        action: 'resource_created',
        actor: { _id: regularUser._id, name: regularUser.name, email: regularUser.email, role: 'regular_user' },
        resource: { id: new mongoose.Types.ObjectId(), type: 'Experience', name: 'Self activity' },
        reason: 'Self test'
      });

      const res = await request(app)
        .get(`/api/activities/actor/${regularUser._id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.history)).toBe(true);
    });

    it('returns 403 when user requests another user\'s activity (not super admin)', async () => {
      const res = await request(app)
        .get(`/api/activities/actor/${superAdmin._id}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid actor ID', async () => {
      const res = await request(app)
        .get('/api/activities/actor/not-an-id')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid actor id/i);
    });
  });

  describe('POST /api/activities/restore/:rollbackToken — restoreResourceState', () => {
    it('returns 403 for non-super-admin users', async () => {
      // 64-char hex token — passes length check, then permission check fires first
      const fakeToken = 'a'.repeat(64);

      const res = await request(app)
        .post(`/api/activities/restore/${fakeToken}`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 400 for malformed (too-short) rollback token', async () => {
      const res = await request(app)
        .post('/api/activities/restore/short-token')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid rollback token/i);
    });

    it('returns 400 when rollback token has correct length but no matching activity', async () => {
      const fakeToken = 'b'.repeat(64);

      const res = await request(app)
        .post(`/api/activities/restore/${fakeToken}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      // restoreState returns { success: false } for unknown token → 400
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
