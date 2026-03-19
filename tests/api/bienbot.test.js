/**
 * BienBot API Integration Tests
 *
 * Tests all BienBot endpoints:
 *   POST   /api/bienbot/chat
 *   GET    /api/bienbot/sessions
 *   GET    /api/bienbot/sessions/:id
 *   DELETE /api/bienbot/sessions/:id
 *   POST   /api/bienbot/sessions/:id/resume
 *   POST   /api/bienbot/sessions/:id/execute
 *   DELETE /api/bienbot/sessions/:id/pending/:actionId
 *
 * AI calls and context builders are mocked to keep tests fast and deterministic.
 */

const request = require('supertest');

// ---- Mock AI layer (must be before app require) ----------------------------
jest.mock('../../controllers/api/ai', () => ({
  callProvider: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      message: 'I can help you plan a trip to Kyoto!',
      pending_actions: []
    }),
    usage: { prompt_tokens: 50, completion_tokens: 30 }
  }),
  getApiKey: jest.fn().mockReturnValue('test-api-key'),
  getProviderForTask: jest.fn().mockReturnValue('openai'),
  AI_PROVIDERS: { OPENAI: 'openai' },
  AI_TASKS: { GENERAL: 'general', FAST: 'fast' },
  // Route handlers referenced in routes/api/ai.js
  status: jest.fn((req, res) => res.json({ success: true, available: true })),
  complete: jest.fn((req, res) => res.json({ success: true })),
  autocomplete: jest.fn((req, res) => res.json({ success: true })),
  improve: jest.fn((req, res) => res.json({ success: true })),
  translate: jest.fn((req, res) => res.json({ success: true })),
  summarize: jest.fn((req, res) => res.json({ success: true })),
  generateTips: jest.fn((req, res) => res.json({ success: true }))
}));

// ---- Mock intent classifier -------------------------------------------------
jest.mock('../../utilities/bienbot-intent-classifier', () => ({
  classifyIntent: jest.fn().mockResolvedValue({
    intent: 'ANSWER_QUESTION',
    entities: {
      destination_name: null,
      experience_name: null,
      user_email: null,
      plan_item_texts: []
    },
    confidence: 0.9
  })
}));

// ---- Mock context builders --------------------------------------------------
jest.mock('../../utilities/bienbot-context-builders', () => ({
  buildContextForInvokeContext: jest.fn().mockResolvedValue('Destination: Test City, Test Country'),
  buildDestinationContext: jest.fn().mockResolvedValue(null),
  buildExperienceContext: jest.fn().mockResolvedValue(null),
  buildUserPlanContext: jest.fn().mockResolvedValue(null),
  buildSearchContext: jest.fn().mockResolvedValue(null)
}));

// ---- Mock action executor ---------------------------------------------------
jest.mock('../../utilities/bienbot-action-executor', () => ({
  ALLOWED_ACTION_TYPES: [
    'create_destination', 'create_experience', 'create_plan',
    'add_plan_items', 'update_plan_item', 'invite_collaborator', 'sync_plan'
  ],
  executeActions: jest.fn().mockResolvedValue({
    results: [{ actionId: 'action_abc12345', success: true, result: { _id: 'new-id' } }],
    errors: []
  })
}));

// ---- Mock session summarizer ------------------------------------------------
jest.mock('../../utilities/bienbot-session-summarizer', () => ({
  summarizeSession: jest.fn().mockResolvedValue({
    summary: 'We discussed planning a trip to Kyoto.',
    next_steps: ['Set a planned date', 'Add accommodation']
  })
}));

const app = require('../../app');
const BienBotSession = require('../../models/bienbot-session');
const {
  createTestUser,
  createTestDestination,
  createTestExperience,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const dbSetup = require('../setup/testSetup');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a super admin user with the ai_features flag enabled.
 * Super admins bypass the BienBot rate limiter, preventing test exhaustion
 * when all tests share the same IP (127.0.0.1 in supertest).
 */
async function createAIUser(overrides = {}) {
  return createTestUser({
    name: 'AI User',
    email: `aiuser_${Date.now()}@test.com`,
    emailConfirmed: true,
    role: 'super_admin',
    feature_flags: [
      {
        flag: 'ai_features',
        enabled: true,
        granted_at: new Date(),
        granted_by: null
      }
    ],
    ...overrides
  });
}

/**
 * Parse SSE stream body into individual events.
 */
function parseSSEEvents(text) {
  const events = [];
  const blocks = text.split(/\n\n/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let data = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      if (line.startsWith('data: ')) {
        try { data = JSON.parse(line.slice(6)); } catch { data = line.slice(6); }
      }
    }
    if (data !== null) events.push({ event, data });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BienBot API', () => {
  let user, authToken, destination, experience;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  beforeEach(async () => {
    await clearTestData();
    await BienBotSession.deleteMany({});

    user = await createAIUser();
    authToken = generateAuthToken(user);

    destination = await createTestDestination(user, { name: 'Test City', country: 'Test Country' });
    experience = await createTestExperience(user, destination, { name: 'Test Experience' });
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  // -------------------------------------------------------------------------
  // POST /api/bienbot/chat — Authentication & Feature Flag
  // -------------------------------------------------------------------------

  describe('POST /api/bienbot/chat — auth & feature flag', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .send({ message: 'Hello' });

      expect(res.status).toBe(401);
    });

    it('returns 403 when user lacks ai_features flag', async () => {
      const noFlagUser = await createTestUser({
        email: `noflag_${Date.now()}@test.com`,
        emailConfirmed: true
      });
      const noFlagToken = generateAuthToken(noFlagUser);

      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', noFlagToken)
        .send({ message: 'Hello' });

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/bienbot/chat — Input validation
  // -------------------------------------------------------------------------

  describe('POST /api/bienbot/chat — input validation', () => {
    it('returns 400 when message is missing', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when message is empty string', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({ message: '   ' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when message exceeds 8000 characters', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({ message: 'a'.repeat(8001) });

      expect(res.status).toBe(400);
    });

    it('returns 400 when sessionId is not a valid ObjectId', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({ message: 'Hello', sessionId: 'not-an-id' });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/bienbot/chat — invokeContext security
  // -------------------------------------------------------------------------

  describe('POST /api/bienbot/chat — invokeContext security', () => {
    it('returns 400 when invokeContext.id is not a valid ObjectId', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({
          message: 'Hello',
          invokeContext: { entity: 'destination', id: 'bad-id' }
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 when invokeContext entity does not exist', async () => {
      const mongoose = require('mongoose');
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({
          message: 'Hello',
          invokeContext: { entity: 'destination', id: nonExistentId }
        });

      expect(res.status).toBe(403);
    });

    it('returns 400 for unknown invokeContext entity type', async () => {
      const mongoose = require('mongoose');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({
          message: 'Hello',
          invokeContext: { entity: 'spaceship', id: fakeId }
        });

      // Either 400 (unknown entity type) or 403 (entity not found/access denied)
      expect([400, 403]).toContain(res.status);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/bienbot/chat — success flow (SSE)
  // -------------------------------------------------------------------------

  describe('POST /api/bienbot/chat — success flow', () => {
    it('creates a new session and streams SSE response', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .buffer(true)
        .parse((response, callback) => {
          let data = '';
          response.on('data', chunk => { data += chunk.toString(); });
          response.on('end', () => callback(null, data));
        })
        .send({ message: 'Tell me about Kyoto' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');

      const events = parseSSEEvents(res.body);
      const eventTypes = events.map(e => e.event);

      expect(eventTypes).toContain('session');
      expect(eventTypes).toContain('token');
      expect(eventTypes).toContain('done');

      // Session event should have a sessionId
      const sessionEvent = events.find(e => e.event === 'session');
      expect(sessionEvent.data).toHaveProperty('sessionId');

      // Verify session was persisted in the database
      const sessionId = sessionEvent.data.sessionId;
      const session = await BienBotSession.findById(sessionId);
      expect(session).toBeTruthy();
      expect(session.user.toString()).toBe(user._id.toString());
      expect(session.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('uses existing session when valid sessionId is provided', async () => {
      // Create a session first
      const session = await BienBotSession.createSession(user._id.toString(), {});

      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .buffer(true)
        .parse((response, callback) => {
          let data = '';
          response.on('data', chunk => { data += chunk.toString(); });
          response.on('end', () => callback(null, data));
        })
        .send({ message: 'Continue planning', sessionId: session._id.toString() });

      expect(res.status).toBe(200);

      const events = parseSSEEvents(res.body);
      const sessionEvent = events.find(e => e.event === 'session');
      expect(sessionEvent.data.sessionId).toBe(session._id.toString());
    });

    it('returns 404 when sessionId points to another user\'s session', async () => {
      const otherUser = await createAIUser({ email: `other_${Date.now()}@test.com` });
      const otherSession = await BienBotSession.createSession(otherUser._id.toString(), {});

      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .send({ message: 'Hello', sessionId: otherSession._id.toString() });

      expect(res.status).toBe(404);
    });

    it('accepts valid invokeContext with an owned destination', async () => {
      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .buffer(true)
        .parse((response, callback) => {
          let data = '';
          response.on('data', chunk => { data += chunk.toString(); });
          response.on('end', () => callback(null, data));
        })
        .send({
          message: 'What can I do here?',
          invokeContext: { entity: 'destination', id: destination._id.toString() }
        });

      expect(res.status).toBe(200);
      const events = parseSSEEvents(res.body);
      expect(events.some(e => e.event === 'done')).toBe(true);
    });

    it('includes pending_actions event when LLM returns actions', async () => {
      const { callProvider } = require('../../controllers/api/ai');
      callProvider.mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'I will create a plan for you.',
          pending_actions: [
            {
              id: 'action_abc12345',
              type: 'create_plan',
              payload: { experience_id: experience._id.toString() },
              description: 'Create a plan for Test Experience'
            }
          ]
        }),
        usage: { prompt_tokens: 50, completion_tokens: 40 }
      });

      const res = await request(app)
        .post('/api/bienbot/chat')
        .set('Authorization', authToken)
        .buffer(true)
        .parse((response, callback) => {
          let data = '';
          response.on('data', chunk => { data += chunk.toString(); });
          response.on('end', () => callback(null, data));
        })
        .send({ message: 'Plan the Test Experience' });

      expect(res.status).toBe(200);
      const events = parseSSEEvents(res.body);
      const actionsEvent = events.find(e => e.event === 'actions');
      expect(actionsEvent).toBeTruthy();
      expect(actionsEvent.data.pending_actions).toHaveLength(1);
      expect(actionsEvent.data.pending_actions[0].type).toBe('create_plan');
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/bienbot/sessions
  // -------------------------------------------------------------------------

  describe('GET /api/bienbot/sessions', () => {
    it('returns empty list when user has no sessions', async () => {
      const res = await request(app)
        .get('/api/bienbot/sessions')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body).toHaveProperty('sessions');
      expect(Array.isArray(body.sessions)).toBe(true);
      expect(body.sessions).toHaveLength(0);
    });

    it('returns sessions belonging to the authenticated user', async () => {
      await BienBotSession.createSession(user._id.toString(), {});
      await BienBotSession.createSession(user._id.toString(), {});

      // Create a session for another user (should not appear)
      const otherUser = await createAIUser({ email: `other2_${Date.now()}@test.com` });
      await BienBotSession.createSession(otherUser._id.toString(), {});

      const res = await request(app)
        .get('/api/bienbot/sessions')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.sessions).toHaveLength(2);
    });

    it('filters by status=active', async () => {
      const s = await BienBotSession.createSession(user._id.toString(), {});
      await s.archive();

      await BienBotSession.createSession(user._id.toString(), {}); // active

      const res = await request(app)
        .get('/api/bienbot/sessions?status=active')
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.sessions.every(s => s.status === 'active')).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/bienbot/sessions');
      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/bienbot/sessions/:id
  // -------------------------------------------------------------------------

  describe('GET /api/bienbot/sessions/:id', () => {
    it('returns a session by ID for its owner', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});

      const res = await request(app)
        .get(`/api/bienbot/sessions/${session._id}`)
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.session._id.toString()).toBe(session._id.toString());
    });

    it('returns 404 for another user\'s session', async () => {
      const otherUser = await createAIUser({ email: `other3_${Date.now()}@test.com` });
      const otherSession = await BienBotSession.createSession(otherUser._id.toString(), {});

      const res = await request(app)
        .get(`/api/bienbot/sessions/${otherSession._id}`)
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid session ID format', async () => {
      const res = await request(app)
        .get('/api/bienbot/sessions/bad-oid')
        .set('Authorization', authToken);

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent session', async () => {
      const mongoose = require('mongoose');
      const fakeId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/bienbot/sessions/${fakeId}`)
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/bienbot/sessions/:id
  // -------------------------------------------------------------------------

  describe('DELETE /api/bienbot/sessions/:id', () => {
    it('archives (soft-deletes) a session', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});

      const res = await request(app)
        .delete(`/api/bienbot/sessions/${session._id}`)
        .set('Authorization', authToken);

      expect(res.status).toBe(200);

      const updated = await BienBotSession.findById(session._id);
      expect(updated.status).toBe('archived');
    });

    it('returns 404 when deleting another user\'s session', async () => {
      const otherUser = await createAIUser({ email: `other4_${Date.now()}@test.com` });
      const otherSession = await BienBotSession.createSession(otherUser._id.toString(), {});

      const res = await request(app)
        .delete(`/api/bienbot/sessions/${otherSession._id}`)
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
      // Session should not be modified
      const stillActive = await BienBotSession.findById(otherSession._id);
      expect(stillActive.status).toBe('active');
    });

    it('returns 400 for invalid session ID', async () => {
      const res = await request(app)
        .delete('/api/bienbot/sessions/bad-id')
        .set('Authorization', authToken);

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/bienbot/sessions/:id/resume
  // -------------------------------------------------------------------------

  describe('POST /api/bienbot/sessions/:id/resume', () => {
    it('returns static greeting for sessions with fewer than 3 messages', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});

      const res = await request(app)
        .post(`/api/bienbot/sessions/${session._id}/resume`)
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body).toHaveProperty('greeting');
      expect(body.greeting).toHaveProperty('role', 'assistant');
      expect(body.greeting).toHaveProperty('content');
    });

    it('generates a summary greeting for sessions with 3+ messages', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});
      await session.addMessage('user', 'I want to plan a trip to Kyoto');
      await session.addMessage('assistant', 'I can help with that!');
      await session.addMessage('user', 'What are the best experiences?');

      const res = await request(app)
        .post(`/api/bienbot/sessions/${session._id}/resume`)
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body).toHaveProperty('greeting');
      expect(body.greeting).toHaveProperty('suggested_next_steps');
      expect(Array.isArray(body.greeting.suggested_next_steps)).toBe(true);

      const { summarizeSession } = require('../../utilities/bienbot-session-summarizer');
      expect(summarizeSession).toHaveBeenCalled();
    });

    it('uses cached summary when not stale', async () => {
      const { summarizeSession } = require('../../utilities/bienbot-session-summarizer');
      summarizeSession.mockClear();

      const session = await BienBotSession.createSession(user._id.toString(), {});
      await session.addMessage('user', 'm1');
      await session.addMessage('assistant', 'r1');
      await session.addMessage('user', 'm2');

      // Cache a summary
      await session.cacheSummary('Cached summary text', ['Step 1', 'Step 2']);
      // Ensure generated_at is very recent (not stale)
      await BienBotSession.findByIdAndUpdate(session._id, {
        'summary.generated_at': new Date()
      });

      const res = await request(app)
        .post(`/api/bienbot/sessions/${session._id}/resume`)
        .set('Authorization', authToken);

      expect(res.status).toBe(200);
      // summarizeSession should NOT have been called since cache is fresh
      expect(summarizeSession).not.toHaveBeenCalled();
    });

    it('returns 404 for another user\'s session', async () => {
      const otherUser = await createAIUser({ email: `other5_${Date.now()}@test.com` });
      const otherSession = await BienBotSession.createSession(otherUser._id.toString(), {});

      const res = await request(app)
        .post(`/api/bienbot/sessions/${otherSession._id}/resume`)
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/bienbot/sessions/:id/execute
  // -------------------------------------------------------------------------

  describe('POST /api/bienbot/sessions/:id/execute', () => {
    it('executes pending actions from a session', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});
      await session.setPendingActions([
        {
          id: 'action_test1234',
          type: 'create_plan',
          payload: { experience_id: experience._id.toString() },
          description: 'Create plan for Test Experience'
        }
      ]);

      const res = await request(app)
        .post(`/api/bienbot/sessions/${session._id}/execute`)
        .set('Authorization', authToken)
        .send({ actionIds: ['action_test1234'] });

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body).toHaveProperty('results');

      const { executeActions } = require('../../utilities/bienbot-action-executor');
      expect(executeActions).toHaveBeenCalled();
    });

    it('returns 400 when actionIds is missing', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});

      const res = await request(app)
        .post(`/api/bienbot/sessions/${session._id}/execute`)
        .set('Authorization', authToken)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when actionIds is empty array', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});

      const res = await request(app)
        .post(`/api/bienbot/sessions/${session._id}/execute`)
        .set('Authorization', authToken)
        .send({ actionIds: [] });

      expect(res.status).toBe(400);
    });

    it('returns 404 for another user\'s session', async () => {
      const otherUser = await createAIUser({ email: `other6_${Date.now()}@test.com` });
      const otherSession = await BienBotSession.createSession(otherUser._id.toString(), {});

      const res = await request(app)
        .post(`/api/bienbot/sessions/${otherSession._id}/execute`)
        .set('Authorization', authToken)
        .send({ actionIds: ['action_test1234'] });

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid session ID format', async () => {
      const res = await request(app)
        .post('/api/bienbot/sessions/bad-id/execute')
        .set('Authorization', authToken)
        .send({ actionIds: ['action_test1234'] });

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api/bienbot/sessions/:id/pending/:actionId
  // -------------------------------------------------------------------------

  describe('DELETE /api/bienbot/sessions/:id/pending/:actionId', () => {
    it('removes a specific pending action', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});
      await session.setPendingActions([
        {
          id: 'action_rem12345',
          type: 'create_plan',
          payload: {},
          description: 'Test action'
        }
      ]);

      const res = await request(app)
        .delete(`/api/bienbot/sessions/${session._id}/pending/action_rem12345`)
        .set('Authorization', authToken);

      expect(res.status).toBe(200);

      const updated = await BienBotSession.findById(session._id);
      expect(updated.pending_actions.find(a => a.id === 'action_rem12345')).toBeUndefined();
    });

    it('returns 404 when action ID does not exist', async () => {
      const session = await BienBotSession.createSession(user._id.toString(), {});

      const res = await request(app)
        .delete(`/api/bienbot/sessions/${session._id}/pending/action_notexist`)
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
    });

    it('returns 404 for another user\'s session', async () => {
      const otherUser = await createAIUser({ email: `other7_${Date.now()}@test.com` });
      const otherSession = await BienBotSession.createSession(otherUser._id.toString(), {});
      await otherSession.setPendingActions([
        { id: 'action_xyz99999', type: 'create_plan', payload: {}, description: 'Test' }
      ]);

      const res = await request(app)
        .delete(`/api/bienbot/sessions/${otherSession._id}/pending/action_xyz99999`)
        .set('Authorization', authToken);

      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid session ID format', async () => {
      const res = await request(app)
        .delete('/api/bienbot/sessions/bad-id/pending/action_test')
        .set('Authorization', authToken);

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting — super admin bypass
  // -------------------------------------------------------------------------

  describe('Rate limiter', () => {
    it('super admin bypasses rate limit', async () => {
      const admin = await createTestUser({
        email: `superadmin_${Date.now()}@test.com`,
        emailConfirmed: true,
        role: 'super_admin',
        feature_flags: [{ flag: 'ai_features', enabled: true, granted_at: new Date() }]
      });
      const adminToken = generateAuthToken(admin);

      // Just verify the admin can make requests without 429
      const res = await request(app)
        .get('/api/bienbot/sessions')
        .set('Authorization', adminToken);

      expect(res.status).toBe(200);
    });
  });
});
