/**
 * Integration tests for Collaborative Plans
 * Tests that plans where a user is added as a collaborator show up correctly
 */

const request = require('supertest');
const app = require('../../app');
const { createTestUser, createTestDestination, createTestExperience, generateAuthToken, clearTestData } = require('../utils/testHelpers');
const dbSetup = require('../setup/testSetup');

describe('Collaborative Plans Integration Tests', () => {
  let user1, user2, user3, experience, destination, authToken1, authToken2, authToken3;

  beforeAll(async () => {
    // Connect to in-memory test database
    await dbSetup.connect();
  });

  beforeEach(async () => {
    // Clear all test data (safe because we're using in-memory database)
    await clearTestData();

    // Create test users
    user1 = await createTestUser({ name: 'Alice', email: 'alice@example.com' });
    user2 = await createTestUser({ name: 'Bob', email: 'bob@example.com' });
    user3 = await createTestUser({ name: 'Charlie', email: 'charlie@example.com' });

    // Generate auth tokens AFTER creating users (important for JWT validation)
    authToken1 = generateAuthToken(user1);
    authToken2 = generateAuthToken(user2);
    authToken3 = generateAuthToken(user3);

    // Create destination and experience (owned by user1)
    destination = await createTestDestination(user1);
    experience = await createTestExperience(user1, destination, {
      plan_items: [
        { text: 'Plan Item 1', cost_estimate: 100, planning_days: 2 },
        { text: 'Plan Item 2', cost_estimate: 50, planning_days: 1 }
      ]
    });
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  describe('getExperiencePlans - Collaborative Plans Query', () => {
    test('should return user\'s own plan', async () => {
      // User2 creates their own plan
      const createResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken2)
        .send({ planned_date: new Date() });

      expect(createResponse.status).toBe(201);
      const planId = createResponse.body._id;

      // User2 fetches all plans for this experience
      const response = await request(app)
        .get(`/api/plans/experience/${experience._id}/all`)
        .set('Authorization', authToken2);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0]._id).toBe(planId);
      expect(response.body[0].user._id).toBe(user2._id.toString());
    });

    test('should return plans where user is a collaborator', async () => {
      // User2 creates a plan
      const createResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken2)
        .send({ planned_date: new Date() });

      const planId = createResponse.body._id;

      // User2 adds User3 as a collaborator
      const addCollabResponse = await request(app)
        .post(`/api/plans/${planId}/permissions/collaborator`)
        .set('Authorization', authToken2)
        .send({ userId: user3._id.toString() });

      expect(addCollabResponse.status).toBe(200);

      // User3 fetches all plans for this experience
      const response = await request(app)
        .get(`/api/plans/experience/${experience._id}/all`)
        .set('Authorization', authToken3);

      console.log('User3 collaborative plans response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(1);

      // Find the collaborative plan
      const collaborativePlan = response.body.find(p => p._id === planId);
      expect(collaborativePlan).toBeTruthy();
      expect(collaborativePlan.user._id).toBe(user2._id.toString()); // Plan owner is User2

      // Verify User3 is in permissions as collaborator
      const user3Permission = collaborativePlan.permissions.find(
        p => p._id.toString() === user3._id.toString() && p.type === 'collaborator'
      );
      expect(user3Permission).toBeTruthy();
    });

    test('should return both own plan and collaborative plans', async () => {
      // User2 creates their own plan
      const ownPlanResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken2)
        .send({ planned_date: new Date() });

      const ownPlanId = ownPlanResponse.body._id;

      // User3 creates a plan and adds User2 as collaborator
      const collabPlanResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken3)
        .send({ planned_date: new Date() });

      const collabPlanId = collabPlanResponse.body._id;

      await request(app)
        .post(`/api/plans/${collabPlanId}/permissions/collaborator`)
        .set('Authorization', authToken3)
        .send({ userId: user2._id.toString() });

      // User2 fetches all plans for this experience
      const response = await request(app)
        .get(`/api/plans/experience/${experience._id}/all`)
        .set('Authorization', authToken2);

      console.log('User2 all plans response:', JSON.stringify(response.body, null, 2));

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2);

      // Find own plan
      const ownPlan = response.body.find(p => p._id === ownPlanId);
      expect(ownPlan).toBeTruthy();
      expect(ownPlan.user._id).toBe(user2._id.toString());

      // Find collaborative plan
      const collaborativePlan = response.body.find(p => p._id === collabPlanId);
      expect(collaborativePlan).toBeTruthy();
      expect(collaborativePlan.user._id).toBe(user3._id.toString()); // Owned by User3

      // Verify User2 is in permissions as collaborator
      const user2Permission = collaborativePlan.permissions.find(
        p => p._id.toString() === user2._id.toString() && p.type === 'collaborator'
      );
      expect(user2Permission).toBeTruthy();
    });

    test('should NOT return plans where user has no permissions', async () => {
      // User2 creates a plan
      await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken2)
        .send({ planned_date: new Date() });

      // User3 tries to fetch plans (should not see User2's plan)
      const response = await request(app)
        .get(`/api/plans/experience/${experience._id}/all`)
        .set('Authorization', authToken3);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    test('should populate user data for collaborators', async () => {
      // User2 creates a plan
      const createResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken2)
        .send({ planned_date: new Date() });

      const planId = createResponse.body._id;

      // User2 adds User3 as a collaborator
      await request(app)
        .post(`/api/plans/${planId}/permissions/collaborator`)
        .set('Authorization', authToken2)
        .send({ userId: user3._id.toString() });

      // User3 fetches plans
      const response = await request(app)
        .get(`/api/plans/experience/${experience._id}/all`)
        .set('Authorization', authToken3);

      expect(response.status).toBe(200);
      const plan = response.body[0];

      // Verify permissions have user data populated
      expect(plan.permissions).toBeInstanceOf(Array);
      expect(plan.permissions.length).toBeGreaterThan(0);

      // Find User3's permission entry
      const user3Perm = plan.permissions.find(
        p => p._id.toString() === user3._id.toString()
      );
      expect(user3Perm).toBeTruthy();
      expect(user3Perm.user).toBeTruthy();
      expect(user3Perm.user.name).toBe('Charlie');
      expect(user3Perm.user.email).toBe('charlie@example.com');
    });
  });

  describe('Frontend Display Logic - Plan Labels', () => {
    test('should identify own plan vs collaborative plan with first name', async () => {
      // User2 creates own plan
      const ownPlanResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken2)
        .send({ planned_date: new Date() });

      // User3 creates plan and adds User2 as collaborator
      const collabPlanResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken3)
        .send({ planned_date: new Date() });

      await request(app)
        .post(`/api/plans/${collabPlanResponse.body._id}/permissions/collaborator`)
        .set('Authorization', authToken3)
        .send({ userId: user2._id.toString() });

      // User2 fetches all plans
      const response = await request(app)
        .get(`/api/plans/experience/${experience._id}/all`)
        .set('Authorization', authToken2);

      const plans = response.body;

      // Simulate frontend logic (using first name extraction)
      plans.forEach(plan => {
        const isOwnPlan = plan.user._id === user2._id.toString();
        let displayName;

        if (isOwnPlan) {
          displayName = "My Plan";
        } else {
          // Extract first name from full name (split by space, take first part)
          const firstName = plan.user.name ? plan.user.name.split(' ')[0] : 'User';
          displayName = `${firstName}'s Plan`;
        }

        console.log(`Plan ${plan._id}: ${displayName} (owner: ${plan.user.name})`);

        if (plan._id === ownPlanResponse.body._id) {
          expect(displayName).toBe("My Plan");
        } else {
          // Charlie's full name is "Charlie", so first name is "Charlie"
          expect(displayName).toBe("Charlie's Plan");
        }
      });
    });

    test('should extract first name from full names correctly', () => {
      // Test first name extraction logic
      expect('John Doe'.split(' ')[0]).toBe('John');
      expect('Alice'.split(' ')[0]).toBe('Alice');
      expect('Bob Smith Jr.'.split(' ')[0]).toBe('Bob');
      expect('Maria Garcia Lopez'.split(' ')[0]).toBe('Maria');
    });
  });
});
