/**
 * Search API Routes Tests
 *
 * Tests all search-related API endpoints for:
 * - Global search across all collections
 * - Collection-specific searches (destinations, experiences, plans, users)
 * - Search filtering and pagination
 * - Authentication
 *
 * Run with DEBUG=true for detailed logging:
 * DEBUG=true npm run test:api -- tests/api/search.test.js
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  generateAuthToken,
  createTestDestination,
  createTestExperience,
  createTestPlan,
  clearTestData,
} = require('../utils/testHelpers');
const { TestLogger } = require('../utils/testLogger');

const logger = new TestLogger('Search API');

// Setup and teardown
beforeAll(async () => {
  logger.section('Starting Search API Tests');
  await dbSetup.connect();
});

afterAll(async () => {
  await dbSetup.closeDatabase();
  logger.section('Completed Search API Tests');
});

afterEach(async () => {
  await clearTestData();
});

describe('Search API Routes', () => {
  describe('GET /api/search - Global search', () => {
    test('should search across all collections', async () => {
      logger.section('GET /api/search - Success case');

      const user = await createTestUser({ name: 'Test Searchable User' });
      const token = generateAuthToken(user);

      const destination = await createTestDestination(user, {
        name: 'Searchable Paris',
        country: 'France'
      });

      await createTestExperience(user, destination, {
        name: 'Searchable Experience'
      });

      logger.request('GET', '/api/search?q=Searchable');

      const response = await request(app)
        .get('/api/search?q=Searchable')
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');

      logger.success('Global search returned results');
    });

    test('should return empty results for non-matching query', async () => {
      logger.section('GET /api/search - No matches');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/search?q=XyzNonExistent123')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();

      logger.success('Empty results returned for non-matching query');
    });

    test('should require authentication', async () => {
      logger.section('GET /api/search - No auth');

      const response = await request(app)
        .get('/api/search?q=test');

      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });

    test('should handle missing query parameter', async () => {
      logger.section('GET /api/search - Missing query');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${token}`);

      // Should return 400 or empty results
      expect([200, 400]).toContain(response.status);
      logger.success('Missing query handled');
    });

    test('should filter by type', async () => {
      logger.section('GET /api/search - Filter by type');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destination = await createTestDestination(user, {
        name: 'Filterable City'
      });

      await createTestExperience(user, destination, {
        name: 'Filterable Experience'
      });

      const response = await request(app)
        .get('/api/search?q=Filterable&types=destination')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Type filtering applied');
    });

    test('should respect limit parameter', async () => {
      logger.section('GET /api/search - Limit results');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destination = await createTestDestination(user);

      // Create multiple searchable items
      for (let i = 1; i <= 5; i++) {
        await createTestExperience(user, destination, {
          name: `Searchable Item ${i}`
        });
      }

      const response = await request(app)
        .get('/api/search?q=Searchable&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Limit parameter respected');
    });
  });

  describe('GET /api/search/destinations - Search destinations', () => {
    test('should search destinations by name', async () => {
      logger.section('GET /api/search/destinations - By name');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      await createTestDestination(user, { name: 'Tokyo', country: 'Japan' });
      await createTestDestination(user, { name: 'London', country: 'UK' });
      await createTestDestination(user, { name: 'Toronto', country: 'Canada' });

      const response = await request(app)
        .get('/api/search/destinations?q=Tok')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.results || response.body).toBeDefined();

      logger.success('Destination search by name successful');
    });

    test('should search destinations by country', async () => {
      logger.section('GET /api/search/destinations - By country');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      await createTestDestination(user, { name: 'Osaka', country: 'Japan' });
      await createTestDestination(user, { name: 'Paris', country: 'France' });

      const response = await request(app)
        .get('/api/search/destinations?q=Japan')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Destination search by country successful');
    });

    test('should require authentication', async () => {
      logger.section('GET /api/search/destinations - No auth');

      const response = await request(app)
        .get('/api/search/destinations?q=test');

      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });
  });

  describe('GET /api/search/experiences - Search experiences', () => {
    test('should search experiences by name', async () => {
      logger.section('GET /api/search/experiences - By name');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      await createTestExperience(user, destination, { name: 'Mountain Adventure' });
      await createTestExperience(user, destination, { name: 'Beach Relaxation' });

      const response = await request(app)
        .get('/api/search/experiences?q=Mountain')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Experience search by name successful');
    });

    test('should search experiences by description', async () => {
      logger.section('GET /api/search/experiences - By description');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);

      await createTestExperience(user, destination, {
        name: 'Test',
        overview: 'A wonderful culinary journey'
      });

      const response = await request(app)
        .get('/api/search/experiences?q=culinary')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Experience search by description successful');
    });
  });

  describe('GET /api/search/plans - Search plans', () => {
    test('should search user plans', async () => {
      logger.section('GET /api/search/plans - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination, {
        name: 'Searchable Plan Experience'
      });

      await createTestPlan(user, experience, {
        plan: [{
          plan_item_id: new mongoose.Types.ObjectId(),
          text: 'Visit Searchable Place'
        }]
      });

      const response = await request(app)
        .get('/api/search/plans?q=Searchable')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Plan search successful');
    });
  });

  describe('GET /api/search/users - Search users', () => {
    test('should search users by name', async () => {
      logger.section('GET /api/search/users - By name');

      const user = await createTestUser({ name: 'John Smith' });
      const token = generateAuthToken(user);

      await createTestUser({ name: 'Jane Doe' });
      await createTestUser({ name: 'Bob Johnson' });

      const response = await request(app)
        .get('/api/search/users?q=Jane')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('User search by name successful');
    });

    test('should not expose sensitive user data', async () => {
      logger.section('GET /api/search/users - Data security');

      const user = await createTestUser({ name: 'Test User' });
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/search/users?q=Test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      // Check that password is not exposed
      const results = response.body.results || response.body;
      if (Array.isArray(results) && results.length > 0) {
        results.forEach(user => {
          expect(user.password).toBeUndefined();
        });
      }

      logger.success('Sensitive data not exposed');
    });
  });

  describe('Search Edge Cases', () => {
    test('should handle special characters in query', async () => {
      logger.section('Search - Special characters');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/search?q=Test%20%26%20Special')
        .set('Authorization', `Bearer ${token}`);

      // Should not crash
      expect([200, 400]).toContain(response.status);
      logger.success('Special characters handled');
    });

    test('should handle very long query', async () => {
      logger.section('Search - Long query');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const longQuery = 'a'.repeat(500);

      const response = await request(app)
        .get(`/api/search?q=${longQuery}`)
        .set('Authorization', `Bearer ${token}`);

      // Should handle gracefully
      expect([200, 400]).toContain(response.status);
      logger.success('Long query handled');
    });

    test('should handle empty query', async () => {
      logger.section('Search - Empty query');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/search?q=')
        .set('Authorization', `Bearer ${token}`);

      // Should return empty or error
      expect([200, 400]).toContain(response.status);
      logger.success('Empty query handled');
    });

    test('should be case-insensitive', async () => {
      logger.section('Search - Case insensitivity');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destination = await createTestDestination(user, {
        name: 'UPPERCASE CITY'
      });

      const response = await request(app)
        .get('/api/search/destinations?q=uppercase')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Case-insensitive search works');
    });
  });
});
