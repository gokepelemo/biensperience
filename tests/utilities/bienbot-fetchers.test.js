const mongoose = require('mongoose');
const {
  READ_ONLY_ACTION_TYPES,
  ACTION_HANDLERS,
  executeAction
} = require('../../utilities/bienbot-action-executor');
const Plan = require('../../models/plan');
const User = require('../../models/user');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const dbSetup = require('../setup/testSetup');

function makeItem(overrides = {}) {
  return {
    plan_item_id: new mongoose.Types.ObjectId(),
    ...overrides
  };
}

describe('fetch_plan_items registration', () => {
  it('is registered as a read-only action type', () => {
    expect(READ_ONLY_ACTION_TYPES.has('fetch_plan_items')).toBe(true);
  });

  it('has a handler', () => {
    expect(typeof ACTION_HANDLERS.fetch_plan_items).toBe('function');
  });
});

describe('fetch_plan_items handler', () => {
  let owner, dest, exp, plan;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await Promise.all([
      Plan.deleteMany({}),
      Experience.deleteMany({}),
      Destination.deleteMany({}),
      User.deleteMany({})
    ]);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    owner = await User.create({
      name: 'Plan Owner', email: `owner-${suffix}@x.test`, password: 'pw12345!'
    });
    dest = await Destination.create({ name: 'Kyoto', country: 'Japan', user: owner._id });
    exp = await Experience.create({
      name: 'Cherry Blossom Tour', destination: dest._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
    plan = await Plan.create({
      experience: exp._id, user: owner._id, planned_date: new Date('2026-04-01'),
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }],
      plan: [
        makeItem({ text: 'Visit Fushimi Inari', complete: false, scheduled_date: new Date('2026-04-02') }),
        makeItem({ text: 'Tea ceremony',        complete: true,  scheduled_date: new Date('2026-04-03') }),
        makeItem({ text: 'Pick a hotel',        complete: false }), // unscheduled
        makeItem({ text: 'Book flights',        complete: false })  // unscheduled
      ]
    });
  });

  it('returns all items with scheduling state for filter=all', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: plan._id.toString(), filter: 'all' } },
      owner
    );
    expect(outcome.success).toBe(true);
    expect(outcome.body.total).toBe(4);
    expect(outcome.body.returned).toBe(4);
    expect(outcome.body.items).toHaveLength(4);
    const visit = outcome.body.items.find(i => i.content === 'Visit Fushimi Inari');
    expect(visit.scheduled_date).toBeTruthy();
    expect(visit.complete).toBe(false);
    expect(visit._id).toBeDefined();
  });

  it('returns only unscheduled non-complete items for filter=unscheduled', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: plan._id.toString(), filter: 'unscheduled' } },
      owner
    );
    expect(outcome.body.total).toBe(2);
    expect(outcome.body.items.map(i => i.content).sort()).toEqual(['Book flights', 'Pick a hotel']);
  });

  it('returns only scheduled items for filter=scheduled', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: plan._id.toString(), filter: 'scheduled' } },
      owner
    );
    expect(outcome.body.total).toBe(2);
  });

  it('returns only incomplete items for filter=incomplete', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: plan._id.toString(), filter: 'incomplete' } },
      owner
    );
    expect(outcome.body.total).toBe(3);
    expect(outcome.body.items.every(i => i.complete === false)).toBe(true);
  });

  it('returns only overdue incomplete items for filter=overdue', async () => {
    const overdueExp = await Experience.create({
      name: 'Overdue Exp', destination: dest._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
    const overduePlan = await Plan.create({
      experience: overdueExp._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }],
      plan: [
        makeItem({ text: 'Past',   complete: false, scheduled_date: new Date('2020-01-01') }),
        makeItem({ text: 'Future', complete: false, scheduled_date: new Date('2099-01-01') })
      ]
    });
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: overduePlan._id.toString(), filter: 'overdue' } },
      owner
    );
    expect(outcome.body.items.map(i => i.content)).toEqual(['Past']);
  });

  it('clamps limit at 100', async () => {
    const bigExp = await Experience.create({
      name: 'Big Exp', destination: dest._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
    const items = Array.from({ length: 120 }, (_, i) => makeItem({ text: `Item ${i}` }));
    const bigPlan = await Plan.create({
      experience: bigExp._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }],
      plan: items
    });
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: bigPlan._id.toString(), limit: 9999 } },
      owner
    );
    expect(outcome.body.total).toBe(120);
    expect(outcome.body.returned).toBe(100);
    expect(outcome.body.items).toHaveLength(100);
  });

  it('returns not_authorized when user cannot view plan', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stranger = await User.create({
      name: 'Stranger', email: `stranger-${suffix}@x.test`, password: 'pw12345!'
    });
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: plan._id.toString() } },
      stranger
    );
    expect(outcome.body.ok).toBe(false);
    expect(outcome.body.error).toBe('not_authorized');
  });

  it('returns invalid_id for malformed plan_id', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_items', payload: { plan_id: 'not-a-real-id' } },
      owner
    );
    expect(outcome.body.error).toBe('invalid_id');
  });
});

describe('fetch_plan_costs handler', () => {
  let owner, dest, exp, plan;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await Promise.all([Plan.deleteMany({}), Experience.deleteMany({}), Destination.deleteMany({}), User.deleteMany({})]);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    owner = await User.create({ name: 'O', email: `o-${suffix}@x.test`, password: 'pw12345!' });
    dest = await Destination.create({ name: 'D', country: 'X', user: owner._id });
    exp = await Experience.create({
      name: 'E', destination: dest._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
    plan = await Plan.create({
      experience: exp._id, user: owner._id, currency: 'USD',
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }],
      costs: [
        { title: 'Hotel', cost: 200, currency: 'USD', category: 'accommodation' },
        { title: 'Flight', cost: 500, currency: 'USD', category: 'transport' },
        { title: 'Dinner', cost: 80, currency: 'USD', category: 'food' }
      ]
    });
  });

  it('returns all costs with totals_by_category', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_costs', payload: { plan_id: plan._id.toString() } },
      owner
    );
    expect(outcome.body.costs).toHaveLength(3);
    expect(outcome.body.totals_by_category.accommodation).toBe(200);
    expect(outcome.body.totals_by_category.transport).toBe(500);
    expect(outcome.body.totals_by_category.food).toBe(80);
    expect(outcome.body.total_in_user_currency).toBe(780);
  });

  it('returns not_authorized when user cannot view plan', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stranger = await User.create({ name: 'S', email: `s-${suffix}@x.test`, password: 'pw12345!' });
    const outcome = await executeAction(
      { type: 'fetch_plan_costs', payload: { plan_id: plan._id.toString() } }, stranger
    );
    expect(outcome.body.error).toBe('not_authorized');
  });
});
