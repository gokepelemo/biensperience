const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getDashboard } = require('../../controllers/api/dashboard');
const User = require('../../models/user');
const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');

describe('Dashboard API - ActivePlansCard Integration', () => {
  let mongoServer;
  let userId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test user
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
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
    const mockReq = {
      user: { _id: userId }
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getDashboard(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    const responseData = mockRes.json.mock.calls[0][0];

    // Verify the response structure
    expect(responseData).toHaveProperty('stats');
    expect(responseData.stats).toHaveProperty('activePlansDetails');

    const details = responseData.stats.activePlansDetails;

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

    const mockReq = {
      user: { _id: userId }
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await getDashboard(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalled();
    const responseData = mockRes.json.mock.calls[0][0];

    const details = responseData.stats.activePlansDetails;

    // Should have 0 plans
    expect(details.totalPlans).toBe(0);
    expect(details.ownedPlans).toBe(0);
    expect(details.sharedPlans).toBe(0);
    expect(details.completedPlans).toBe(0);
  });
});