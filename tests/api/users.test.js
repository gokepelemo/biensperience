jest.mock('../../utilities/sinch', () => ({
  startSmsVerification: jest.fn(),
  reportSmsVerificationById: jest.fn()
}));

const request = require('supertest');
const app = require('../../app');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const User = require('../../models/user');

const { startSmsVerification, reportSmsVerificationById } = require('../../utilities/sinch');

describe('Users API', () => {
  let mongoServer;
  let regularUserToken;
  let superAdminToken;
  let regularUser;
  let superAdminUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test users
    regularUser = await User.create({
      name: 'Regular User',
      email: 'regular@example.com',
      password: 'password123',
      emailConfirmed: true
    });

    superAdminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'password123',
      role: 'super_admin',
      emailConfirmed: true
    });

    // Generate tokens
    const jwt = require('jsonwebtoken');
    regularUserToken = jwt.sign({ user: regularUser }, process.env.SECRET || 'test-secret', { expiresIn: '24h' });
    superAdminToken = jwt.sign({ user: superAdminUser }, process.env.SECRET || 'test-secret', { expiresIn: '24h' });
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('PUT /api/users/:id (updateUser)', () => {
    it('should allow user to update their own profile', async () => {
      const updateData = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.email).toBe(updateData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should allow super admin to update any user profile', async () => {
      const updateData = {
        name: 'Updated by Admin',
        email: 'updated-by-admin@example.com'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user.name).toBe(updateData.name);
      expect(response.body.data.user.email).toBe(updateData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should not allow user to update another user profile', async () => {
      // Create another user
      const anotherUser = await User.create({
        name: 'Another User',
        email: 'another@example.com',
        password: 'password123',
        emailConfirmed: true
      });

      const updateData = {
        name: 'Hacked Name'
      };

      const response = await request(app)
        .put(`/api/users/${anotherUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toContain('You can only update your own profile');
    });

    it('should require authentication', async () => {
      const updateData = {
        name: 'Updated Name'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .send(updateData)
        .expect(401);

      // Response may be a string or object depending on auth middleware
      if (typeof response.body === 'string') {
        expect(response.body).toBe('Unauthorized');
      } else {
        expect(response.body.error || response.body.message || response.text).toMatch(/unauthorized/i);
      }
    });

    it('should validate email format', async () => {
      const updateData = {
        email: 'invalid-email'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toContain('Invalid email format');
    });

    it('should require old password when changing password', async () => {
      const updateData = {
        password: 'newpassword123'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toContain('Old password is required');
    });

    it('should validate password change with old password', async () => {
      const updateData = {
        password: 'newpassword123',
        oldPassword: 'password123'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.token).toBeDefined();
    });
  });

  describe('PUT /api/users/:id/admin (updateUserAsAdmin)', () => {
    it('should allow super admin to update user email confirmation status', async () => {
      const updateData = {
        emailConfirmed: true
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}/admin`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user.emailConfirmed).toBe(true);
    });

    it('should allow super admin to update user password without old password', async () => {
      const updateData = {
        password: 'newadminpassword123'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}/admin`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.user).toBeDefined();
    });

    it('should not allow regular user to use admin update endpoint', async () => {
      const updateData = {
        name: 'Hacked Name'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}/admin`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.error).toContain('Super admin access required');
    });

    it('should require authentication for admin update', async () => {
      const updateData = {
        name: 'Updated Name'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}/admin`)
        .send(updateData)
        .expect(401);

      // Response may be a string or object depending on auth middleware
      if (typeof response.body === 'string') {
        expect(response.body).toBe('Unauthorized');
      } else {
        expect(response.body.error || response.body.message || response.text).toMatch(/unauthorized/i);
      }
    });

    it('should validate email format in admin update', async () => {
      const updateData = {
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}/admin`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toContain('Invalid email format');
    });

    it('should validate emailConfirmed field type', async () => {
      const updateData = {
        emailConfirmed: 'not-a-boolean'
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}/admin`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toContain('emailConfirmed must be a boolean');
    });

    it('should allow super admin to update user notification webhooks', async () => {
      const updateData = {
        preferences: {
          notifications: {
            enabled: true,
            channels: ['email', 'webhook'],
            types: ['activity'],
            webhooks: [
              'https://example.com/hook',
              'http://not-https.example.com/hook',
              'https://localhost/hook'
            ]
          }
        }
      };

      const response = await request(app)
        .put(`/api/users/${regularUser._id}/admin`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updateData)
        .expect(200);

      const notifications = response.body.data.user.preferences.notifications;
      expect(notifications.enabled).toBe(true);
      expect(Array.isArray(notifications.channels)).toBe(true);
      expect(notifications.channels).toContain('webhook');

      // Only valid HTTPS, non-localhost endpoints should be persisted
      expect(notifications.webhooks).toEqual(['https://example.com/hook']);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/users/${fakeId}/admin`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.error).toContain('User not found');
    });
  });

  describe('GET /api/users/:id (getUser)', () => {
    it('should return user data for authenticated user', async () => {
      const response = await request(app)
        .get(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      const body = response.body?.data || response.body;

      expect(body._id).toBe(regularUser._id.toString());
      expect(body.name).toBe(regularUser.name);
    });

    it('should allow super admin to view any user', async () => {
      const response = await request(app)
        .get(`/api/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const body = response.body?.data || response.body;

      expect(body._id).toBe(regularUser._id.toString());
    });
  });

  describe('Phone verification', () => {
    it('should start phone verification and store pending verificationId', async () => {
      startSmsVerification.mockResolvedValueOnce({ id: 'verif_123' });

      const response = await request(app)
        .post(`/api/users/${regularUser._id}/phone-verification/start`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ phoneNumber: '+15551234567' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.verificationId).toBe('verif_123');

      const updated = await User.findById(regularUser._id).lean();
      expect(updated.phone.number).toBe('+15551234567');
      expect(updated.phone.verified).toBe(false);
      expect(updated.phone.verificationId).toBe('verif_123');
    });

    it('should confirm phone verification and mark number as verified on SUCCESSFUL', async () => {
      startSmsVerification.mockResolvedValueOnce({ id: 'verif_456' });
      reportSmsVerificationById.mockResolvedValueOnce({ id: 'verif_456', status: 'SUCCESSFUL' });

      await request(app)
        .post(`/api/users/${regularUser._id}/phone-verification/start`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ phoneNumber: '+15551234567' })
        .expect(200);

      const response = await request(app)
        .post(`/api/users/${regularUser._id}/phone-verification/confirm`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ code: '123456' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('SUCCESSFUL');

      const updated = await User.findById(regularUser._id).lean();
      expect(updated.phone.verified).toBe(true);
      expect(updated.phone.verifiedAt).toBeTruthy();
      expect(updated.phone.verificationId).toBe(null);
    });
  });
});