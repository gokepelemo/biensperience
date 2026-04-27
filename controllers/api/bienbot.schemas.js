/**
 * Zod schemas for `/api/bienbot/...` state-changing routes (bd #8f36.25).
 *
 * Wired in `routes/api/bienbot.js`. The chat endpoint accepts multipart form
 * data (string fields + optional file attachment), so most fields are typed
 * as strings; the controller continues to JSON-parse `invokeContext`,
 * `navigationSchema`, etc. and to enforce content-length / null-byte rules.
 */

const { z } = require('zod');
const { objectIdSchema } = require('./_common-schemas');

const chatSchema = z.object({
  body: z
    .object({
      message: z
        .string({ message: 'Message is required' })
        .min(1, { message: 'Message is required' })
        .max(20000),
      sessionId: z.string().optional(),
      // invokeContext / navigationSchema arrive as JSON strings via multipart;
      // the controller parses them. Keep loose here.
      invokeContext: z.union([z.string(), z.object({}).passthrough()]).optional(),
      navigationSchema: z
        .union([z.string(), z.object({}).passthrough()])
        .optional(),
      hiddenUserMessage: z.string().max(20000).optional(),
    })
    .passthrough(),
});

const executeSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      actionIds: z.array(z.string().min(1)).min(1, {
        message: 'actionIds array is required',
      }),
    })
    .passthrough(),
});

const resumeSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      current_page_context: z
        .object({
          entity: z.string().optional(),
          id: z.string().optional(),
          label: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
});

const updateContextSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      entity: z.enum(['destination', 'experience', 'plan', 'plan_item', 'user']),
      entityId: objectIdSchema,
    })
    .passthrough(),
});

const updatePendingActionSchema = z.object({
  params: z
    .object({ id: objectIdSchema, actionId: z.string().min(1) })
    .passthrough(),
  body: z
    .object({
      status: z.enum(['approved', 'skipped']),
      payload: z.any().optional(),
    })
    .passthrough(),
});

const addSessionCollaboratorSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      userId: objectIdSchema,
      role: z.enum(['viewer', 'editor']).optional(),
    })
    .passthrough(),
});

const analyzeSchema = z.object({
  body: z
    .object({
      entity: z.enum(['destination', 'experience', 'plan', 'plan_item', 'user']),
      entityId: objectIdSchema,
    })
    .passthrough(),
});

const applyTipsSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      destination_id: objectIdSchema,
      tips: z.array(z.any()).min(1, { message: 'tips must be a non-empty array' }),
    })
    .passthrough(),
});

module.exports = {
  chatSchema,
  executeSchema,
  resumeSchema,
  updateContextSchema,
  updatePendingActionSchema,
  addSessionCollaboratorSchema,
  analyzeSchema,
  applyTipsSchema,
};
