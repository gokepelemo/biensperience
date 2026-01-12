const mongoose = require('mongoose');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const User = require('../../models/user');
const Plan = require('../../models/plan');
const Photo = require('../../models/photo');
const permissions = require('../../utilities/permissions');
const { getEnforcer } = require('../../utilities/permission-enforcer');
const backendLogger = require('../../utilities/backend-logger');
const { trackCreate, trackUpdate, trackDelete } = require('../../utilities/activity-tracker');
const { hasFeatureFlag } = require('../../utilities/feature-flags');
const { broadcastEvent } = require('../../utilities/websocket-server');
const { ARCHIVE_USER, isArchiveUser } = require('../../utilities/system-users');
const { successResponse, errorResponse, paginatedResponse } = require('../../utilities/controller-helpers');

// Helper function to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize location data to prevent GeoJSON validation errors
 * Ensures proper format or null if invalid
 * @param {Object} location - Location object from request
 * @returns {Object|null} Sanitized location or null
 */
function sanitizeLocation(location) {
  if (!location) return null;

  // If location is empty object or only has null/empty values, return null
  const hasAddress = location.address && typeof location.address === 'string' && location.address.trim();
  const hasGeo = location.geo && location.geo.coordinates && Array.isArray(location.geo.coordinates) && location.geo.coordinates.length === 2;

  if (!hasAddress && !hasGeo) return null;

  const sanitized = {
    address: hasAddress ? location.address.trim() : null,
    geo: null,
    city: (location.city && typeof location.city === 'string') ? location.city : null,
    state: (location.state && typeof location.state === 'string') ? location.state : null,
    country: (location.country && typeof location.country === 'string') ? location.country : null,
    postalCode: (location.postalCode && typeof location.postalCode === 'string') ? location.postalCode : null,
    placeId: (location.placeId && typeof location.placeId === 'string') ? location.placeId : null
  };

  // Validate and set GeoJSON coordinates
  if (hasGeo) {
    const [lng, lat] = location.geo.coordinates;
    if (typeof lng === 'number' && typeof lat === 'number' &&
        lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
      sanitized.geo = {
        type: 'Point',
        coordinates: [lng, lat]
      };
    }
  }

  return sanitized;
}
const { findDuplicateFuzzy } = require("../../utilities/fuzzy-match");

/**
 * GET /api/experiences/tags
 * Return a list of distinct experience_type tags across experiences
 */
async function getExperienceTags(req, res) {
  try {
    // Use Mongo distinct to get experience_type entries (may be array or comma-separated strings)
    // Support server-side `q` filter to search tag labels without returning all tags
    const q = req.query.q && String(req.query.q).trim();
    let raw;
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      // Query for documents where experience_type contains the regex either as a string or inside an array
      const query = {
        $or: [
          { experience_type: { $regex: regex } },
          { experience_type: { $elemMatch: { $regex: regex } } }
        ]
      };
      raw = await Experience.distinct('experience_type', query);
    } else {
      raw = await Experience.distinct('experience_type');
    }
    const tagSet = new Set();

    raw.forEach(item => {
      if (!item) return;
      if (Array.isArray(item)) {
        item.forEach(tag => {
          if (typeof tag === 'string') tagSet.add(tag.trim());
        });
      } else if (typeof item === 'string') {
        // split comma-separated strings
        item.split(',').map(t => t.trim()).forEach(t => { if (t) tagSet.add(t); });
      }
    });

    const tags = Array.from(tagSet).sort();
    return successResponse(res, tags);
  } catch (err) {
    backendLogger.error('Error fetching experience tags', { error: err.message });
    return errorResponse(res, err, 'Failed to fetch tags', 400);
  }
}

async function index(req, res) {
  const start = Date.now();
  try {
      // Pagination support: if page or limit provided, return paginated result with meta
      const page = parseInt(req.query.page, 10);
      const limit = parseInt(req.query.limit, 10);

      // Build filter from query params (supports server-side filtering with pagination)
      const filter = {};
      if (req.query.destination) {
        // Support single or comma-separated destination values. Each value may be an ObjectId,
        // a slug, or a destination name. Resolve non-ObjectId values to ObjectId via lookup.
        const raw = String(req.query.destination || '').trim();
        const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
        const resolvedIds = [];

        for (const part of parts) {
          if (mongoose.Types.ObjectId.isValid(part)) {
            // Use `new` with ObjectId to avoid runtime error in certain mongoose/bson versions
            resolvedIds.push(new mongoose.Types.ObjectId(part));
            continue;
          }

          // Try to resolve slug or exact name (case-insensitive)
          try {
            backendLogger.debug('Attempting to resolve destination part', { part });

            // If the part contains a comma, try to split into name and country
            const commaIndex = part.indexOf(',');
            let destDoc = null;

            if (commaIndex > -1) {
              const left = part.substring(0, commaIndex).trim();
              const right = part.substring(commaIndex + 1).trim();
              // Try exact-ish match on name + country
              destDoc = await Destination.findOne({
                $and: [
                  { name: { $regex: new RegExp(escapeRegex(left), 'i') } },
                  { country: { $regex: new RegExp(escapeRegex(right), 'i') } }
                ]
              }).select('_id').lean().exec();
            }

            // Fallbacks: slug, name contains, country contains
            if (!destDoc) {
              destDoc = await Destination.findOne({
                $or: [
                  { slug: part },
                  { name: { $regex: new RegExp(escapeRegex(part), 'i') } },
                  { country: { $regex: new RegExp(escapeRegex(part), 'i') } }
                ]
              }).select('_id').lean().exec();
            }

            if (destDoc && destDoc._id) {
              // destDoc._id may already be an ObjectId or a string; only construct a new ObjectId
              // when the value is a string. Passing an existing ObjectId into the constructor
              // can trigger "Class constructor ObjectId cannot be invoked without 'new'" in
              // some environments. Preserve the original ObjectId when present.
              if (typeof destDoc._id === 'string') {
                resolvedIds.push(new mongoose.Types.ObjectId(destDoc._id));
              } else {
                resolvedIds.push(destDoc._id);
              }
              backendLogger.debug('Resolved destination part to _id', { part, id: destDoc._id });
            } else {
              backendLogger.debug('Could not resolve destination part to any destination', { part });
            }
          } catch (err) {
            backendLogger.error('Error resolving destination part', { part, error: err.message });
          }
        }

        if (resolvedIds.length === 1) {
          filter.destination = resolvedIds[0];
        } else if (resolvedIds.length > 1) {
          filter.destination = { $in: resolvedIds };
        } else {
          // No resolvable destination parts; leave filter untouched (will match all)
          backendLogger.debug('No valid destination ids resolved from query', { raw });
        }
      }
      // Support filtering by experience type (tags). Matches array values or comma-separated strings.
      // We build a flexible regex that tolerates special characters (e.g. '&') and punctuation
      // so that slugs like "food-drink" will match stored values like "Food & Drink".
      if (req.query.experience_type) {
        const et = String(req.query.experience_type).trim();
        if (et.length) {
            // Protect against ReDoS by limiting user-supplied input used to build
            // dynamic regular expressions. If the slugified input is too long or
            // contains too many parts, fall back to a simple escaped match.
            const MAX_REGEX_INPUT_LENGTH = 200; // reasonable upper bound
            const MAX_REGEX_PARTS = 6; // limit complexity of joined pattern
          // Create a slug-like split of the input (words only) and join with a flexible separator
          const slugify = (s) => String(s || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
            const slug = slugify(et);

            // If the slug is excessively long, skip building a complex pattern
            if (!slug || slug.length === 0) {
              filter.experience_type = { $regex: new RegExp(escapeRegex(et), 'i') };
            } else if (slug.length > MAX_REGEX_INPUT_LENGTH) {
              // Fallback to a simple escaped regex on the whole input to avoid
              // creating a potentially expensive pattern from attacker-controlled data.
              filter.experience_type = { $regex: new RegExp(escapeRegex(et), 'i') };
            } else {
              const parts = slug.split('-').filter(Boolean).map(p => escapeRegex(p));
              if (parts.length === 0) {
                filter.experience_type = { $regex: new RegExp(escapeRegex(et), 'i') };
              } else if (parts.length === 1) {
                filter.experience_type = { $regex: new RegExp(parts[0], 'i') };
              } else if (parts.length > MAX_REGEX_PARTS) {
                // Too many parts would create a complex regex; use a simple escaped match
                filter.experience_type = { $regex: new RegExp(escapeRegex(et), 'i') };
              } else {
                // Allow any non-word or underscore characters between parts (covers & and punctuation)
                const pattern = parts.join('[\\W_]*');
                filter.experience_type = { $regex: new RegExp(pattern, 'i') };
              }
            }
        }
      }

      const baseQuery = Experience.find(filter)
        .select('name destination photos default_photo_id permissions experience_type createdAt updatedAt')
        .slice('photos', 1)
        .populate({ path: 'photos', select: 'url caption width height' })
        .lean({ virtuals: false });

      // Default pagination: page=1, limit=30
      const p = Number.isNaN(page) || page < 1 ? 1 : page;
      const l = Number.isNaN(limit) || limit < 1 ? 30 : limit;
      const skip = (p - 1) * l;

      // Sorting support
      const sortBy = req.query.sort_by || req.query.sort || 'created-newest';
      const sortOrder = req.query.sort_order || req.query.order || 'desc';
      const sortMap = {
        'alphabetical': { name: 1 },
        'alphabetical-desc': { name: -1 },
        'created-newest': { createdAt: -1 },
        'created-oldest': { createdAt: 1 },
        'updated-newest': { updatedAt: -1 },
        'updated-oldest': { updatedAt: 1 }
      };
      const sortObj = sortMap[sortBy] || (sortOrder === 'asc' ? { createdAt: 1 } : { createdAt: -1 });

      const total = await Experience.countDocuments(filter);
  backendLogger.debug('Experiences index request', { query: req.query, filter });
      // If sorting by destination, use aggregation to lookup destination and sort by destination.name
      const isDestinationSort = sortBy === 'destination' || sortBy === 'destination-desc';
      const destSortDir = sortBy === 'destination' ? 1 : -1;

      // If ?all=true requested, return full array (compatibility)
      if (req.query.all === 'true' || req.query.all === true) {
        if (isDestinationSort) {
          const all = await Experience.aggregate([
            { $match: filter },
            // lookup destination
            { $lookup: { from: 'destinations', localField: 'destination', foreignField: '_id', as: 'destination' } },
            { $unwind: { path: '$destination', preserveNullAndEmptyArrays: true } },
            // lookup photos (keep first photo only)
            { $lookup: { from: 'photos', localField: 'photos', foreignField: '_id', as: 'photos' } },
            { $addFields: { photos: { $slice: ['$photos', 1] } } },
            { $sort: { 'destination.name': destSortDir } },
            { $project: { name: 1, destination: 1, photos: 1, default_photo_id: 1, permissions: 1, experience_type: 1, createdAt: 1, updatedAt: 1 } }
          ]).exec();
          return successResponse(res, all);
        }

        const all = await Experience.find(filter)
          .select('name destination photos default_photo_id permissions experience_type createdAt updatedAt')
          .slice('photos', 1)
          .populate({ path: 'photos', select: 'url caption width height' })
          .sort(sortObj)
          .lean({ virtuals: false })
          .exec();
        return successResponse(res, all);
      }

      // Apply sort and pagination
      let experiences;
      if (isDestinationSort) {
        // Use aggregation for destination sort + pagination
        const pipeline = [
          { $match: filter },
          { $lookup: { from: 'destinations', localField: 'destination', foreignField: '_id', as: 'destination' } },
          { $unwind: { path: '$destination', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'photos', localField: 'photos', foreignField: '_id', as: 'photos' } },
          { $addFields: { photos: { $slice: ['$photos', 1] } } },
          { $sort: { 'destination.name': destSortDir } },
          { $skip: skip },
          { $limit: l },
          { $project: { name: 1, destination: 1, photos: 1, default_photo_id: 1, permissions: 1, experience_type: 1, createdAt: 1, updatedAt: 1 } }
        ];

        experiences = await Experience.aggregate(pipeline).exec();
      } else {
        experiences = await Experience.find(filter)
          .select('name destination photos default_photo_id permissions experience_type createdAt updatedAt')
          .slice('photos', 1)
          .populate({ path: 'photos', select: 'url caption width height' })
          .sort(sortObj)
          .skip(skip)
          .limit(l)
          .lean({ virtuals: false })
          .exec();
      }

      const totalPages = Math.ceil(total / l);
      backendLogger.info('Experiences index fetched (paginated)', {
        count: experiences.length,
        durationMs: Date.now() - start,
        page: p,
        limit: l,
        total,
        userId: req.user?._id
      });

      return paginatedResponse(res, experiences, {
        page: p,
        limit: l,
        total,
        totalPages,
        hasMore: p < totalPages
      });
  } catch (err) {
      // Log full stack and context to aid debugging
      backendLogger.error('Error fetching experiences', {
        error: err.message,
        stack: err.stack,
        query: req.query,
        filter: typeof filter !== 'undefined' ? filter : null,
        userId: req.user?._id,
        durationMs: Date.now() - start
      });

      // Return 500 to indicate server-side failure and include message for easier local debugging
      return errorResponse(res, err, 'Failed to fetch experiences', 500);
  }
}

async function createExperience(req, res) {
  try {
    // Initialize permissions array with owner
    req.body.permissions = [
      {
        _id: req.user._id,
        entity: permissions.ENTITY_TYPES.USER,
        type: permissions.ROLES.OWNER
      }
    ];

    // Check for duplicate experiences in single optimized query
    const userExperiences = await Experience.find({
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: req.user._id
        }
      }
    })
    .select('name')
    .lean()
    .exec();

    const exactDuplicate = userExperiences.find(exp =>
      exp.name.toLowerCase() === req.body.name.toLowerCase()
    );

    if (exactDuplicate) {
      return errorResponse(res, null, `An experience named "${req.body.name}" already exists. Please choose a different name.`, 409);
    }

    // Check for similar experience names
    const fuzzyDuplicate = findDuplicateFuzzy(
      userExperiences,
      req.body.name,
      'name',
      85
    );

    if (fuzzyDuplicate) {
      return errorResponse(res, null, `A similar experience "${fuzzyDuplicate.name}" already exists. Did you mean to use that instead?`, 409);
    }

    // Log if curator is creating experience (curated status derived from owner's feature flag)
    if (hasFeatureFlag(req.user, 'curator')) {
      backendLogger.info('Curator creating experience', { userId: req.user._id.toString(), name: req.body.name });
    }

    let experience = await Experience.create(req.body);

    trackCreate({
      resource: experience,
      resourceType: 'Experience',
      actor: req.user,
      req,
      reason: `Experience "${experience.name}" created`
    });

    // Broadcast experience creation via WebSocket (async, non-blocking)
    try {
      broadcastEvent('experience', experience._id.toString(), {
        type: 'experience:created',
        payload: { experience, userId: req.user._id.toString() }
      });
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast experience creation', { error: wsErr.message });
    }

    return successResponse(res, experience, 'Experience created successfully', 201);
  } catch (err) {
    backendLogger.error('Error creating experience', { error: err.message, userId: req.user._id, name: req.body.name, destination: req.body.destination });
    return errorResponse(res, err, 'Failed to create experience', 400);
  }
}

async function showExperience(req, res) {
  try {
    // OPTIMIZATION: Use lean() for read-only queries and select only needed fields
    let experience = await Experience.findById(req.params.id)
      .populate("destination")
      .populate("photos", "url caption photo_credit photo_credit_url width height")
      .populate({
        path: "permissions._id",
        populate: {
          path: "photos",
          model: "Photo",
          select: 'url caption'
        },
        select: "name photos default_photo_id feature_flags bio"
      })
      .lean()
      .exec();

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Manually compute virtuals since .lean() bypasses schema virtuals
    if (experience.plan_items && experience.plan_items.length > 0) {
      const itemMap = new Map();
      experience.plan_items.forEach(item => {
        itemMap.set(item._id.toString(), item);
      });

      const calculateTotalCost = (itemId) => {
        const item = itemMap.get(itemId.toString());
        if (!item) return 0;
        let total = item.cost_estimate || 0;
        experience.plan_items.forEach(subItem => {
          if (subItem.parent && subItem.parent.toString() === itemId.toString()) {
            total += calculateTotalCost(subItem._id);
          }
        });
        return total;
      };

      const calculateMaxDays = (itemId) => {
        const item = itemMap.get(itemId.toString());
        if (!item) return 0;
        let maxDays = item.planning_days || 0;
        experience.plan_items.forEach(subItem => {
          if (subItem.parent && subItem.parent.toString() === itemId.toString()) {
            maxDays = Math.max(maxDays, calculateMaxDays(subItem._id));
          }
        });
        return maxDays;
      };

      experience.cost_estimate = experience.plan_items
        .filter(item => !item.parent)
        .reduce((sum, item) => sum + calculateTotalCost(item._id), 0);

      const rootItems = experience.plan_items.filter(item => !item.parent);
      experience.max_planning_days = rootItems.length > 0
        ? Math.max(...rootItems.map(item => calculateMaxDays(item._id)))
        : 0;
    } else {
      experience.cost_estimate = 0;
      experience.max_planning_days = 0;
    }

    return successResponse(res, experience, 'Experience retrieved successfully');
  } catch (err) {
    backendLogger.error('Error fetching experience', { error: err.message, experienceId: req.params.id });
    return errorResponse(res, err, 'Failed to fetch experience', 400);
  }
}

// OPTIMIZATION: Combined endpoint for SingleExperience page
// Fetches experience + user plan + collaborative plans in ONE optimized query
// Reduces 3 separate API calls to 1, dramatically improving page load time
async function showExperienceWithContext(req, res) {
  try {
    const { id: experienceId } = req.params;
    const userId = req.user._id;

    backendLogger.debug('Fetching experience with full context', { experienceId, userId });

    // OPTIMIZATION: Simplified queries with minimal population and select fields
    // Remove nested population to reduce query complexity
    const experiencePromise = Experience.findById(experienceId)
      .populate("destination", "name city state country slug _id")
      .populate("photos", "url caption photo_credit photo_credit_url width height")
      .select('-__v')  // Exclude version field
      .lean()
      .exec();

    // Fetch user's plan for this experience with minimal data
    const userPlanPromise = Plan.findOne({
      experience: experienceId,
      user: userId
    })
      .select('experience user planned_date plan permissions notes pinnedItemId createdAt updatedAt')
      .populate({
        path: 'user',
        select: 'name email photos default_photo_id',
        populate: { path: 'photos', select: 'url caption' }
      })
      .lean()
      .exec();

    // Fetch all collaborative plans for this experience (where user is a collaborator)
    // Only fetch essential fields to reduce data transfer
    // Fetch plans for this experience that the current user can view
    // Use $elemMatch for permissions and match both ObjectId and string forms to tolerate mixed storage
    const userIdStr = userId.toString();
    const plansForUserPromise = Plan.find({
      experience: experienceId,
      $or: [
        { user: userId },
        {
          permissions: {
            $elemMatch: {
              _id: userId,
              type: { $in: ['collaborator', 'owner'] }
            }
          }
        },
        {
          permissions: {
            $elemMatch: {
              _id: userIdStr,
              type: { $in: ['collaborator', 'owner'] }
            }
          }
        }
      ]
    })
      .select('experience user planned_date plan permissions notes pinnedItemId createdAt updatedAt')
      // Populate the plan owner user small profile so frontend can render owner names
      .populate({
        path: 'user',
        select: 'name email photos default_photo_id',
        populate: { path: 'photos', select: 'url caption' }
      })
      .lean()
      .exec();

    // Execute all queries in parallel for maximum performance
    const [experience, userPlan, plansForUser] = await Promise.all([
      experiencePromise,
      userPlanPromise,
      plansForUserPromise
    ]);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Manually compute virtuals since .lean() bypasses schema virtuals
    // These were previously computed by Mongoose schema virtuals but .lean() optimization
    // returns plain objects that don't have access to virtuals
    if (experience.plan_items && experience.plan_items.length > 0) {
      // Build a map of items by ID for quick lookup
      const itemMap = new Map();
      experience.plan_items.forEach(item => {
        itemMap.set(item._id.toString(), item);
      });

      // Helper to calculate total cost for an item and its children
      const calculateTotalCost = (itemId) => {
        const item = itemMap.get(itemId.toString());
        if (!item) return 0;
        let total = item.cost_estimate || 0;
        // Add costs of children
        experience.plan_items.forEach(subItem => {
          if (subItem.parent && subItem.parent.toString() === itemId.toString()) {
            total += calculateTotalCost(subItem._id);
          }
        });
        return total;
      };

      // Helper to calculate max planning days for an item and its children
      const calculateMaxDays = (itemId) => {
        const item = itemMap.get(itemId.toString());
        if (!item) return 0;
        let maxDays = item.planning_days || 0;
        // Check children for higher values
        experience.plan_items.forEach(subItem => {
          if (subItem.parent && subItem.parent.toString() === itemId.toString()) {
            maxDays = Math.max(maxDays, calculateMaxDays(subItem._id));
          }
        });
        return maxDays;
      };

      // Calculate cost_estimate (sum of all root item costs)
      experience.cost_estimate = experience.plan_items
        .filter(item => !item.parent)
        .reduce((sum, item) => sum + calculateTotalCost(item._id), 0);

      // Calculate max_planning_days (max of all root item planning days)
      const rootItems = experience.plan_items.filter(item => !item.parent);
      experience.max_planning_days = rootItems.length > 0
        ? Math.max(...rootItems.map(item => calculateMaxDays(item._id)))
        : 0;
    } else {
      experience.cost_estimate = 0;
      experience.max_planning_days = 0;
    }

    // Will compute sharedPlans below; log using plansForUser length as an initial indicator
    backendLogger.info('Experience context fetched', {
      experienceId,
      userId: userId.toString(),
      hasUserPlan: !!userPlan,
      plansForUserCount: plansForUser ? plansForUser.length : 0
    });
    // Compute total_cost for userPlan
    if (userPlan && userPlan.plan) {
      userPlan.total_cost = userPlan.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
    }

    // From plansForUser derive sharedPlans (exclude the user's own plan)
    let sharedPlans = [];
    if (plansForUser && plansForUser.length > 0) {
      // find user's own plan in the set (may duplicate userPlan)
      const ownIdStr = userId.toString();
      sharedPlans = plansForUser.filter(p => {
        const planUserId = p.user && p.user._id ? p.user._id.toString() : (p.user ? p.user.toString() : null);
        return planUserId !== ownIdStr;
      });

      // Compute totals for each shared plan
      sharedPlans.forEach(plan => {
        if (plan.plan) {
          plan.total_cost = plan.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
        }
      });
    }

    // Fallback: if none found above, explicitly query for plans where the user is a collaborator
    if ((!sharedPlans || sharedPlans.length === 0)) {
      try {
        const fallbackPlans = await Plan.find({
          experience: experienceId,
          $and: [
            { user: { $ne: userId } },
            {
              permissions: {
                $elemMatch: {
                  entity: 'user',
                  _id: userId,
                  type: 'collaborator'
                }
              }
            }
          ]
        })
          .select('experience user planned_date plan permissions notes createdAt updatedAt')
          .populate({ path: 'user', select: 'name email photos default_photo_id', populate: { path: 'photos', select: 'url caption' } })
          .lean()
          .exec();

        if (fallbackPlans && fallbackPlans.length > 0) {
          sharedPlans = fallbackPlans.map(plan => {
            if (plan.plan) {
              plan.total_cost = plan.plan.reduce((sum, item) => sum + (item.cost || 0), 0);
            }
            return plan;
          });
        }
      } catch (fallbackErr) {
        backendLogger.warn('Fallback collaborator plans query failed', { error: fallbackErr.message, experienceId, userId: userId.toString() });
      }
    }

    // (developer) test plan injection removed

    // Return combined data structure
    return successResponse(res, {
      experience,
      userPlan,
      sharedPlans
    });
  } catch (err) {
    backendLogger.error('Error fetching experience with context', {
      error: err.message,
      experienceId: req.params.id,
      userId: req.user?._id
    });
    return errorResponse(res, err, 'Failed to fetch experience data', 400);
  }
}

async function updateExperience(req, res) {
  backendLogger.info('updateExperience called', { experienceId: req.params.experienceId || req.params.id, userId: req.user._id });
  const experienceId = req.params.experienceId || req.params.id;
  try {
    backendLogger.info('Looking up experience', { experienceId });
    let experience = await Experience.findById(experienceId);
    backendLogger.info('Experience lookup result', { found: !!experience });
    
    if (!experience) {
      backendLogger.warn('Experience not found', { experienceId });
      return errorResponse(res, null, 'Experience not found', 404);
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return errorResponse(res, null, 'Not authorized to update this experience', 403);
    }

    // Check for duplicate experience name if name is being updated
    if (req.body.name && req.body.name !== experience.name) {
      // Check for exact duplicate
      const exactDuplicate = await Experience.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i') },
        permissions: {
          $elemMatch: {
            entity: permissions.ENTITY_TYPES.USER,
            type: permissions.ROLES.OWNER,
            _id: req.user._id
          }
        },
        _id: { $ne: experienceId }
      });

      if (exactDuplicate) {
        return errorResponse(res, null, `An experience named "${req.body.name}" already exists. Please choose a different name.`, 409);
      }

      // Check for fuzzy duplicate
      const userExperiences = await Experience.find({
        permissions: {
          $elemMatch: {
            entity: permissions.ENTITY_TYPES.USER,
            type: permissions.ROLES.OWNER,
            _id: req.user._id
          }
        },
        _id: { $ne: experienceId }
      });

      const fuzzyDuplicate = findDuplicateFuzzy(
        userExperiences,
        req.body.name,
        'name',
        85
      );

      if (fuzzyDuplicate) {
        return errorResponse(res, null, `A similar experience "${fuzzyDuplicate.name}" already exists. Did you mean to use that instead?`, 409);
      }
    }

    // Filter out fields that shouldn't be updated
    const allowedFields = [
      'name', 'overview', 'destination', 'map_location', 'experience_type', 
      'plan_items', 'photos', 'default_photo_id', 'visibility', 'permissions'
    ];
    
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body.hasOwnProperty(field)) {
        updateData[field] = req.body[field];
      }
    }
    backendLogger.info('Filtered update data', {
      experienceId,
      updateFields: Object.keys(updateData),
      originalBodyKeys: Object.keys(req.body)
    });

    // Validate permissions if present
    if (updateData.permissions) {
      backendLogger.debug('Validating permissions', { count: updateData.permissions.length });
      for (const perm of updateData.permissions) {
        if (!perm._id) {
          backendLogger.error('Invalid permission: missing _id', { permission: perm, experienceId });
          return errorResponse(res, null, 'Invalid permissions data: missing _id', 400);
        }
        if (!perm.entity || !['user', 'destination', 'experience'].includes(perm.entity)) {
          backendLogger.error('Invalid permission: invalid entity', { permission: perm, experienceId });
          return errorResponse(res, null, 'Invalid permissions data: invalid entity', 400);
        }
      }
    }
    
    // Capture previous state for activity tracking
    const previousState = experience.toObject();
    
    experience = Object.assign(experience, updateData);
    
    backendLogger.info('About to save experience', { experienceId, bodyKeys: Object.keys(req.body) });
    await experience.save();
    backendLogger.info('Experience saved successfully', { experienceId });
    
    // Track update (non-blocking)
    trackUpdate({
      resource: experience,
      previousState,
      resourceType: 'Experience',
      actor: req.user,
      req,
      fieldsToTrack: Object.keys(updateData),
      reason: `Experience "${experience.name}" updated`
    });

    // Broadcast experience update via WebSocket (async, non-blocking)
    try {
      broadcastEvent('experience', experienceId.toString(), {
        type: 'experience:updated',
        payload: {
          experience,
          experienceId: experienceId.toString(),
          updatedFields: Object.keys(updateData),
          userId: req.user._id.toString()
        }
      }, req.user._id.toString()); // Exclude sender from broadcast
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast experience update', { error: wsErr.message });
    }

    return successResponse(res, experience, 'Experience updated successfully');
  } catch (err) {
    backendLogger.error('Experience save error details', {
      message: err.message,
      stack: err.stack,
      name: err.name,
      code: err.code,
      errors: err.errors
    });
    
    // Safe logging to avoid undefined property access
    const safeExperienceId = experienceId || 'undefined';
    const safeUserId = req.user && req.user._id ? req.user._id.toString() : 'undefined';
    
    backendLogger.error('Error saving experience', { 
      error: err.message, 
      errors: err.errors, 
      userId: safeUserId, 
      experienceId: safeExperienceId 
    });
    
    return errorResponse(res, err, 'Failed to update experience', 400);
  }
}

async function deleteExperience(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    let experience = await Experience.findById(req.params.id);
    
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Check if user has permission to delete using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canDelete({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'Only the experience owner can delete it.', 403);
    }
    
    // Check if any other users have plans for this experience
    // Only prevent deletion if non-owner users have plans (owners can cascade delete)
    const existingPlans = await Plan.find({ experience: req.params.id })
      .populate({
        path: 'user',
        select: '_id name email photos default_photo_id',
        populate: [
          {
            path: 'photos',
            model: 'Photo'
          }
        ]
      });
    
    if (existingPlans.length > 0) {
      // Check if any plan belongs to someone other than the owner
      const otherUserPlans = existingPlans.filter(
        plan => plan.user._id.toString() !== req.user._id.toString()
      );
      
      // If there are plans by other users, the owner can still delete (cascade delete)
      // Only non-owners are prevented from deleting experiences with other users' plans
      if (otherUserPlans.length > 0 && !permCheck.allowed) {
        // Get unique users with their plan details
        const usersWithPlans = otherUserPlans.map(plan => ({
          userId: plan.user._id,
          name: plan.user.name,
          email: plan.user.email,
          photos: plan.user.photos,
          default_photo_id: plan.user.default_photo_id,
          planId: plan._id,
          plannedDate: plan.planned_date
      }));
        
        return errorResponse(res, null, 'This experience cannot be deleted because other users have created plans for it. You can transfer ownership to one of these users instead.', 409);
      }
    }
    
    // Track deletion (non-blocking) - must happen before deleteOne()
    trackDelete({
      resource: experience,
      resourceType: 'Experience',
      actor: req.user,
      req,
      reason: `Experience "${experience.name}" deleted`
    });
    
    // Get plan IDs before deletion so frontend can emit events for cascade-deleted plans
    let deletedPlanIds = [];
    let deletedPlansCount = 0;

    // Delete all plans associated with this experience
    // This prevents orphaned plans showing as "Unnamed Experience" on dashboards
    try {
      // First, get the plan IDs so we can return them
      const plansToDelete = await Plan.find({ experience: req.params.id }).select('_id user').lean();
      deletedPlanIds = plansToDelete.map(p => ({
        planId: p._id.toString(),
        userId: p.user ? p.user.toString() : null
      }));

      // Then delete them
      const deleteResult = await Plan.deleteMany({ experience: req.params.id });
      deletedPlansCount = deleteResult.deletedCount;

      backendLogger.info('Deleted associated plans', {
        experienceId: req.params.id,
        plansDeleted: deletedPlansCount,
        planIds: deletedPlanIds.map(p => p.planId)
      });
    } catch (planDeleteErr) {
      backendLogger.error('Error deleting associated plans', {
        error: planDeleteErr.message,
        experienceId: req.params.id
      });
      // Don't fail the experience deletion if plan deletion fails
      // The plans will become orphaned but the experience deletion should succeed
    }

    await experience.deleteOne();

    // Broadcast experience deletion via WebSocket (async, non-blocking)
    try {
      broadcastEvent('experience', req.params.id.toString(), {
        type: 'experience:deleted',
        payload: {
          experienceId: req.params.id.toString(),
          deletedPlans: deletedPlanIds,
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast experience deletion', { error: wsErr.message });
    }

    // Return deletion info including cascade-deleted plans for frontend event emission
    return successResponse(res, {
      deletedPlans: {
        count: deletedPlansCount,
        plans: deletedPlanIds
      }
    }, 'Experience deleted successfully');
  } catch (err) {
    backendLogger.error('Error deleting experience', { error: err.message, userId: req.user._id, experienceId: req.params.id });
    return errorResponse(res, err, 'Failed to delete experience', 400);
  }
}

async function createPlanItem(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.experienceId)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name email photo photos default_photo_id"
      })
      .populate({
        path: "photos",
        model: "Photo"
      });
    
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'You must be the owner or a collaborator to add plan items.', 403);
    }

    // Enforce configurable max nesting level.
    // Definition: root items have depth 0; a direct child has depth 1; etc.
    const maxNestingLevelRaw = process.env.PLAN_ITEM_MAX_NESTING_LEVEL || process.env.VITE_PLAN_ITEM_MAX_NESTING_LEVEL;
    const maxNestingLevelParsed = parseInt(maxNestingLevelRaw, 10);
    const maxNestingLevel = Number.isFinite(maxNestingLevelParsed) && maxNestingLevelParsed >= 0 ? maxNestingLevelParsed : 1;

    if (req.body.parent) {
      if (maxNestingLevel === 0) {
        return errorResponse(res, null, 'Plan item nesting is disabled (max nesting level is 0)', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(req.body.parent)) {
        return errorResponse(res, null, 'Invalid parent plan item ID format', 400);
      }

      const parentItem = experience.plan_items.id(req.body.parent);
      if (!parentItem) {
        return errorResponse(res, null, 'Parent plan item not found in this experience', 400);
      }

      // Compute depth of the parent by walking up its parent chain.
      const visited = new Set();
      let parentDepth = 0;
      let cursor = parentItem;
      while (cursor?.parent) {
        const cursorId = cursor?._id?.toString();
        if (cursorId) {
          if (visited.has(cursorId)) {
            return errorResponse(res, null, 'Invalid plan item hierarchy (cycle detected)', 400);
          }
          visited.add(cursorId);
        }

        parentDepth += 1;
        if (parentDepth > 50) {
          return errorResponse(res, null, 'Invalid plan item hierarchy (excessive nesting)', 400);
        }

        const nextParentId = cursor.parent.toString();
        const nextParent = experience.plan_items.id(nextParentId);
        if (!nextParent) {
          return errorResponse(res, null, 'Invalid plan item hierarchy (missing parent)', 400);
        }
        cursor = nextParent;
      }

      if (parentDepth >= maxNestingLevel) {
        return errorResponse(res, null, `Cannot add a child item deeper than max nesting level ${maxNestingLevel}`, 400);
      }
    }
    
    // Sanitize plan item data before saving
    const planItemData = {
      text: req.body.text,
      url: req.body.url || null,
      cost_estimate: req.body.cost_estimate || 0,
      planning_days: req.body.planning_days || 0,
      parent: req.body.parent || null,
      activity_type: req.body.activity_type || null,
      location: sanitizeLocation(req.body.location)
    };

    experience.plan_items.push(planItemData);
    await experience.save();

    // Get the newly created plan item (last one in array)
    const newPlanItem = experience.plan_items[experience.plan_items.length - 1];

    // Broadcast plan item creation via WebSocket
    try {
      broadcastEvent('experience', req.params.experienceId.toString(), {
        type: 'experience:item:added',
        payload: {
          experienceId: req.params.experienceId.toString(),
          planItem: newPlanItem,
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast plan item creation', { error: wsErr.message });
    }

    // Re-fetch with populated permissions for consistent response
    experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name email photo photos default_photo_id"
      })
      .populate({
        path: "photos",
        model: "Photo"
      });

    return successResponse(res, experience, 'Created successfully', 201);
  } catch (err) {
    backendLogger.error('Error creating plan item', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId });
    return errorResponse(res, err, 'Failed to create plan item', 400);
  }
}

async function updatePlanItem(req, res) {
  try {
    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(req.params.experienceId)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.planItemId)) {
      return errorResponse(res, null, 'Invalid plan item ID format', 400);
    }

    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name email photo photos default_photo_id"
      })
      .populate({
        path: "photos",
        model: "Photo"
      });
    
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    // Use canEdit() for proper permission check including email verification
    // Email verification IS required for modifying experience content
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'You must be the owner or a collaborator to update plan items.', 403);
    }
    
    let plan_item = experience.plan_items.id(req.params.planItemId);

    if (!plan_item) {
      return errorResponse(res, null, 'Plan item not found', 404);
    }

    // Enforce configurable max nesting level for parent updates.
    // Allow clearing parent (set to null), but block setting parent so the resulting depth exceeds max.
    const maxNestingLevelRaw = process.env.PLAN_ITEM_MAX_NESTING_LEVEL || process.env.VITE_PLAN_ITEM_MAX_NESTING_LEVEL;
    const maxNestingLevelParsed = parseInt(maxNestingLevelRaw, 10);
    const maxNestingLevel = Number.isFinite(maxNestingLevelParsed) && maxNestingLevelParsed >= 0 ? maxNestingLevelParsed : 1;

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'parent') && req.body.parent) {
      if (maxNestingLevel === 0) {
        return errorResponse(res, null, 'Plan item nesting is disabled (max nesting level is 0)', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(req.body.parent)) {
        return errorResponse(res, null, 'Invalid parent plan item ID format', 400);
      }

      if (req.body.parent.toString() === req.params.planItemId.toString()) {
        return errorResponse(res, null, 'Plan item cannot be its own parent', 400);
      }

      const parentItem = experience.plan_items.id(req.body.parent);
      if (!parentItem) {
        return errorResponse(res, null, 'Parent plan item not found in this experience', 400);
      }

      // Compute depth of the parent by walking up its parent chain.
      const visited = new Set([req.params.planItemId.toString()]);
      let parentDepth = 0;
      let cursor = parentItem;

      while (cursor?.parent) {
        const cursorId = cursor?._id?.toString();
        if (cursorId) {
          if (visited.has(cursorId)) {
            return errorResponse(res, null, 'Invalid plan item hierarchy (cycle detected)', 400);
          }
          visited.add(cursorId);
        }

        parentDepth += 1;
        if (parentDepth > 50) {
          return errorResponse(res, null, 'Invalid plan item hierarchy (excessive nesting)', 400);
        }

        const nextParentId = cursor.parent.toString();
        const nextParent = experience.plan_items.id(nextParentId);
        if (!nextParent) {
          return errorResponse(res, null, 'Invalid plan item hierarchy (missing parent)', 400);
        }
        cursor = nextParent;
      }

      if (parentDepth >= maxNestingLevel) {
        return errorResponse(res, null, `Cannot add a child item deeper than max nesting level ${maxNestingLevel}`, 400);
      }
    }

    // Update only provided fields (exclude _id as it's immutable)
    // Sanitize location data to prevent GeoJSON validation errors
    const { _id, location, ...otherData } = req.body;
    Object.assign(plan_item, otherData);

    // Handle location separately with sanitization
    if ('location' in req.body) {
      plan_item.location = sanitizeLocation(location);
    }

    await experience.save();

    // Broadcast plan item update via WebSocket
    try {
      broadcastEvent('experience', req.params.experienceId.toString(), {
        type: 'experience:item:updated',
        payload: {
          experienceId: req.params.experienceId.toString(),
          planItemId: req.params.planItemId.toString(),
          planItem: plan_item,
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast plan item update', { error: wsErr.message });
    }

    // Re-fetch with populated permissions for consistent response
    experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name email photo photos default_photo_id"
      })
      .populate({
        path: "photos",
        model: "Photo"
      });

    return successResponse(res, experience);
  } catch (err) {
    backendLogger.error('Error updating plan item', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId, planItemId: req.params.planItemId });
    return errorResponse(res, err, 'Failed to update plan item', 400);
  }
}

async function deletePlanItem(req, res) {
  try {
    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(req.params.experienceId)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.planItemId)) {
      return errorResponse(res, null, 'Invalid plan item ID format', 400);
    }

    let experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name email photo photos default_photo_id"
      })
      .populate({
        path: "photos",
        model: "Photo"
      });
    
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }
    
    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });
    
    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'You must be the owner or a collaborator to delete plan items.', 403);
    }
    
    const planItem = experience.plan_items.id(req.params.planItemId);
    if (!planItem) {
      return errorResponse(res, null, 'Plan item not found', 404);
    }

    planItem.deleteOne();
    await experience.save();

    // Broadcast plan item deletion via WebSocket
    try {
      broadcastEvent('experience', req.params.experienceId.toString(), {
        type: 'experience:item:deleted',
        payload: {
          experienceId: req.params.experienceId.toString(),
          planItemId: req.params.planItemId.toString(),
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast plan item deletion', { error: wsErr.message });
    }

    // Re-fetch with populated permissions for consistent response
    experience = await Experience.findById(req.params.experienceId)
      .populate("destination")
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name email photo photos default_photo_id"
      })
      .populate({
        path: "photos",
        model: "Photo"
      });
    
    return successResponse(res, experience);
  } catch (err) {
    backendLogger.error('Error deleting plan item', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId, planItemId: req.params.planItemId });
    return errorResponse(res, err, 'Failed to delete plan item', 400);
  }
}



/**
 * Get experiences where user has created a plan (contributor permission)
 * Replaces the old users array approach
 */
async function showUserExperiences(req, res) {
  try {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    // Check if pagination is requested (optional - defaults to returning all)
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const p = Number.isNaN(page) || page < 1 ? 1 : page;
    const l = Number.isNaN(limit) || limit < 1 ? 12 : Math.min(limit, 100); // Default 12, max 100
    const skip = (p - 1) * l;

    // Build query
    let query = Plan.find({ user: req.params.userId })
      .sort({ createdAt: -1 }) // Most recent first
      .populate({
        path: 'experience',
        populate: [
          {
            path: 'destination',
            select: 'name country'
          },
          {
            path: 'photos',
            select: 'url caption'
          }
        ]
      });

    // Apply pagination only if requested
    if (hasPagination) {
      query = query.skip(skip).limit(l);
    }

    const plans = await query.exec();

    // Extract unique experiences from plans
    const experiences = plans
      .filter(plan => plan.experience) // Filter out null experiences
      .map(plan => plan.experience);

    // Deduplicate by experience ID (a user might have multiple plans for same experience)
    const seen = new Set();
    const uniqueExperiences = experiences.filter(exp => {
      const id = exp._id.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // Return paginated response with metadata, or just array for backwards compatibility
    if (hasPagination) {
      const totalPlans = await Plan.countDocuments({ user: req.params.userId });
      const totalPages = Math.ceil(totalPlans / l);

      return paginatedResponse(res, uniqueExperiences, {
        page: p,
        limit: l,
        total: totalPlans,
        totalPages,
        hasMore: p < totalPages
      });
    } else {
      // Backwards compatible: return just the array
      return successResponse(res, uniqueExperiences);
    }
  } catch (err) {
    backendLogger.error('Error fetching user experiences', { error: err.message, userId: req.params.userId });
    return errorResponse(res, err, 'Failed to fetch user experiences', 400);
  }
}

async function showUserCreatedExperiences(req, res) {
  try {
    // Validate ObjectId format to prevent injection
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    // Check if pagination is requested (optional - defaults to returning all)
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const p = Number.isNaN(page) || page < 1 ? 1 : page;
    const l = Number.isNaN(limit) || limit < 1 ? 12 : Math.min(limit, 100); // Default 12, max 100
    const skip = (p - 1) * l;

    // Build query for experiences owned by this user
    const queryFilter = {
      permissions: {
        $elemMatch: {
          entity: permissions.ENTITY_TYPES.USER,
          type: permissions.ROLES.OWNER,
          _id: userId
        }
      }
    };

    // Build query
    let query = Experience.find(queryFilter)
      .sort({ createdAt: -1 }) // Most recent first
      .populate("destination")
      .populate({
        path: 'photos',
        select: 'url caption'
      });

    // Apply pagination only if requested
    if (hasPagination) {
      query = query.skip(skip).limit(l);
    }

    const experiences = await query.exec();

    // Return paginated response with metadata, or just array for backwards compatibility
    if (hasPagination) {
      const total = await Experience.countDocuments(queryFilter);
      const totalPages = Math.ceil(total / l);

      return paginatedResponse(res, experiences, {
        page: p,
        limit: l,
        total,
        totalPages,
        hasMore: p < totalPages
      });
    } else {
      // Backwards compatible: return just the array
      return successResponse(res, experiences);
    }
  } catch (err) {
    backendLogger.error('Error fetching user created experiences', { error: err.message, userId: req.params.userId });
    return errorResponse(res, err, 'Failed to fetch user created experiences', 400);
  }
}

async function getTagName(req, res) {
  try {
    const { tagSlug } = req.params;

    // Validate input length to prevent ReDoS attacks
    const MAX_SLUG_LENGTH = 200;
    if (!tagSlug || typeof tagSlug !== 'string' || tagSlug.length > MAX_SLUG_LENGTH) {
      return errorResponse(res, null, 'Invalid tag slug', 400);
    }

    // Helper function to create URL slug (same logic as frontend)
    // Uses simple character replacement - safe from ReDoS
    const createUrlSlug = (str) => {
      // Limit input and use simple char-by-char replacement to avoid ReDoS
      const limited = str.slice(0, MAX_SLUG_LENGTH).toLowerCase();
      let result = '';
      let lastWasDash = true; // Start true to skip leading dashes
      for (const char of limited) {
        if ((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9')) {
          result += char;
          lastWasDash = false;
        } else if (!lastWasDash) {
          result += '-';
          lastWasDash = true;
        }
      }
      // Remove trailing dash
      return result.endsWith('-') ? result.slice(0, -1) : result;
    };

    // Normalize incoming slug: decode URL-encoded characters and
    // run through the same slugify function so variants like
    // "food-&-wine" or "food%26-wine" normalize to "food-wine".
    let normalizedInputSlug;
    try {
      const decoded = decodeURIComponent(tagSlug);
      normalizedInputSlug = createUrlSlug(decoded);
    } catch (e) {
      // Fall back to raw tagSlug if decoding fails
      normalizedInputSlug = createUrlSlug(tagSlug);
    }

    // OPTIMIZATION: Single query with .lean() and .select() to only fetch experience_type field
    // Reduces memory usage by 90%+ (only fetching tag arrays, not full documents)
    const allExperiences = await Experience.find({
      experience_type: { $exists: true, $ne: [] }
    })
    .select('experience_type')
    .lean()
    .exec();

    if (!allExperiences || allExperiences.length === 0) {
      return errorResponse(res, null, 'No tags found', 404);
    }

    // Find the matching tag name (in-memory operation)
    for (const exp of allExperiences) {
      if (exp.experience_type && Array.isArray(exp.experience_type)) {
        // Flatten array - some old data has ["Tag1, Tag2"] instead of ["Tag1", "Tag2"]
        const tags = exp.experience_type.flatMap(item =>
          typeof item === 'string' && item.includes(',')
            ? item.split(',').map(tag => tag.trim())
            : item
        );

        const matchingTag = tags.find(
          tag => createUrlSlug(tag) === normalizedInputSlug
        );
        if (matchingTag) {
          return successResponse(res, { tagName: matchingTag });
        }
      }
    }

    // If no match found, return the normalized slug as fallback
    return errorResponse(res, null, 'Tag not found', 404);
  } catch (err) {
    backendLogger.error('Error finding tag by slug', { error: err.message, tagSlug: req.params.tagSlug });
    return errorResponse(res, err, 'Failed to find tag', 400);
  }
}

async function addPhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'Not authorized to modify this experience', 403);
    }

    const { url, photo_credit, photo_credit_url } = req.body;

    if (!url) {
      return errorResponse(res, null, 'Photo URL is required', 400);
    }

    // Add photo to photos array
    experience.photos.push({
      url,
      photo_credit: photo_credit || 'Unknown',
      photo_credit_url: photo_credit_url || url
    });

    await experience.save();

    // Broadcast experience:updated event for photo addition
    try {
      broadcastEvent('experience', experience._id.toString(), {
        type: 'experience:updated',
        payload: {
          experience: experience.toObject(),
          experienceId: experience._id.toString(),
          updatedFields: ['photos'],
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (err) {
      backendLogger.error('Failed to broadcast experience:updated for photo addition', { error: err.message, experienceId: experience._id });
    }

    return successResponse(res, experience, 'Created successfully', 201);
  } catch (err) {
    backendLogger.error('Error adding photo to experience', { error: err.message, userId: req.user._id, experienceId: req.params.id, url: req.body.url });
    return errorResponse(res, err, 'Failed to add photo', 400);
  }
}

async function removePhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Check if user has permission to edit using PermissionEnforcer
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'You must be the owner or a collaborator to modify this experience.', 403);
    }

    const photoIndex = parseInt(req.params.photoIndex);

    if (photoIndex < 0 || photoIndex >= experience.photos.length) {
      return errorResponse(res, null, 'Invalid photo index', 400);
    }

    // Remove photo from array
    experience.photos.splice(photoIndex, 1);

    // Adjust default_photo_id if necessary
    if (experience.default_photo_id && !experience.photos.includes(experience.default_photo_id)) {
      experience.default_photo_id = experience.photos.length > 0 ? experience.photos[0] : null;
    }

    await experience.save();

    // Broadcast experience:updated event for photo removal
    try {
      broadcastEvent('experience', experience._id.toString(), {
        type: 'experience:updated',
        payload: {
          experience: experience.toObject(),
          experienceId: experience._id.toString(),
          updatedFields: ['photos'],
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (err) {
      backendLogger.error('Failed to broadcast experience:updated for photo removal', { error: err.message, experienceId: experience._id });
    }

    return successResponse(res, experience);
  } catch (err) {
    backendLogger.error('Error removing photo from experience', { error: err.message, userId: req.user._id, experienceId: req.params.id, photoIndex: req.params.photoIndex });
    return errorResponse(res, err, 'Failed to remove photo', 400);
  }
}

async function setDefaultPhoto(req, res) {
  try {
    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Check if user has permission to edit
    const enforcer = getEnforcer({ Destination, Experience, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      return errorResponse(res, null, permCheck.reason || 'Not authorized to modify this experience', 403);
    }

    const photoIndex = parseInt(req.body.photoIndex);

    if (photoIndex < 0 || photoIndex >= experience.photos.length) {
      return errorResponse(res, null, 'Invalid photo index', 400);
    }

    experience.default_photo_id = experience.photos[photoIndex];
    await experience.save();

    // Broadcast experience:updated event for default photo change
    try {
      broadcastEvent('experience', experience._id.toString(), {
        type: 'experience:updated',
        payload: {
          experience: experience.toObject(),
          experienceId: experience._id.toString(),
          updatedFields: ['default_photo_id'],
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (err) {
      backendLogger.error('Failed to broadcast experience:updated for default photo', { error: err.message, experienceId: experience._id });
    }

    return successResponse(res, experience);
  } catch (err) {
    backendLogger.error('Error setting default photo', { error: err.message, userId: req.user._id, experienceId: req.params.id, photoIndex: req.body.photoIndex });
    return errorResponse(res, err, 'Failed to set default photo', 400);
  }
}

// ============================================
// PERMISSION MANAGEMENT FUNCTIONS
// ============================================

/**
 * Add a permission (collaborator/contributor or inherited entity) to an experience
 * POST /api/experiences/:id/permissions
 */
async function addExperiencePermission(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, experience)) {
      return errorResponse(res, null, 'Only the experience owner can manage permissions', 403);
    }

    const { _id, entity, type } = req.body;

    // Validate required fields
    if (!_id || !entity) {
      return errorResponse(res, null, 'Permission must have _id and entity fields', 400);
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return errorResponse(res, null, 'Invalid permission _id format', 400);
    }

    // Validate entity exists
    if (entity === permissions.ENTITY_TYPES.USER) {
      const user = await User.findById(_id);
      if (!user) {
        return errorResponse(res, null, 'User not found', 404);
      }

      // Prevent owner from being added as permission
      const ownerPermission = experience.permissions.find(p =>
        p.entity === 'user' && p.type === 'owner'
      );
      if (ownerPermission && _id === ownerPermission._id.toString()) {
        return errorResponse(res, null, 'Owner already has full permissions', 400);
      }

      if (!type) {
        return errorResponse(res, null, 'User permissions must have a type field', 400);
      }
    } else if (entity === permissions.ENTITY_TYPES.DESTINATION) {
      const destination = await Destination.findById(_id);
      if (!destination) {
        return errorResponse(res, null, 'Target destination not found', 404);
      }

      // Check for circular dependency
      const models = { Destination, Experience };
      const wouldBeCircular = await permissions.wouldCreateCircularDependency(
        experience,
        _id,
        entity,
        models
      );

      if (wouldBeCircular) {
        return errorResponse(res, null, 'Cannot add permission: would create circular dependency', 400);
      }
    } else if (entity === permissions.ENTITY_TYPES.EXPERIENCE) {
      const targetExp = await Experience.findById(_id);
      if (!targetExp) {
        return errorResponse(res, null, 'Target experience not found', 404);
      }

      // Check for circular dependency
      const models = { Destination, Experience };
      const wouldBeCircular = await permissions.wouldCreateCircularDependency(
        experience,
        _id,
        entity,
        models
      );

      if (wouldBeCircular) {
        return errorResponse(res, null, 'Cannot add permission: would create circular dependency', 400);
      }
    }

    // Add permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Experience, Destination, User });
    
    const permission = { _id, entity };
    if (type) {
      permission.type = type;
    }

    const result = await enforcer.addPermission({
      resource: experience,
      permission,
      actorId: req.user._id,
      reason: 'Owner added permission via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return errorResponse(res, null, result.error, 400);
    }

    // Permission saved by enforcer, no need to save again

    // Broadcast experience:updated event for collaborator addition
    // This enables real-time collaborator avatar updates across all users/tabs
    try {
      broadcastEvent('experience', req.params.id.toString(), {
        type: 'experience:updated',
        payload: {
          experience: experience.toObject(),
          experienceId: req.params.id.toString(),
          updatedFields: ['permissions'],
          action: 'permission_added',
          permission: { _id, entity, type },
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast permission addition', { error: wsErr.message, experienceId: req.params.id });
    }

    return successResponse(res, experience, 'Permission added successfully', 201);

  } catch (err) {
    backendLogger.error('Error adding experience permission', { error: err.message, userId: req.user._id, experienceId: req.params.id, entityId: req.body.entityId, entityType: req.body.entityType, type: req.body.type });
    return errorResponse(res, err, 'Failed to add permission', 400);
  }
}

/**
 * Remove a permission from an experience
 * DELETE /api/experiences/:id/permissions/:entityId/:entityType
 */
async function removeExperiencePermission(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    // Validate entity ID
    if (!mongoose.Types.ObjectId.isValid(req.params.entityId)) {
      return errorResponse(res, null, 'Invalid entity ID format', 400);
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, experience)) {
      return errorResponse(res, null, 'Only the experience owner can manage permissions', 403);
    }

    const { entityId, entityType } = req.params;

    // Validate entity type
    if (!Object.values(permissions.ENTITY_TYPES).includes(entityType)) {
      return errorResponse(res, null, `Invalid entity type. Must be one of: ${Object.values(permissions.ENTITY_TYPES).join(', ')}`, 400);
    }

    // Remove permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Experience, Destination, User });

    const result = await enforcer.removePermission({
      resource: experience,
      permissionId: entityId,
      entityType,
      actorId: req.user._id,
      reason: 'Owner removed permission via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return errorResponse(res, null, result.error, 400);
    }

    await experience.save();

    // Broadcast experience:updated event for collaborator removal
    // This enables real-time collaborator avatar updates across all users/tabs
    try {
      broadcastEvent('experience', req.params.id.toString(), {
        type: 'experience:updated',
        payload: {
          experience: experience.toObject(),
          experienceId: req.params.id.toString(),
          updatedFields: ['permissions'],
          action: 'permission_removed',
          removedPermission: { entityId, entityType },
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast permission removal', { error: wsErr.message, experienceId: req.params.id });
    }

    return successResponse(res, { removed: result.removed, experience }, 'Permission removed successfully');

  } catch (err) {
    backendLogger.error('Error removing experience permission', { error: err.message, userId: req.user._id, experienceId: req.params.id, entityId: req.params.entityId, entityType: req.params.entityType });
    return errorResponse(res, err, 'Failed to remove permission', 400);
  }
}

/**
 * Update a user permission type (collaborator <-> contributor)
 * PATCH /api/experiences/:id/permissions/:userId
 */
async function updateExperiencePermission(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Only owner can modify permissions
    if (!permissions.isOwner(req.user, experience)) {
      return errorResponse(res, null, 'Only the experience owner can manage permissions', 403);
    }

    const { type } = req.body;

    if (!type) {
      return errorResponse(res, null, 'Permission type is required', 400);
    }

    // Update permission using enforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Experience, Destination, User });

    const result = await enforcer.updatePermission({
      resource: experience,
      permissionId: req.params.userId,
      entityType: 'user',
      newType: type,
      actorId: req.user._id,
      reason: 'Owner updated permission type via API',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!result.success) {
      return errorResponse(res, null, result.error, 400);
    }

    await experience.save();

    return successResponse(res, experience, 'Permission updated successfully');

  } catch (err) {
    backendLogger.error('Error updating experience permission', { error: err.message, userId: req.user._id, experienceId: req.params.id, userIdParam: req.params.userId, type: req.body.type });
    return errorResponse(res, err, 'Failed to update permission', 400);
  }
}

/**
 * Get all permissions for an experience (with inheritance resolved)
 * GET /api/experiences/:id/permissions
 */
async function getExperiencePermissions(req, res) {
  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    const experience = await Experience.findById(req.params.id);

    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    const models = { Destination, Experience };
    const allPermissions = await permissions.getAllPermissions(experience, models);

    // Get owner information from permissions
    const ownerPermission = experience.permissions.find(p =>
      p.entity === 'user' && p.type === 'owner'
    );

    let ownerInfo = null;
    if (ownerPermission) {
      const ownerUser = await User.findById(ownerPermission._id).select('name');
      if (ownerUser) {
        ownerInfo = {
          userId: ownerPermission._id,
          name: ownerUser.name,
          role: permissions.ROLES.OWNER
        };
      }
    }

    return successResponse(res, {
      owner: ownerInfo,
      permissions: allPermissions,
      directPermissions: experience.permissions || []
    });

  } catch (err) {
    backendLogger.error('Error getting experience permissions', { error: err.message, experienceId: req.params.id });
    return errorResponse(res, err, 'Failed to get permissions', 400);
  }
}

async function transferOwnership(req, res) {
  try {
    const { experienceId } = req.params;
    const { newOwnerId } = req.body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(experienceId)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(newOwnerId)) {
      return errorResponse(res, null, 'Invalid user ID format', 400);
    }

    // Find experience and verify current ownership
    const experience = await Experience.findById(experienceId);
    
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Verify current user is the owner
    if (!permissions.isOwner(req.user._id, experience)) {
      return errorResponse(res, null, 'Only the experience owner can transfer ownership.', 403);
    }

    // Verify new owner exists and has a plan for this experience
    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return errorResponse(res, null, 'New owner not found', 404);
    }

    // Verify the new owner has a plan for this experience
    const newOwnerPlan = await Plan.findOne({
      experience: experienceId,
      user: newOwnerId
    });

    if (!newOwnerPlan) {
      return errorResponse(res, null, 'The new owner must have a plan for this experience before ownership can be transferred.', 400);
    }

    // Update ownership using PermissionEnforcer (SECURE)
    const { getEnforcer } = require('../../utilities/permission-enforcer');
    const enforcer = getEnforcer({ Destination, Experience, User });

    const transferResult = await enforcer.transferOwnership({
      resource: experience,
      oldOwnerId: req.user._id,
      newOwnerId: newOwnerId,
      actorId: req.user._id,
      reason: 'Ownership transfer requested by current owner',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method
      }
    });

    if (!transferResult.success) {
      return errorResponse(res, null, transferResult.error, 400);
    }

    await experience.save();

    // OPTIMIZATION: Re-populate existing document instead of fetching again (Phase 3.1)
    // This avoids a redundant database query since we already have the experience
    await experience.populate('destination');

    return successResponse(res, {
      experience: experience,
      previousOwner: {
        id: req.user._id,
        name: req.user.name
      },
      newOwner: {
        id: newOwner._id,
        name: newOwner.name
      }
    }, 'Ownership transferred successfully');

  } catch (err) {
    backendLogger.error('Error transferring ownership', { error: err.message, userId: req.user._id, experienceId: req.params.experienceId, newOwnerId: req.body.newOwnerId });
    return errorResponse(res, err, 'Failed to transfer ownership', 400);
  }
}

/**
 * PUT /api/experiences/:experienceId/reorder-plan-items
 * Reorder experience plan items
 */
async function reorderExperiencePlanItems(req, res) {
  const { experienceId } = req.params;
  const { plan_items: reorderedItems } = req.body;

  backendLogger.debug('Experience plan items reorder request received', {
    experienceId,
    itemCount: reorderedItems?.length,
    userId: req.user?._id?.toString(),
    firstItemSample: reorderedItems?.[0] ? {
      hasId: !!reorderedItems[0]._id,
      idType: typeof reorderedItems[0]._id,
      keys: Object.keys(reorderedItems[0])
    } : null
  });

  try {
    // Validate experience ID
    if (!mongoose.Types.ObjectId.isValid(experienceId)) {
      backendLogger.warn('Invalid experience ID format', { experienceId });
      return errorResponse(res, null, 'Invalid experience ID', 400);
    }

    // Validate reorderedItems
    if (!Array.isArray(reorderedItems)) {
      backendLogger.warn('Invalid plan items format - not an array', {
        experienceId,
        receivedType: typeof reorderedItems
      });
      return errorResponse(res, null, 'Plan items must be an array', 400);
    }

    // Validate that all items have _id
    const itemsWithoutId = reorderedItems.filter(item => !item._id);
    if (itemsWithoutId.length > 0) {
      backendLogger.warn('Reordered items missing _id', {
        experienceId,
        missingCount: itemsWithoutId.length,
        totalCount: reorderedItems.length,
        sampleItem: itemsWithoutId[0]
      });
      return errorResponse(res, null, 'All plan items must have an _id field', 400);
    }

    let experience = await Experience.findById(experienceId);

    if (!experience) {
      backendLogger.warn('Experience not found', { experienceId });
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Check permissions - must be owner or collaborator
    const enforcer = getEnforcer({ Plan, Experience, Destination, User });
    const permCheck = await enforcer.canEdit({
      userId: req.user._id,
      resource: experience
    });

    if (!permCheck.allowed) {
      backendLogger.warn('Insufficient permissions to reorder experience plan items', {
        experienceId,
        userId: req.user._id.toString(),
        reason: permCheck.reason
      });
      return errorResponse(res, null, permCheck.reason || 'Insufficient permissions to reorder this experience\'s plan', 403);
    }

    // Validate that reordered items match existing items
    const existingIds = new Set(experience.plan_items.map(item => item._id.toString()));
    const reorderedIds = new Set(reorderedItems.map(item => item._id.toString()));

    if (existingIds.size !== reorderedIds.size) {
      backendLogger.warn('Reordered items count mismatch', {
        experienceId,
        existingCount: existingIds.size,
        reorderedCount: reorderedIds.size
      });
      return errorResponse(res, null, 'Reordered items must match existing items', 400);
    }

    for (const id of existingIds) {
      if (!reorderedIds.has(id)) {
        backendLogger.warn('Reordered items contain unknown ID', {
          experienceId,
          unknownId: id
        });
        return errorResponse(res, null, 'Reordered items contain IDs not in original plan', 400);
      }
    }

    // Update the experience with reordered items
    experience.plan_items = reorderedItems;
    await experience.save();

    // Track the update activity
    await trackUpdate({
      resource: experience,
      resourceType: 'Experience',
      actor: req.user,
      req,
      reason: 'Experience plan items reordered',
      changes: {
        field: 'plan_items',
        action: 'reordered',
        itemCount: reorderedItems.length
      }
    });

    backendLogger.info('Experience plan items reordered successfully', {
      experienceId,
      itemCount: reorderedItems.length,
      userId: req.user._id.toString()
    });

    // Broadcast plan items reorder via WebSocket
    try {
      broadcastEvent('experience', experienceId.toString(), {
        type: 'experience:item:reordered',
        payload: {
          experienceId: experienceId.toString(),
          planItems: reorderedItems,
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast plan items reorder', { error: wsErr.message });
    }

    // Re-fetch with populated data for consistent response
    experience = await Experience.findById(experienceId)
      .populate("destination")
      .populate({
        path: "permissions._id",
        populate: [
          {
            path: "photo",
            select: "url caption"
          },
          {
            path: "photos",
            model: "Photo"
          }
        ],
        select: "name email photo photos default_photo_id"
      })
      .populate({
        path: "photos",
        model: "Photo"
      });

    return successResponse(res, experience);
  } catch (err) {
    backendLogger.error('Error reordering experience plan items', {
      experienceId,
      error: err.message,
      userId: req.user._id.toString()
    });
    return errorResponse(res, err, 'Failed to reorder plan items', 400);
  }
}

/**
 * GET /api/experiences/:id/check-plans
 * Check if an experience has plans before deletion
 * Returns only non-identifying information about plan existence
 * Open to all authenticated users for UI flow purposes
 */
async function checkExperiencePlans(req, res) {
  try {
    const experienceId = req.params.id;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(experienceId)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    const experience = await Experience.findById(experienceId);
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Count plans for this experience (no user details)
    const totalPlans = await Plan.countDocuments({ experience: experienceId });

    // Check if requesting user has a plan for this experience
    const userHasPlan = await Plan.exists({
      experience: experienceId,
      user: req.user._id
    });

    // Count plans by other users (excluding current user)
    const otherUserPlansCount = await Plan.countDocuments({
      experience: experienceId,
      user: { $ne: req.user._id }
    });

    // Determine if user is owner (for canDelete logic)
    const isOwner = permissions.isOwner(req.user._id, experience);

    return successResponse(res, {
      experienceId,
      experienceName: experience.name,
      totalPlans,
      hasUserPlan: !!userHasPlan,
      otherUserPlansCount,
      // User can delete only if they are owner AND no other users have plans
      canDelete: isOwner && otherUserPlansCount === 0,
      // Transfer required only if owner and other users have plans
      requiresTransfer: isOwner && otherUserPlansCount > 0,
      isOwner
    });

  } catch (err) {
    backendLogger.error('Error checking experience plans', {
      error: err.message,
      userId: req.user._id,
      experienceId: req.params.id
    });
    return errorResponse(res, err, 'Failed to check experience plans', 500);
  }
}

/**
 * POST /api/experiences/:experienceId/archive
 * Archive an experience by transferring ownership to Archive User
 * Stores original owner in archived_owner field
 * Used when owner wants to delete but plans exist
 */
async function archiveExperience(req, res) {
  try {
    const { experienceId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(experienceId)) {
      return errorResponse(res, null, 'Invalid experience ID format', 400);
    }

    const experience = await Experience.findById(experienceId);
    if (!experience) {
      return errorResponse(res, null, 'Experience not found', 404);
    }

    // Verify current user is the owner
    if (!permissions.isOwner(req.user._id, experience)) {
      return errorResponse(res, null, 'Only the experience owner can archive it.', 403);
    }

    // Store original owner before transfer
    experience.archived_owner = req.user._id;

    // Ensure Archive User exists in database
    let archiveUser = await User.findById(ARCHIVE_USER._id);
    if (!archiveUser) {
      // Create Archive User if not exists (should have been seeded)
      archiveUser = new User({
        _id: ARCHIVE_USER._id,
        name: ARCHIVE_USER.name,
        email: ARCHIVE_USER.email,
        provider: ARCHIVE_USER.provider,
        role: ARCHIVE_USER.role,
        emailConfirmed: ARCHIVE_USER.emailConfirmed,
        visibility: ARCHIVE_USER.visibility,
        password: require('crypto').randomBytes(64).toString('hex')
      });
      await archiveUser.save();
      backendLogger.info('Created Archive User on-demand', { userId: ARCHIVE_USER._id.toString() });
    }

    // Update permissions - remove current owner, add Archive User as owner
    const oldOwnerPermIdx = experience.permissions.findIndex(
      p => p.entity === 'user' && p.type === 'owner' && p._id.toString() === req.user._id.toString()
    );

    if (oldOwnerPermIdx !== -1) {
      experience.permissions.splice(oldOwnerPermIdx, 1);
    }

    // Add Archive User as owner
    experience.permissions.push({
      _id: ARCHIVE_USER._id,
      entity: 'user',
      type: 'owner'
    });

    await experience.save();

    // Track the archive action
    trackUpdate({
      resource: experience,
      resourceType: 'Experience',
      actor: req.user,
      req,
      changes: {
        archived_owner: req.user._id,
        owner: ARCHIVE_USER._id
      },
      reason: `Experience "${experience.name}" archived by original owner`
    });

    // Broadcast event
    try {
      broadcastEvent('experience', experienceId.toString(), {
        type: 'experience:archived',
        payload: {
          experienceId: experienceId.toString(),
          archivedBy: req.user._id.toString(),
          archivedOwner: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast experience archive', { error: wsErr.message });
    }

    return successResponse(res, {
      experience: {
        _id: experience._id,
        name: experience.name,
        archived_owner: experience.archived_owner
      },
      previousOwner: {
        id: req.user._id,
        name: req.user.name
      }
    }, 'Experience archived successfully');

  } catch (err) {
    backendLogger.error('Error archiving experience', {
      error: err.message,
      userId: req.user._id,
      experienceId: req.params.experienceId
    });
    return errorResponse(res, err, 'Failed to archive experience', 500);
  }
}

module.exports = {
  create: createExperience,
  show: showExperience,
  showWithContext: showExperienceWithContext,
  update: updateExperience,
  delete: deleteExperience,
  transferOwnership,
  checkExperiencePlans,
  archiveExperience,
  index,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
  reorderExperiencePlanItems,
  showUserExperiences,
  showUserCreatedExperiences,
  getTagName,
  getExperienceTags,
  addPhoto,
  removePhoto,
  setDefaultPhoto,
  addExperiencePermission,
  removeExperiencePermission,
  updateExperiencePermission,
  getExperiencePermissions,
};
