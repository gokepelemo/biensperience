/**
 * API Tokens Test Suite
 *
 * Tests for API token authentication and management
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const User = require('../../models/user');
const ApiToken = require('../../models/apiToken');
const jwt = require('jsonwebtoken');

let mongoServer;
let testUser;
let testUserToken; // JWT token for authenticated requests
let apiToken; // API token for testing
let adminUser;
let adminToken;

/**
 * Setup: Start in-memory MongoDB and create test users
 */
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test user
  testUser = await User.create({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    emailConfirmed: true,
    apiEnabled: true
  });

  // Create admin user
  adminUser = await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    emailConfirmed: true,
    isSuperAdmin: true,
    apiEnabled: true
  });

  // Generate JWT tokens
  testUserToken = jwt.sign({ user: testUser }, process.env.SECRET || 'test-secret');
  adminToken = jwt.sign({ user: adminUser }, process.env.SECRET || 'test-secret');
});

/**
 * Cleanup: Stop MongoDB and close connections
 */
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

/**
 * Reset: Clear tokens before each test
 */
beforeEach(async () => {
  await ApiToken.deleteMany({});
});

describe('API Token Management', () => {
  describe('POST /api/tokens - Create Token', () => {
    test('should create a new API token with API access enabled', async () => {
      const response = await request(app)
        .post('/api/tokens')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: 'Test Token' })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('tokenData');
      expect(response.body.token).toMatch(/^[a-f0-9]{64}$/);
      expect(response.body.tokenData.name).toBe('Test Token');
      expect(response.body.tokenData.tokenPrefix).toBe(response.body.token.substring(0, 8));

      // Verify token was saved to database
      const savedToken = await ApiToken.findById(response.body.tokenData._id);
      expect(savedToken).toBeTruthy();
      expect(savedToken.user.toString()).toBe(testUser._id.toString());
    });

    test('should fail to create token when API access is disabled', async () => {
      // Disable API access
      await User.findByIdAndUpdate(testUser._id, { apiEnabled: false });

      const response = await request(app)
        .post('/api/tokens')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ name: 'Test Token' })
        .expect(403);

      expect(response.body.error).toContain('API access is disabled');

      // Re-enable for other tests
      await User.findByIdAndUpdate(testUser._id, { apiEnabled: true });
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/tokens')
        .send({ name: 'Test Token' })
        .expect(401);
    });

    test('should use default name if not provided', async () => {
      const response = await request(app)
        .post('/api/tokens')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({})
        .expect(201);

      expect(response.body.tokenData.name).toBe('API Token');
    });
  });

  describe('GET /api/tokens - List Tokens', () => {
    beforeEach(async () => {
      // Create some test tokens
      const { token: token1 } = await ApiToken.createToken(testUser._id, { name: 'Token 1' });
      const { token: token2 } = await ApiToken.createToken(testUser._id, { name: 'Token 2' });
      apiToken = token1; // Save for later tests
    });

    test('should list all tokens for authenticated user', async () => {
      const response = await request(app)
        .get('/api/tokens')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Token 2'); // Sorted by createdAt desc
      expect(response.body[1].name).toBe('Token 1');

      // Should not include token hash
      expect(response.body[0]).not.toHaveProperty('tokenHash');
    });

    test('should return empty array when user has no tokens', async () => {
      await ApiToken.deleteMany({ user: testUser._id });

      const response = await request(app)
        .get('/api/tokens')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/tokens')
        .expect(401);
    });
  });

  describe('DELETE /api/tokens/:id - Revoke Token', () => {
    let tokenToRevoke;

    beforeEach(async () => {
      const { apiToken: token } = await ApiToken.createToken(testUser._id, { name: 'Token to Revoke' });
      tokenToRevoke = token;
    });

    test('should revoke a token (set isActive to false)', async () => {
      const response = await request(app)
        .delete(`/api/tokens/${tokenToRevoke._id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('revoked');

      // Verify token is inactive
      const revokedToken = await ApiToken.findById(tokenToRevoke._id);
      expect(revokedToken.isActive).toBe(false);
    });

    test('should permanently delete a token when permanent=true', async () => {
      const response = await request(app)
        .delete(`/api/tokens/${tokenToRevoke._id}?permanent=true`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify token is deleted
      const deletedToken = await ApiToken.findById(tokenToRevoke._id);
      expect(deletedToken).toBeNull();
    });

    test('should not allow deleting another user\'s token', async () => {
      const { apiToken: otherToken } = await ApiToken.createToken(adminUser._id, { name: 'Admin Token' });

      await request(app)
        .delete(`/api/tokens/${otherToken._id}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);

      // Verify token still exists
      const stillExists = await ApiToken.findById(otherToken._id);
      expect(stillExists).toBeTruthy();
    });

    test('should return 404 for non-existent token', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      await request(app)
        .delete(`/api/tokens/${fakeId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/tokens/toggle-api-access - Toggle API Access', () => {
    test('should enable API access', async () => {
      // Start with disabled
      await User.findByIdAndUpdate(testUser._id, { apiEnabled: false });

      const response = await request(app)
        .put('/api/tokens/toggle-api-access')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ enabled: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.apiEnabled).toBe(true);
      expect(response.body.message).toContain('enabled');

      // Verify in database
      const user = await User.findById(testUser._id);
      expect(user.apiEnabled).toBe(true);
    });

    test('should disable API access and revoke all tokens', async () => {
      // Create some tokens
      await ApiToken.createToken(testUser._id, { name: 'Token 1' });
      await ApiToken.createToken(testUser._id, { name: 'Token 2' });

      const response = await request(app)
        .put('/api/tokens/toggle-api-access')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.apiEnabled).toBe(false);
      expect(response.body.message).toContain('disabled');
      expect(response.body.message).toContain('revoked');

      // Verify all tokens are revoked
      const tokens = await ApiToken.find({ user: testUser._id });
      expect(tokens.every(t => !t.isActive)).toBe(true);
    });

    test('should require boolean value for enabled', async () => {
      await request(app)
        .put('/api/tokens/toggle-api-access')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ enabled: 'yes' })
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .put('/api/tokens/toggle-api-access')
        .send({ enabled: true })
        .expect(401);
    });
  });
});

describe('API Token Authentication', () => {
  let validApiToken;

  beforeEach(async () => {
    const { token } = await ApiToken.createToken(testUser._id, { name: 'Auth Test Token' });
    validApiToken = token;
  });

  describe('Authentication with API Token', () => {
    test('should authenticate with valid API token', async () => {
      const response = await request(app)
        .get('/api/experiences')
        .set('Authorization', `Bearer ${validApiToken}`)
        .expect(200);

      // Should succeed (200 or appropriate response)
      expect(response.status).toBeLessThan(400);
    });

    test('should fail with invalid API token', async () => {
      const invalidToken = 'a'.repeat(64); // Valid format but wrong token

      const response = await request(app)
        .get('/api/experiences')
        .set('Authorization', `Bearer ${invalidToken}`);

      // Should not authenticate (no user set)
      // This will likely return 401 or fall through to unauthenticated behavior
      expect([401, 403]).toContain(response.status);
    });

    test('should fail with malformed API token', async () => {
      const malformedToken = 'not-a-valid-token';

      const response = await request(app)
        .get('/api/experiences')
        .set('Authorization', `Bearer ${malformedToken}`);

      // Should not authenticate
      expect([401, 403]).toContain(response.status);
    });

    test('should bypass CSRF protection with API token', async () => {
      // POST request without CSRF token should succeed with API token
      const response = await request(app)
        .post('/api/experiences')
        .set('Authorization', `Bearer ${validApiToken}`)
        .send({
          name: 'Test Experience',
          destination: new mongoose.Types.ObjectId()
        });

      // Should not fail with CSRF error
      // (may fail with other validation errors, but not CSRF)
      // Expect 201 (success) since we're providing valid data
      expect(response.status).toBe(201);
    });

    test('should fail when API access is disabled for user', async () => {
      // Disable API access
      await User.findByIdAndUpdate(testUser._id, { apiEnabled: false });

      const response = await request(app)
        .get('/api/experiences')
        .set('Authorization', `Bearer ${validApiToken}`)
        .expect(403);

      expect(response.body.error).toContain('API access is disabled');

      // Re-enable
      await User.findByIdAndUpdate(testUser._id, { apiEnabled: true });
    });

    test('should fail with revoked token', async () => {
      // Revoke the token
      const tokenDoc = await ApiToken.findOne({
        tokenHash: ApiToken.hashToken(validApiToken)
      });
      await ApiToken.revokeToken(tokenDoc._id);

      const response = await request(app)
        .get('/api/experiences')
        .set('Authorization', `Bearer ${validApiToken}`);

      // Should not authenticate
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Token Model Methods', () => {
    test('should generate unique token', () => {
      const token1 = ApiToken.generateToken();
      const token2 = ApiToken.generateToken();

      expect(token1).toMatch(/^[a-f0-9]{64}$/);
      expect(token2).toMatch(/^[a-f0-9]{64}$/);
      expect(token1).not.toBe(token2);
    });

    test('should hash token consistently', () => {
      const token = ApiToken.generateToken();
      const hash1 = ApiToken.hashToken(token);
      const hash2 = ApiToken.hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should get token prefix', () => {
      const token = 'abcdef1234567890' + 'x'.repeat(48);
      const prefix = ApiToken.getTokenPrefix(token);

      expect(prefix).toBe('abcdef12');
      expect(prefix.length).toBe(8);
    });

    test('should find user by valid token', async () => {
      const { token } = await ApiToken.createToken(testUser._id, { name: 'Lookup Test' });
      const foundUser = await ApiToken.findUserByToken(token);

      expect(foundUser).toBeTruthy();
      expect(foundUser._id.toString()).toBe(testUser._id.toString());
      expect(foundUser.email).toBe(testUser.email);
    });

    test('should return null for invalid token', async () => {
      const invalidToken = 'a'.repeat(64);
      const foundUser = await ApiToken.findUserByToken(invalidToken);

      expect(foundUser).toBeNull();
    });

    test('should update lastUsed timestamp on token use', async () => {
      const { token, apiToken: tokenDoc } = await ApiToken.createToken(testUser._id, { name: 'Usage Test' });

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));

      const foundUser = await ApiToken.findUserByToken(token);
      expect(foundUser).toBeTruthy();

      // Check that lastUsed was updated (give it a moment to save)
      await new Promise(resolve => setTimeout(resolve, 100));

      const updatedToken = await ApiToken.findById(tokenDoc._id);
      expect(updatedToken.lastUsed).toBeTruthy();
      expect(updatedToken.lastUsed.getTime()).toBeGreaterThan(tokenDoc.createdAt.getTime());
    });

    test('should cleanup expired tokens', async () => {
      // Ensure clean state - delete all existing tokens
      await ApiToken.deleteMany({});

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Create expired token
      await ApiToken.createToken(testUser._id, {
        name: 'Expired Token',
        expiresAt: yesterday
      });

      // Create valid token
      await ApiToken.createToken(testUser._id, {
        name: 'Valid Token'
      });

      const deletedCount = await ApiToken.cleanupExpiredTokens();
      expect(deletedCount).toBe(1);

      const remainingTokens = await ApiToken.find({ user: testUser._id });
      expect(remainingTokens).toHaveLength(1);
      expect(remainingTokens[0].name).toBe('Valid Token');
    });
  });
});

describe('API Token Edge Cases', () => {
  test('should handle concurrent token creation', async () => {
    const promises = Array(5).fill(null).map(() =>
      ApiToken.createToken(testUser._id, { name: 'Concurrent Token' })
    );

    const results = await Promise.all(promises);

    // All tokens should be unique
    const tokens = results.map(r => r.token);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(5);

    // All should be saved
    const savedTokens = await ApiToken.find({ user: testUser._id });
    expect(savedTokens).toHaveLength(5);
  });

  test('should handle token with special characters in name', async () => {
    const specialName = 'Token with "quotes" & <tags> and émojis 🔑';

    const { apiToken } = await ApiToken.createToken(testUser._id, {
      name: specialName
    });

    expect(apiToken.name).toBe(specialName);

    const retrieved = await ApiToken.findById(apiToken._id);
    expect(retrieved.name).toBe(specialName);
  });

  test('should handle very long token names', async () => {
    const longName = 'A'.repeat(1000);

    const { apiToken } = await ApiToken.createToken(testUser._id, {
      name: longName
    });

    expect(apiToken.name).toBe(longName);
  });
});
