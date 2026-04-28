/**
 * Zod schemas for `/api/documents` state-changing routes (bd #8f36.25).
 *
 * Wired in `routes/api/documents.js`. Multer handles the file upload binary;
 * these schemas validate the multipart form fields (`entityType`, `entityId`,
 * etc.) for upload, plus the JSON body for reprocess and visibility-update.
 */

const { z } = require('zod');
const { objectIdSchema } = require('./_common-schemas');

// Multipart form fields are strings, so accept booleans as either real bools
// or 'true' / 'false' strings the controller already handles.
const stringyBoolSchema = z.union([
  z.boolean(),
  z.string(),
]);

const uploadDocumentSchema = z.object({
  body: z
    .object({
      entityType: z.enum(['plan', 'plan_item', 'experience', 'destination']),
      entityId: objectIdSchema,
      planId: objectIdSchema.optional(),
      planItemId: objectIdSchema.optional(),
      aiParsingEnabled: stringyBoolSchema.optional(),
      documentTypeHint: z.string().max(64).optional(),
      visibility: z.string().max(32).optional(),
      language: z.string().max(20).optional(),
      forceLLM: stringyBoolSchema.optional(),
      skipLLMFallback: stringyBoolSchema.optional(),
      aiModel: z.string().max(100).optional(),
    })
    .passthrough(),
});

const reprocessDocumentSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      language: z.string().max(20).optional(),
      forceLLM: stringyBoolSchema.optional(),
      skipLLMFallback: stringyBoolSchema.optional(),
      documentTypeHint: z.string().max(64).optional(),
    })
    .passthrough(),
});

// DELETE often has no body; tolerate empty/missing body and an optional `reason`.
const deleteDocumentSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      reason: z.string().max(500).optional(),
    })
    .passthrough()
    .optional(),
});

const updateVisibilitySchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      // NOTE: kept loose at the schema layer so the controller can return its
      // legacy `{ error: 'Invalid visibility...' }` shape that existing callers
      // (and tests) match on (see documents.test.js "invalid visibility").
      visibility: z.string().max(32),
    })
    .passthrough(),
});

module.exports = {
  uploadDocumentSchema,
  reprocessDocumentSchema,
  deleteDocumentSchema,
  updateVisibilitySchema,
};
