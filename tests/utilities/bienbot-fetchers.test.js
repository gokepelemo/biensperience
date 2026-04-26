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

describe('fetch_plan_collaborators handler', () => {
  let owner, collab, dest, exp, plan;

  beforeAll(async () => { await dbSetup.connect(); });
  afterAll(async () => { await dbSetup.closeDatabase(); });

  beforeEach(async () => {
    await Promise.all([Plan.deleteMany({}), Experience.deleteMany({}), Destination.deleteMany({}), User.deleteMany({})]);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    owner = await User.create({ name: 'O', email: `o-${suffix}@x.test`, password: 'pw12345!' });
    collab = await User.create({ name: 'Collab', email: `c-${suffix}@x.test`, password: 'pw12345!' });
    dest = await Destination.create({ name: 'D', country: 'X', user: owner._id });
    exp = await Experience.create({
      name: 'E', destination: dest._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
    plan = await Plan.create({
      experience: exp._id, user: owner._id,
      permissions: [
        { _id: owner._id, entity: 'user', type: 'owner', granted_at: new Date() },
        { _id: collab._id, entity: 'user', type: 'collaborator', granted_at: new Date() }
      ],
      member_locations: [
        { user: collab._id, location: { city: 'Berlin', country: 'DE' }, travel_cost_estimate: 300, currency: 'EUR' }
      ]
    });
  });

  it('returns collaborators with names, roles, and locations', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_collaborators', payload: { plan_id: plan._id.toString() } }, owner
    );
    expect(outcome.body.collaborators).toHaveLength(2);
    const collabEntry = outcome.body.collaborators.find(c => c.role === 'collaborator');
    expect(collabEntry.name).toBe('Collab');
    expect(collabEntry.location.city).toBe('Berlin');
    expect(collabEntry.travel_cost_estimate).toBe(300);
  });

  it('returns not_authorized when user cannot view plan', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stranger = await User.create({ name: 'S', email: `s-${suffix}@x.test`, password: 'pw12345!' });
    const outcome = await executeAction(
      { type: 'fetch_plan_collaborators', payload: { plan_id: plan._id.toString() } }, stranger
    );
    expect(outcome.body.error).toBe('not_authorized');
  });

  it('returns invalid_id for malformed plan_id', async () => {
    const outcome = await executeAction(
      { type: 'fetch_plan_collaborators', payload: { plan_id: 'not-a-real-id' } }, owner
    );
    expect(outcome.body.error).toBe('invalid_id');
  });
});

describe('fetch_experience_items handler', () => {
  let owner, dest, exp;

  beforeAll(async () => { await dbSetup.connect(); });
  afterAll(async () => { await dbSetup.closeDatabase(); });

  beforeEach(async () => {
    await Promise.all([Plan.deleteMany({}), Experience.deleteMany({}), Destination.deleteMany({}), User.deleteMany({})]);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    owner = await User.create({ name: 'O', email: `o-${suffix}@x.test`, password: 'pw12345!' });
    dest = await Destination.create({ name: 'D', country: 'X', user: owner._id });
    exp = await Experience.create({
      name: 'E', destination: dest._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }],
      plan_items: [
        { text: 'Visit X', cost_estimate: 50 },
        { text: 'Tour Y', cost_estimate: 100 }
      ]
    });
  });

  it('returns experience items with cost_estimate and photos_count', async () => {
    const outcome = await executeAction(
      { type: 'fetch_experience_items', payload: { experience_id: exp._id.toString() } }, owner
    );
    expect(outcome.body.items).toHaveLength(2);
    const visit = outcome.body.items.find(i => i.content === 'Visit X');
    expect(visit.cost_estimate).toBe(50);
    expect(visit.photos_count).toBe(0);
    expect(visit._id).toBeDefined();
  });

  it('returns invalid_id for malformed id', async () => {
    const outcome = await executeAction(
      { type: 'fetch_experience_items', payload: { experience_id: 'bad' } }, owner
    );
    expect(outcome.body.error).toBe('invalid_id');
  });
});

describe('fetch_destination_experiences handler', () => {
  let owner, dest, exp1, exp2;

  beforeAll(async () => { await dbSetup.connect(); });
  afterAll(async () => { await dbSetup.closeDatabase(); });

  beforeEach(async () => {
    await Promise.all([Plan.deleteMany({}), Experience.deleteMany({}), Destination.deleteMany({}), User.deleteMany({})]);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    owner = await User.create({ name: 'O', email: `o-${suffix}@x.test`, password: 'pw12345!' });
    dest = await Destination.create({ name: 'D', country: 'X', user: owner._id });
    exp1 = await Experience.create({
      name: 'Exp A', destination: dest._id, user: owner._id, cost_estimate: 100,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
    exp2 = await Experience.create({
      name: 'Exp B', destination: dest._id, user: owner._id, cost_estimate: 200,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
  });

  it('returns experiences at the destination', async () => {
    const outcome = await executeAction(
      { type: 'fetch_destination_experiences', payload: { destination_id: dest._id.toString() } }, owner
    );
    expect(outcome.body.experiences).toHaveLength(2);
    expect(outcome.body.experiences.map(e => e.name).sort()).toEqual(['Exp A', 'Exp B']);
  });

  it('respects sort=popular by plan_count desc', async () => {
    // Add a plan against exp2 to give it a higher plan_count
    await Plan.create({
      experience: exp2._id, user: owner._id,
      permissions: [{ _id: owner._id, entity: 'user', type: 'owner' }]
    });
    const outcome = await executeAction(
      { type: 'fetch_destination_experiences', payload: { destination_id: dest._id.toString(), sort: 'popular' } }, owner
    );
    expect(outcome.body.experiences[0].name).toBe('Exp B');
  });

  it('returns invalid_id for malformed destination id', async () => {
    const outcome = await executeAction(
      { type: 'fetch_destination_experiences', payload: { destination_id: 'bad' } }, owner
    );
    expect(outcome.body.error).toBe('invalid_id');
  });
});

describe('fetch_user_plans registration', () => {
  it('is registered as a read-only action type', () => {
    expect(READ_ONLY_ACTION_TYPES.has('fetch_user_plans')).toBe(true);
  });

  it('has a handler', () => {
    expect(typeof ACTION_HANDLERS.fetch_user_plans).toBe('function');
  });
});

describe('fetch_user_plans handler', () => {
  let user, otherUser, dest, exp;

  beforeAll(async () => { await dbSetup.connect(); });
  afterAll(async () => { await dbSetup.closeDatabase(); });

  beforeEach(async () => {
    await Promise.all([Plan.deleteMany({}), Experience.deleteMany({}), Destination.deleteMany({}), User.deleteMany({})]);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    user = await User.create({ name: 'U', email: `u-${suffix}@x.test`, password: 'pw12345!' });
    otherUser = await User.create({ name: 'O', email: `o-${suffix}@x.test`, password: 'pw12345!' });
    dest = await Destination.create({ name: 'D', country: 'X', user: user._id });
    exp = await Experience.create({
      name: 'Trip to D', destination: dest._id,
      permissions: [{ _id: user._id, entity: 'user', type: 'owner' }]
    });
    await Plan.create({
      experience: exp._id, user: user._id, planned_date: new Date('2026-12-01'),
      permissions: [{ _id: user._id, entity: 'user', type: 'owner' }],
      plan: [
        makeItem({ text: 'A', complete: true }),
        makeItem({ text: 'B', complete: false })
      ]
    });
  });

  it('returns the requesting user own plans by default', async () => {
    const outcome = await executeAction(
      { type: 'fetch_user_plans', payload: {} }, user
    );
    expect(outcome.body.plans).toHaveLength(1);
    expect(outcome.body.plans[0].experience_name).toBe('Trip to D');
    expect(outcome.body.plans[0].destination_name).toBe('D');
    expect(outcome.body.plans[0].completion_pct).toBe(50);
    expect(outcome.body.plans[0].item_count).toBe(2);
  });

  it('does not return other users plans without permission', async () => {
    const outcome = await executeAction(
      { type: 'fetch_user_plans', payload: { user_id: otherUser._id.toString() } }, user
    );
    expect(outcome.body.plans).toEqual([]);
  });
});

describe('fetcher registration coverage', () => {
  it('every TOOL_CALL_ACTION_TYPE has a verifier entry', () => {
    const { TOOL_CALL_ACTION_TYPES } = require('../../utilities/bienbot-action-executor');
    const { _ACTION_ENTITY_VERIFY_FOR_TEST } = require('../../controllers/api/bienbot');
    for (const type of TOOL_CALL_ACTION_TYPES) {
      expect(_ACTION_ENTITY_VERIFY_FOR_TEST[type]).toBeDefined();
    }
  });

  it('every TOOL_CALL_ACTION_TYPE has a handler', () => {
    const { TOOL_CALL_ACTION_TYPES, ACTION_HANDLERS } = require('../../utilities/bienbot-action-executor');
    for (const type of TOOL_CALL_ACTION_TYPES) {
      expect(ACTION_HANDLERS[type]).toBeDefined();
    }
  });
});
