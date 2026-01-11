/**
 * Integration tests for plan item scheduling policy
 *
 * Policy:
 * - Only root (parent) plan items can be scheduled (scheduled_date/scheduled_time)
 * - Child items must follow the parent in Timeline grouping and cannot set their own schedule
 */

const request = require('supertest');
const app = require('../../app');
const Plan = require('../../models/plan');
const {
  createTestUser,
  createTestDestination,
  createTestExperience,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const dbSetup = require('../setup/testSetup');

describe('Plan Item Scheduling Policy', () => {
  let user, experienceOwner, experience, destination, authToken;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  beforeEach(async () => {
    await clearTestData();

    user = await createTestUser({ name: 'Test User', email: 'testuser@example.com' });
    experienceOwner = await createTestUser({ name: 'Experience Owner', email: 'owner@example.com' });

    destination = await createTestDestination(experienceOwner);
    experience = await createTestExperience(experienceOwner, destination, {
      plan_items: [
        { text: 'Root Item 1', cost_estimate: 10, planning_days: 1 },
        { text: 'Root Item 2', cost_estimate: 20, planning_days: 2 }
      ]
    });

    authToken = generateAuthToken(user);
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  test('rejects scheduling updates on child plan items', async () => {
    // Create a plan from the experience snapshot
    const createRes = await request(app)
      .post(`/api/plans/experience/${experience._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: new Date() });

    expect(createRes.status).toBe(201);
    const createdPlan = createRes.body?.data || createRes.body;
    const planId = createdPlan._id;

    // Add a child item under the first root item
    const rootItem = (createdPlan.plan || [])[0];
    expect(rootItem).toBeTruthy();

    const parentRef = rootItem.plan_item_id || rootItem._id;

    const addChildRes = await request(app)
      .post(`/api/plans/${planId}/items`)
      .set('Authorization', authToken)
      .send({ text: 'Child Item', parent: parentRef });

    expect(addChildRes.status).toBe(200);
    const planWithChild = addChildRes.body?.data || addChildRes.body;
    const childItem = (planWithChild.plan || []).find((it) => it.text === 'Child Item');
    expect(childItem).toBeTruthy();

    // Attempt to schedule the child item
    const scheduleChildRes = await request(app)
      .patch(`/api/plans/${planId}/items/${childItem._id}`)
      .set('Authorization', authToken)
      .send({
        scheduled_date: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        scheduled_time: '09:00'
      });

    expect(scheduleChildRes.status).toBe(400);
    expect(scheduleChildRes.body?.error || '').toContain('Child plan items cannot be scheduled');
  });

  test('allows scheduling updates on parent (root) plan items', async () => {
    const createRes = await request(app)
      .post(`/api/plans/experience/${experience._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: new Date() });

    expect(createRes.status).toBe(201);
    const createdPlan = createRes.body?.data || createRes.body;
    const planId = createdPlan._id;

    const rootItem = (createdPlan.plan || [])[0];
    expect(rootItem).toBeTruthy();

    const scheduleRootRes = await request(app)
      .patch(`/api/plans/${planId}/items/${rootItem._id}`)
      .set('Authorization', authToken)
      .send({
        scheduled_date: new Date('2026-01-02T00:00:00.000Z').toISOString(),
        scheduled_time: '10:30'
      });

    expect(scheduleRootRes.status).toBe(200);

    const updatedPlan = scheduleRootRes.body?.data || scheduleRootRes.body;
    const updatedRoot = (updatedPlan.plan || []).find((it) => it._id?.toString() === rootItem._id?.toString());
    expect(updatedRoot).toBeTruthy();
    expect(updatedRoot.scheduled_date).toBeTruthy();
  });

  test('allows clearing legacy child schedule values by setting to null', async () => {
    const createRes = await request(app)
      .post(`/api/plans/experience/${experience._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: new Date() });

    expect(createRes.status).toBe(201);
    const createdPlan = createRes.body?.data || createRes.body;
    const planId = createdPlan._id;

    // Create a child item
    const rootItem = (createdPlan.plan || [])[0];
    const parentRef = rootItem.plan_item_id || rootItem._id;

    const addChildRes = await request(app)
      .post(`/api/plans/${planId}/items`)
      .set('Authorization', authToken)
      .send({ text: 'Child Item Legacy', parent: parentRef });

    expect(addChildRes.status).toBe(200);
    const planWithChild = addChildRes.body?.data || addChildRes.body;
    const childItem = (planWithChild.plan || []).find((it) => it.text === 'Child Item Legacy');
    expect(childItem).toBeTruthy();

    // Simulate legacy data by directly setting schedule values
    await Plan.updateOne(
      { _id: planId, 'plan._id': childItem._id },
      { $set: { 'plan.$.scheduled_date': new Date('2026-01-03T00:00:00.000Z'), 'plan.$.scheduled_time': '08:15' } }
    );

    // Clearing should be allowed
    const clearChildRes = await request(app)
      .patch(`/api/plans/${planId}/items/${childItem._id}`)
      .set('Authorization', authToken)
      .send({ scheduled_date: null, scheduled_time: null });

    expect(clearChildRes.status).toBe(200);
    const updatedPlan = clearChildRes.body?.data || clearChildRes.body;
    const updatedChild = (updatedPlan.plan || []).find((it) => it._id?.toString() === childItem._id?.toString());
    expect(updatedChild).toBeTruthy();
    expect(updatedChild.scheduled_date).toBeFalsy();
  });
});
