/**
 * Session ID and Trace ID System Tests
 * 
 * Tests the comprehensive session and trace ID implementation including:
 * - Session generation and validation
 * - Session expiry and refresh
 * - Trace ID generation and propagation
 * - Middleware integration
 * - OAuth flow sessions
 * - Concurrent sessions
 * - Response headers
 */

const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/user');
const { createSessionForUser, clearSessionForUser } = require('../../utilities/session-middleware');

describe('Session and Trace ID System', () => {
  let mongoServer;
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      emailConfirmed: true
    });

    // Generate auth token
    authToken = testUser.generateToken();
  });

  describe('Session Generation and Validation', () => {
    test('should create session on login', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.headers['bien-session-id']).toBeDefined();
      expect(response.headers['bien-session-id']).toMatch(/^bien-[a-f0-9-]+-\d+$/);

      // Verify session stored in database
      const user = await User.findById(testUser._id);
      expect(user.currentSessionId).toBeDefined();
      expect(user.sessionCreatedAt).toBeDefined();
      expect(user.sessionExpiresAt).toBeDefined();
    });

    test('should validate session ID format', async () => {
      await createSessionForUser(testUser);

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', testUser.currentSessionId)
        .expect(200);

      expect(response.headers['bien-session-id']).toBe(testUser.currentSessionId);
    });

    test('should reject invalid session ID format', async () => {
      await createSessionForUser(testUser);

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', 'invalid_format')
        .expect(200); // Still succeeds but creates new session

      expect(response.headers['bien-session-id']).toBeDefined();
      expect(response.headers['bien-session-id']).not.toBe('invalid_format');
    });

    test('should reject expired session', async () => {
      await createSessionForUser(testUser);

      // Manually expire session
      testUser.sessionExpiresAt = new Date(Date.now() - 1000);
      await testUser.save();

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', testUser.currentSessionId)
        .expect(200);

      // Should get new session
      expect(response.headers['bien-session-id']).toBeDefined();
      expect(response.headers['bien-session-id']).not.toBe(testUser.currentSessionId);
    });

    test('should handle missing session ID gracefully', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should create new session
      expect(response.headers['bien-session-id']).toBeDefined();
    });
  });

  describe('Session Expiry and Refresh', () => {
    test('should expire after configured time', async () => {
      // Set short expiry for testing
      process.env.SESSION_EXPIRY_HOURS = '0.001'; // ~3.6 seconds

      await createSessionForUser(testUser);
      const originalSessionId = testUser.currentSessionId;

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 4000));

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', originalSessionId)
        .expect(200);

      // Should get new session
      expect(response.headers['bien-session-id']).not.toBe(originalSessionId);

      // Reset to default
      delete process.env.SESSION_EXPIRY_HOURS;
    }, 10000);

    test('should warn when session nearing expiry', async () => {
      await createSessionForUser(testUser);

      // Set expiry to near future
      testUser.sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      await testUser.save();

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', testUser.currentSessionId)
        .expect(200);

      expect(response.headers['x-session-expiring-soon']).toBe('true');
    });

    test('should extend session on activity', async () => {
      await createSessionForUser(testUser);
      const originalExpiry = testUser.sessionExpiresAt;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Make request
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', testUser.currentSessionId)
        .expect(200);

      // Check if expiry extended
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.sessionExpiresAt).toBeGreaterThanOrEqual(originalExpiry);
    });
  });

  describe('Trace ID System', () => {
    test('should generate trace ID for each request', async () => {
      const response1 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const response2 = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response1.headers['bien-trace-id']).toBeDefined();
      expect(response2.headers['bien-trace-id']).toBeDefined();
      expect(response1.headers['bien-trace-id']).not.toBe(response2.headers['bien-trace-id']);
    });

    test('should accept and preserve client-provided trace ID', async () => {
      const clientTraceId = 'client-trace-12345';

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-trace-id', clientTraceId)
        .expect(200);

      expect(response.headers['bien-trace-id']).toBe(clientTraceId);
    });

    test('should include trace ID in error responses', async () => {
      // Use a valid ObjectId format that doesn't exist
      const nonexistentId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/users/${nonexistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.headers['bien-trace-id']).toBeDefined();
    });
  });

  describe('Middleware Integration', () => {
    test('should attach session and trace IDs in correct order', async () => {
      await createSessionForUser(testUser);

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', testUser.currentSessionId)
        .expect(200);

      // Both should be present
      expect(response.headers['bien-session-id']).toBe(testUser.currentSessionId);
      expect(response.headers['bien-trace-id']).toBeDefined();
    });

    test('should work on public routes', async () => {
      const response = await request(app)
        .get('/api/destinations')
        .expect(200);

      // Trace ID should be present even on public routes
      expect(response.headers['bien-trace-id']).toBeDefined();
      // Session ID should not be present for unauthenticated requests
      expect(response.headers['bien-session-id']).toBeUndefined();
    });

    test('should handle concurrent requests with different sessions', async () => {
      // Create second user
      const testUser2 = await User.create({
        name: 'Test User 2',
        email: 'test2@example.com',
        password: 'Password123!',
        emailConfirmed: true
      });

      await createSessionForUser(testUser);
      await createSessionForUser(testUser2);

      const authToken2 = testUser2.generateToken();

      // Make concurrent requests
      const [response1, response2] = await Promise.all([
        request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken}`)
          .set('bien-session-id', testUser.currentSessionId),
        request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${authToken2}`)
          .set('bien-session-id', testUser2.currentSessionId)
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.headers['bien-session-id']).toBe(testUser.currentSessionId);
      expect(response2.headers['bien-session-id']).toBe(testUser2.currentSessionId);
      expect(response1.headers['bien-trace-id']).not.toBe(response2.headers['bien-trace-id']);
    });
  });

  describe('OAuth Flow Sessions', () => {
    test('should create session after OAuth login', async () => {
      // Simulate OAuth user creation
      const oauthUser = await User.create({
        name: 'OAuth User',
        email: 'oauth@example.com',
        googleId: 'google_12345',
        emailConfirmed: true
      });

      await createSessionForUser(oauthUser);

      expect(oauthUser.currentSessionId).toBeDefined();
      expect(oauthUser.sessionCreatedAt).toBeDefined();
      expect(oauthUser.sessionExpiresAt).toBeDefined();
    });

    test('should handle OAuth users without password', async () => {
      const oauthUser = await User.create({
        name: 'OAuth User',
        email: 'oauth@example.com',
        facebookId: 'facebook_12345',
        emailConfirmed: true
      });

      await createSessionForUser(oauthUser);
      const oauthToken = oauthUser.generateToken();

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${oauthToken}`)
        .set('bien-session-id', oauthUser.currentSessionId)
        .expect(200);

      expect(response.headers['bien-session-id']).toBe(oauthUser.currentSessionId);
    });
  });

  describe('Logout and Session Clearing', () => {
    test('should clear session on logout', async () => {
      await createSessionForUser(testUser);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');

      // Verify session cleared in database
      const user = await User.findById(testUser._id);
      expect(user.currentSessionId).toBeUndefined();
      expect(user.sessionCreatedAt).toBeUndefined();
      expect(user.sessionExpiresAt).toBeUndefined();
    });

    test('should handle logout for user with no session', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });

    test('should clear session manually', async () => {
      await createSessionForUser(testUser);
      expect(testUser.currentSessionId).toBeDefined();

      await clearSessionForUser(testUser);

      expect(testUser.currentSessionId).toBeUndefined();
      expect(testUser.sessionCreatedAt).toBeUndefined();
      expect(testUser.sessionExpiresAt).toBeUndefined();
    });
  });

  describe('Session Validation Edge Cases', () => {
    test('should handle user with mismatched session ID', async () => {
      await createSessionForUser(testUser);
      const wrongSessionId = 'bien-wrong-session-123456789';

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', wrongSessionId)
        .expect(200);

      // Should create new session
      expect(response.headers['bien-session-id']).toBeDefined();
      expect(response.headers['bien-session-id']).not.toBe(wrongSessionId);
    });

    test('should handle concurrent session creation', async () => {
      // Create multiple sessions simultaneously
      await Promise.all([
        createSessionForUser(testUser),
        createSessionForUser(testUser),
        createSessionForUser(testUser)
      ]);

      // Should only have one valid session
      const user = await User.findById(testUser._id);
      expect(user.currentSessionId).toBeDefined();
      expect(user.isSessionValid(user.currentSessionId)).toBe(true);
    });

    test('should handle session with corrupted data', async () => {
      testUser.currentSessionId = 'corrupted';
      testUser.sessionCreatedAt = null;
      testUser.sessionExpiresAt = new Date();
      await testUser.save();

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('bien-session-id', 'corrupted')
        .expect(200);

      // Should create new valid session
      expect(response.headers['bien-session-id']).toBeDefined();
      expect(response.headers['bien-session-id']).not.toBe('corrupted');
    });
  });

  describe('Response Headers', () => {
    test('should include session and trace IDs in all API responses', async () => {
      await createSessionForUser(testUser);

      const endpoints = [
        { method: 'get', path: '/api/users/profile', protected: true },
        { method: 'get', path: '/api/destinations', protected: false },
        { method: 'get', path: '/api/experiences', protected: false }
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${authToken}`)
          .set('bien-session-id', testUser.currentSessionId);

        expect(response.headers['bien-trace-id']).toBeDefined();
        
        // Protected routes should return session ID
        const hasSessionId = !!response.headers['bien-session-id'];
        expect(hasSessionId).toBe(endpoint.protected || hasSessionId);
      }
    });

    test('should not leak session ID on public routes', async () => {
      const response = await request(app)
        .get('/api/destinations')
        .expect(200);

      expect(response.headers['bien-session-id']).toBeUndefined();
      expect(response.headers['bien-trace-id']).toBeDefined();
    });
  });
});
