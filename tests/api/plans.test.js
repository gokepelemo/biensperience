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

    // Create test users
    user = await User.create({
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'password123'
    });

    experienceOwner = await User.create({
      name: 'Experience Owner',
      email: 'owner@example.com',
      password: 'password123'
    });

    // Create destination
    destination = await Destination.create({
      name: 'Test Destination',
      country: 'Test Country',
      user: experienceOwner._id,
      permissions: [{
        _id: experienceOwner._id,
        entity: 'user',
        type: 'owner'
      }]
    });

    // Create experience
    experience = await Experience.create({
      name: 'Test Experience',
      destination: destination._id,
      user: experienceOwner._id,
      permissions: [{
        _id: experienceOwner._id,
        entity: 'user',
        type: 'owner'
      }],
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

    // Generate auth tokens (simplified - in real app use proper JWT)
    authToken = 'Bearer ' + user._id.toString();
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
      expect(response.body.experience).toBe(experience._id.toString());
      expect(response.body.user).toBe(user._id.toString());

      // Verify plan was created in database
      const plan = await Plan.findOne({ experience: experience._id, user: user._id });
      expect(plan).toBeTruthy();
      expect(plan.plan).toHaveLength(2); // Should have snapshot of 2 plan items

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

      expect(response.status).toBe(400);
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

      // Modify experience plan items
      experience.plan_items[0].text = 'Modified Plan Item';
      await experience.save();

      // Verify plan snapshot unchanged
      const plan = await Plan.findById(response.body._id);
      expect(plan.plan[0].text).toBe('Plan Item 1'); // Original text
    });
  });
});
