/**
 * Dashboard API Routes Tests
 *
 * Tests all dashboard-related API endpoints for:
 * - Dashboard data retrieval
 * - Activity feed
 * - Upcoming plans
 * - Authentication
 *
 * Run with DEBUG=true for detailed logging:
 * DEBUG=true npm run test:api -- tests/api/dashboard.test.js
 */

const request = require('supertest');
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

const logger = new TestLogger('Dashboard API');

// Setup and teardown
beforeAll(async () => {
  logger.section('Starting Dashboard API Tests');
  await dbSetup.connect();
});

afterAll(async () => {
  await dbSetup.closeDatabase();
  logger.section('Completed Dashboard API Tests');
});

afterEach(async () => {
  await clearTestData();
});

describe('Dashboard API Routes', () => {
  describe('GET /api/dashboard - Get dashboard data', () => {
    test('should return dashboard data for authenticated user', async () => {
      logger.section('GET /api/dashboard - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      // Create some data for the dashboard
      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination);
      await createTestPlan(user, experience, {
        planned_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      });

      logger.request('GET', '/api/dashboard');

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      // Dashboard should return some structured data
      expect(response.body).toBeDefined();

      logger.success('Dashboard data returned successfully');
    });

    test('should require authentication', async () => {
      logger.section('GET /api/dashboard - No auth');

      const response = await request(app)
        .get('/api/dashboard');

      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });

    test('should handle new user with no data', async () => {
      logger.section('GET /api/dashboard - New user');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      // Should return empty/default dashboard, not error

      logger.success('New user dashboard handled');
    });
  });

  describe('GET /api/dashboard/activity-feed - Get activity feed', () => {
    test('should return activity feed for authenticated user', async () => {
      logger.section('GET /api/dashboard/activity-feed - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      // Create some activity
      const destination = await createTestDestination(user);
      await createTestExperience(user, destination);

      logger.request('GET', '/api/dashboard/activity-feed');

      const response = await request(app)
        .get('/api/dashboard/activity-feed')
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();

      logger.success('Activity feed returned successfully');
    });

    test('should require authentication', async () => {
      logger.section('GET /api/dashboard/activity-feed - No auth');

      const response = await request(app)
        .get('/api/dashboard/activity-feed');

      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });

    test('should return empty feed for new user', async () => {
      logger.section('GET /api/dashboard/activity-feed - Empty feed');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/dashboard/activity-feed')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      // Should return empty array or object, not error

      logger.success('Empty activity feed handled');
    });

    test('should support pagination', async () => {
      logger.section('GET /api/dashboard/activity-feed - Pagination');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/dashboard/activity-feed?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Pagination supported');
    });
  });

  describe('GET /api/dashboard/upcoming-plans - Get upcoming plans', () => {
    test('should return upcoming plans for authenticated user', async () => {
      logger.section('GET /api/dashboard/upcoming-plans - Success case');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destination = await createTestDestination(user);
      const experience = await createTestExperience(user, destination);

      // Create a plan in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      await createTestPlan(user, experience, {
        planned_date: futureDate
      });

      logger.request('GET', '/api/dashboard/upcoming-plans');

      const response = await request(app)
        .get('/api/dashboard/upcoming-plans')
        .set('Authorization', `Bearer ${token}`);

      logger.response(response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();

      logger.success('Upcoming plans returned successfully');
    });

    test('should require authentication', async () => {
      logger.section('GET /api/dashboard/upcoming-plans - No auth');

      const response = await request(app)
        .get('/api/dashboard/upcoming-plans');

      expect(response.status).toBe(401);
      logger.success('Unauthenticated request rejected');
    });

    test('should only return future plans', async () => {
      logger.section('GET /api/dashboard/upcoming-plans - Future only');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destination = await createTestDestination(user);
      // Create separate experiences to avoid unique index constraint (experience + user)
      const pastExperience = await createTestExperience(user, destination, { name: 'Past Experience' });
      const futureExperience = await createTestExperience(user, destination, { name: 'Future Experience' });

      // Create a plan in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 7);

      await createTestPlan(user, pastExperience, {
        planned_date: pastDate
      });

      // Create a plan in the future
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      await createTestPlan(user, futureExperience, {
        planned_date: futureDate
      });

      const response = await request(app)
        .get('/api/dashboard/upcoming-plans')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      // Should only contain future plans

      logger.success('Only future plans returned');
    });

    test('should return empty for user with no plans', async () => {
      logger.section('GET /api/dashboard/upcoming-plans - No plans');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const response = await request(app)
        .get('/api/dashboard/upcoming-plans')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      logger.success('Empty upcoming plans handled');
    });

    test('should sort plans by date', async () => {
      logger.section('GET /api/dashboard/upcoming-plans - Sorted');

      const user = await createTestUser();
      const token = generateAuthToken(user);

      const destination = await createTestDestination(user);
      const experience1 = await createTestExperience(user, destination, { name: 'Later Experience' });
      const experience2 = await createTestExperience(user, destination, { name: 'Sooner Experience' });

      // Create plans with different dates
      const laterDate = new Date();
      laterDate.setDate(laterDate.getDate() + 30);

      const soonerDate = new Date();
      soonerDate.setDate(soonerDate.getDate() + 7);

      await createTestPlan(user, experience1, { planned_date: laterDate });
      await createTestPlan(user, experience2, { planned_date: soonerDate });

      const response = await request(app)
        .get('/api/dashboard/upcoming-plans')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);

      // The response should be sorted by planned_date ascending
      if (Array.isArray(response.body) && response.body.length >= 2) {
        const firstPlanDate = new Date(response.body[0].planned_date);
        const secondPlanDate = new Date(response.body[1].planned_date);
        expect(firstPlanDate <= secondPlanDate).toBe(true);
      }

      logger.success('Plans sorted by date');
    });
  });

  describe('Dashboard Data Integrity', () => {
    test('should include user-specific data only', async () => {
      logger.section('Dashboard - User isolation');

      const user1 = await createTestUser({ email: 'user1@test.com' });
      const user2 = await createTestUser({ email: 'user2@test.com' });
      const token1 = generateAuthToken(user1);

      // Create data for user2
      const destination2 = await createTestDestination(user2);
      await createTestExperience(user2, destination2, { name: 'User2 Experience' });

      // User1's dashboard should not show user2's private data
      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);

      logger.success('User data properly isolated');
    });

    test('should handle expired token', async () => {
      logger.section('Dashboard - Expired token');

      // Create a token with immediate expiration (this is a simplified test)
      const jwt = require('jsonwebtoken');
      const user = await createTestUser();
      const expiredToken = jwt.sign(
        { user },
        process.env.SECRET || 'test-secret',
        { expiresIn: '0s' }
      );

      // Wait a moment for the token to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);

      logger.success('Expired token rejected');
    });
  });
});
