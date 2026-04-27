/**
 * BienBot Context — Permission Regression Tests
 *
 * Guards against the `.lean()` regression in plan/plan-item context builders.
 *
 * If a builder loads a Plan via `Plan.findById(...).lean()`, the returned
 * plain object loses `resource.constructor.modelName`. PermissionEnforcer
 * then falls back to `AUTHENTICATED` visibility (instead of `RESTRICTED` for
 * Plans), silently granting read access to ANY logged-in user. See the
 * BienBot section in CLAUDE.md.
 *
 * This file:
 *  1. Asserts that buildUserPlanContext, buildPlanItemContext, and
 *     buildPlanNextStepsContext deny a non-collaborator (return null).
 *  2. Asserts the same builders allow the owner (return non-null context).
 *  3. Demonstrates the regression: when Plan is loaded with .lean(), a
 *     non-collaborator IS incorrectly granted access by the enforcer — proving
 *     the test would catch a future .lean() slip in the builders.
 */

const mongoose = require('mongoose');
const dbSetup = require('../setup/testSetup');

const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const User = require('../../models/user');

const {
  buildUserPlanContext,
  buildPlanItemContext,
  buildPlanNextStepsContext,
  buildContextForInvokeContext,
} = require('../../utilities/bienbot-context-builders');

const { getEnforcer } = require('../../utilities/permission-enforcer');

describe('bienbot-context permission enforcement (regression: do NOT use .lean() on Plan)', () => {
  let ownerUser, otherUser, destination, experience, plan, planItemId;

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
      User.deleteMany({}),
    ]);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    ownerUser = await User.create({
      name: 'Plan Owner',
      email: `owner-${suffix}@perm.test`,
      password: 'pw12345!',
      emailConfirmed: true,
    });
    otherUser = await User.create({
      name: 'Random User',
      email: `other-${suffix}@perm.test`,
      password: 'pw12345!',
      emailConfirmed: true,
    });
    destination = await Destination.create({
      name: 'Lisbon',
      country: 'Portugal',
      user: ownerUser._id,
      permissions: [{ _id: ownerUser._id, entity: 'user', type: 'owner' }],
    });
    experience = await Experience.create({
      name: 'Lisbon Walking Tour',
      destination: destination._id,
      user: ownerUser._id,
      permissions: [{ _id: ownerUser._id, entity: 'user', type: 'owner' }],
      plan_items: [],
    });
    plan = await Plan.create({
      experience: experience._id,
      user: ownerUser._id,
      planned_date: new Date('2026-06-01'),
      plan: [
        {
          _id: new mongoose.Types.ObjectId(),
          plan_item_id: new mongoose.Types.ObjectId(),
          text: 'Visit Belem Tower',
          complete: false,
          scheduled_date: new Date('2026-06-02'),
        },
      ],
      permissions: [
        { _id: ownerUser._id, entity: 'user', type: 'owner', granted_by: ownerUser._id },
      ],
    });
    planItemId = plan.plan[0]._id.toString();
  });

  // -----------------------------------------------------------------------
  // Owner gets access (sanity)
  // -----------------------------------------------------------------------

  it('owner CAN view their own plan via buildUserPlanContext', async () => {
    const ctx = await buildUserPlanContext(plan._id.toString(), ownerUser._id.toString());
    expect(ctx).not.toBeNull();
    expect(typeof ctx).toBe('string');
    expect(ctx).toContain('[Plan]');
  });

  it('owner CAN view their own plan_item via buildPlanItemContext', async () => {
    const ctx = await buildPlanItemContext(plan._id.toString(), planItemId, ownerUser._id.toString());
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('[Plan Item]');
  });

  it('owner CAN view next-steps for their own plan via buildPlanNextStepsContext', async () => {
    const ctx = await buildPlanNextStepsContext(plan._id.toString(), ownerUser._id.toString());
    expect(ctx).not.toBeNull();
    expect(ctx).toContain('[NEXT STEPS]');
  });

  // -----------------------------------------------------------------------
  // Non-collaborator DENIED (the actual regression test)
  // -----------------------------------------------------------------------

  it('non-collaborator is DENIED buildUserPlanContext (returns null)', async () => {
    const ctx = await buildUserPlanContext(plan._id.toString(), otherUser._id.toString());
    expect(ctx).toBeNull();
  });

  it('non-collaborator is DENIED buildPlanItemContext (returns null)', async () => {
    const ctx = await buildPlanItemContext(plan._id.toString(), planItemId, otherUser._id.toString());
    expect(ctx).toBeNull();
  });

  it('non-collaborator is DENIED buildPlanNextStepsContext (returns null)', async () => {
    const ctx = await buildPlanNextStepsContext(plan._id.toString(), otherUser._id.toString());
    expect(ctx).toBeNull();
  });

  it('non-collaborator is DENIED via buildContextForInvokeContext({ entity: "plan" })', async () => {
    const ctx = await buildContextForInvokeContext(
      { entity: 'plan', entity_id: plan._id.toString() },
      otherUser._id.toString()
    );
    expect(ctx).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Demonstrate the .lean() pitfall the test guards against.
  //
  // If a future change adds `.lean()` to Plan.findById in any of the
  // plan-related builders, the resource handed to canView() loses
  // `constructor.modelName`. The enforcer then can't detect it's a Plan
  // and falls back to AUTHENTICATED (any logged-in user). This snippet
  // proves that hazard — so the assertions above genuinely verify the
  // builder is loading the doc as a Mongoose document, not a lean object.
  // -----------------------------------------------------------------------

  it('PROOF: lean()-loaded Plan loses RESTRICTED visibility and grants the wrong user', async () => {
    const enforcer = getEnforcer({ Destination, Experience, Plan, User });

    // Hydrated (correct): non-owner is denied.
    const hydratedPlan = await Plan.findById(plan._id);
    const hydratedPerm = await enforcer.canView({
      userId: otherUser._id.toString(),
      resource: hydratedPlan,
    });
    expect(hydratedPerm.allowed).toBe(false);

    // Lean (the bug): non-owner is incorrectly allowed.
    const leanPlan = await Plan.findById(plan._id).lean();
    const leanPerm = await enforcer.canView({
      userId: otherUser._id.toString(),
      resource: leanPlan,
    });
    // This is the silently-broken behaviour the regression test guards against.
    expect(leanPerm.allowed).toBe(true);
  });
});
