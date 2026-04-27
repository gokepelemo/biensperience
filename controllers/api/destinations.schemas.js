/**
 * Zod schemas for `/api/destinations` state-changing routes (bd #8f36.25).
 *
 * Wired in `routes/api/destinations.js`. Per-handler schemas validate the
 * shape of the request body. Existing controller-side checks (ownership,
 * duplicate detection, geocoding, etc.) remain in place and run after these
 * format gates pass.
 */

const { z } = require('zod');
const {
  objectIdSchema,
  permissionEntitySchema,
  permissionTypeSchema,
} = require('./_common-schemas');

// Location may be either a free-form address string or a structured object.
// We use .passthrough() to leave geocoder-specific fields alone.
const locationInputSchema = z.union([
  z.string().max(500),
  z.object({}).passthrough(),
]);

const createDestinationSchema = z.object({
  body: z
    .object({
      name: z
        .string({ message: 'Destination name is required' })
        .trim()
        .min(1, { message: 'Destination name is required' })
        .max(200),
      country: z
        .string({ message: 'Country is required' })
        .trim()
        .min(1, { message: 'Country is required' })
        .max(200),
      state: z.string().trim().max(200).optional(),
      overview: z.string().max(5000).optional(),
      photos: z.array(z.any()).optional(),
      travel_tips: z.array(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      map_location: z.string().max(500).optional(),
      location: locationInputSchema.optional(),
    })
    .passthrough(),
});

const updateDestinationSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      name: z.string().trim().min(1).max(200).optional(),
      country: z.string().trim().min(1).max(200).optional(),
      state: z.string().trim().max(200).optional(),
      overview: z.string().max(5000).optional(),
      photos: z.array(z.any()).optional(),
      travel_tips: z.array(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      map_location: z.string().max(500).optional(),
      location: locationInputSchema.optional(),
      activityParentId: z.string().optional(),
    })
    .passthrough(),
});

const addDestinationPhotoSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      url: z.string().min(1).max(2048),
      photo_credit: z.string().max(500).optional(),
      photo_credit_url: z.string().max(2048).optional(),
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

const addDestinationPermissionSchema = z.object({
  params: z.object({ id: objectIdSchema }).passthrough(),
  body: z
    .object({
      _id: objectIdSchema,
      entity: permissionEntitySchema,
      type: permissionTypeSchema.optional(),
    })
    .passthrough(),
});

const updateDestinationPermissionSchema = z.object({
  params: z
    .object({ id: objectIdSchema, userId: objectIdSchema })
    .passthrough(),
  body: z
    .object({
      type: permissionTypeSchema,
    })
    .passthrough(),
});

module.exports = {
  createDestinationSchema,
  updateDestinationSchema,
  addDestinationPhotoSchema,
  setDefaultPhotoSchema,
  addDestinationPermissionSchema,
  updateDestinationPermissionSchema,
};
