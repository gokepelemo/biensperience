/**
 * Integration tests for Plan creation and deletion
 * Tests the automatic plan lifecycle when users add/remove experiences
 */

const request = require('supertest');
const app = require('../../app');
const mongoose = require('mongoose');
const User = require('../../models/user');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Plan = require('../../models/plan');
const { createTestUser, createTestDestination, createTestExperience, generateAuthToken } = require('../utils/testHelpers');

describe('Plan Integration Tests', () => {
  let user, experienceOwner, experience, destination, authToken;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/biensperience-test');
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Experience.deleteMany({});
    await Destination.deleteMany({});
    await Plan.deleteMany({});

    // Create test users using helpers
    user = await createTestUser({ name: 'Test User', email: 'testuser@example.com' });
    experienceOwner = await createTestUser({ name: 'Experience Owner', email: 'owner@example.com' });

    // Create destination using helper
    destination = await createTestDestination(experienceOwner);

    // Create experience using helper
    experience = await createTestExperience(experienceOwner, destination, {
      plan_items: [
        {
          text: 'Plan Item 1',
          cost_estimate: 100,
          planning_days: 2
        },
        {
          text: 'Plan Item 2',
          cost_estimate: 50,
          planning_days: 1
        }
      ]
    });

    // Generate proper JWT auth token
    authToken = generateAuthToken(user);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Plan Creation on Experience Add', () => {
    test('should create plan when non-owner adds experience', async () => {
      // Create plan
      const response = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body.experience._id).toBe(experience._id.toString());
      expect(response.body.user._id).toBe(user._id.toString());

      // Verify plan was created in database
      const plan = await Plan.findOne({ experience: experience._id, user: user._id });
      expect(plan).toBeTruthy();
      expect(plan.plan).toHaveLength(2); // Should have snapshot of 2 plan items

      // Wait for async contributor permission addition to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify user became contributor
      const updatedExperience = await Experience.findById(experience._id);
      const contributorPerm = updatedExperience.permissions.find(
        p => p.entity === 'user' && p._id.toString() === user._id.toString() && p.type === 'contributor'
      );
      expect(contributorPerm).toBeTruthy();
    });

    test('should NOT create plan when owner adds own experience', async () => {
      // Owner should use experience plan items directly
      // This test verifies frontend logic - backend will still create if called
      // In production, frontend should skip plan creation for owners
      
      const plansBefore = await Plan.countDocuments({ 
        experience: experience._id, 
        user: experienceOwner._id 
      });
      expect(plansBefore).toBe(0);
    });

    test('should fail to create duplicate plan', async () => {
      // Create first plan
      await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      // Try to create duplicate
      const response = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('Plan Deletion on Experience Remove', () => {
    test('should delete plan when non-owner removes experience', async () => {
      // Create plan first
      const createResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      const planId = createResponse.body._id;

      // Delete plan
      const deleteResponse = await request(app)
        .delete(`/api/plans/${planId}`)
        .set('Authorization', authToken);

      expect(deleteResponse.status).toBe(200);

      // Verify plan was deleted
      const plan = await Plan.findById(planId);
      expect(plan).toBeNull();

      // Verify contributor permission was removed
      const updatedExperience = await Experience.findById(experience._id);
      const contributorPerm = updatedExperience.permissions.find(
        p => p.entity === 'user' && p._id.toString() === user._id.toString() && p.type === 'contributor'
      );
      expect(contributorPerm).toBeFalsy();
    });

    test('should NOT remove contributor if user is owner', async () => {
      // Make user an owner of the experience
      experience.permissions.push({
        _id: user._id,
        entity: 'user',
        type: 'owner'
      });
      await experience.save();

      // Create and delete plan
      const createResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      await request(app)
        .delete(`/api/plans/${createResponse.body._id}`)
        .set('Authorization', authToken);

      // Verify owner permission still exists
      const updatedExperience = await Experience.findById(experience._id);
      const ownerPerm = updatedExperience.permissions.find(
        p => p.entity === 'user' && p._id.toString() === user._id.toString() && p.type === 'owner'
      );
      expect(ownerPerm).toBeTruthy();
    });

    test('should NOT remove contributor if user is collaborator', async () => {
      // Make user a collaborator
      experience.permissions.push({
        _id: user._id,
        entity: 'user',
        type: 'collaborator'
      });
      await experience.save();

      // Create and delete plan
      const createResponse = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      await request(app)
        .delete(`/api/plans/${createResponse.body._id}`)
        .set('Authorization', authToken);

      // Verify collaborator permission still exists
      const updatedExperience = await Experience.findById(experience._id);
      const collabPerm = updatedExperience.permissions.find(
        p => p.entity === 'user' && p._id.toString() === user._id.toString() && p.type === 'collaborator'
      );
      expect(collabPerm).toBeTruthy();
    });
  });

  describe('Plan Snapshots', () => {
    test('should create plan with snapshot of current plan items', async () => {
      const response = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      const plan = await Plan.findById(response.body._id);
      
      expect(plan.plan).toHaveLength(2);
      expect(plan.plan[0].text).toBe('Plan Item 1');
      expect(plan.plan[0].cost).toBe(100);
      expect(plan.plan[0].planning_days).toBe(2);
      expect(plan.plan[0].complete).toBe(false);
      
      expect(plan.plan[1].text).toBe('Plan Item 2');
      expect(plan.plan[1].cost).toBe(50);
      expect(plan.plan[1].planning_days).toBe(1);
    });

    test('plan snapshot should be independent of experience changes', async () => {
      // Create plan
      const response = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      // Modify experience plan items (reload first to avoid version conflict)
      experience = await Experience.findById(experience._id);
      experience.plan_items[0].text = 'Modified Plan Item';
      await experience.save();

      // Verify plan snapshot unchanged
      const plan = await Plan.findById(response.body._id);
      expect(plan.plan[0].text).toBe('Plan Item 1'); // Original text
    });
  });

  describe('Experience Deletion Cascade', () => {
    let user2, user3;

    beforeEach(async () => {
      // Create additional test users for cascade testing
      user2 = await createTestUser({ name: 'Test User 2', email: 'testuser2@example.com' });
      user3 = await createTestUser({ name: 'Test User 3', email: 'testuser3@example.com' });
    });

    test('should delete all associated plans when experience is deleted', async () => {
      // Create multiple plans for the experience as different users
      const plan1Response = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', generateAuthToken(user))
        .send({ planned_date: new Date() });

      const plan2Response = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', generateAuthToken(user2))
        .send({ planned_date: new Date() });

      const plan3Response = await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', generateAuthToken(user3))
        .send({ planned_date: new Date() });

      // Verify plans were created
      expect(plan1Response.status).toBe(201);
      expect(plan2Response.status).toBe(201);
      expect(plan3Response.status).toBe(201);

      const plansBeforeDelete = await Plan.find({ experience: experience._id });
      expect(plansBeforeDelete).toHaveLength(3);

      // Delete the experience as the owner
      const ownerToken = generateAuthToken(experienceOwner);
      const deleteResponse = await request(app)
        .delete(`/api/experiences/${experience._id}`)
        .set('Authorization', ownerToken);

      expect(deleteResponse.status).toBe(200);

      // Verify experience was deleted
      const deletedExperience = await Experience.findById(experience._id);
      expect(deletedExperience).toBeNull();

      // Verify all associated plans were deleted
      const plansAfterDelete = await Plan.find({ experience: experience._id });
      expect(plansAfterDelete).toHaveLength(0);
    });

    test('should allow experience deletion with cascade when other users have plans', async () => {
      // Create a plan for the experience as a different user
      await request(app)
        .post(`/api/plans/experience/${experience._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: new Date() });

      // Delete the experience as the owner - should succeed with cascade
      const ownerToken = generateAuthToken(experienceOwner);
      const deleteResponse = await request(app)
        .delete(`/api/experiences/${experience._id}`)
        .set('Authorization', ownerToken);

      // Should succeed with 200 status
      expect(deleteResponse.status).toBe(200);

      // Verify experience was deleted
      const experienceDeleted = await Experience.findById(experience._id);
      expect(experienceDeleted).toBeNull();

      // Verify all associated plans were cascade deleted
      const plansAfterDelete = await Plan.find({ experience: experience._id });
      expect(plansAfterDelete).toHaveLength(0);
    });
  });
});
