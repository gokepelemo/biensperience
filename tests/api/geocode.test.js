/**
 * Geocode API Integration Tests
 *
 * Covers POST /api/geocode (proxies external geocoding via geocoding-utils).
 *
 * The external HTTP call is mocked at the geocoding-utils module boundary,
 * keeping tests deterministic and rate-limit-safe.
 */

// ---- Mock geocoding-utils (must be before app require) ---------------------
jest.mock('../../utilities/geocoding-utils', () => ({
  geocodeAddress: jest.fn()
}));

const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const {
  createTestUser,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');
const { geocodeAddress } = require('../../utilities/geocoding-utils');

describe('Geocode API', () => {
  let user;
  let token;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    geocodeAddress.mockReset();

    user = await createTestUser({
      email: `geo-${Date.now()}@test.com`,
      role: 'super_admin' // bypass rate limiter
    });
    token = generateAuthToken(user);
  });

  afterEach(async () => {
    await clearTestData();
  });

  describe('POST /api/geocode', () => {
    it('returns geocoded location for a valid address (happy path)', async () => {
      geocodeAddress.mockResolvedValueOnce({
        displayName: 'Paris, Île-de-France, France',
        city: 'Paris',
        country: 'France',
        coordinates: [2.3522, 48.8566]
      });

      const res = await request(app)
        .post('/api/geocode')
        .set('Authorization', `Bearer ${token}`)
        .send({ address: 'Paris' });

      expect(res.status).toBe(200);
      expect(res.body.city).toBe('Paris');
      expect(res.body.country).toBe('France');
      expect(geocodeAddress).toHaveBeenCalledWith('Paris');
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/geocode')
        .send({ address: 'Paris' });

      expect(res.status).toBe(401);
      expect(geocodeAddress).not.toHaveBeenCalled();
    });

    it('returns 400 when address is missing', async () => {
      const res = await request(app)
        .post('/api/geocode')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/required/i);
      expect(geocodeAddress).not.toHaveBeenCalled();
    });

    it('returns 400 when address is too short', async () => {
      const res = await request(app)
        .post('/api/geocode')
        .set('Authorization', `Bearer ${token}`)
        .send({ address: 'a' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(geocodeAddress).not.toHaveBeenCalled();
    });

    it('returns success:false with null data when address yields no results', async () => {
      geocodeAddress.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/geocode')
        .set('Authorization', `Bearer ${token}`)
        .send({ address: 'NoSuchPlaceXYZ' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
    });
  });
});
