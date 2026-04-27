/**
 * Zod schemas for `/api/plans` state-changing routes (bd #8f36.25).
 *
 * Wired in `routes/api/plans.js`. The plans controller has the most diverse
 * payload surface (plan items, notes, details, costs, collaborators, member
 * locations). Schemas focus on shape — date normalisation, currency casing,
 * sub-document existence, and permission enforcement remain in the
 * controller.
 *
 * Style: `.passthrough()` everywhere so existing test payloads with extra
 * fields keep working.
 */

const { z } = require('zod');
const { objectIdSchema } = require('./_common-schemas');

// `planned_date` accepts: ISO string, epoch number, empty string, or null
// (clearing). The controller normalises afterwards.
const dateLikeSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
]);

const locationInputSchema = z.union([
  z.string().max(500),
  z.object({}).passthrough(),
  z.null(),
]);

// ---------------------------------------------------------------------------
// Plan CRUD
// ---------------------------------------------------------------------------

const createPlanSchema = z.object({
  params: z.object({ experienceId: objectIdSchema }).passthrough(),
  body: z
    .object({
      planned_date: dateLikeSchema.optional(),
      currency: z.string().max(10).optional(),
    })
    .passthrough(),
});

const updatePlanSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      planned_date: dateLikeSchema.optional(),
      plan: z.array(z.any()).optional(),
      notes: z.union([z.string(), z.null()]).optional(),
      currency: z.string().max(10).optional(),
    })
    .passthrough(),
});

const requestPlanAccessSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      message: z.string().max(2000).optional(),
    })
    .passthrough(),
});

const respondToAccessRequestSchema = z.object({
  params: z
    .object({ id: objectIdSchema, requestId: objectIdSchema })
    .passthrough(),
  body: z
    .object({
      action: z.enum(['approve', 'decline']),
    })
    .passthrough(),
});

const reorderPlanItemsSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      plan: z.array(z.any()),
    })
    .passthrough(),
});

const scheduleDeletePlanSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
});

const cancelScheduledDeletePlanSchema = z.object({
  params: z
    .object({ token: z.string().min(1).max(128) })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Plan items
// ---------------------------------------------------------------------------

const planItemBodyShape = {
  text: z.string().max(2000).optional(),
  url: z.union([z.string().max(2048), z.null()]).optional(),
  cost: z.union([z.number(), z.string()]).optional(),
  planning_days: z.union([z.number(), z.string()]).optional(),
  parent: z.union([objectIdSchema, z.null(), z.literal('')]).optional(),
  photo: z.union([objectIdSchema, z.null()]).optional(),
  activity_type: z.union([z.string().max(64), z.null()]).optional(),
  location: locationInputSchema.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.union([z.string().max(500), z.null()]).optional(),
  plan_item_id: z.string().optional(),
};

const addPlanItemSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z.object(planItemBodyShape).passthrough(),
});

const updatePlanItemSchema = z.object({
  params: z.object({ id: objectIdSchema, itemId: objectIdSchema }).passthrough(),
  body: z
    .object({
      complete: z.boolean().optional(),
      cost: z.union([z.number(), z.string()]).optional(),
      planning_days: z.union([z.number(), z.string()]).optional(),
      text: z.string().max(2000).optional(),
      url: z.union([z.string().max(2048), z.null()]).optional(),
      activity_type: z.union([z.string().max(64), z.null()]).optional(),
      location: locationInputSchema.optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      address: z.union([z.string().max(500), z.null()]).optional(),
      scheduled_date: dateLikeSchema.optional(),
      scheduled_time: z.union([z.string().max(20), z.null()]).optional(),
      photos: z.union([z.array(z.any()), z.null()]).optional(),
      visibility: z.string().max(32).optional(),
    })
    .passthrough(),
});

const pinPlanItemSchema = z.object({
  params: z.object({ id: objectIdSchema, itemId: objectIdSchema }).passthrough(),
});

// ---------------------------------------------------------------------------
// Collaborators
// ---------------------------------------------------------------------------

const addCollaboratorSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      userId: objectIdSchema,
    })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Plan item notes
// ---------------------------------------------------------------------------

const addPlanItemNoteSchema = z.object({
  params: z.object({ id: objectIdSchema, itemId: objectIdSchema }).passthrough(),
  body: z
    .object({
      content: z
        .string({ message: 'Note content is required' })
        .min(1, { message: 'Note content is required' })
        .max(10000),
      visibility: z.enum(['private', 'contributors']).optional(),
    })
    .passthrough(),
});

const updatePlanItemNoteSchema = z.object({
  params: z
    .object({
      id: objectIdSchema,
      itemId: objectIdSchema,
      noteId: objectIdSchema,
    })
    .passthrough(),
  body: z
    .object({
      content: z
        .string({ message: 'Note content is required' })
        .min(1, { message: 'Note content is required' })
        .max(10000),
      visibility: z.enum(['private', 'contributors']).optional(),
    })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Plan item details (transport / parking / discount / documents / photos / accommodation)
// ---------------------------------------------------------------------------

const addPlanItemDetailSchema = z.object({
  params: z.object({ id: objectIdSchema, itemId: objectIdSchema }).passthrough(),
  body: z
    .object({
      type: z.string().max(32),
      data: z.any(),
    })
    .passthrough(),
});

const updatePlanItemDetailSchema = z.object({
  params: z
    .object({
      id: objectIdSchema,
      itemId: objectIdSchema,
      detailId: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    })
    .passthrough(),
  body: z
    .object({
      type: z.string().max(32),
      data: z.any(),
    })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

const assignPlanItemSchema = z.object({
  params: z.object({ id: objectIdSchema, itemId: objectIdSchema }).passthrough(),
  body: z
    .object({
      assignedTo: objectIdSchema,
    })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

const addCostSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      title: z
        .string({ message: 'Cost title is required' })
        .trim()
        .min(1, { message: 'Cost title is required' })
        .max(200),
      description: z.string().max(2000).optional(),
      cost: z.union([z.number(), z.string()]),
      currency: z.string().max(10).optional(),
      category: z.union([z.string().max(64), z.null()]).optional(),
      date: dateLikeSchema.optional(),
      plan_item: z.union([objectIdSchema, z.null()]).optional(),
      collaborator: z.union([objectIdSchema, z.null()]).optional(),
    })
    .passthrough(),
});

const updateCostSchema = z.object({
  params: z.object({ id: objectIdSchema, costId: objectIdSchema }).passthrough(),
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      cost: z.union([z.number(), z.string()]).optional(),
      currency: z.string().max(10).optional(),
      category: z.union([z.string().max(64), z.null()]).optional(),
      date: dateLikeSchema.optional(),
      plan_item: z.union([objectIdSchema, z.null()]).optional(),
      collaborator: z.union([objectIdSchema, z.null()]).optional(),
    })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Member locations
// ---------------------------------------------------------------------------

const setMemberLocationSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      location: z.object({}).passthrough(),
      travel_cost_estimate: z.union([z.number(), z.null()]).optional(),
      currency: z.string().max(10).optional(),
    })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Date shifting & AI config
// ---------------------------------------------------------------------------

const shiftPlanItemDatesSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      diff_ms: z.union([z.number(), z.string()]),
    })
    .passthrough(),
});

const updatePlanAIConfigSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      preferred_provider: z.string().max(100).optional(),
      preferred_model: z.string().max(100).optional(),
      system_prompt_override: z.string().max(20000).optional(),
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().int().positive().max(100000).optional(),
      language: z.string().max(20).optional(),
      disabled: z.boolean().optional(),
    })
    .passthrough(),
});

module.exports = {
  createPlanSchema,
  updatePlanSchema,
  requestPlanAccessSchema,
  respondToAccessRequestSchema,
  reorderPlanItemsSchema,
  scheduleDeletePlanSchema,
  cancelScheduledDeletePlanSchema,
  addPlanItemSchema,
  updatePlanItemSchema,
  pinPlanItemSchema,
  addCollaboratorSchema,
  addPlanItemNoteSchema,
  updatePlanItemNoteSchema,
  addPlanItemDetailSchema,
  updatePlanItemDetailSchema,
  assignPlanItemSchema,
  addCostSchema,
  updateCostSchema,
  setMemberLocationSchema,
  shiftPlanItemDatesSchema,
  updatePlanAIConfigSchema,
};
