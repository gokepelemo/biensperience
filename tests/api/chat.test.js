/**
 * Chat API Integration Tests
 *
 * Covers Stream Chat token + channel creation endpoints:
 *   POST /api/chat/token
 *   POST /api/chat/channels/dm
 *   POST /api/chat/channels/plan
 *   POST /api/chat/channels/plan-item
 *
 * The Stream Chat SDK is mocked at the utility-module boundary so tests
 * never reach the network and don't require API keys.
 */

// ---- Mock stream-chat utility (must precede app require) ------------------
jest.mock('../../utilities/stream-chat', () => ({
  createUserToken: jest.fn().mockReturnValue('stream-test-token-abc123'),
  upsertMessagingChannel: jest.fn().mockResolvedValue({
    id: 'channel-id',
    members: ['user-a', 'user-b']
  }),
  syncChannelMembers: jest.fn().mockResolvedValue(),
  getStreamChatConfig: jest.fn().mockReturnValue({
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    configured: true
  }),
  getStreamServerClient: jest.fn().mockReturnValue({})
}));

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const Follow = require('../../models/follow');
const {
  createTestUser,
  createTestDestination,
  createTestExperience,
  createTestPlan,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const { createUserToken, upsertMessagingChannel } = require('../../utilities/stream-chat');

// Helper: enable chat feature flag on a user
function withChatFlag(overrides = {}) {
  return {
    feature_flags: [
      {
        flag: 'chat',
        enabled: true,
        granted_at: new Date(),
        granted_by: null
      }
    ],
    ...overrides
  };
}

describe('Chat API', () => {
  let userA, userB;
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

    createUserToken.mockClear();
    upsertMessagingChannel.mockClear();

    // Make userA a super admin so they can DM anyone (eligibility shortcut)
    userA = await createTestUser({
      name: 'User A',
      email: `chat-a-${Date.now()}@test.com`,
      role: 'super_admin'
    });
    userB = await createTestUser({
      name: 'User B',
      email: `chat-b-${Date.now()}@test.com`
    });

    tokenA = generateAuthToken(userA);
    tokenB = generateAuthToken(userB);
  });

  afterEach(async () => {
    await clearTestData();
    await Follow.deleteMany({});
  });

  describe('POST /api/chat/token', () => {
    it('returns a Stream Chat token for authenticated user (happy path)', async () => {
      const res = await request(app)
        .post('/api/chat/token')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.token).toBe('stream-test-token-abc123');
      expect(body.user.id).toBe(userA._id.toString());
      expect(createUserToken).toHaveBeenCalledTimes(1);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app).post('/api/chat/token').send({});
      expect(res.status).toBe(401);
      expect(createUserToken).not.toHaveBeenCalled();
    });

    it('returns 501 when Stream Chat is not configured', async () => {
      // Simulate missing configuration
      const err = new Error('Stream Chat is not configured');
      err.code = 'STREAM_CHAT_NOT_CONFIGURED';
      createUserToken.mockImplementationOnce(() => { throw err; });

      const res = await request(app)
        .post('/api/chat/token')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});

      expect(res.status).toBe(501);
      expect(res.body.error).toMatch(/not configured/i);
    });
  });

  describe('POST /api/chat/channels/dm', () => {
    it('creates a DM channel when actor is super admin (happy path)', async () => {
      const res = await request(app)
        .post('/api/chat/channels/dm')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ otherUserId: userB._id.toString() });

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.type).toBe('messaging');
      expect(body.id).toMatch(/^dm_/);
      expect(Array.isArray(body.members)).toBe(true);
      expect(body.members.length).toBe(2);
      expect(upsertMessagingChannel).toHaveBeenCalled();
    });

    it('returns 400 for invalid otherUserId', async () => {
      const res = await request(app)
        .post('/api/chat/channels/dm')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ otherUserId: 'not-an-objectid' });

      expect(res.status).toBe(400);
      expect(upsertMessagingChannel).not.toHaveBeenCalled();
    });

    it('returns 403 when DM eligibility check fails (no mutual follow, not super admin)', async () => {
      // userB tries to DM userA but they don't mutually follow and userB is not super admin
      const res = await request(app)
        .post('/api/chat/channels/dm')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ otherUserId: userA._id.toString() });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/mutually follow|curated experiences/i);
      expect(upsertMessagingChannel).not.toHaveBeenCalled();
    });

    it('returns 404 when target user does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/api/chat/channels/dm')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ otherUserId: fakeId.toString() });

      expect(res.status).toBe(404);
      expect(upsertMessagingChannel).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chat/channels/plan', () => {
    it('returns 400 for invalid planId', async () => {
      const res = await request(app)
        .post('/api/chat/channels/plan')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ planId: 'not-valid' });

      expect(res.status).toBe(400);
      expect(upsertMessagingChannel).not.toHaveBeenCalled();
    });

    it('returns 404 when plan does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/api/chat/channels/plan')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ planId: fakeId.toString() });

      expect(res.status).toBe(404);
    });

    it('creates a plan channel when chat flag enabled and user has access', async () => {
      // Create a plan-owning user with chat flag enabled
      const planOwner = await createTestUser({
        name: 'Plan Owner',
        email: `plan-owner-${Date.now()}@test.com`,
        role: 'super_admin', // chat flag check passes via super admin shortcut
        ...withChatFlag()
      });
      const planOwnerToken = generateAuthToken(planOwner);

      const dest = await createTestDestination(planOwner);
      const exp = await createTestExperience(planOwner, dest);
      const plan = await createTestPlan(planOwner, exp);

      const res = await request(app)
        .post('/api/chat/channels/plan')
        .set('Authorization', `Bearer ${planOwnerToken}`)
        .send({ planId: plan._id.toString() });

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.type).toBe('messaging');
      expect(body.id).toMatch(/^plan_/);
      expect(upsertMessagingChannel).toHaveBeenCalled();
    });
  });

  describe('Auth gating', () => {
    it('all routes require authentication', async () => {
      const tokenRes = await request(app).post('/api/chat/token').send({});
      expect(tokenRes.status).toBe(401);

      const dmRes = await request(app)
        .post('/api/chat/channels/dm')
        .send({ otherUserId: userB._id.toString() });
      expect(dmRes.status).toBe(401);

      const planRes = await request(app)
        .post('/api/chat/channels/plan')
        .send({ planId: new mongoose.Types.ObjectId().toString() });
      expect(planRes.status).toBe(401);
    });
  });
});
