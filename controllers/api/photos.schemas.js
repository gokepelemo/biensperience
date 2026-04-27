/**
 * Zod schemas for `/api/photos` state-changing routes (bd #8f36.25).
 *
 * Wired in `routes/api/photos.js`. Multer handles the file binary; these
 * schemas validate body fields only (caption, photo_credit, dimensions, etc.).
 */

const { z } = require('zod');
const { objectIdSchema } = require('./_common-schemas');

// `createPhoto` is a multipart upload — multer parses the form fields into
// req.body as strings. We use .passthrough() and don't require any specific
// field at create-time (file presence is checked in the controller).
const createPhotoSchema = z.object({
  body: z
    .object({
      name: z.string().max(200).optional(),
      photo_credit: z.string().max(500).optional(),
      photo_credit_url: z.string().max(2048).optional(),
      caption: z.string().max(2000).optional(),
      width: z.union([z.string(), z.number()]).optional(),
      height: z.union([z.string(), z.number()]).optional(),
    })
    .passthrough(),
});

const createPhotoBatchSchema = z.object({
  body: z
    .object({
      name: z.string().max(200).optional(),
      photo_credit: z.string().max(500).optional(),
      photo_credit_url: z.string().max(2048).optional(),
      dimensions: z.string().optional(), // JSON-serialised array
    })
    .passthrough(),
});

const getByIdsSchema = z.object({
  body: z
    .object({
      ids: z.array(z.string()),
    })
    .passthrough(),
});

const createPhotoFromUrlSchema = z.object({
  body: z
    .object({
      url: z.string().min(1).max(2048),
      photo_credit: z.string().max(500).optional(),
      photo_credit_url: z.string().max(2048).optional(),
      width: z.union([z.string(), z.number()]).optional(),
      height: z.union([z.string(), z.number()]).optional(),
    })
    .passthrough(),
});

const updatePhotoSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      caption: z.string().max(2000).optional(),
      photo_credit: z.string().max(500).optional(),
      photo_credit_url: z.string().max(2048).optional(),
    })
    .passthrough(),
});

const photoCollaboratorSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      userId: objectIdSchema,
    })
    .passthrough(),
});

module.exports = {
  createPhotoSchema,
  createPhotoBatchSchema,
  getByIdsSchema,
  createPhotoFromUrlSchema,
  updatePhotoSchema,
  photoCollaboratorSchema,
};
