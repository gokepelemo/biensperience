/**
 * Zod schemas for `/api/experiences` state-changing routes (bd #8f36.25).
 *
 * Wired in `routes/api/experiences.js`. Domain rules (uniqueness, fuzzy
 * dedupe, geocoding, max-nesting depth) stay in the controller — these
 * schemas only enforce request shape so malformed payloads short-circuit
 * before hitting business logic.
 */

const { z } = require('zod');
const {
  objectIdSchema,
  permissionEntitySchema,
  permissionTypeSchema,
} = require('./_common-schemas');

const locationInputSchema = z.union([
  z.string().max(500),
  z.object({}).passthrough(),
]);

// Activity types are model-enforced via Mongoose enum; we pass through here
// so adding new types doesn't require updating two places.
const planItemBodyShape = {
  text: z.string().min(1).max(2000).optional(),
  url: z
    .union([z.string().max(2048), z.null()])
    .optional(),
  cost_estimate: z.number().nonnegative().optional(),
  planning_days: z.number().nonnegative().optional(),
  parent: z
    .union([objectIdSchema, z.null(), z.literal('')])
    .optional(),
  activity_type: z.union([z.string().max(64), z.null()]).optional(),
  location: z.union([locationInputSchema, z.null()]).optional(),
};

const createExperienceSchema = z.object({
  body: z
    .object({
      name: z
        .string({ message: 'Experience name is required' })
        .trim()
        .min(1, { message: 'Experience name is required' })
        .max(200),
      destination: objectIdSchema,
      overview: z.string().max(5000).optional(),
      experience_type: z.array(z.string()).optional(),
      plan_items: z.array(z.any()).optional(),
      photos: z.array(z.any()).optional(),
      visibility: z.string().max(64).optional(),
      map_location: z.string().max(500).optional(),
      location: locationInputSchema.optional(),
      tags: z.array(z.string()).optional(),
    })
    .passthrough(),
});

const updateExperienceSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      destination: objectIdSchema.optional(),
      overview: z.string().max(5000).optional(),
      experience_type: z.array(z.string()).optional(),
      plan_items: z.array(z.any()).optional(),
      photos: z.array(z.any()).optional(),
      visibility: z.string().max(64).optional(),
      map_location: z.string().max(500).optional(),
      location: locationInputSchema.optional(),
      permissions: z.array(z.any()).optional(),
      activityParentId: z.string().optional(),
    })
    .passthrough(),
});

const createPlanItemSchema = z.object({
  params: z.object({ experienceId: objectIdSchema }).passthrough(),
  body: z
    .object({
      ...planItemBodyShape,
      text: z
        .string({ message: 'Plan item text is required' })
        .min(1, { message: 'Plan item text is required' })
        .max(2000),
    })
    .passthrough(),
});

const updatePlanItemSchema = z.object({
  params: z
    .object({ experienceId: objectIdSchema, planItemId: objectIdSchema })
    .passthrough(),
  body: z.object(planItemBodyShape).passthrough(),
});

const reorderPlanItemsSchema = z.object({
  params: z.object({ experienceId: objectIdSchema }).passthrough(),
  body: z
    .object({
      plan_items: z.array(z.any()),
    })
    .passthrough(),
});

const transferOwnershipSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      newOwnerId: objectIdSchema,
    })
    .passthrough(),
});

const addExperiencePhotoSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      photoId: objectIdSchema,
    })
    .passthrough(),
});

const setDefaultPhotoSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      photoIndex: z.union([z.number().int(), z.string()]),
    })
    .passthrough(),
});

const addExperiencePermissionSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      _id: objectIdSchema,
      entity: permissionEntitySchema,
      type: permissionTypeSchema.optional(),
    })
    .passthrough(),
});

const updateExperiencePermissionSchema = z.object({
  params: z
    .object({ id: objectIdSchema, userId: objectIdSchema })
    .passthrough(),
  body: z
    .object({
      type: permissionTypeSchema,
    })
    .passthrough(),
});

const updateAIConfigSchema = z.object({
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
  createExperienceSchema,
  updateExperienceSchema,
  createPlanItemSchema,
  updatePlanItemSchema,
  reorderPlanItemsSchema,
  transferOwnershipSchema,
  addExperiencePhotoSchema,
  setDefaultPhotoSchema,
  addExperiencePermissionSchema,
  updateExperiencePermissionSchema,
  updateAIConfigSchema,
};
