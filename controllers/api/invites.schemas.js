/**
 * Zod schemas for `/api/invites` state-changing routes (bd #8f36.25).
 *
 * Wired in `routes/api/invites.js`. Note that this controller is unusual —
 * the handlers live inline in the routes file rather than a dedicated
 * controllers/api/invites.js, so the schemas are imported directly there.
 */

const { z } = require('zod');
const { objectIdSchema } = require('./_common-schemas');

const dateLikeSchema = z.union([z.string(), z.number(), z.null()]);

const createInviteSchema = z.object({
  body: z
    .object({
      email: z.string().max(254).optional(),
      inviteeName: z.string().max(200).optional(),
      experiences: z.array(objectIdSchema).optional(),
      destinations: z.array(objectIdSchema).optional(),
      maxUses: z.number().int().min(1).max(1000).optional(),
      expiresAt: dateLikeSchema.optional(),
      customMessage: z.string().max(2000).optional(),
      sendEmail: z.boolean().optional(),
      mutualFollow: z.boolean().optional(),
      permissionType: z.string().max(32).optional(),
    })
    .passthrough(),
});

const bulkCreateInviteSchema = z.object({
  body: z
    .object({
      invites: z.array(z.any()).min(1, { message: 'invites must be a non-empty array' }),
      sendEmail: z.boolean().optional(),
    })
    .passthrough(),
});

const validateInviteSchema = z.object({
  body: z
    .object({
      code: z.string().min(1).max(64),
      email: z.string().max(254).optional(),
    })
    .passthrough(),
});

const redeemInviteSchema = z.object({
  body: z
    .object({
      code: z.string().min(1).max(64),
    })
    .passthrough(),
});

const emailInviteSchema = z.object({
  body: z
    .object({
      email: z.string().min(1).max(254),
      name: z.string().min(1).max(200),
      resourceType: z.enum(['experience', 'destination', 'plan']),
      resourceId: objectIdSchema,
      resourceName: z.string().max(500).optional(),
      customMessage: z.string().max(2000).optional(),
      permissionType: z.string().max(32).optional(),
    })
    .passthrough(),
});

const deleteInviteSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
});

module.exports = {
  createInviteSchema,
  bulkCreateInviteSchema,
  validateInviteSchema,
  redeemInviteSchema,
  emailInviteSchema,
  deleteInviteSchema,
};
