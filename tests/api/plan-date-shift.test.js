/**
 * Integration tests for POST /api/plans/:id/shift-item-dates
 */
const request = require('supertest');
const app = require('../../app');
const Plan = require('../../models/plan');
const mongoose = require('mongoose');
const {
  createTestUser,
  createTestDestination,
  createTestExperience,
  createTestPlan,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const dbSetup = require('../setup/testSetup');

describe('POST /api/plans/:id/shift-item-dates', () => {
  let user, experience, destination, authToken;

  beforeAll(async () => { await dbSetup.connect(); });
  afterAll(async () => { await dbSetup.closeDatabase(); });

  beforeEach(async () => {
    await clearTestData();
    user = await createTestUser({ name: 'Test User', email: 'tester@example.com' });
    const owner = await createTestUser({ name: 'Owner', email: 'owner@example.com' });
    destination = await createTestDestination(owner);
    experience = await createTestExperience(owner, destination, {});
    authToken = generateAuthToken(user);
  });

  async function planWithScheduledItems(plannedDate = new Date('2026-05-01')) {
    const itemDate = new Date('2026-05-10');
    return createTestPlan(user, experience, {
      planned_date: plannedDate,
      plan: [
        {
          plan_item_id: new mongoose.Types.ObjectId(),
          text: 'Root with schedule',
          scheduled_date: itemDate,
          complete: false
        },
        {
          plan_item_id: new mongoose.Types.ObjectId(),
          text: 'Root no schedule',
          scheduled_date: null,
          complete: false
        }
      ]
    });
  }

  test('shifts scheduled_date of root items by diff_ms', async () => {
    const plan = await planWithScheduledItems();
    const diffMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({ diff_ms: diffMs });

    expect(res.status).toBe(200);
    expect(res.body.shifted_count).toBe(1);

    const updated = await Plan.findById(plan._id);
    const shiftedItem = updated.plan.find(i => i.text === 'Root with schedule');
    const unshiftedItem = updated.plan.find(i => i.text === 'Root no schedule');

    const expectedDate = new Date(new Date('2026-05-10').getTime() + diffMs);
    expect(new Date(shiftedItem.scheduled_date).toDateString()).toBe(expectedDate.toDateString());
    expect(unshiftedItem.scheduled_date).toBeNull();
  });

  test('returns 400 when diff_ms is missing', async () => {
    const plan = await planWithScheduledItems();
    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({});
    expect(res.status).toBe(400);
  });

  test('returns 400 when diff_ms is zero', async () => {
    const plan = await planWithScheduledItems();
    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({ diff_ms: 0 });
    expect(res.status).toBe(400);
  });

  test('returns 401 when unauthenticated', async () => {
    const plan = await planWithScheduledItems();
    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .send({ diff_ms: 86400000 });
    expect(res.status).toBe(401);
  });

  test('returns 403 when user does not have edit permission', async () => {
    const other = await createTestUser({ name: 'Other', email: 'other@example.com' });
    const otherToken = generateAuthToken(other);
    const plan = await planWithScheduledItems();

    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', otherToken)
      .send({ diff_ms: 86400000 });
    expect(res.status).toBe(403);
  });

  test('returns shifted_count 0 when no items have scheduled_date', async () => {
    const plan = await createTestPlan(user, experience, {
      planned_date: new Date('2026-05-01'),
      plan: [
        { plan_item_id: new mongoose.Types.ObjectId(), text: 'Unscheduled', scheduled_date: null, complete: false }
      ]
    });

    const res = await request(app)
      .post(`/api/plans/${plan._id}/shift-item-dates`)
      .set('Authorization', authToken)
      .send({ diff_ms: 86400000 });

    expect(res.status).toBe(200);
    expect(res.body.shifted_count).toBe(0);
  });

  describe('PUT /api/plans/:id — _shift_meta in planned_date-only update', () => {
    let user, experience, destination, authToken;

    beforeEach(async () => {
      await clearTestData();
      user = await createTestUser({ name: 'Test User', email: 'tester2@example.com' });
      const owner = await createTestUser({ name: 'Owner', email: 'owner2@example.com' });
      destination = await createTestDestination(owner);
      experience = await createTestExperience(owner, destination, {});
      authToken = generateAuthToken(user);
    });

    async function planWithItemAndDate(plannedDate) {
      return createTestPlan(user, experience, {
        planned_date: plannedDate,
        plan: [
          {
            plan_item_id: new mongoose.Types.ObjectId(),
            text: 'Scheduled item',
            scheduled_date: new Date('2026-05-10'),
            complete: false
          }
        ]
      });
    }

    test('returns _shift_meta when both dates non-null and items have scheduled_date', async () => {
      const plan = await planWithItemAndDate(new Date('2026-05-01'));

      const res = await request(app)
        .put(`/api/plans/${plan._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: '2026-05-08' });

      expect(res.status).toBe(200);
      expect(res.body._shift_meta).toBeDefined();
      expect(res.body._shift_meta.scheduled_items_count).toBe(1);
      expect(res.body._shift_meta.date_diff_days).toBe(7);
      expect(res.body._shift_meta.date_diff_ms).toBe(7 * 24 * 60 * 60 * 1000);
      expect(res.body._id).toBeDefined(); // plan fields still present
    });

    test('does NOT return _shift_meta when old date is null', async () => {
      const plan = await createTestPlan(user, experience, {
        planned_date: null,
        plan: [
          { plan_item_id: new mongoose.Types.ObjectId(), text: 'item', scheduled_date: new Date('2026-05-10'), complete: false }
        ]
      });

      const res = await request(app)
        .put(`/api/plans/${plan._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: '2026-05-08' });

      expect(res.status).toBe(200);
      expect(res.body._shift_meta).toBeUndefined();
    });

    test('does NOT return _shift_meta when no items have scheduled_date', async () => {
      const plan = await createTestPlan(user, experience, {
        planned_date: new Date('2026-05-01'),
        plan: [
          { plan_item_id: new mongoose.Types.ObjectId(), text: 'no schedule', scheduled_date: null, complete: false }
        ]
      });

      const res = await request(app)
        .put(`/api/plans/${plan._id}`)
        .set('Authorization', authToken)
        .send({ planned_date: '2026-05-08' });

      expect(res.status).toBe(200);
      expect(res.body._shift_meta).toBeUndefined();
    });
  });
});
