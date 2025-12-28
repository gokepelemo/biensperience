/**
 * Experiences API Routes Tests
 *
 * Tests all experience-related API endpoints for:
 * - CRUD operations (create, read, update, delete)
 * - Plan item management
 * - Photo management
 * - Permission management
 * - Authentication and authorization
 * - Edge cases
 *
 * Run with DEBUG=true for detailed logging:
 * DEBUG=true npm run test:api -- tests/api/experiences.test.js
 */

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  generateAuthToken,
  createTestDestination,
  createTestExperience,
  createTestPhoto,
  clearTestData,
  validators,
} = require('../utils/testHelpers');
const { TestLogger } = require('../utils/testLogger');

const logger = new TestLogger('Experiences API');

// Setup and teardown
beforeAll(async () => {
  logger.section('Starting Experiences API Tests');
  await dbSetup.connect();
});

afterAll(async () => {
  await dbSetup.closeDatabase();
  logger.section('Completed Experiences API Tests');
});

afterEach(async () => {
  await clearTestData();
});

describe('Experiences API Routes', () => {
  describe('GET /api/experiences - Get all experiences', () => {
    test('should return all experiences with pagination', async () => {
      logger.section('GET /api/experiences - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      // Create test experiences
      const exp1 = await createTestExperience(user, destination, { name: 'Experience 1' });
      const exp2 = await createTestExperience(user, destination, { name: 'Experience 2' });
      const exp3 = await createTestExperience(user, destination, { name: 'Experience 3' });

      logger.request('GET', '/api/experiences');
      const response = await request(app)
        .get('/api/experiences')
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.data.length).toBe(3);
      expect(response.body.meta).toHaveProperty('total', 3);
      expect(response.body.meta).toHaveProperty('page', 1);

      logger.success('All experiences returned with pagination');
    });

    test('should return experiences without authentication (public)', async () => {
      logger.section('GET /api/experiences - Public access');

      const user = await createTestUser();
      const destination = await createTestDestination(user);
      await createTestExperience(user, destination);

      const response = await request(app).get('/api/experiences');

      expect(response.status).toBe(200);
      logger.success('Public access allowed');
    });

    test('should filter experiences by destination', async () => {
      logger.section('GET /api/experiences - Filter by destination');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination1 = await createTestDestination(user, { name: 'Paris', country: 'France' });
      const destination2 = await createTestDestination(user, { name: 'London', country: 'UK' });

      await createTestExperience(user, destination1, { name: 'Paris Experience' });
      await createTestExperience(user, destination2, { name: 'London Experience' });

      const response = await request(app)
        .get(`/api/experiences?destination=${destination1._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Paris Experience');

      logger.success('Experiences filtered by destination');
    });

    test('should support pagination with page and limit', async () => {
      logger.section('GET /api/experiences - Pagination');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      // Create 5 experiences
      for (let i = 1; i <= 5; i++) {
        await createTestExperience(user, destination, { name: `Experience ${i}` });
      }

      const response = await request(app)
        .get('/api/experiences?page=2&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(2);
      expect(response.body.meta.page).toBe(2);
      expect(response.body.meta.limit).toBe(2);
      expect(response.body.meta.total).toBe(5);

      logger.success('Pagination working correctly');
    });
  });

  describe('POST /api/experiences - Create experience', () => {
    test('should create a new experience with valid data', async () => {
      logger.section('POST /api/experiences - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      const newExperience = {
        name: 'Amazing Trip',
        overview: 'A wonderful adventure',
        destination: destination._id.toString(),
        experience_type: ['outdoor', 'adventure']
      };

      logger.request('POST', '/api/experiences', newExperience);

      const response = await request(app)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send(newExperience);

      const body = response.body?.data || response.body;

      logger.response(response.status, response.body);

      expect(response.status).toBe(201);
      validators.isValidExperience(body);
      expect(body.name).toBe(newExperience.name);
      expect(body.overview).toBe(newExperience.overview);
      expect(body.permissions.length).toBeGreaterThan(0);

      logger.success('Experience created successfully');
    });

    test('should reject creation without authentication', async () => {
      logger.section('POST /api/experiences - No auth');

      const user = await createTestUser();
      const destination = await createTestDestination(user);

      const newExperience = {
        name: 'Test Experience',
        destination: destination._id.toString()
      };

      const response = await request(app)
        .post('/api/experiences')
        .send(newExperience);

      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });

    test('should reject experience with missing required fields', async () => {
      logger.section('POST /api/experiences - Missing fields');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${token}`)
        .send({ overview: 'No name provided' });

      expect(response.status).toBe(400);
      logger.success('Missing required fields rejected');
    });
  });

  describe('GET /api/experiences/:id - Get single experience', () => {
    test('should return a single experience by ID', async () => {
      logger.section('GET /api/experiences/:id - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination);

      logger.request('GET', `/api/experiences/${experience._id}`);

      const response = await request(app)
        .get(`/api/experiences/${experience._id}`)
        .set('Authorization', `Bearer ${token}`);

      const body = response.body?.data || response.body;

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      validators.isValidExperience(body);
      expect(body._id.toString()).toBe(experience._id.toString());

      logger.success('Single experience fetched successfully');
    });

    test('should return 404 for non-existent experience', async () => {
      logger.section('GET /api/experiences/:id - Not found');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const mongoose = require('mongoose');
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/experiences/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      logger.success('Non-existent experience returns 404');
    });

    test('should return 400 for invalid ID format', async () => {
      logger.section('GET /api/experiences/:id - Invalid ID');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/experiences/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      logger.success('Invalid ID rejected');
    });
  });

  describe('PUT /api/experiences/:id - Update experience', () => {
    test('should update experience with valid data', async () => {
      logger.section('PUT /api/experiences/:id - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination, {
        name: 'Original Name',
        overview: 'Original Overview'
      });

      const updateData = {
        name: 'Updated Name',
        overview: 'Updated Overview'
      };

      logger.request('PUT', `/api/experiences/${experience._id}`, updateData);

      const response = await request(app)
        .put(`/api/experiences/${experience._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      const body = response.body?.data || response.body;

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      expect(body.name).toBe(updateData.name);
      expect(body.overview).toBe(updateData.overview);

      logger.success('Experience updated successfully');
    });

    test('should reject update from non-owner', async () => {
      logger.section('PUT /api/experiences/:id - Authorization failure');

      const owner = await createTestUser({ email: 'owner@test.com' });
      const otherUser = await createTestUser({ email: 'other@test.com' });
      const otherToken = generateAuthToken(otherUser);

      const destination = await createTestDestination(owner);
      const experience = await createTestExperience(owner, destination);

      const response = await request(app)
        .put(`/api/experiences/${experience._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(403);
      logger.success('Unauthorized update rejected');
    });

    test('should reject update without authentication', async () => {
      logger.section('PUT /api/experiences/:id - No auth');

      const user = await createTestUser();
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination);

      const response = await request(app)
        .put(`/api/experiences/${experience._id}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(401);
      logger.success('Unauthenticated update rejected');
    });
  });

  describe('DELETE /api/experiences/:id - Delete experience', () => {
    test('should delete experience successfully', async () => {
      logger.section('DELETE /api/experiences/:id - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination);

      logger.request('DELETE', `/api/experiences/${experience._id}`);

      const response = await request(app)
        .delete(`/api/experiences/${experience._id}`)
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);

      // Verify it's actually deleted
      const Experience = require('../../models/experience');
      const deletedExperience = await Experience.findById(experience._id);
      expect(deletedExperience).toBeNull();

      logger.success('Experience deleted successfully');
    });

    test('should reject delete from non-owner', async () => {
      logger.section('DELETE /api/experiences/:id - Authorization failure');

      const owner = await createTestUser({ email: 'owner@test.com' });
      const otherUser = await createTestUser({ email: 'other@test.com' });
      const otherToken = generateAuthToken(otherUser);

      const destination = await createTestDestination(owner);
      const experience = await createTestExperience(owner, destination);

      const response = await request(app)
        .delete(`/api/experiences/${experience._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      logger.success('Unauthorized delete rejected');
    });
  });

  describe('Plan Item Management', () => {
    test('POST /api/experiences/:id/plan-item - should create plan item', async () => {
      logger.section('POST Plan Item - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination);

      const planItemData = {
        text: 'Visit the museum',
        cost_estimate: 50,
        planning_days: 1
      };

      const response = await request(app)
        .post(`/api/experiences/${experience._id}/plan-item`)
        .set('Authorization', `Bearer ${token}`)
        .send(planItemData);

      const body = response.body?.data || response.body;

      expect(response.status).toBe(201);
      expect(body.plan_items.length).toBe(1);
      expect(body.plan_items[0].text).toBe(planItemData.text);

      logger.success('Plan item created successfully');
    });

    test('PUT /api/experiences/:id/plan-item/:planItemId - should update plan item', async () => {
      logger.section('PUT Plan Item - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination, {
        plan_items: [{
          text: 'Original text',
          cost_estimate: 100,
          planning_days: 2
        }]
      });

      const planItemId = experience.plan_items[0]._id;
      const updateData = {
        text: 'Updated text',
        cost_estimate: 150
      };

      const response = await request(app)
        .put(`/api/experiences/${experience._id}/plan-item/${planItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      const body = response.body?.data || response.body;

      expect(response.status).toBe(200);
      const updatedItem = body.plan_items.find(item => item._id.toString() === planItemId.toString());
      expect(updatedItem.text).toBe(updateData.text);
      expect(updatedItem.cost_estimate).toBe(updateData.cost_estimate);

      logger.success('Plan item updated successfully');
    });

    test('DELETE /api/experiences/:id/plan-item/:planItemId - should delete plan item', async () => {
      logger.section('DELETE Plan Item - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination, {
        plan_items: [{
          text: 'Item to delete',
          cost_estimate: 100,
          planning_days: 1
        }]
      });

      const planItemId = experience.plan_items[0]._id;

      const response = await request(app)
        .delete(`/api/experiences/${experience._id}/plan-item/${planItemId}`)
        .set('Authorization', `Bearer ${token}`);

      const body = response.body?.data || response.body;

      expect(response.status).toBe(200);
      expect(body.plan_items.length).toBe(0);

      logger.success('Plan item deleted successfully');
    });
  });

  describe('Permission Management', () => {
    test('POST /api/experiences/:id/permissions - should add collaborator', async () => {
      logger.section('POST Permissions - Add collaborator');

      const owner = await createTestUser({ email: 'owner@test.com' });
      const collaborator = await createTestUser({ email: 'collaborator@test.com' });
      const ownerToken = generateAuthToken(owner);

      const destination = await createTestDestination(owner);
      const experience = await createTestExperience(owner, destination);

      const response = await request(app)
        .post(`/api/experiences/${experience._id}/permissions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          _id: collaborator._id.toString(),
          entity: 'user',
          type: 'collaborator'
        });

      const responseExperience = response.body?.data || response.body;

      expect(response.status).toBe(201);
      expect(responseExperience).toBeTruthy();
      const collaboratorPerm = responseExperience.permissions.find(
        p => p._id.toString() === collaborator._id.toString() && p.type === 'collaborator'
      );
      expect(collaboratorPerm).toBeTruthy();

      logger.success('Collaborator added successfully');
    });

    test('GET /api/experiences/:id/permissions - should return permissions', async () => {
      logger.section('GET Permissions - Success case');

      const owner = await createTestUser();
      const token = generateAuthToken(owner);
      const destination = await createTestDestination(owner);
      const experience = await createTestExperience(owner, destination);

      const response = await request(app)
        .get(`/api/experiences/${experience._id}/permissions`)
        .set('Authorization', `Bearer ${token}`);

      const body = response.body?.data || response.body;

      expect(response.status).toBe(200);
      expect(Array.isArray(body.permissions)).toBe(true);
      expect(body.permissions.length).toBeGreaterThan(0);

      logger.success('Permissions fetched successfully');
    });

    test('DELETE /api/experiences/:id/permissions/:entityId/:entityType - should remove permission', async () => {
      logger.section('DELETE Permission - Success case');

      const owner = await createTestUser({ email: 'owner@test.com' });
      const collaborator = await createTestUser({ email: 'collaborator@test.com' });
      const ownerToken = generateAuthToken(owner);

      const destination = await createTestDestination(owner);
      const experience = await createTestExperience(owner, destination, {
        permissions: [
          { _id: owner._id, entity: 'user', type: 'owner' },
          { _id: collaborator._id, entity: 'user', type: 'collaborator' }
        ]
      });

      const response = await request(app)
        .delete(`/api/experiences/${experience._id}/permissions/${collaborator._id}/user`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const responseExperience = response.body?.data?.experience || response.body?.data || response.body?.experience;

      expect(response.status).toBe(200);
      expect(responseExperience).toBeTruthy();
      const removedPerm = responseExperience.permissions.find(
        p => p._id.toString() === collaborator._id.toString() && p.type === 'collaborator'
      );
      expect(removedPerm).toBeFalsy();

      logger.success('Permission removed successfully');
    });
  });

  describe('Tags Endpoints', () => {
    test('GET /api/experiences/tags - should return all tags', async () => {
      logger.section('GET Tags - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      await createTestExperience(user, destination, { experience_type: 'outdoor' });
      await createTestExperience(user, destination, { experience_type: 'food-drink' });
      await createTestExperience(user, destination, { experience_type: 'outdoor' }); // duplicate

      const response = await request(app)
        .get('/api/experiences/tags')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      // Should have unique tags
      expect(response.body.data).toContain('outdoor');
      expect(response.body.data).toContain('food-drink');

      logger.success('Tags fetched successfully');
    });

    test('GET /api/experiences/tag/:tagSlug - should return tag name', async () => {
      logger.section('GET Tag by Slug - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      await createTestExperience(user, destination, { experience_type: 'Food & Drink' });

      const response = await request(app)
        .get('/api/experiences/tag/food-drink')
        .set('Authorization', `Bearer ${token}`);

      // The response should resolve the slug to the actual tag name
      expect(response.status).toBe(200);

      logger.success('Tag resolved by slug');
    });
  });

  describe('User Experiences', () => {
    test('GET /api/experiences/user/:userId - should return user experiences (based on plans)', async () => {
      logger.section('GET User Experiences - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      // Create experiences and plans for them (endpoint returns experiences where user has plans)
      const exp1 = await createTestExperience(user, destination, { name: 'User Experience 1' });
      const exp2 = await createTestExperience(user, destination, { name: 'User Experience 2' });

      // Import Plan and create plans for the experiences
      const Plan = require('../../models/plan');
      await Plan.create({ user: user._id, experience: exp1._id, planned_date: new Date(), permissions: [{ _id: user._id, entity: 'user', type: 'owner' }] });
      await Plan.create({ user: user._id, experience: exp2._id, planned_date: new Date(), permissions: [{ _id: user._id, entity: 'user', type: 'owner' }] });

      const response = await request(app)
        .get(`/api/experiences/user/${user._id}`)
        .set('Authorization', `Bearer ${token}`);

      const body = response.body?.data || response.body;

      expect(response.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);

      logger.success('User experiences fetched successfully');
    });

    test('GET /api/experiences/user/:userId/created - should return user created experiences', async () => {
      logger.section('GET User Created Experiences - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      await createTestExperience(user, destination, { name: 'Created Experience' });

      const response = await request(app)
        .get(`/api/experiences/user/${user._id}/created`)
        .set('Authorization', `Bearer ${token}`);

      const body = response.body?.data || response.body;

      expect(response.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);

      logger.success('User created experiences fetched successfully');
    });
  });

  describe('Experience With Context', () => {
    test('GET /api/experiences/:id/with-context - should return experience with additional data', async () => {
      logger.section('GET Experience With Context - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination);

      const response = await request(app)
        .get(`/api/experiences/${experience._id}/with-context`)
        .set('Authorization', `Bearer ${token}`);

      const body = response.body?.data || response.body;

      expect(response.status).toBe(200);
      expect(body).toHaveProperty('experience');

      logger.success('Experience with context fetched successfully');
    });
  });
});
