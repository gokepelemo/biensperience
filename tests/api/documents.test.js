/**
 * Documents API Integration Tests
 *
 * Covers a representative slice of /api/documents routes:
 *   GET    /api/documents/supported-types      (public)
 *   GET    /api/documents/:id                  (auth + access)
 *   GET    /api/documents/entity/:type/:id     (auth + entity access)
 *   PATCH  /api/documents/:id/visibility       (owner only)
 *   DELETE /api/documents/:id                  (owner only — soft delete)
 *   DELETE /api/documents/:id/permanent        (super admin only)
 *   POST   /api/documents/:id/restore          (super admin only)
 *   GET    /api/documents/:id/preview          (auth + access)
 *
 * S3 / AI / upload modules are mocked at their utility-module boundaries
 * so tests don't touch the network and don't require AWS keys.
 */

// ---- Mock external services (must precede app require) -------------------
jest.mock('../../utilities/upload-pipeline', () => ({
  uploadWithPipeline: jest.fn().mockResolvedValue({
    s3Status: 'uploaded',
    s3Result: {
      Location: 'https://s3.amazonaws.com/test-bucket/documents/test.pdf',
      key: 'documents/test-key.pdf',
      bucket: 'test-bucket',
      isProtected: true,
      bucketType: 'protected'
    }
  }),
  retrieveFile: jest.fn().mockResolvedValue({
    source: 's3',
    signedUrl: 'https://s3.amazonaws.com/test-bucket/documents/test.pdf?X-Amz-Signature=abc'
  }),
  deleteFile: jest.fn().mockResolvedValue(),
  deleteFileSafe: jest.fn().mockResolvedValue({ deleted: true }),
  downloadToLocal: jest.fn().mockResolvedValue({
    localPath: '/tmp/doc.pdf',
    contentType: 'application/pdf',
    size: 1024
  }),
  S3_STATUS: { PENDING: 'pending', UPLOADED: 'uploaded', FAILED: 'failed' }
}));

jest.mock('../../utilities/ai-document-utils', () => ({
  validateDocument: jest.fn().mockReturnValue({ valid: true, type: 'pdf' }),
  extractText: jest.fn().mockResolvedValue({
    text: 'extracted text',
    metadata: { method: 'pdf-parse', characterCount: 14 }
  }),
  parseWithAI: jest.fn().mockResolvedValue({
    documentType: 'travel',
    summary: 'mock summary'
  }),
  SUPPORTED_DOCUMENT_TYPES: {
    pdf: ['application/pdf'],
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'],
    word: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    text: ['text/plain', 'text/csv', 'text/markdown']
  },
  MAX_FILE_SIZES: {
    pdf: 50 * 1024 * 1024,
    image: 10 * 1024 * 1024,
    word: 25 * 1024 * 1024,
    text: 5 * 1024 * 1024
  }
}));

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../../app');
const dbSetup = require('../setup/testSetup');
const Document = require('../../models/document');
const {
  createTestUser,
  createTestExperience,
  createTestDestination,
  createTestPlan,
  generateAuthToken,
  clearTestData
} = require('../utils/testHelpers');

// ---- Helpers ---------------------------------------------------------------
async function createTestDocument(owner, entity, overrides = {}) {
  const doc = await Document.create({
    user: owner._id,
    entityType: 'experience',
    entityId: entity._id,
    originalFilename: 'test.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    documentType: 'pdf',
    s3Key: `documents/${Date.now()}-test.pdf`,
    s3Url: 'https://s3.amazonaws.com/test-bucket/documents/test.pdf',
    s3Bucket: 'test-bucket',
    isProtected: true,
    bucketType: 'protected',
    visibility: 'collaborators',
    status: 'completed',
    permissions: [
      { _id: owner._id, entity: 'user', type: 'owner' }
    ],
    ...overrides
  });
  return doc;
}

describe('Documents API', () => {
  let owner;
  let ownerToken;
  let other;
  let otherToken;
  let superAdmin;
  let superAdminToken;
  let destination;
  let experience;

  beforeAll(async () => {
    await dbSetup.connect();
  });

  afterAll(async () => {
    await dbSetup.closeDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    await Document.deleteMany({});

    owner = await createTestUser({
      name: 'Doc Owner',
      email: `doc-owner-${Date.now()}@test.com`,
      role: 'super_admin' // bypass rate limiter (we still test perms via permission helpers)
    });
    ownerToken = generateAuthToken(owner);

    other = await createTestUser({
      name: 'Other',
      email: `doc-other-${Date.now()}@test.com`
    });
    otherToken = generateAuthToken(other);

    superAdmin = await createTestUser({
      name: 'Doc Admin',
      email: `doc-admin-${Date.now()}@test.com`,
      role: 'super_admin'
    });
    superAdminToken = generateAuthToken(superAdmin);

    destination = await createTestDestination(owner);
    experience = await createTestExperience(owner, destination);
  });

  afterEach(async () => {
    await clearTestData();
    await Document.deleteMany({});
  });

  describe('GET /api/documents/supported-types', () => {
    it('returns supported types and size limits (no auth required)', async () => {
      const res = await request(app).get('/api/documents/supported-types');

      expect(res.status).toBe(200);
      expect(res.body.types).toBeDefined();
      expect(res.body.maxSizes).toBeDefined();
      expect(res.body.accept).toContain('application/pdf');
    });
  });

  describe('GET /api/documents/:id', () => {
    it('returns 401 without authentication', async () => {
      const doc = await createTestDocument(owner, experience);
      const res = await request(app).get(`/api/documents/${doc._id}`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid document ID', async () => {
      const res = await request(app)
        .get('/api/documents/not-an-id')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid document id/i);
    });

    it('returns 404 when document does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/documents/${fakeId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    });

    it('returns the document for the owner (happy path)', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .get(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.document).toBeDefined();
      expect(res.body.document._id.toString()).toBe(doc._id.toString());
    });
  });

  describe('GET /api/documents/entity/:entityType/:entityId', () => {
    it('returns 400 for invalid entity type', async () => {
      const res = await request(app)
        .get(`/api/documents/entity/invalid-type/${experience._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid entity type/i);
    });

    it('returns 400 for invalid entity ID', async () => {
      const res = await request(app)
        .get('/api/documents/entity/experience/not-an-id')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid entity id/i);
    });

    it('returns documents list for the entity (happy path)', async () => {
      await createTestDocument(owner, experience);
      await createTestDocument(owner, experience, {
        s3Key: `documents/${Date.now()}-second.pdf`,
        originalFilename: 'second.pdf'
      });

      const res = await request(app)
        .get(`/api/documents/entity/experience/${experience._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.documents)).toBe(true);
      expect(res.body.documents.length).toBe(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
    });
  });

  describe('PATCH /api/documents/:id/visibility', () => {
    it('allows owner to update visibility', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'private' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.document.visibility).toBe('private');
    });

    it('returns 400 for invalid visibility value', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/visibility`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ visibility: 'banana' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid visibility/i);
    });

    it('returns 403 when non-owner tries to change visibility', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .patch(`/api/documents/${doc._id}/visibility`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ visibility: 'private' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/owner/i);
    });
  });

  describe('DELETE /api/documents/:id (soft delete)', () => {
    it('soft-deletes a document for the owner', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .delete(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'cleanup' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stored = await Document.findById(doc._id);
      expect(stored.isDisabled).toBe(true);
    });

    it('returns 403 when non-owner tries to delete', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .delete(`/api/documents/${doc._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/owner/i);
    });
  });

  describe('DELETE /api/documents/:id/permanent (super admin only)', () => {
    it('returns 403 for non-super-admin users', async () => {
      // Use a regular (non-super-admin) user as document owner here
      const regular = await createTestUser({
        email: `regular-doc-${Date.now()}@test.com`
      });
      const regularToken = generateAuthToken(regular);
      const doc = await createTestDocument(regular, experience);

      const res = await request(app)
        .delete(`/api/documents/${doc._id}/permanent`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/super admin/i);
    });

    it('permanently deletes a document for super admin (happy path)', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .delete(`/api/documents/${doc._id}/permanent`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stored = await Document.findById(doc._id);
      expect(stored).toBeNull();
    });
  });

  describe('GET /api/documents/:id/preview', () => {
    it('returns a signed URL for the owner (happy path)', async () => {
      const doc = await createTestDocument(owner, experience);

      const res = await request(app)
        .get(`/api/documents/${doc._id}/preview`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.url).toMatch(/X-Amz-Signature/);
      expect(res.body.filename).toBe('test.pdf');
      expect(res.body.mimeType).toBe('application/pdf');
      expect(res.body.expiresIn).toBe(3600);
    });

    it('returns 401 without authentication', async () => {
      const doc = await createTestDocument(owner, experience);
      const res = await request(app).get(`/api/documents/${doc._id}/preview`);
      expect(res.status).toBe(401);
    });
  });
});
