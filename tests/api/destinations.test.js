/**
 * Destinations API Routes Tests
 *
 * Tests all destination-related API endpoints for:
 * - Expected output formats
 * - Data types and validation
 * - Error handling
 * - Authentication
 * - Edge cases
 *
 * Run with DEBUG=true for detailed logging:
 * DEBUG=true npm test tests/api/destinations.test.js
 */

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  generateAuthToken,
  createTestDestination,
  clearTestData,
  validators,
  createMultipleTestDestinations,
} = require('../utils/testHelpers');
const { TestLogger } = require('../utils/testLogger');

const logger = new TestLogger('Destinations API');

// Setup and teardown
beforeAll(async () => {
  logger.section('Starting Destinations API Tests');
  await dbSetup.connect();
});

afterAll(async () => {
  await dbSetup.closeDatabase();
  logger.section('Completed Destinations API Tests');
});

afterEach(async () => {
  await clearTestData();
});

describe('Destinations API Routes', () => {
  describe('GET /api/destinations - Get all destinations', () => {
    test('should return all destinations for authenticated user', async () => {
      logger.section('GET /api/destinations - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      logger.log('Created test user', { userId: user._id, email: user.email });

      // Create test destinations
      const destinations = await createMultipleTestDestinations(user, 3);
      logger.log(`Created ${destinations.length} test destinations`);

      logger.startTimer();
      logger.request('GET', '/api/destinations');

      const response = await request(app)
        .get('/api/destinations')
        .set('Authorization', `Bearer ${token}`);

      logger.endTimer('GET /api/destinations');
      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      validators.isArray(response);
      const body = response.body.data || response.body;
      expect(body.length).toBe(3);

      body.forEach((destination) => {
        validators.isValidDestination(destination);
      });

      logger.success('All destinations returned successfully');
    });

    test('should return destinations without authentication (public endpoint)', async () => {
      logger.section('GET /api/destinations - Public access');

      logger.request('GET', '/api/destinations (no auth)');
      const response = await request(app).get('/api/destinations');

      logger.response(response.status, response.body);
      // GET /api/destinations is a public endpoint, returns 200
      expect(response.status).toBe(200);
      logger.success('Public destinations endpoint accessible');
    });

    test('should return empty array when no destinations exist', async () => {
      logger.section('GET /api/destinations - Empty case');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      logger.request('GET', '/api/destinations (empty database)');
      const response = await request(app)
        .get('/api/destinations')
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);
  expect(response.status).toBe(200);
  validators.isArray(response);
  const body = response.body.data || response.body;
  expect(body.length).toBe(0);
      logger.success('Empty array returned correctly');
    });
  });

  describe('POST /api/destinations - Create destination', () => {
    test('should create a new destination with valid data', async () => {
      logger.section('POST /api/destinations - Success case');

      const user = await createTestUser({ isSuperAdmin: true, role: 'super_admin' });
      const token = generateAuthToken(user);

      const newDestination = {
        name: 'Paris',
        country: 'France',
        state: 'Île-de-France',
        travel_tips: ['Visit Eiffel Tower', 'Try local cuisine'],
      };

      logger.request('POST', '/api/destinations', newDestination);
      logger.startTimer();

      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${token}`)
        .send(newDestination);

      logger.endTimer('POST /api/destinations');
      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      validators.isValidDestination(response.body);
      expect(response.body.name).toBe(newDestination.name);
      expect(response.body.country).toBe(newDestination.country);
      expect(response.body.state).toBe(newDestination.state);
      expect(response.body.travel_tips).toEqual(newDestination.travel_tips);
      expect(response.body.permissions).toBeDefined();
      expect(Array.isArray(response.body.permissions)).toBe(true);
      expect(response.body.permissions.length).toBeGreaterThan(0);

      logger.success('Destination created successfully', {
        id: response.body._id,
        name: response.body.name,
      });
    });

    test('should reject duplicate destination (exact match)', async () => {
      logger.section('POST /api/destinations - Duplicate rejection');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destinationData = {
        name: 'Tokyo',
        country: 'Japan',
      };

      // Create first destination
      await createTestDestination(user, destinationData);
      logger.log('Created initial destination', destinationData);

      // Try to create duplicate
      logger.request('POST', '/api/destinations (duplicate)', destinationData);
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${token}`)
        .send(destinationData);

      logger.response(response.status, response.body);
      expect(response.status).toBe(409);
      validators.isValidError(response, 409);
      expect(response.body.error).toBe('Duplicate destination');
      logger.success('Duplicate correctly rejected');
    });

    test('should reject invalid data types', async () => {
      logger.section('POST /api/destinations - Invalid data types');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const invalidDestination = {
        name: 123, // Should be string
        country: true, // Should be string
      };

      logger.request('POST', '/api/destinations (invalid types)', invalidDestination);
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidDestination);

      logger.response(response.status, response.body);
      expect(response.status).toBe(400);
      logger.success('Invalid data types rejected');
    });

    test('should reject request without authentication', async () => {
      logger.section('POST /api/destinations - No auth');

      const newDestination = {
        name: 'London',
        country: 'UK',
      };

      logger.request('POST', '/api/destinations (no auth)', newDestination);
      const response = await request(app)
        .post('/api/destinations')
        .send(newDestination);

      logger.response(response.status);
      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });
  });

  describe('GET /api/destinations/:id - Get single destination', () => {
    test('should return a single destination by ID', async () => {
      logger.section('GET /api/destinations/:id - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      logger.request('GET', `/api/destinations/${destination._id}`);
      logger.startTimer();

      const response = await request(app)
        .get(`/api/destinations/${destination._id}`)
        .set('Authorization', `Bearer ${token}`);

      logger.endTimer('GET single destination');
      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      validators.isValidDestination(response.body);
      expect(response.body._id.toString()).toBe(destination._id.toString());
      expect(response.body.name).toBe(destination.name);

      logger.success('Single destination fetched successfully');
    });

    test('should return 400 for invalid ID format', async () => {
      logger.section('GET /api/destinations/:id - Invalid ID');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      logger.request('GET', '/api/destinations/invalid-id');
      const response = await request(app)
        .get('/api/destinations/invalid-id')
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);
      expect(response.status).toBe(400);
      logger.success('Invalid ID rejected');
    });

    test('should return destination without authentication (public endpoint)', async () => {
      logger.section('GET /api/destinations/:id - Public access');

      const user = await createTestUser();
      const destination = await createTestDestination(user);

      logger.request('GET', `/api/destinations/${destination._id} (no auth)`);
      const response = await request(app).get(`/api/destinations/${destination._id}`);

      logger.response(response.status);
      // GET /api/destinations/:id is a public endpoint, returns 200
      expect(response.status).toBe(200);
      logger.success('Public destination endpoint accessible');
    });
  });

  describe('PUT /api/destinations/:id - Update destination', () => {
    test('should update destination with valid data', async () => {
      logger.section('PUT /api/destinations/:id - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user, {
        name: 'Old Name',
        country: 'Old Country',
      });

      const updateData = {
        name: 'New Name',
        country: 'New Country',
        travel_tips: ['New tip 1', 'New tip 2'],
      };

      logger.request('PUT', `/api/destinations/${destination._id}`, updateData);
      logger.startTimer();

      const response = await request(app)
        .put(`/api/destinations/${destination._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      logger.endTimer('PUT /api/destinations/:id');
      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      validators.isValidDestination(response.body);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.country).toBe(updateData.country);
      expect(response.body.travel_tips).toEqual(updateData.travel_tips);

      logger.success('Destination updated successfully');
    });

    test('should reject update from non-owner', async () => {
      logger.section('PUT /api/destinations/:id - Authorization failure');

      const owner = await createTestUser({ email: 'owner@test.com' });
      const otherUser = await createTestUser({ email: 'other@test.com' });
      const otherToken = generateAuthToken(otherUser);

      const destination = await createTestDestination(owner);

      const updateData = { name: 'Unauthorized Update' };

      logger.request('PUT', `/api/destinations/${destination._id} (wrong user)`, updateData);
      const response = await request(app)
        .put(`/api/destinations/${destination._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(updateData);

      logger.response(response.status);
      expect(response.status).toBe(403);
      logger.success('Unauthorized update rejected');
    });

    test('should reject duplicate name/country combination', async () => {
      logger.section('PUT /api/destinations/:id - Duplicate rejection');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destination1 = await createTestDestination(user, {
        name: 'City A',
        country: 'Country X',
      });

      const destination2 = await createTestDestination(user, {
        name: 'City B',
        country: 'Country Y',
      });

      // Try to update destination2 to match destination1
      const updateData = {
        name: 'City A',
        country: 'Country X',
      };

      logger.request('PUT', `/api/destinations/${destination2._id} (duplicate)`, updateData);
      const response = await request(app)
        .put(`/api/destinations/${destination2._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      logger.response(response.status, response.body);
      expect(response.status).toBe(409);
      validators.isValidError(response, 409);
      logger.success('Duplicate update rejected');
    });
  });

  describe('DELETE /api/destinations/:id - Delete destination', () => {
    test('should delete destination successfully', async () => {
      logger.section('DELETE /api/destinations/:id - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      logger.request('DELETE', `/api/destinations/${destination._id}`);
      logger.startTimer();

      const response = await request(app)
        .delete(`/api/destinations/${destination._id}`)
        .set('Authorization', `Bearer ${token}`);

      logger.endTimer('DELETE /api/destinations/:id');
      logger.response(response.status, response.body);

      expect(response.status).toBe(200);

      // Verify it's actually deleted
      const Destination = require('../../models/destination');
      const deletedDestination = await Destination.findById(destination._id);
      expect(deletedDestination).toBeNull();

      logger.success('Destination deleted successfully');
    });

    test('should reject delete from non-owner', async () => {
      logger.section('DELETE /api/destinations/:id - Authorization failure');

      const owner = await createTestUser({ email: 'owner@test.com' });
      const otherUser = await createTestUser({ email: 'other@test.com' });
      const otherToken = generateAuthToken(otherUser);

      const destination = await createTestDestination(owner);

      logger.request('DELETE', `/api/destinations/${destination._id} (wrong user)`);
      const response = await request(app)
        .delete(`/api/destinations/${destination._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      logger.response(response.status);
      expect(response.status).toBe(403);
      logger.success('Unauthorized delete rejected');
    });
  });

  describe('POST /api/destinations/:destinationId/user/:userId - Toggle favorite', () => {
    test('should add destination to favorites', async () => {
      logger.section('POST Toggle favorite - Add to favorites');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      logger.request('POST', `/api/destinations/${destination._id}/user/${user._id}`);
      logger.startTimer();

      const response = await request(app)
        .post(`/api/destinations/${destination._id}/user/${user._id}`)
        .set('Authorization', `Bearer ${token}`);

      logger.endTimer('Toggle favorite (add)');
      logger.response(response.status, response.body);

      expect(response.status).toBe(201);
      validators.isValidDestination(response.body);
      expect(response.body.users_favorite).toContain(user._id.toString());

      logger.success('Destination added to favorites', {
        favorites: response.body.users_favorite,
      });
    });

    test('should remove destination from favorites', async () => {
      logger.section('POST Toggle favorite - Remove from favorites');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user, {
        users_favorite: [user._id],
      });

      logger.log('Initial favorites', { favorites: destination.users_favorite });
      logger.request('POST', `/api/destinations/${destination._id}/user/${user._id}`);
      logger.startTimer();

      const response = await request(app)
        .post(`/api/destinations/${destination._id}/user/${user._id}`)
        .set('Authorization', `Bearer ${token}`);

      logger.endTimer('Toggle favorite (remove)');
      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      validators.isValidDestination(response.body);
      expect(response.body.users_favorite).not.toContainEqual(user._id);

      logger.success('Destination removed from favorites', {
        favorites: response.body.users_favorite,
      });
    });

    test('should return 401 without authentication', async () => {
      logger.section('POST Toggle favorite - No auth');

      const user = await createTestUser();
      const destination = await createTestDestination(user);

      logger.request('POST', `/api/destinations/${destination._id}/user/${user._id} (no auth)`);
      const response = await request(app).post(
        `/api/destinations/${destination._id}/user/${user._id}`
      );

      logger.response(response.status);
      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });

    test('should handle invalid destination ID', async () => {
      logger.section('POST Toggle favorite - Invalid destination ID');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      logger.request('POST', '/api/destinations/invalid-id/user/' + user._id);
      const response = await request(app)
        .post(`/api/destinations/invalid-id/user/${user._id}`)
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);
      expect(response.status).toBe(400);
      logger.success('Invalid ID rejected');
    });
  });

  describe('Data Type Validation Tests', () => {
    test('should validate all destination fields have correct types', async () => {
      logger.section('Data Type Validation');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user, {
        name: 'Type Test City',
        country: 'Type Test Country',
        state: 'Type Test State',
        travel_tips: ['Tip 1', 'Tip 2', 'Tip 3'],
      });

      const response = await request(app)
        .get(`/api/destinations/${destination._id}`)
        .set('Authorization', `Bearer ${token}`);

      logger.table(
        {
          _id: typeof response.body._id,
          name: typeof response.body.name,
          country: typeof response.body.country,
          state: typeof response.body.state,
          user: typeof response.body.user,
          users_favorite: Array.isArray(response.body.users_favorite) ? 'array' : 'not array',
          travel_tips: Array.isArray(response.body.travel_tips) ? 'array' : 'not array',
        },
        'Destination Field Types'
      );

      expect(typeof response.body._id).toBe('string');
      expect(typeof response.body.name).toBe('string');
      expect(typeof response.body.country).toBe('string');
      expect(typeof response.body.state).toBe('string');
      expect(Array.isArray(response.body.users_favorite)).toBe(true);
      expect(Array.isArray(response.body.travel_tips)).toBe(true);

      logger.success('All data types validated successfully');
    });
  });
});
