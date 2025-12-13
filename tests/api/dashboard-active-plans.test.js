const mongoose = require('mongoose');
const { getDashboard } = require('../../controllers/api/dashboard');
const User = require('../../models/user');
const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const dbSetup = require('../setup/testSetup');

describe('Dashboard API - ActivePlansCard Integration', () => {
  let userId;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    // Create test user with preferences (required by dashboard controller)
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      preferences: {
        currency: 'USD',
        theme: 'light',
        timezone: 'America/New_York'
      }
    });
    userId = user._id;

    // Create test destination
    const destination = await Destination.create({
      name: 'Test Destination',
      city: 'Test City',
      country: 'Test Country',
      user: userId,
      permissions: [{
        _id: userId,
        entity: 'user',
        type: 'owner'
      }]
    });

    // Create test experience
    const experience = await Experience.create({
      name: 'Test Experience',
      destination: destination._id,
      user: userId,
      permissions: [{
        _id: userId,
        entity: 'user',
        type: 'owner'
      }]
    });

    // Create owned plan (user is owner)
    await Plan.create({
      experience: experience._id,
      user: userId,
      plan: [
        { plan_item_id: new mongoose.Types.ObjectId(), complete: true, cost: 50 },
        { plan_item_id: new mongoose.Types.ObjectId(), complete: false, cost: 25 }
      ],
      permissions: [{
        _id: userId,
        entity: 'user',
        type: 'owner'
      }]
    });

    // Create another user for shared plan
    const otherUser = await User.create({
      name: 'Other User',
      email: 'other@example.com',
      password: 'password123'
    });

    // Create shared plan (user is collaborator)
    await Plan.create({
      experience: experience._id,
      user: otherUser._id, // Other user is owner
      plan: [
        { plan_item_id: new mongoose.Types.ObjectId(), complete: true, cost: 30 }
      ],
      permissions: [
        {
          _id: otherUser._id,
          entity: 'user',
          type: 'owner'
        },
        {
          _id: userId,
          entity: 'user',
          type: 'collaborator'
        }
      ]
    });
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Plan.deleteMany({});
    await Experience.deleteMany({});
    await Destination.deleteMany({});
  });

  it('should return detailed active plans statistics for ActivePlansCard', async () => {
    // Fetch the full user object with preferences
    const fullUser = await User.findById(userId);

    const mockReq = {
      user: fullUser,
      query: {}  // Required by dashboard controller for currency parameter
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getDashboard(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    const responseData = mockRes.json.mock.calls[0][0];

    // Verify the response structure (wrapped in { data, success } by successResponse helper)
    expect(responseData).toHaveProperty('data');
    expect(responseData.data).toHaveProperty('stats');
    expect(responseData.data.stats).toHaveProperty('activePlansDetails');

    const details = responseData.data.stats.activePlansDetails;

    // Should have 2 total plans (1 owned + 1 shared)
    expect(details.totalPlans).toBe(2);

    // Should have 1 owned plan
    expect(details.ownedPlans).toBe(1);

    // Should have 1 shared plan
    expect(details.sharedPlans).toBe(1);

    // Should have 1 completed plan (the shared plan with 1 complete item)
    expect(details.completedPlans).toBe(1);
  });

  it('should handle users with no plans', async () => {
    // Clean up existing plans
    await Plan.deleteMany({});

    // Fetch the full user object with preferences
    const fullUser = await User.findById(userId);

    const mockReq = {
      user: fullUser,
      query: {}  // Required by dashboard controller for currency parameter
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getDashboard(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    const responseData = mockRes.json.mock.calls[0][0];

    const details = responseData.data.stats.activePlansDetails;

    // Should have 0 plans
    expect(details.totalPlans).toBe(0);
    expect(details.ownedPlans).toBe(0);
    expect(details.sharedPlans).toBe(0);
    expect(details.completedPlans).toBe(0);
  });
});