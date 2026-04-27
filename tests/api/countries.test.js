/**
 * Countries API Integration Tests
 *
 * Covers GET /api/countries/:countryName
 *  - Happy path: returns destinations + experiences for a country
 *  - Slug normalization (e.g. "united-states" matches "United States")
 *  - Empty result for unknown countries
 *  - Pagination metadata shape
 */

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  createTestDestination,
  createTestExperience,
  clearTestData
} = require('../utils/testHelpers');

describe('Countries API', () => {
  let user;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    user = await createTestUser({
      email: `countries-${Date.now()}@test.com`,
      role: 'super_admin'
    });
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('GET /api/countries/:countryName', () => {
    it('returns destinations and experiences for a known country (happy path)', async () => {
      const dest = await createTestDestination(user, {
        name: 'Paris',
        country: 'France'
      });
      await createTestExperience(user, dest, { name: 'Eiffel Tower Tour' });

      const res = await request(app).get('/api/countries/France');

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body).toHaveProperty('country');
      expect(body).toHaveProperty('destinations');
      expect(body).toHaveProperty('experiences');
      expect(body).toHaveProperty('destinationsMeta');
      expect(body).toHaveProperty('experiencesMeta');
      expect(Array.isArray(body.destinations)).toBe(true);
      expect(body.destinations.length).toBe(1);
      expect(body.destinations[0].name).toBe('Paris');
      expect(body.experiences.length).toBe(1);
      expect(body.experiences[0].name).toBe('Eiffel Tower Tour');

      // Pagination metadata shape
      expect(body.destinationsMeta).toHaveProperty('page', 1);
      expect(body.destinationsMeta).toHaveProperty('total', 1);
      expect(body.destinationsMeta).toHaveProperty('totalPages', 1);
      expect(body.destinationsMeta).toHaveProperty('hasMore', false);
    });

    it('normalizes slug-style URL (united-states) into matched country name', async () => {
      await createTestDestination(user, {
        name: 'New York',
        country: 'United States'
      });

      const res = await request(app).get('/api/countries/united-states');

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.destinations.length).toBe(1);
      expect(body.destinations[0].country).toBe('United States');
      // slug should be lower-case dash form
      expect(body.slug).toBe('united-states');
    });

    it('returns empty arrays for unknown country', async () => {
      const res = await request(app).get('/api/countries/Atlantis');

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.destinations).toEqual([]);
      expect(body.experiences).toEqual([]);
      expect(body.destinationsMeta.total).toBe(0);
      expect(body.experiencesMeta.total).toBe(0);
    });

    it('respects destinationsLimit query parameter for pagination', async () => {
      // Create 3 destinations so pagination can split them
      await createTestDestination(user, { name: 'CityA', country: 'Spain' });
      await createTestDestination(user, { name: 'CityB', country: 'Spain' });
      await createTestDestination(user, { name: 'CityC', country: 'Spain' });

      const res = await request(app)
        .get('/api/countries/Spain?destinationsPage=1&destinationsLimit=2');

      expect(res.status).toBe(200);
      const body = res.body?.data || res.body;
      expect(body.destinations.length).toBe(2);
      expect(body.destinationsMeta.total).toBe(3);
      expect(body.destinationsMeta.hasMore).toBe(true);
      expect(body.destinationsMeta.totalPages).toBe(2);
    });
  });
});
