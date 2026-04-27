/**
 * Negative-case zod validation tests for `/api/plans` (bd #8f36.25).
 */

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  generateAuthToken,
  createTestDestination,
  createTestExperience,
  clearTestData,
} = require('../utils/testHelpers');
const Plan = require('../../models/plan');

beforeAll(async () => {
  await dbSetup.connect();
});

afterAll(async () => {
  await dbSetup.closeDatabase();
});

afterEach(async () => {
  await clearTestData();
});

describe('Plans input validation (zod)', () => {
  describe('POST /api/plans/:id/permissions/collaborator', () => {
    it('returns 400 VALIDATION_ERROR when userId is missing', async () => {
      const owner = await createTestUser();
      const token = generateAuthToken(owner);
      const destination = await createTestDestination(owner);
      const experience = await createTestExperience(owner, destination);

      const plan = await Plan.create({
        experience: experience._id,
        user: owner._id,
        plan: [],
        permissions: [
          { _id: owner._id, entity: 'user', type: 'owner', granted_by: owner._id },
        ],
      });

      const response = await request(app)
        .post(`/api/plans/${plan._id}/permissions/collaborator`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      const userIdIssue = response.body.issues.find(
        (i) => Array.isArray(i.path) && i.path.join('.') === 'body.userId'
      );
      expect(userIdIssue).toBeDefined();
    });

    it('returns 400 VALIDATION_ERROR when userId is not a valid ObjectId', async () => {
      const owner = await createTestUser();
      const token = generateAuthToken(owner);
      const destination = await createTestDestination(owner);
      const experience = await createTestExperience(owner, destination);

      const plan = await Plan.create({
        experience: experience._id,
        user: owner._id,
        plan: [],
        permissions: [
          { _id: owner._id, entity: 'user', type: 'owner', granted_by: owner._id },
        ],
      });

      const response = await request(app)
        .post(`/api/plans/${plan._id}/permissions/collaborator`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: 'not-an-objectid' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
