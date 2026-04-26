/**
 * Negative-case tests for the zod input-validation pilot on the auth routes.
 *
 * See bd #8f36.10 — these tests cover the new `validate(schema)` middleware
 * surface and confirm the structured 400 error shape returned to clients.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../../app');
const User = require('../../models/user');

describe('Auth route input validation (zod pilot)', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/users (signup)', () => {
    it('returns 400 with a structured VALIDATION_ERROR when email is missing', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Test User', password: 'longpassword' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(response.body.issues)).toBe(true);
      const emailIssue = response.body.issues.find(
        (issue) => Array.isArray(issue.path) && issue.path.join('.') === 'body.email'
      );
      expect(emailIssue).toBeDefined();
      expect(emailIssue.message).toMatch(/required|invalid/i);
    });

    it('returns 400 with a structured VALIDATION_ERROR when email format is invalid', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Test User', email: 'not-an-email', password: 'longpassword' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(response.body.issues)).toBe(true);
      const emailIssue = response.body.issues.find(
        (issue) => Array.isArray(issue.path) && issue.path.join('.') === 'body.email'
      );
      expect(emailIssue).toBeDefined();
      expect(emailIssue.message).toMatch(/invalid/i);
    });

    it('returns 400 when password is shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Test User', email: 'test@example.com', password: 'short' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      const pwIssue = response.body.issues.find(
        (issue) => Array.isArray(issue.path) && issue.path.join('.') === 'body.password'
      );
      expect(pwIssue).toBeDefined();
    });
  });

  describe('POST /api/users/forgot-password', () => {
    it('returns 400 when email is not a string', async () => {
      const response = await request(app)
        .post('/api/users/forgot-password')
        .send({ email: 12345 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      const emailIssue = response.body.issues.find(
        (issue) => Array.isArray(issue.path) && issue.path.join('.') === 'body.email'
      );
      expect(emailIssue).toBeDefined();
    });
  });
});
