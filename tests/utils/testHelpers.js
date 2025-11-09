/**
 * Test Helper Utilities
 *
 * Provides common helper functions for API route testing including:
 * - Database setup/teardown
 * - Authentication token generation
 * - Test data creation
 * - Response validation
 */

const jwt = require('jsonwebtoken');
const User = require('../../models/user');
const Destination = require('../../models/destination');
const Experience = require('../../models/experience');
const Plan = require('../../models/plan');
const Photo = require('../../models/photo');

/**
 * Creates a test user and returns the user object
 */
async function createTestUser(userData = {}) {
  const defaultUser = {
    name: 'Test User',
    email: `test${Date.now()}@test.com`,
    password: 'Test123!',
    emailConfirmed: true, // Verified by default for tests
    ...userData,
  };

  const user = await User.create(defaultUser);
  return user;
}

/**
 * Generates a JWT token for a test user
 */
function generateAuthToken(user) {
  const payload = { user: { _id: user._id, email: user.email } };
  return jwt.sign(payload, process.env.SECRET);
}

/**
 * Creates a test destination
 */
async function createTestDestination(user, destinationData = {}) {
  const defaultDestination = {
    name: 'Test City',
    country: 'Test Country',
    state: 'Test State',
    travel_tips: ['Tip 1', 'Tip 2'],
    user: user._id,
    permissions: [
      {
        _id: user._id,
        entity: 'user',
        type: 'owner'
      }
    ],
    users_favorite: [],
    ...destinationData,
  };

  const destination = await Destination.create(defaultDestination);
  return destination;
}

/**
 * Creates a test experience
 */
async function createTestExperience(user, destination, experienceData = {}) {
  const defaultExperience = {
    name: 'Test Experience',
    description: 'Test Description',
    destination: destination._id,
    user: user._id,
    permissions: [
      {
        _id: user._id,
        entity: 'user',
        type: 'owner'
      }
    ],
    tags: ['test', 'sample'],
    users: [],
    plan_items: [],
    ...experienceData,
  };

  const experience = await Experience.create(defaultExperience);
  return experience;
}

/**
 * Creates a test plan
 */
async function createTestPlan(user, experience, planData = {}) {
  const defaultPlan = {
    user: user._id,
    experience: experience._id,
    planned_date: new Date(),
    plan: [],
    permissions: [
      {
        _id: user._id,
        entity: 'user',
        type: 'owner',
        granted_by: user._id
      }
    ],
    ...planData,
  };

  const plan = await Plan.create(defaultPlan);
  return plan;
}

/**
 * Creates a test photo
 */
async function createTestPhoto(user, photoData = {}) {
  const defaultPhoto = {
    url: 'https://example.com/test-photo.jpg',
    caption: 'Test Photo',
    photo_credit: 'Test Photographer',
    photo_credit_url: 'https://example.com',
    user: user._id,
    permissions: [
      {
        _id: user._id,
        entity: 'user',
        type: 'owner'
      }
    ],
    ...photoData,
  };

  const photo = await Photo.create(defaultPhoto);
  return photo;
}

/**
 * Clears all test data from the database
 */
async function clearTestData() {
  await Promise.all([
    User.deleteMany({}),
    Destination.deleteMany({}),
    Experience.deleteMany({}),
    Plan.deleteMany({}),
    Photo.deleteMany({}),
  ]);
}

/**
 * Validates response structure and data types
 */
const validators = {
  /**
   * Validates that a response is an array
   */
  isArray(response) {
    // Support paginated responses ({ data, meta }) or legacy array responses
    const body = response && response.body && response.body.data ? response.body.data : response.body;
    expect(Array.isArray(body)).toBe(true);
  },

  /**
   * Validates that a response is an object
   */
  isObject(response) {
    expect(typeof response.body).toBe('object');
    expect(Array.isArray(response.body)).toBe(false);
  },

  /**
   * Validates destination object structure
   */
  isValidDestination(destination) {
    expect(destination).toHaveProperty('_id');
    expect(destination).toHaveProperty('name');
    expect(destination).toHaveProperty('country');
    expect(destination).toHaveProperty('permissions');
    expect(destination).toHaveProperty('users_favorite');
    expect(typeof destination.name).toBe('string');
    expect(typeof destination.country).toBe('string');
    expect(Array.isArray(destination.permissions)).toBe(true);
    expect(Array.isArray(destination.users_favorite)).toBe(true);
    expect(Array.isArray(destination.travel_tips)).toBe(true);
  },

  /**
   * Validates experience object structure
   */
  isValidExperience(experience) {
    expect(experience).toHaveProperty('_id');
    expect(experience).toHaveProperty('name');
    expect(experience).toHaveProperty('description');
    expect(experience).toHaveProperty('destination');
    expect(experience).toHaveProperty('user');
    expect(experience).toHaveProperty('tags');
    expect(experience).toHaveProperty('users');
    expect(experience).toHaveProperty('plan_items');
    expect(typeof experience.name).toBe('string');
    expect(typeof experience.description).toBe('string');
    expect(Array.isArray(experience.tags)).toBe(true);
    expect(Array.isArray(experience.users)).toBe(true);
    expect(Array.isArray(experience.plan_items)).toBe(true);
  },

  /**
   * Validates user object structure
   */
  isValidUser(user) {
    expect(user).toHaveProperty('_id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(typeof user.name).toBe('string');
    expect(typeof user.email).toBe('string');
    expect(user).not.toHaveProperty('password'); // Password should never be returned
  },

  /**
   * Validates error response structure
   */
  isValidError(response, expectedStatus) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('error');
    expect(typeof response.body.error).toBe('string');
  },

  /**
   * Validates plan item structure
   */
  isValidPlanItem(planItem) {
    expect(planItem).toHaveProperty('_id');
    expect(planItem).toHaveProperty('task');
    expect(planItem).toHaveProperty('completed');
    expect(typeof planItem.task).toBe('string');
    expect(typeof planItem.completed).toBe('boolean');
  },
};

/**
 * Creates multiple test users
 */
async function createMultipleTestUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      name: `Test User ${i}`,
      email: `testuser${i}_${Date.now()}@test.com`,
    });
    users.push(user);
  }
  return users;
}

/**
 * Creates multiple test destinations
 */
async function createMultipleTestDestinations(user, count) {
  const destinations = [];
  for (let i = 0; i < count; i++) {
    const destination = await createTestDestination(user, {
      name: `Test City ${i}`,
      country: `Test Country ${i}`,
    });
    destinations.push(destination);
  }
  return destinations;
}

/**
 * Wait helper for async operations
 */
async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  createTestUser,
  generateAuthToken,
  createTestDestination,
  createTestExperience,
  createTestPlan,
  createTestPhoto,
  clearTestData,
  validators,
  createMultipleTestUsers,
  createMultipleTestDestinations,
  wait,
};
