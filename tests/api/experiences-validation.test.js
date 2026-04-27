/**
 * Negative-case zod validation tests for `/api/experiences` (bd #8f36.25).
 */

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  generateAuthToken,
  createTestDestination,
  clearTestData,
} = require('../utils/testHelpers');

beforeAll(async () => {
  await dbSetup.connect();
});

afterAll(async () => {
  await dbSetup.closeDatabase();
});

afterEach(async () => {
  await clearTestData();
});

describe('Experiences input validation (zod)', () => {
  describe('POST /api/experiences', () => {
    it('returns 400 VALIDATION_ERROR when name is missing', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      const response = await request(app)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send({ destination: destination._id.toString() });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      const nameIssue = response.body.issues.find(
        (i) => Array.isArray(i.path) && i.path.join('.') === 'body.name'
      );
      expect(nameIssue).toBeDefined();
    });

    it('returns 400 VALIDATION_ERROR when destination is not a valid ObjectId', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test exp', destination: 'not-a-mongo-id' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      const destIssue = response.body.issues.find(
        (i) => Array.isArray(i.path) && i.path.join('.') === 'body.destination'
      );
      expect(destIssue).toBeDefined();
    });
  });
});
