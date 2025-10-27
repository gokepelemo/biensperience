/**
 * Integration Tests - Invite Signup Flow
 *
 * Tests the complete end-to-end flow of:
 * 1. Admin creates invite with resources
 * 2. User signs up with invite code
 * 3. Invite is auto-redeemed
 * 4. Plans are created
 * 5. Destinations are added to favorites
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const User = require('../../models/user');
const InviteCode = require('../../models/inviteCode');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Plan = require('../../models/plan');

let mongoServer;
let superAdminToken;
let superAdmin;
let experience1;
let experience2;
let destination1;
let destination2;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear all collections
  await User.deleteMany({});
  await InviteCode.deleteMany({});
  await Experience.deleteMany({});
  await Destination.deleteMany({});
  await Plan.deleteMany({});

  // Create super admin
  superAdmin = await User.create({
    name: 'Super Admin',
    email: 'admin@test.com',
    password: 'password123',
    role: 'super_admin',
    emailConfirmed: true
  });

  // Create test experiences
  experience1 = await Experience.create({
    title: 'Experience 1',
    destination: new mongoose.Types.ObjectId(),
    createdBy: superAdmin._id,
    items: [
      { description: 'Item 1', cost: 100 },
      { description: 'Item 2', cost: 200 }
    ]
  });

  experience2 = await Experience.create({
    title: 'Experience 2',
    destination: new mongoose.Types.ObjectId(),
    createdBy: superAdmin._id,
    items: [
      { description: 'Item A', cost: 50 }
    ]
  });

  // Create test destinations
  destination1 = await Destination.create({
    name: 'Paris',
    country: 'France',
    createdBy: superAdmin._id
  });

  destination2 = await Destination.create({
    name: 'Tokyo',
    country: 'Japan',
    createdBy: superAdmin._id
  });

  // Get auth token
  const adminRes = await request(app)
    .post('/api/users/login')
    .send({ email: 'admin@test.com', password: 'password123' });
  superAdminToken = adminRes.body;
});

describe('Complete Invite Signup Flow', () => {
  it('should complete full flow: create invite -> signup -> auto-redeem', async () => {
    // Step 1: Admin creates invite with resources
    const createInviteRes = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email: 'newuser@test.com',
        inviteeName: 'New User',
        experiences: [experience1._id.toString(), experience2._id.toString()],
        destinations: [destination1._id.toString(), destination2._id.toString()],
        maxUses: 1,
        customMessage: 'Welcome to Biensperience!'
      });

    expect(createInviteRes.status).toBe(201);
    const inviteCode = createInviteRes.body.code;
    expect(inviteCode).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);

    // Step 2: Validate the invite code (public endpoint)
    const validateRes = await request(app)
      .post('/api/invites/validate')
      .send({
        code: inviteCode,
        email: 'newuser@test.com'
      });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.valid).toBe(true);
    expect(validateRes.body.inviteeName).toBe('New User');
    expect(validateRes.body.experienceCount).toBe(2);
    expect(validateRes.body.destinationCount).toBe(2);

    // Step 3: User signs up with invite code
    const signupRes = await request(app)
      .post('/api/users')
      .send({
        name: 'New User',
        email: 'newuser@test.com',
        password: 'password123',
        inviteCode: inviteCode
      });

    expect(signupRes.status).toBe(201);
    const userToken = signupRes.body;

    // Verify user was created with invite code
    const newUser = await User.findOne({ email: 'newuser@test.com' });
    expect(newUser).toBeTruthy();
    expect(newUser.inviteCode).toBe(inviteCode);

    // Step 4: User redeems invite code
    const redeemRes = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: inviteCode });

    expect(redeemRes.status).toBe(200);
    expect(redeemRes.body.success).toBe(true);
    expect(redeemRes.body.experiences).toHaveLength(2);
    expect(redeemRes.body.destinations).toHaveLength(2);

    // Step 5: Verify plans were created
    const plans = await Plan.find({ user: newUser._id });
    expect(plans).toHaveLength(2);

    // Verify plan for experience 1
    const plan1 = plans.find(p => p.experience.toString() === experience1._id.toString());
    expect(plan1).toBeTruthy();
    expect(plan1.items).toHaveLength(2);
    expect(plan1.items[0].description).toBe('Item 1');

    // Verify plan for experience 2
    const plan2 = plans.find(p => p.experience.toString() === experience2._id.toString());
    expect(plan2).toBeTruthy();
    expect(plan2.items).toHaveLength(1);

    // Step 6: Verify invite was marked as used
    const updatedInvite = await InviteCode.findOne({ code: inviteCode });
    expect(updatedInvite.usedCount).toBe(1);
    expect(updatedInvite.redeemedBy).toContainEqual(newUser._id);

    // Step 7: Verify user has permissions on plans
    expect(plan1.permissions).toBeDefined();
    expect(plan1.permissions.length).toBeGreaterThan(0);
    const ownerPermission = plan1.permissions.find(p => p.type === 'owner');
    expect(ownerPermission).toBeTruthy();
    expect(ownerPermission._id.toString()).toBe(newUser._id.toString());
  });

  it('should handle duplicate redemption gracefully', async () => {
    // Create invite
    const invite = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      experiences: [experience1._id],
      maxUses: 2
    });

    // Create and login user
    const signupRes = await request(app)
      .post('/api/users')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
        inviteCode: invite.code
      });

    const userToken = signupRes.body;

    // First redemption
    const firstRedeem = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: invite.code });

    expect(firstRedeem.status).toBe(200);

    const plansAfterFirst = await Plan.countDocuments();
    expect(plansAfterFirst).toBe(1);

    // Second redemption (should not create duplicate plans)
    const secondRedeem = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: invite.code });

    expect(secondRedeem.status).toBe(200);

    const plansAfterSecond = await Plan.countDocuments();
    expect(plansAfterSecond).toBe(1); // Should still be 1

    // Verify used count only incremented once
    const updatedInvite = await InviteCode.findById(invite._id);
    expect(updatedInvite.usedCount).toBe(1);
  });

  it('should prevent signup with expired invite code', async () => {
    // Create expired invite
    const expiredInvite = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      experiences: [experience1._id],
      expiresAt: new Date(Date.now() - 1000) // Expired
    });

    // Validate should fail
    const validateRes = await request(app)
      .post('/api/invites/validate')
      .send({ code: expiredInvite.code });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.valid).toBe(false);

    // User can still signup (invite code is optional)
    const signupRes = await request(app)
      .post('/api/users')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
        inviteCode: expiredInvite.code
      });

    expect(signupRes.status).toBe(201);
    const userToken = signupRes.body;

    // But redemption should fail
    const redeemRes = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: expiredInvite.code });

    expect(redeemRes.status).toBe(400);
    expect(redeemRes.body.error).toContain('expired');
  });

  it('should handle email-restricted invites correctly', async () => {
    // Create email-restricted invite
    const invite = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      email: 'specific@test.com',
      experiences: [experience1._id]
    });

    // Wrong email should fail validation
    const wrongEmailValidate = await request(app)
      .post('/api/invites/validate')
      .send({
        code: invite.code,
        email: 'wrong@test.com'
      });

    expect(wrongEmailValidate.status).toBe(200);
    expect(wrongEmailValidate.body.valid).toBe(false);

    // Correct email should pass validation
    const correctEmailValidate = await request(app)
      .post('/api/invites/validate')
      .send({
        code: invite.code,
        email: 'specific@test.com'
      });

    expect(correctEmailValidate.status).toBe(200);
    expect(correctEmailValidate.body.valid).toBe(true);

    // Signup with correct email
    const signupRes = await request(app)
      .post('/api/users')
      .send({
        name: 'Specific User',
        email: 'specific@test.com',
        password: 'password123',
        inviteCode: invite.code
      });

    expect(signupRes.status).toBe(201);

    // Redemption should succeed
    const redeemRes = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${signupRes.body}`)
      .send({ code: invite.code });

    expect(redeemRes.status).toBe(200);
  });

  it('should not create plans for deleted experiences', async () => {
    // Create invite with experience
    const invite = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      experiences: [experience1._id]
    });

    // Delete the experience
    await Experience.deleteOne({ _id: experience1._id });

    // Signup
    const signupRes = await request(app)
      .post('/api/users')
      .send({
        name: 'Test User',
        email: 'test@test.com',
        password: 'password123',
        inviteCode: invite.code
      });

    const userToken = signupRes.body;

    // Redeem (should handle gracefully)
    const redeemRes = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: invite.code });

    // Should still succeed but with no experiences
    expect(redeemRes.status).toBe(200);
    expect(redeemRes.body.experiences).toHaveLength(0);

    // No plans should be created
    const newUser = await User.findOne({ email: 'test@test.com' });
    const plans = await Plan.find({ user: newUser._id });
    expect(plans).toHaveLength(0);
  });

  it('should respect max uses limit', async () => {
    // Create invite with max 1 use
    const invite = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      experiences: [experience1._id],
      maxUses: 1
    });

    // First user signup and redeem
    const user1Signup = await request(app)
      .post('/api/users')
      .send({
        name: 'User 1',
        email: 'user1@test.com',
        password: 'password123',
        inviteCode: invite.code
      });

    await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${user1Signup.body}`)
      .send({ code: invite.code });

    // Second user signup
    const user2Signup = await request(app)
      .post('/api/users')
      .send({
        name: 'User 2',
        email: 'user2@test.com',
        password: 'password123',
        inviteCode: invite.code
      });

    // Validation should fail (max uses reached)
    const validateRes = await request(app)
      .post('/api/invites/validate')
      .send({ code: invite.code });

    expect(validateRes.status).toBe(200);
    expect(validateRes.body.valid).toBe(false);

    // Redemption should fail
    const redeemRes = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${user2Signup.body}`)
      .send({ code: invite.code });

    expect(redeemRes.status).toBe(400);
  });
});

describe('Bulk Invite Flow', () => {
  it('should create and send bulk invites with email flag', async () => {
    const invites = [
      { email: 'user1@test.com', name: 'User 1' },
      { email: 'user2@test.com', name: 'User 2' },
      { email: 'user3@test.com', name: 'User 3' }
    ];

    const res = await request(app)
      .post('/api/invites/bulk')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        invites: invites.map(inv => ({
          ...inv,
          experiences: [experience1._id.toString()],
          destinations: [destination1._id.toString()]
        })),
        sendEmail: false // Don't actually send emails in tests
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(3);
    expect(res.body.errors).toHaveLength(0);

    // Verify all invites have the resources
    res.body.created.forEach(invite => {
      expect(invite.experiences).toHaveLength(1);
      expect(invite.destinations).toHaveLength(1);
    });

    // Each user should be able to redeem their invite
    for (let i = 0; i < invites.length; i++) {
      const invite = res.body.created[i];

      const signupRes = await request(app)
        .post('/api/users')
        .send({
          name: invites[i].name,
          email: invites[i].email,
          password: 'password123',
          inviteCode: invite.code
        });

      expect(signupRes.status).toBe(201);

      const redeemRes = await request(app)
        .post('/api/invites/redeem')
        .set('Authorization', `Bearer ${signupRes.body}`)
        .send({ code: invite.code });

      expect(redeemRes.status).toBe(200);
    }

    // Verify 3 plans were created (one per user)
    const totalPlans = await Plan.countDocuments();
    expect(totalPlans).toBe(3);
  });
});
