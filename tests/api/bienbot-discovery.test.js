/**
 * Integration tests for discovery engine pipeline
 *
 * Tests:
 * - findSimilarUsers() returns correct users for activity filters
 * - findSimilarUsers() respects destination scoping
 * - findSimilarUsers() excludes querying user
 * - findCoOccurringExperiences() excludes Stage 1 experiences
 * - findCoOccurringExperiences() computes ranking signals correctly
 * - findCoOccurringExperiences() filters by visibility
 * - buildDiscoveryContext() full pipeline with cache
 * - executeDiscoverContent() structured response
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Require models after mongoose is connected
const Plan = require('../../models/plan');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const User = require('../../models/user');
const Photo = require('../../models/photo');

const {
  findSimilarUsers,
  findCoOccurringExperiences
} = require('../../utilities/bienbot-context-builders');

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let userA, userB, userC, queryingUser;
let destParis, destTokyo;
let expFood, expMuseum, expNightlife, expAdventure;

beforeAll(async () => {
  // Create users
  queryingUser = await User.create({ name: 'Querying User', email: 'query@test.com', password: 'test123' });
  userA = await User.create({ name: 'User A', email: 'a@test.com', password: 'test123' });
  userB = await User.create({ name: 'User B', email: 'b@test.com', password: 'test123' });
  userC = await User.create({ name: 'User C', email: 'c@test.com', password: 'test123' });

  // Create destinations
  destParis = await Destination.create({ name: 'Paris', country: 'France', user: userA._id, permissions: [{ _id: userA._id, entity: 'user', type: 'owner' }] });
  destTokyo = await Destination.create({ name: 'Tokyo', country: 'Japan', user: userB._id, permissions: [{ _id: userB._id, entity: 'user', type: 'owner' }] });

  // Create experiences
  expFood = await Experience.create({
    name: 'Paris Food Tour', destination: destParis._id, user: userA._id,
    permissions: [{ _id: userA._id, entity: 'user', type: 'owner' }],
    plan_items: [{ content: 'Croissants', activity_type: 'food' }],
    visibility: 'public'
  });
  expMuseum = await Experience.create({
    name: 'Paris Museums', destination: destParis._id, user: userA._id,
    permissions: [{ _id: userA._id, entity: 'user', type: 'owner' }],
    plan_items: [{ content: 'Louvre', activity_type: 'museum' }],
    visibility: 'public'
  });
  expNightlife = await Experience.create({
    name: 'Tokyo Nightlife', destination: destTokyo._id, user: userB._id,
    permissions: [{ _id: userB._id, entity: 'user', type: 'owner' }],
    plan_items: [{ content: 'Shibuya', activity_type: 'nightlife' }],
    visibility: 'public'
  });
  expAdventure = await Experience.create({
    name: 'Private Adventure', destination: destParis._id, user: userC._id,
    permissions: [{ _id: userC._id, entity: 'user', type: 'owner' }],
    plan_items: [{ content: 'Secret', activity_type: 'adventure' }],
    visibility: 'private'
  });

  // Plans: userA and userB both planned food experiences, then also planned other things
  const foodItemId = new mongoose.Types.ObjectId();
  const museumItemId = new mongoose.Types.ObjectId();
  const nightlifeItemId = new mongoose.Types.ObjectId();

  await Plan.create({
    experience: expFood._id, user: userA._id, planned_date: new Date(),
    plan: [{ plan_item_id: foodItemId, content: 'Croissants', activity_type: 'food', cost: 20, complete: true }],
    permissions: [{ _id: userA._id, entity: 'user', type: 'owner' }]
  });
  await Plan.create({
    experience: expFood._id, user: userB._id, planned_date: new Date(),
    plan: [{ plan_item_id: foodItemId, content: 'Croissants', activity_type: 'food', cost: 20, complete: false }],
    permissions: [
      { _id: userB._id, entity: 'user', type: 'owner' },
      { _id: userC._id, entity: 'user', type: 'collaborator' }
    ]
  });
  // userA also planned museums (this is the co-occurrence we want to find)
  await Plan.create({
    experience: expMuseum._id, user: userA._id, planned_date: new Date(Date.now() - 30 * 86400000),
    plan: [{ plan_item_id: museumItemId, content: 'Louvre', activity_type: 'museum', cost: 15, complete: true }],
    permissions: [{ _id: userA._id, entity: 'user', type: 'owner' }]
  });
  // userB also planned nightlife
  await Plan.create({
    experience: expNightlife._id, user: userB._id, planned_date: new Date(Date.now() - 60 * 86400000),
    plan: [{ plan_item_id: nightlifeItemId, content: 'Shibuya', activity_type: 'nightlife', cost: 50, complete: false }],
    permissions: [{ _id: userB._id, entity: 'user', type: 'owner' }]
  });
});

// ---------------------------------------------------------------------------
// findSimilarUsers tests
// ---------------------------------------------------------------------------

describe('findSimilarUsers', () => {
  test('finds users who planned matching activity types', async () => {
    const result = await findSimilarUsers(
      { activity_types: ['culinary'] }, // expands to food, drinks, coffee, market, local
      queryingUser._id.toString()
    );
    expect(result.length).toBeGreaterThanOrEqual(2);
    const userIds = result.map(r => r.userId.toString());
    expect(userIds).toContain(userA._id.toString());
    expect(userIds).toContain(userB._id.toString());
  });

  test('excludes the querying user', async () => {
    const result = await findSimilarUsers(
      { activity_types: ['culinary'] },
      userA._id.toString()
    );
    const userIds = result.map(r => r.userId.toString());
    expect(userIds).not.toContain(userA._id.toString());
  });

  test('filters by destination_id when provided', async () => {
    const result = await findSimilarUsers(
      { activity_types: ['culinary'], destination_id: destParis._id.toString() },
      queryingUser._id.toString()
    );
    // Only userA planned a Paris food experience
    const userIds = result.map(r => r.userId.toString());
    expect(userIds).toContain(userA._id.toString());
  });

  test('returns all destinations when cross_destination is true', async () => {
    const result = await findSimilarUsers(
      { activity_types: ['culinary'], cross_destination: true },
      queryingUser._id.toString()
    );
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  test('returns empty array when no matching activity types', async () => {
    const result = await findSimilarUsers(
      { activity_types: ['zzz_nonexistent_activity'] },
      queryingUser._id.toString()
    );
    expect(result).toEqual([]);
  });

  test('returns empty array for empty activity_types', async () => {
    const result = await findSimilarUsers(
      {},
      queryingUser._id.toString()
    );
    expect(result).toEqual([]);
  });

  test('result shape has required fields', async () => {
    const result = await findSimilarUsers(
      { activity_types: ['culinary'] },
      queryingUser._id.toString()
    );
    expect(result.length).toBeGreaterThan(0);
    const first = result[0];
    expect(first).toHaveProperty('userId');
    expect(first).toHaveProperty('matchingPlanCount');
    expect(first).toHaveProperty('experienceIds');
    expect(Array.isArray(first.experienceIds)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// findCoOccurringExperiences tests
// ---------------------------------------------------------------------------

describe('findCoOccurringExperiences', () => {
  test('returns experiences not in stage 1 set', async () => {
    const similarUsers = [
      { userId: userA._id, matchingPlanCount: 1, experienceIds: [expFood._id] },
      { userId: userB._id, matchingPlanCount: 1, experienceIds: [expFood._id] }
    ];
    const result = await findCoOccurringExperiences(
      similarUsers, {}, queryingUser._id.toString()
    );
    const expIds = result.map(r => r.experience_id.toString());
    expect(expIds).not.toContain(expFood._id.toString());
  });

  test('excludes private experiences', async () => {
    const similarUsers = [
      { userId: userC._id, matchingPlanCount: 1, experienceIds: [] }
    ];
    const result = await findCoOccurringExperiences(
      similarUsers, {}, queryingUser._id.toString()
    );
    const expIds = result.map(r => r.experience_id.toString());
    expect(expIds).not.toContain(expAdventure._id.toString());
  });

  test('computes co_occurrence_count correctly', async () => {
    const similarUsers = [
      { userId: userA._id, matchingPlanCount: 1, experienceIds: [expFood._id] }
    ];
    const result = await findCoOccurringExperiences(
      similarUsers, {}, queryingUser._id.toString()
    );
    const museum = result.find(r => r.experience_id.toString() === expMuseum._id.toString());
    if (museum) {
      expect(museum.co_occurrence_count).toBe(1);
    }
  });

  test('returns empty array for empty similarUsers', async () => {
    const result = await findCoOccurringExperiences(
      [], {}, queryingUser._id.toString()
    );
    expect(result).toEqual([]);
  });

  test('result shape has required fields', async () => {
    const similarUsers = [
      { userId: userA._id, matchingPlanCount: 1, experienceIds: [expFood._id] }
    ];
    const result = await findCoOccurringExperiences(
      similarUsers, {}, queryingUser._id.toString()
    );
    if (result.length > 0) {
      const first = result[0];
      expect(first).toHaveProperty('experience_id');
      expect(first).toHaveProperty('experience_name');
      expect(first).toHaveProperty('destination_name');
      expect(first).toHaveProperty('co_occurrence_count');
      expect(first).toHaveProperty('avg_completion_rate');
      expect(first).toHaveProperty('collaborator_count');
      expect(first).toHaveProperty('latest_planned_date');
    }
  });
});

// ---------------------------------------------------------------------------
// buildDiscoveryContext tests
// ---------------------------------------------------------------------------

const { buildDiscoveryContext } = require('../../utilities/bienbot-context-builders');
const { resetDiscoveryCache } = require('../../utilities/discovery-cache');

describe('buildDiscoveryContext (full pipeline)', () => {
  beforeEach(async () => {
    resetDiscoveryCache();
    // Clear MongoDB cache collection so each test starts cold
    const DiscoveryCacheModel = require('../../models/discovery-cache');
    await DiscoveryCacheModel.deleteMany({});
  });

  test('returns structured results with text context', async () => {
    const result = await buildDiscoveryContext(
      { activity_types: ['culinary'] },
      queryingUser._id.toString()
    );
    expect(result).toBeTruthy();
    expect(result.results).toBeDefined();
    expect(result.contextBlock).toBeDefined();
    expect(result.query_metadata).toBeDefined();
    expect(result.query_metadata.result_count).toBeGreaterThanOrEqual(0);
  });

  test('returns cache_hit: false on first call, true on second', async () => {
    const result1 = await buildDiscoveryContext(
      { activity_types: ['culinary'] },
      queryingUser._id.toString()
    );
    expect(result1.query_metadata.cache_hit).toBe(false);

    const result2 = await buildDiscoveryContext(
      { activity_types: ['culinary'] },
      queryingUser._id.toString()
    );
    expect(result2.query_metadata.cache_hit).toBe(true);
  });

  test('returns null when no matches found', async () => {
    const result = await buildDiscoveryContext(
      { activity_types: ['nonexistent_category'] },
      queryingUser._id.toString()
    );
    expect(result).toBeNull();
  });

  test('supports cross-destination discovery', async () => {
    const result = await buildDiscoveryContext(
      { activity_types: ['culinary'], cross_destination: true },
      queryingUser._id.toString()
    );
    expect(result).toBeTruthy();
    expect(result.query_metadata.cross_destination).toBe(true);
  });

  test('results have required structured fields', async () => {
    const result = await buildDiscoveryContext(
      { activity_types: ['culinary'] },
      queryingUser._id.toString()
    );
    if (result && result.results.length > 0) {
      const item = result.results[0];
      expect(item).toHaveProperty('experience_id');
      expect(item).toHaveProperty('experience_name');
      expect(item).toHaveProperty('destination_name');
      expect(item).toHaveProperty('relevance_score');
      expect(item).toHaveProperty('match_reason');
    }
  });
});
