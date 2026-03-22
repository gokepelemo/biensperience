/**
 * AI Admin Classifier API Tests
 *
 * Tests corpus CRUD, classification logs, and classifier config endpoints.
 * All endpoints require super_admin + ai_admin feature flag.
 */

const request = require('supertest');

// Mock AI layer (must be before app require)
jest.mock('../../controllers/api/ai', () => ({
  callProvider: jest.fn().mockResolvedValue({ content: '{}', usage: {} }),
  getApiKey: jest.fn().mockReturnValue('test-key'),
  getProviderForTask: jest.fn().mockReturnValue('openai'),
  AI_PROVIDERS: { OPENAI: 'openai' },
  AI_TASKS: { GENERAL: 'general' },
  status: jest.fn((req, res) => res.json({ success: true })),
  complete: jest.fn((req, res) => res.json({ success: true })),
  autocomplete: jest.fn((req, res) => res.json({ success: true })),
  improve: jest.fn((req, res) => res.json({ success: true })),
  translate: jest.fn((req, res) => res.json({ success: true })),
  summarize: jest.fn((req, res) => res.json({ success: true })),
  generateTips: jest.fn((req, res) => res.json({ success: true }))
}));

// Mock intent classifier to avoid NLP training in tests
jest.mock('../../utilities/bienbot-intent-classifier', () => ({
  classifyIntent: jest.fn().mockResolvedValue({
    intent: 'ANSWER_QUESTION',
    entities: {},
    confidence: 0.9,
    source: 'nlp'
  }),
  INTENTS: { ANSWER_QUESTION: 'ANSWER_QUESTION', QUERY_DESTINATION: 'QUERY_DESTINATION' },
  resetManager: jest.fn(),
  retrainManager: jest.fn().mockResolvedValue({ intents: 5, utterances: 50 }),
  getClassifierConfig: jest.fn(),
  invalidateConfigCache: jest.fn()
}));

const app = require('../../app');
const IntentCorpus = require('../../models/intent-corpus');
const IntentClassificationLog = require('../../models/intent-classification-log');
const IntentClassifierConfig = require('../../models/intent-classifier-config');
const {
  createTestUser,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const dbSetup = require('../setup/testSetup');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createAdminUser() {
  return createTestUser({
    name: 'Admin User',
    email: `admin_${Date.now()}@test.com`,
    emailConfirmed: true,
    role: 'super_admin',
    feature_flags: [
      { flag: 'ai_admin', enabled: true, granted_at: new Date() },
      { flag: 'ai_features', enabled: true, granted_at: new Date() }
    ]
  });
}

async function createRegularUser() {
  return createTestUser({
    name: 'Regular User',
    email: `regular_${Date.now()}@test.com`,
    emailConfirmed: true,
    role: 'regular_user'
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AI Admin Classifier API', () => {
  let admin, adminToken, regularUser, regularToken;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  beforeEach(async () => {
    await clearTestData();
    await IntentCorpus.deleteMany({});
    await IntentClassificationLog.deleteMany({});
    await IntentClassifierConfig.deleteMany({});

    admin = await createAdminUser();
    adminToken = generateAuthToken(admin);
    regularUser = await createRegularUser();
    regularToken = generateAuthToken(regularUser);
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  // =========================================================================
  // Authorization
  // =========================================================================

  describe('Authorization', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/ai-admin/corpus');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users', async () => {
      const res = await request(app)
        .get('/api/ai-admin/corpus')
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // Corpus CRUD
  // =========================================================================

  describe('Corpus Management', () => {
    it('GET /corpus returns empty list initially', async () => {
      const res = await request(app)
        .get('/api/ai-admin/corpus')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.intents).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });

    it('POST /corpus creates a new intent', async () => {
      const res = await request(app)
        .post('/api/ai-admin/corpus')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          intent: 'BOOK_HOTEL',
          description: 'Book a hotel',
          utterances: ['book a hotel', 'reserve a room']
        });

      expect(res.status).toBe(200);
      expect(res.body.data.intent.intent).toBe('BOOK_HOTEL');
      expect(res.body.data.intent.utterances).toHaveLength(2);
      expect(res.body.data.intent.is_custom).toBe(true);
    });

    it('POST /corpus rejects duplicate intents', async () => {
      await IntentCorpus.create({ intent: 'BOOK_HOTEL', utterances: [] });

      const res = await request(app)
        .post('/api/ai-admin/corpus')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ intent: 'BOOK_HOTEL' });

      expect(res.status).toBe(409);
    });

    it('GET /corpus/:intent returns intent details', async () => {
      await IntentCorpus.create({
        intent: 'BOOK_HOTEL',
        utterances: ['book a hotel', 'reserve a room'],
        description: 'Hotel booking'
      });

      const res = await request(app)
        .get('/api/ai-admin/corpus/BOOK_HOTEL')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.intent.intent).toBe('BOOK_HOTEL');
      expect(res.body.data.intent.utterances).toHaveLength(2);
    });

    it('PUT /corpus/:intent updates utterances', async () => {
      await IntentCorpus.create({ intent: 'BOOK_HOTEL', utterances: ['book a hotel'] });

      const res = await request(app)
        .put('/api/ai-admin/corpus/BOOK_HOTEL')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ utterances: ['book a hotel', 'find a room', 'get accommodation'] });

      expect(res.status).toBe(200);
      expect(res.body.data.intent.utterances).toHaveLength(3);
    });

    it('PUT /corpus/:intent toggles enabled', async () => {
      await IntentCorpus.create({ intent: 'BOOK_HOTEL', utterances: [], enabled: true });

      const res = await request(app)
        .put('/api/ai-admin/corpus/BOOK_HOTEL')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false });

      expect(res.status).toBe(200);
      expect(res.body.data.intent.enabled).toBe(false);
    });

    it('DELETE /corpus/:intent deletes custom intents', async () => {
      await IntentCorpus.create({ intent: 'BOOK_HOTEL', utterances: [], is_custom: true });

      const res = await request(app)
        .delete('/api/ai-admin/corpus/BOOK_HOTEL')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('DELETE /corpus/:intent refuses to delete seeded intents', async () => {
      await IntentCorpus.create({ intent: 'ANSWER_QUESTION', utterances: [], is_custom: false });

      const res = await request(app)
        .delete('/api/ai-admin/corpus/ANSWER_QUESTION')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('POST /corpus/retrain triggers retraining', async () => {
      const res = await request(app)
        .post('/api/ai-admin/corpus/retrain')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.retrained).toBe(true);
    });
  });

  // =========================================================================
  // Classification Logs
  // =========================================================================

  describe('Classification Logs', () => {
    beforeEach(async () => {
      // Seed some logs
      await IntentClassificationLog.create([
        {
          message: 'Tell me about Tokyo',
          intent: 'QUERY_DESTINATION',
          confidence: 0.8,
          user: admin._id,
          is_low_confidence: false
        },
        {
          message: 'Do something weird',
          intent: 'ANSWER_QUESTION',
          confidence: 0.3,
          user: admin._id,
          is_low_confidence: true,
          reviewed: false
        },
        {
          message: 'Maybe plan something',
          intent: 'PLAN_EXPERIENCE',
          confidence: 0.5,
          user: admin._id,
          is_low_confidence: true,
          reviewed: true,
          admin_corrected_intent: 'ANSWER_QUESTION'
        }
      ]);
    });

    it('GET /classifications returns paginated logs', async () => {
      const res = await request(app)
        .get('/api/ai-admin/classifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.logs.length).toBe(3);
      expect(res.body.data.total).toBe(3);
    });

    it('GET /classifications filters by low_confidence', async () => {
      const res = await request(app)
        .get('/api/ai-admin/classifications?low_confidence=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.logs.length).toBe(2);
    });

    it('GET /classifications filters by reviewed=false', async () => {
      const res = await request(app)
        .get('/api/ai-admin/classifications?reviewed=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.logs.every(l => !l.reviewed)).toBe(true);
    });

    it('GET /classifications/summary returns aggregated stats', async () => {
      const res = await request(app)
        .get('/api/ai-admin/classifications/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.low_confidence).toBe(2);
    });

    it('PUT /classifications/:id/review marks as reviewed', async () => {
      const log = await IntentClassificationLog.findOne({ reviewed: false });

      const res = await request(app)
        .put(`/api/ai-admin/classifications/${log._id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ corrected_intent: 'QUERY_DESTINATION' });

      expect(res.status).toBe(200);
      expect(res.body.data.log.reviewed).toBe(true);
      expect(res.body.data.log.admin_corrected_intent).toBe('QUERY_DESTINATION');
    });

    it('POST /classifications/batch-add adds utterances to corpus', async () => {
      await IntentCorpus.create({ intent: 'ANSWER_QUESTION', utterances: ['hello'] });
      const log = await IntentClassificationLog.findOne({ reviewed: false });

      const res = await request(app)
        .post('/api/ai-admin/classifications/batch-add')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          corrections: [{
            log_id: log._id.toString(),
            intent: 'ANSWER_QUESTION',
            utterance: log.message
          }]
        });

      expect(res.status).toBe(200);
      const results = res.body.data.results;
      expect(results[0].status).toBe('added');

      // Verify utterance was added
      const corpus = await IntentCorpus.findOne({ intent: 'ANSWER_QUESTION' });
      expect(corpus.utterances).toContain(log.message);
    });
  });

  // =========================================================================
  // Classifier Config
  // =========================================================================

  describe('Classifier Config', () => {
    it('GET /classifier-config returns defaults on first call', async () => {
      const res = await request(app)
        .get('/api/ai-admin/classifier-config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.config.low_confidence_threshold).toBe(0.65);
      expect(res.body.data.config.llm_fallback_enabled).toBe(false);
    });

    it('PUT /classifier-config updates thresholds', async () => {
      const res = await request(app)
        .put('/api/ai-admin/classifier-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          low_confidence_threshold: 0.5,
          llm_fallback_enabled: true,
          llm_fallback_threshold: 0.3
        });

      expect(res.status).toBe(200);
      expect(res.body.data.config.low_confidence_threshold).toBe(0.5);
      expect(res.body.data.config.llm_fallback_enabled).toBe(true);
      expect(res.body.data.config.llm_fallback_threshold).toBe(0.3);
    });

    it('PUT /classifier-config validates thresholds', async () => {
      const res = await request(app)
        .put('/api/ai-admin/classifier-config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ low_confidence_threshold: 2.0 });

      expect(res.status).toBe(500); // Mongoose validation error
    });
  });
});
