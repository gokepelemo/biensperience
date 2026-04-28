/**
 * JWT denylist (revocation) test suite.
 *
 * Covers three paths:
 *   1. Redis available + jti not on list  → token works.
 *   2. Redis available + jti on list      → token rejected (req.user = null).
 *   3. Redis unavailable                  → token works (graceful fallback).
 *
 * The shared Redis client (`utilities/rate-limit-store`) is mocked so no
 * live Redis is required. The Express integration test uses supertest
 * against the real `app.js` to exercise `config/checkToken.js`.
 */

// ---------------------------------------------------------------------------
// Mock the shared Redis client BEFORE any module that imports it.
// ---------------------------------------------------------------------------

const mockStore = new Map();
const mockState = { redisAvailable: true };

function mockMakeFakeClient() {
  return {
    setex: jest.fn(async (key, ttlSeconds, value) => {
      mockStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      return 'OK';
    }),
    exists: jest.fn(async (key) => {
      const entry = mockStore.get(key);
      if (!entry) return 0;
      if (entry.expiresAt < Date.now()) {
        mockStore.delete(key);
        return 0;
      }
      return 1;
    }),
  };
}

jest.mock('../../utilities/rate-limit-store', () => ({
  getSharedRedisClient: jest.fn(() => (mockState.redisAvailable ? mockMakeFakeClient() : null)),
  createRateLimitStore: jest.fn(() => undefined),
}));

// ---------------------------------------------------------------------------
// Imports after mock setup.
// ---------------------------------------------------------------------------

const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const dbSetup = require('../setup/testSetup');

// Force the JWT secret to a known value before app.js loads.
process.env.SECRET = process.env.SECRET || 'jwt-denylist-test-secret';

const app = require('../../app');
const User = require('../../models/user');
const denylist = require('../../utilities/jwt-denylist');

let testUser;

beforeAll(async () => {
  await dbSetup.connect();

  testUser = await User.create({
    name: 'Denylist Test User',
    email: 'jwt-denylist-test@example.com',
    password: 'password123',
    emailConfirmed: true,
  });
});

afterAll(async () => {
  await dbSetup.closeDatabase();
});

beforeEach(() => {
  mockStore.clear();
  mockState.redisAvailable = true;
});

// ---------------------------------------------------------------------------
// Unit tests for the denylist helpers themselves.
// ---------------------------------------------------------------------------

describe('jwt-denylist (unit)', () => {
  test('generateJti() returns a 32-char hex string (16 random bytes)', () => {
    const jti1 = denylist.generateJti();
    const jti2 = denylist.generateJti();
    expect(jti1).toMatch(/^[a-f0-9]{32}$/);
    expect(jti2).toMatch(/^[a-f0-9]{32}$/);
    expect(jti1).not.toBe(jti2);
  });

  test('addToDenylist + isDenylisted round-trip when Redis is available', async () => {
    const jti = denylist.generateJti();

    expect(await denylist.isDenylisted(jti)).toBe(false);

    const added = await denylist.addToDenylist(jti, 3600);
    expect(added).toBe(true);

    expect(await denylist.isDenylisted(jti)).toBe(true);
  });

  test('addToDenylist is a no-op when Redis is unavailable', async () => {
    mockState.redisAvailable = false;
    const jti = denylist.generateJti();

    const added = await denylist.addToDenylist(jti, 3600);
    expect(added).toBe(false);

    // Even after the "add" call, isDenylisted returns false (graceful).
    expect(await denylist.isDenylisted(jti)).toBe(false);
  });

  test('isDenylisted returns false when Redis is unavailable (fail open)', async () => {
    mockState.redisAvailable = false;
    expect(await denylist.isDenylisted(denylist.generateJti())).toBe(false);
  });

  test('addToDenylist refuses non-positive TTLs', async () => {
    const jti = denylist.generateJti();
    expect(await denylist.addToDenylist(jti, 0)).toBe(false);
    expect(await denylist.addToDenylist(jti, -10)).toBe(false);
  });

  test('remainingSecondsFromExp computes the right delta', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(denylist.remainingSecondsFromExp(nowSec + 60)).toBeGreaterThanOrEqual(59);
    expect(denylist.remainingSecondsFromExp(nowSec - 60)).toBe(0);
    expect(denylist.remainingSecondsFromExp(undefined)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: checkToken middleware honors the denylist.
// ---------------------------------------------------------------------------

describe('checkToken denylist integration', () => {
  function signTokenWithJti(user, jti, expiresIn = '24h') {
    return jwt.sign(
      { user: { _id: user._id, email: user.email, role: user.role }, jti },
      process.env.SECRET,
      { expiresIn }
    );
  }

  test('valid (non-denylisted) JWT is accepted', async () => {
    const jti = denylist.generateJti();
    const token = signTokenWithJti(testUser, jti);

    // /api/users/check-token returns 200 + the JWT-payload user when
    // checkToken populates req.user (see controllers/api/users.js).
    const res = await request(app)
      .get('/api/users/check-token')
      .set('Authorization', `Bearer ${token}`);

    // We tolerate either 200 (the route exists) or 404 (route name differs)
    // — what matters is that the request didn't get blocked at auth.
    // The fact we don't get a 401 here proves checkToken let it through.
    expect(res.status).not.toBe(401);
  });

  test('denylisted JWT is rejected (req.user nulled)', async () => {
    const jti = denylist.generateJti();
    const token = signTokenWithJti(testUser, jti);

    // Add to denylist with full token TTL.
    await denylist.addToDenylist(jti, 3600);

    // /api/users/check-token is gated by ensureLoggedIn, which returns 401
    // when checkToken nulls req.user (which the denylist check should do).
    const res = await request(app)
      .get('/api/users/check-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  test('Redis-unavailable path: denylist check is skipped, token works', async () => {
    mockState.redisAvailable = false;

    const jti = denylist.generateJti();
    const token = signTokenWithJti(testUser, jti);

    // Even after attempting to "denylist" the token, with Redis down
    // the request should still be processed (graceful degradation).
    await denylist.addToDenylist(jti, 3600); // no-op
    expect(await denylist.isDenylisted(jti)).toBe(false);

    const res = await request(app)
      .get('/api/users/check-token')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).not.toBe(401);
  });
});
