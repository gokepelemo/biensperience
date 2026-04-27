/**
 * Shared zod building blocks used across the per-controller schema files.
 *
 * The wider rollout (bd #8f36.25) leans on these helpers to keep individual
 * schemas terse and consistent. See `utilities/validate.js` for how the
 * resulting `z.object({ body?, query?, params? })` schemas are wired into
 * Express routes.
 *
 * Conventions:
 * - Schemas err on the side of `.passthrough()` rather than `.strict()` so
 *   existing tests that send extra fields are not rejected.
 * - Numeric / length caps are sane upper bounds, not domain truths — Mongoose
 *   models still own canonical validation for things like enum members and
 *   business invariants.
 */

const { z } = require('zod');

// MongoDB ObjectId hex string (24 hex chars). Use this for both params and
// body fields that are expected to be a Mongo identifier.
const objectIdSchema = z
  .string({ message: 'ID is required' })
  .regex(/^[a-fA-F0-9]{24}$/, { message: 'Invalid ID format' });

// Optional ObjectId — accepts undefined, null, or a valid 24-hex string.
const optionalObjectIdSchema = z
  .union([objectIdSchema, z.null(), z.literal('')])
  .optional();

// Bounded plain string used for short titles / names. The 200-char cap is the
// generous default; specific schemas may tighten.
const shortStringSchema = z
  .string()
  .trim()
  .min(1, { message: 'Value is required' })
  .max(200, { message: 'Value must be 200 characters or fewer' });

// Bounded plain string used for descriptions / notes. 5,000 chars is the cap.
const longStringSchema = z
  .string()
  .max(5000, { message: 'Value must be 5,000 characters or fewer' });

// Permission entity values supported in the codebase (see utilities/permissions.js).
const permissionEntitySchema = z.enum(['user', 'destination', 'experience']);
const permissionTypeSchema = z.enum(['owner', 'collaborator', 'contributor']);

// Standard "entity ID in :id slot" params block.
const idParamsSchema = z.object({ id: objectIdSchema });

module.exports = {
  objectIdSchema,
  optionalObjectIdSchema,
  shortStringSchema,
  longStringSchema,
  permissionEntitySchema,
  permissionTypeSchema,
  idParamsSchema,
};
