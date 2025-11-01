/**
 * Invite Code API Tests
 *
 * Tests for invite code creation, validation, redemption, and email sending
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
let regularUserToken;
let superAdmin;
let regularUser;
let experience;
let destination;

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

  // Create regular user
  regularUser = await User.create({
    name: 'Regular User',
    email: 'user@test.com',
    password: 'password123',
    emailConfirmed: true
  });

  // Create test experience
  experience = await Experience.create({
    name: 'Test Experience',
    destination: new mongoose.Types.ObjectId(),
    permissions: [{
      _id: superAdmin._id,
      entity: 'user',
      type: 'owner'
    }],
    plan_items: [
      { text: 'Item 1', cost_estimate: 100 },
      { text: 'Item 2', cost_estimate: 200 }
    ]
  });

  // Create test destination
  destination = await Destination.create({
    name: 'Test City',
    country: 'Test Country',
    createdBy: superAdmin._id
  });

  // Get auth tokens
  const adminRes = await request(app)
    .post('/api/users/login')
    .send({ email: 'admin@test.com', password: 'password123' });
  superAdminToken = adminRes.body;

  const userRes = await request(app)
    .post('/api/users/login')
    .send({ email: 'user@test.com', password: 'password123' });
  regularUserToken = userRes.body;
});

describe('POST /api/invites', () => {
  it('should create invite code as super admin', async () => {
    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        email: 'newuser@test.com',
        inviteeName: 'New User',
        experiences: [experience._id.toString()],
        destinations: [destination._id.toString()],
        maxUses: 1,
        customMessage: 'Welcome!'
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
    expect(res.body.email).toBe('newuser@test.com');
    expect(res.body.inviteeName).toBe('New User');
    expect(res.body.customMessage).toBe('Welcome!');
    expect(res.body.isActive).toBe(true);
    expect(res.body.usedCount).toBe(0);
  });

  it('should fail if not authenticated', async () => {
    const res = await request(app)
      .post('/api/invites')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(401);
  });

  it('should create invite with default values', async () => {
    const res = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.maxUses).toBe(1);
    expect(res.body.experiences).toEqual([]);
    expect(res.body.destinations).toEqual([]);
  });
});

describe('POST /api/invites/validate', () => {
  let inviteCode;

  beforeEach(async () => {
    inviteCode = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      email: 'specific@test.com',
      inviteeName: 'Specific User',
      experiences: [experience._id],
      destinations: [destination._id],
      maxUses: 1,
      customMessage: 'Test message'
    });
  });

  it('should validate correct invite code', async () => {
    const res = await request(app)
      .post('/api/invites/validate')
      .send({ code: inviteCode.code });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.inviteeName).toBe('Specific User');
    expect(res.body.customMessage).toBe('Test message');
    expect(res.body.experienceCount).toBe(1);
    expect(res.body.destinationCount).toBe(1);
  });

  it('should reject invalid code format', async () => {
    const res = await request(app)
      .post('/api/invites/validate')
      .send({ code: 'INVALID' });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('should reject non-existent code', async () => {
    const res = await request(app)
      .post('/api/invites/validate')
      .send({ code: 'AAA-BBB-CCC' });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('should reject wrong email for email-restricted invite', async () => {
    const res = await request(app)
      .post('/api/invites/validate')
      .send({
        code: inviteCode.code,
        email: 'wrong@test.com'
      });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toContain('email');
  });

  it('should accept correct email for email-restricted invite', async () => {
    const res = await request(app)
      .post('/api/invites/validate')
      .send({
        code: inviteCode.code,
        email: 'specific@test.com'
      });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('should reject expired invite code', async () => {
    // Create expired invite
    const expiredInvite = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
    });

    const res = await request(app)
      .post('/api/invites/validate')
      .send({ code: expiredInvite.code });

    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  it('should reject fully-used invite code', async () => {
    // Mark invite as fully used
    inviteCode.usedCount = inviteCode.maxUses;
    await inviteCode.save();

    const res = await request(app)
      .post('/api/invites/validate')
      .send({ code: inviteCode.code });

    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toBeTruthy();
  });

  it('should reject inactive invite code', async () => {
    inviteCode.isActive = false;
    await inviteCode.save();

    const res = await request(app)
      .post('/api/invites/validate')
      .send({ code: inviteCode.code });

    expect(res.status).toBe(400);
    expect(res.body.valid).toBe(false);
    expect(res.body.error).toBeTruthy();
  });
});

describe('POST /api/invites/redeem', () => {
  let inviteCode;

  beforeEach(async () => {
    inviteCode = await InviteCode.createInvite({
      createdBy: superAdmin._id,
      experiences: [experience._id],
      destinations: [destination._id],
      maxUses: 2
    });
  });

  it('should redeem invite code and create plans', async () => {
    const res = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ code: inviteCode.code });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.experiencesAdded).toHaveLength(1);
    expect(res.body.destinations).toHaveLength(1);

    // Verify plan was created
    const plan = await Plan.findOne({
      user: regularUser._id,
      experience: experience._id
    });
    expect(plan).toBeTruthy();
    expect(plan.plan).toHaveLength(2); // Copied from experience.plan_items

    // Verify invite was updated
    const updatedInvite = await InviteCode.findById(inviteCode._id);
    expect(updatedInvite.usedCount).toBe(1);
    expect(updatedInvite.redeemedBy).toContainEqual(regularUser._id);
  });

  it('should not create duplicate plans on re-redemption', async () => {
    // First redemption
    await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ code: inviteCode.code });

    const planCountBefore = await Plan.countDocuments({
      user: regularUser._id,
      experience: experience._id
    });

    // Second redemption (shouldn't create duplicate)
    await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ code: inviteCode.code });

    const planCountAfter = await Plan.countDocuments({
      user: regularUser._id,
      experience: experience._id
    });

    expect(planCountBefore).toBe(1);
    expect(planCountAfter).toBe(1);
  });

  it('should fail if not authenticated', async () => {
    const res = await request(app)
      .post('/api/invites/redeem')
      .send({ code: inviteCode.code });

    expect(res.status).toBe(401);
  });

  it('should fail for invalid code', async () => {
    const res = await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ code: 'INVALID-CODE' });

    expect(res.status).toBe(400);
  });

  it('should increment used count correctly', async () => {
    // Create second user
    const user2 = await User.create({
      name: 'User 2',
      email: 'user2@test.com',
      password: 'password123'
    });

    const user2Res = await request(app)
      .post('/api/users/login')
      .send({ email: 'user2@test.com', password: 'password123' });

    // First redemption
    await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ code: inviteCode.code });

    let updatedInvite = await InviteCode.findById(inviteCode._id);
    expect(updatedInvite.usedCount).toBe(1);

    // Second redemption by different user
    await request(app)
      .post('/api/invites/redeem')
      .set('Authorization', `Bearer ${user2Res.body}`)
      .send({ code: inviteCode.code });

    updatedInvite = await InviteCode.findById(inviteCode._id);
    expect(updatedInvite.usedCount).toBe(2);
    expect(updatedInvite.redeemedBy).toHaveLength(2);
  });
});

describe('POST /api/invites/bulk', () => {
  it('should create multiple invite codes as super admin', async () => {
    const invites = [
      { email: 'user1@test.com', name: 'User 1' },
      { email: 'user2@test.com', name: 'User 2' },
      { email: 'user3@test.com', name: 'User 3' }
    ];

    const res = await request(app)
      .post('/api/invites/bulk')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ invites });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(3);
    expect(res.body.errors).toHaveLength(0);

    // Verify all codes are unique
    const codes = res.body.created.map(inv => inv.code);
    const uniqueCodes = [...new Set(codes)];
    expect(codes.length).toBe(uniqueCodes.length);
  });

  it('should fail as regular user', async () => {
    const res = await request(app)
      .post('/api/invites/bulk')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ invites: [{ email: 'test@test.com' }] });

    expect(res.status).toBe(403);
  });

  it('should handle duplicate emails gracefully', async () => {
    const invites = [
      { email: 'user1@test.com', name: 'User 1' },
      { email: 'user1@test.com', name: 'User 1 Duplicate' }
    ];

    const res = await request(app)
      .post('/api/invites/bulk')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ invites });

    expect(res.status).toBe(201);
    // Both should be created as they're separate invites
    expect(res.body.created.length + res.body.errors.length).toBe(2);
  });

  it('should apply experiences and destinations to all invites', async () => {
    const invites = [
      { email: 'user1@test.com', name: 'User 1' },
      { email: 'user2@test.com', name: 'User 2' }
    ];

    const res = await request(app)
      .post('/api/invites/bulk')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        invites: invites.map(inv => ({
          ...inv,
          experiences: [experience._id.toString()],
          destinations: [destination._id.toString()]
        }))
      });

    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(2);

    // Verify experiences/destinations are attached
    res.body.created.forEach(invite => {
      expect(invite.experiences).toHaveLength(1);
      expect(invite.destinations).toHaveLength(1);
    });
  });
});

describe('DELETE /api/invites/:id', () => {
  let inviteCode;

  beforeEach(async () => {
    inviteCode = await InviteCode.createInvite({
      createdBy: superAdmin._id
    });
  });

  it('should deactivate invite code as creator', async () => {
    const res = await request(app)
      .delete(`/api/invites/${inviteCode._id}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deactivated');

    const updatedInvite = await InviteCode.findById(inviteCode._id);
    expect(updatedInvite.isActive).toBe(false);
  });

  it('should fail if not the creator', async () => {
    const res = await request(app)
      .delete(`/api/invites/${inviteCode._id}`)
      .set('Authorization', `Bearer ${regularUserToken}`);

    expect(res.status).toBe(403);
  });

  it('should fail if not authenticated', async () => {
    const res = await request(app)
      .delete(`/api/invites/${inviteCode._id}`);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/invites', () => {
  beforeEach(async () => {
    // Create invites for super admin
    await InviteCode.createInvite({
      createdBy: superAdmin._id,
      inviteeName: 'Admin Invite 1'
    });
    await InviteCode.createInvite({
      createdBy: superAdmin._id,
      inviteeName: 'Admin Invite 2'
    });

    // Create invite for regular user
    await InviteCode.createInvite({
      createdBy: regularUser._id,
      inviteeName: 'User Invite'
    });
  });

  it('should return all invites for super admin', async () => {
    const res = await request(app)
      .get('/api/invites')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('should return only user invites for regular user', async () => {
    const res = await request(app)
      .get('/api/invites')
      .set('Authorization', `Bearer ${regularUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].inviteeName).toBe('User Invite');
  });

  it('should populate creator information', async () => {
    const res = await request(app)
      .get('/api/invites')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].createdBy).toBeTruthy();
    expect(res.body[0].createdBy.name).toBeTruthy();
    expect(res.body[0].createdBy.email).toBeTruthy();
  });
});
