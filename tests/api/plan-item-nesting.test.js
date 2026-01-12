/**
 * Integration tests for plan item nesting rules
 * Enforces: configurable max nesting level (default: 1)
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

describe('Plan Item Nesting Rules', () => {
  let user, experienceOwner, destination, experience, authToken;

  const originalMax = process.env.PLAN_ITEM_MAX_NESTING_LEVEL;

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
        {
          text: 'Top Level Item',
          cost_estimate: 100,
          planning_days: 1
        }
      ]
    });

    authToken = generateAuthToken(user);
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  afterEach(() => {
    process.env.PLAN_ITEM_MAX_NESTING_LEVEL = originalMax;
  });

  test('should reject creating a child item under a child item (max 1 nesting level)', async () => {
    process.env.PLAN_ITEM_MAX_NESTING_LEVEL = '1';

    // Create a plan for the experience (gives us a plan snapshot to attach children to)
    const createPlanResponse = await request(app)
      .post(`/api/plans/experience/${experience._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: new Date() });

    const createdPlan = createPlanResponse.body?.data || createPlanResponse.body;
    expect(createPlanResponse.status).toBe(201);

    // Confirm plan exists
    const planFromDb = await Plan.findById(createdPlan._id);
    expect(planFromDb).toBeTruthy();
    expect(createdPlan.plan?.length).toBeGreaterThan(0);

    const topLevelItem = createdPlan.plan[0];
    const topLevelParentId = (topLevelItem.plan_item_id || topLevelItem._id).toString();

    // Add a child item under the top-level item (allowed)
    const addChildResponse = await request(app)
      .post(`/api/plans/${createdPlan._id}/items`)
      .set('Authorization', authToken)
      .send({
        text: 'Child Item',
        parent: topLevelParentId
      });

    const planAfterChildAdd = addChildResponse.body?.data || addChildResponse.body;
    expect(addChildResponse.status).toBe(200);
    expect(planAfterChildAdd.plan?.length).toBeGreaterThan(createdPlan.plan.length);

    const createdChildItem = planAfterChildAdd.plan[planAfterChildAdd.plan.length - 1];
    const childId = (createdChildItem.plan_item_id || createdChildItem._id).toString();

    // Try to add a grandchild under the child item (should be rejected)
    const addGrandchildResponse = await request(app)
      .post(`/api/plans/${createdPlan._id}/items`)
      .set('Authorization', authToken)
      .send({
        text: 'Grandchild Item',
        parent: childId
      });

    expect(addGrandchildResponse.status).toBe(400);
    expect(addGrandchildResponse.body?.error || '').toContain('Cannot add a child item deeper than max nesting level 1');
  });

  test('should allow creating a grandchild when max nesting level is 2', async () => {
    process.env.PLAN_ITEM_MAX_NESTING_LEVEL = '2';

    const createPlanResponse = await request(app)
      .post(`/api/plans/experience/${experience._id}`)
      .set('Authorization', authToken)
      .send({ planned_date: new Date() });

    const createdPlan = createPlanResponse.body?.data || createPlanResponse.body;
    expect(createPlanResponse.status).toBe(201);

    const topLevelItem = createdPlan.plan[0];
    const topLevelParentId = (topLevelItem.plan_item_id || topLevelItem._id).toString();

    // Add a child item under the top-level item (allowed)
    const addChildResponse = await request(app)
      .post(`/api/plans/${createdPlan._id}/items`)
      .set('Authorization', authToken)
      .send({
        text: 'Child Item',
        parent: topLevelParentId
      });

    const planAfterChildAdd = addChildResponse.body?.data || addChildResponse.body;
    expect(addChildResponse.status).toBe(200);

    const createdChildItem = planAfterChildAdd.plan[planAfterChildAdd.plan.length - 1];
    const childId = (createdChildItem.plan_item_id || createdChildItem._id).toString();

    // Add a grandchild under the child item (allowed when max=2)
    const addGrandchildResponse = await request(app)
      .post(`/api/plans/${createdPlan._id}/items`)
      .set('Authorization', authToken)
      .send({
        text: 'Grandchild Item',
        parent: childId
      });

    const planAfterGrandchildAdd = addGrandchildResponse.body?.data || addGrandchildResponse.body;
    expect(addGrandchildResponse.status).toBe(200);
    expect(planAfterGrandchildAdd.plan?.length).toBeGreaterThan(planAfterChildAdd.plan.length);
  });
});
