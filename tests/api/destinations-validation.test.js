/**
 * Negative-case zod validation tests for `/api/destinations` (bd #8f36.25).
 *
 * Confirms that the `validate(...)` middleware short-circuits malformed
 * payloads with the structured `{ success:false, code:'VALIDATION_ERROR', issues:[] }`
 * response shape — i.e. the rollout from the auth-pilot pattern reached this
 * controller's state-changing routes.
 */

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  generateAuthToken,
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

describe('Destinations input validation (zod)', () => {
  describe('POST /api/destinations', () => {
    it('returns 400 VALIDATION_ERROR when name is missing', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${token}`)
        .send({ country: 'Japan' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(response.body.issues)).toBe(true);
      const nameIssue = response.body.issues.find(
        (i) => Array.isArray(i.path) && i.path.join('.') === 'body.name'
      );
      expect(nameIssue).toBeDefined();
    });

    it('returns 400 VALIDATION_ERROR when country is missing', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Tokyo' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      const countryIssue = response.body.issues.find(
        (i) => Array.isArray(i.path) && i.path.join('.') === 'body.country'
      );
      expect(countryIssue).toBeDefined();
    });
  });
});
