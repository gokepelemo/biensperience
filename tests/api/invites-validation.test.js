/**
 * Negative-case zod validation tests for `/api/invites` (bd #8f36.25).
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

describe('Invites input validation (zod)', () => {
  describe('POST /api/invites/redeem', () => {
    it('returns 400 VALIDATION_ERROR when code is missing', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .post('/api/invites/redeem')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      const codeIssue = response.body.issues.find(
        (i) => Array.isArray(i.path) && i.path.join('.') === 'body.code'
      );
      expect(codeIssue).toBeDefined();
    });
  });

  describe('POST /api/invites/validate', () => {
    it('returns 400 VALIDATION_ERROR when code is missing', async () => {
      const response = await request(app)
        .post('/api/invites/validate')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
