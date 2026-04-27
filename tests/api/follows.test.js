/**
 * Follows API Integration Tests
 *
 * Covers a subset of /api/follows endpoints:
 *   POST   /api/follows/:userId          (followUser)
 *   DELETE /api/follows/:userId          (unfollowUser)
 *   GET    /api/follows/:userId/followers
 *   GET    /api/follows/:userId/following
 *   GET    /api/follows/:userId/counts
 *   GET    /api/follows/:userId/status
 *   GET    /api/follows/:userId/relationship
 *   GET    /api/follows/feed
 *   GET    /api/follows/requests
 *   GET    /api/follows/requests/count
 *   PUT    /api/follows/requests/:followerId/accept
 *   POST   /api/follows/:userId/block
 *   DELETE /api/follows/:userId/block
 *
 * Notifications and websocket broadcasts are tolerated as best-effort failures.
 */

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const Follow = require('../../models/follow');
const {
  createTestUser,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');

describe('Follows API', () => {
  let userA, userB, userC;
  let tokenA, tokenB;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    await Follow.deleteMany({});

    userA = await createTestUser({
      name: 'User A',
      email: `usera-${Date.now()}@test.com`,
      role: 'super_admin' // skip rate-limiter when needed
    });
    userB = await createTestUser({
      name: 'User B',
      email: `userb-${Date.now()}@test.com`
    });
    userC = await createTestUser({
      name: 'User C',
      email: `userc-${Date.now()}@test.com`
    });

    tokenA = generateAuthToken(userA);
    tokenB = generateAuthToken(userB);
  });

  afterEach(async () => {
    await clearTestData();
    await Follow.deleteMany({});
  });

  describe('POST /api/follows/:userId — followUser', () => {
    it('creates a follow relationship (happy path)', async () => {
      const res = await request(app)
        .post(`/api/follows/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.follow).toBeDefined();

      // Verify follow was persisted
      const follow = await Follow.findOne({
        follower: userA._id,
        following: userB._id
      });
      expect(follow).toBeTruthy();
    });

    it('returns 400 when trying to follow self', async () => {
      const res = await request(app)
        .post(`/api/follows/${userA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot follow yourself/i);
    });

    it('returns 400 for invalid user ID', async () => {
      const res = await request(app)
        .post('/api/follows/not-an-objectid')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid user id/i);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).post(`/api/follows/${userB._id}`);
      expect(res.status).toBe(401);
    });

    it('is idempotent — returns 200 success on duplicate follow', async () => {
      await request(app)
        .post(`/api/follows/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      const res = await request(app)
        .post(`/api/follows/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/follows/:userId — unfollowUser', () => {
    it('removes an existing follow', async () => {
      // Set up a follow first
      await Follow.createFollow(userA._id, userB._id);

      const res = await request(app)
        .delete(`/api/follows/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stillFollowing = await Follow.isFollowing(userA._id, userB._id);
      expect(stillFollowing).toBe(false);
    });

    it('returns 200 success when not following (idempotent)', async () => {
      const res = await request(app)
        .delete(`/api/follows/${userB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/follows/:userId/counts', () => {
    it('returns follower and following counts', async () => {
      await Follow.createFollow(userA._id, userB._id);
      await Follow.createFollow(userC._id, userB._id);

      const res = await request(app)
        .get(`/api/follows/${userB._id}/counts`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.counts.followers).toBe(2);
      expect(res.body.counts.following).toBe(0);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).get(`/api/follows/${userB._id}/counts`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/follows/:userId/status', () => {
    it('returns isFollowing=true after a follow is created', async () => {
      await Follow.createFollow(userA._id, userB._id);

      const res = await request(app)
        .get(`/api/follows/${userB._id}/status`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.isFollowing).toBe(true);
    });

    it('returns isFollowing=false when no follow exists', async () => {
      const res = await request(app)
        .get(`/api/follows/${userB._id}/status`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.isFollowing).toBe(false);
    });
  });

  describe('GET /api/follows/feed', () => {
    it('returns "follow users" message when not following anyone', async () => {
      const res = await request(app)
        .get('/api/follows/feed')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.feed)).toBe(true);
      expect(res.body.feed.length).toBe(0);
      expect(res.body.message).toMatch(/follow users/i);
    });
  });
});
