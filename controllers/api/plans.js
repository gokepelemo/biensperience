const Plan = require("../../models/plan");
const Experience = require("../../models/experience");
const Destination = require("../../models/destination");
const User = require("../../models/user");
const Photo = require("../../models/photo");
const permissions = require("../../utilities/permissions");
const { getEnforcer } = require("../../utilities/permission-enforcer");
const { asyncHandler, successResponse, errorResponse, validateObjectId } = require("../../utilities/controller-helpers");
const backendLogger = require("../../utilities/backend-logger");
const mongoose = require("mongoose");
const Activity = require('../../models/activity');
const { sendCollaboratorInviteEmail } = require('../../utilities/email-service');
const { trackCreate, trackUpdate, trackDelete, trackPlanItemCompletion, trackCostAdded } = require('../../utilities/activity-tracker');
const { hasFeatureFlag } = require('../../utilities/feature-flags');
const { broadcastEvent } = require('../../utilities/websocket-server');

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

/**
 * Filter plan notes based on visibility permissions
 * - 'contributors': Visible to all plan collaborators
 * - 'private': Only visible to the note creator
 *
 * @param {Object} plan - The plan document (will be modified in place)
 * @param {ObjectId|string} userId - Current user's ID
 * @returns {Object} The plan with filtered notes
 */
function filterNotesByVisibility(plan, userId) {
  if (!plan || !plan.plan || !Array.isArray(plan.plan)) return plan;

  const userIdStr = userId?.toString();

  plan.plan.forEach(planItem => {
    if (planItem.details && planItem.details.notes && Array.isArray(planItem.details.notes)) {
      // Filter out private notes that don't belong to the current user
      planItem.details.notes = planItem.details.notes.filter(note => {
        // 'contributors' visibility (default) - visible to all plan members
        if (!note.visibility || note.visibility === 'contributors') {
          return true;
        }
        // 'private' visibility - only visible to the note creator
        if (note.visibility === 'private') {
          const noteUserId = note.user?._id?.toString() || note.user?.toString();
          return noteUserId === userIdStr;
        }
        // Unknown visibility - default to visible (backwards compatibility)
        return true;
      });
    }
  });

  return plan;
}

/**
 * Check if a user is a valid member of a plan (owner or has permissions)
 * Uses permission inheritance to resolve all valid members including those from experience
 * @param {Object} plan - The plan document
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} True if user is a plan member
 */
async function isPlanMember(plan, userId) {
  if (!plan || !userId) return false;

  const userIdStr = userId.toString();

  // Check if user is the plan owner
  if (plan.user && plan.user.toString() === userIdStr) {
    return true;
  }

  // Check direct user permissions on the plan
  const hasDirectPermission = plan.permissions?.some(
    p => p.entity === 'user' && p._id.toString() === userIdStr
  );
  if (hasDirectPermission) {
    return true;
  }

  // Check inherited permissions from experience
  const models = { Plan, Experience, Destination, User };
  try {
    const resolvedPermissions = await permissions.resolvePermissionsWithInheritance(plan, models);
    return resolvedPermissions.has(userIdStr);
  } catch (err) {
    backendLogger.warn('Error resolving plan permissions for member check', {
      planId: plan._id.toString(),
      userId: userIdStr,
      error: err.message
    });
    return false;
  }
}

/**
 * Create a new plan for an experience
 * Initializes plan with snapshot of current experience plan items
 */
const createPlan = asyncHandler(async (req, res) => {
  const { experienceId } = req.params;
  const { planned_date, currency } = req.body;

  backendLogger.debug('Plan creation request received', {
    experienceId,
    planned_date,
    currency,
    userId: req.user?._id?.toString(),
    hasUser: !!req.user,
    requestMethod: req.method,
    requestPath: req.path
  });

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    backendLogger.warn('Invalid experience ID format', { experienceId });
    return errorResponse(res, null, "Invalid experience ID", 400);
  }

  if (!req.user || !req.user._id) {
    backendLogger.warn('Plan creation attempted without authentication', {
      hasUser: !!req.user,
      hasUserId: !!(req.user?._id)
    });
    return errorResponse(res, null, "Authentication required", 401);
  }

  if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
    backendLogger.warn('Invalid user ID format', { userId: req.user._id });
    return errorResponse(res, null, "Invalid user ID", 400);
  }

  // Check if experience exists
  backendLogger.debug('Looking up experience', { experienceId });
  const experience = await Experience.findById(experienceId);
  if (!experience) {
    backendLogger.warn('Experience not found', { experienceId });
    return errorResponse(res, null, "Experience not found", 404);
  }
  backendLogger.debug('Experience found', { 
    experienceId, 
    experienceName: experience.name,
    planItemsCount: experience.plan_items?.length || 0
  });

  // Check if user already has a plan for this experience
  backendLogger.debug('Checking for existing plan', { experienceId, userId: req.user._id.toString() });
  const existingPlan = await Plan.findOne({
    experience: experienceId,
    user: req.user._id
  });

  if (existingPlan) {
    backendLogger.warn('Plan creation attempted for existing plan', {
      experienceId,
      userId: req.user._id.toString(),
      existingPlanId: existingPlan._id.toString()
    });
    return errorResponse(res, null, "Plan already exists for this experience. Use the checkmark button to view it.", 409);
  }
  backendLogger.debug('No existing plan found, proceeding with creation');

  // Create snapshot of current plan items
  const planSnapshot = experience.plan_items.map(item => ({
    plan_item_id: item._id,
    complete: false,
    cost: item.cost_estimate || 0,
    planning_days: item.planning_days || 0,
    text: item.text,
    url: item.url,
    photo: item.photo,
    parent: item.parent,
    activity_type: item.activity_type || null,
    location: item.location || null
  }));

  // Create plan with dual ownership
  backendLogger.debug('Creating plan with snapshot', {
    experienceId,
    userId: req.user._id.toString(),
    itemCount: planSnapshot.length,
    plannedDate: planned_date
  });

  // Normalize planned_date: accept null, empty string, ISO string, or numeric epoch
  let normalizedPlannedDate = null;
  try {
    if (planned_date === null || planned_date === undefined || (typeof planned_date === 'string' && planned_date.trim() === '')) {
      normalizedPlannedDate = null;
    } else if (planned_date instanceof Date) {
      normalizedPlannedDate = planned_date;
    } else if (typeof planned_date === 'number' && Number.isFinite(planned_date)) {
      normalizedPlannedDate = new Date(planned_date);
    } else if (typeof planned_date === 'string') {
      const d = new Date(planned_date);
      if (!isNaN(d.getTime())) normalizedPlannedDate = d;
      else normalizedPlannedDate = null;
    }
  } catch (err) {
    normalizedPlannedDate = null;
  }

  // Normalize currency: accept valid 3-letter currency code or default to USD
  const normalizedCurrency = (typeof currency === 'string' && currency.trim().length === 3)
    ? currency.trim().toUpperCase()
    : 'USD';

  const plan = await Plan.create({
    experience: experienceId,
    user: req.user._id,
    planned_date: normalizedPlannedDate,
    currency: normalizedCurrency,
    plan: planSnapshot,
    permissions: [
      {
        _id: req.user._id,
        entity: 'user',
        type: 'owner',
        granted_by: req.user._id
      },
      {
        _id: experienceId,
        entity: 'experience',
        type: 'collaborator', // Inherit experience permissions
        granted_by: req.user._id
      }
    ]
  });

  backendLogger.info('Plan created successfully', {
    planId: plan._id.toString(),
    experienceId: experienceId.toString(),
    userId: req.user._id.toString(),
    planItemsCount: plan.plan?.length || 0
  });

  // OPTIMIZATION: Manually populate with data we already have in memory
  // This avoids additional database queries and returns instantly
  const quickPopulatedPlan = {
    ...plan.toObject(),
    experience: {
      _id: experience._id,
      name: experience.name,
      destination: experience.destination,
      photos: experience.photos,
      default_photo_id: experience.default_photo_id
    },
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      photos: req.user.photos,
      default_photo_id: req.user.default_photo_id
    }
  };

  // Return immediately for fast response
  successResponse(res, quickPopulatedPlan, 'Plan created successfully', 201);

  // Broadcast plan creation via WebSocket (async, non-blocking)
  try {
    // Broadcast to experience room (for other collaborators viewing the experience)
    broadcastEvent('experience', experienceId.toString(), {
      type: 'plan:created',
      payload: {
        plan: quickPopulatedPlan,
        experienceId: experienceId.toString(),
        userId: req.user._id.toString()
      }
    }, req.user._id.toString());
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast plan creation', { error: wsErr.message });
  }

  // Do permission enforcement and tracking asynchronously (don't block response)
  setImmediate(async () => {
    try {
      const enforcer = getEnforcer({ Plan, Experience, Destination, User });
      const userRole = await enforcer.getUserRole(req.user._id, experience);

      // Only add as contributor if user has no existing role (SECURE)
      if (!userRole) {
        await enforcer.addPermission({
          resource: experience,
          permission: {
            _id: req.user._id,
            entity: 'user',
            type: 'contributor'
          },
          actorId: req.user._id,
          reason: 'User created plan for experience',
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestPath: req.path,
            requestMethod: req.method
          },
          allowSelfContributor: true
        });
      }

      // Track creation (non-blocking)
      // Populate experience for activity tracking so it shows experience name instead of "Plan"
      const planWithExperience = {
        ...plan.toObject(),
        experience: {
          _id: experience._id,
          name: experience.name
        }
      };
      trackCreate({
        resource: planWithExperience,
        resourceType: 'Plan',
        actor: req.user,
        req,
        reason: `Plan created for experience "${experience.name}"`
      });

      // If experience owner is a curator, log an activity for their dashboard
      // Find the owner from permissions and check if they have the curator flag
      const ownerPermission = experience.permissions?.find(p => p.type === 'owner' && p.entity === 'user');
      if (ownerPermission && ownerPermission._id.toString() !== req.user._id.toString()) {
        try {
          // Fetch the owner to check their feature flags
          const owner = await User.findById(ownerPermission._id).select('name feature_flags').lean();
          if (owner && hasFeatureFlag(owner, 'curator')) {
            await Activity.log({
              action: 'plan_created',
              actor: {
                _id: req.user._id,
                name: req.user.name,
                email: req.user.email
              },
              resource: {
                id: plan._id,
                type: 'Plan',
                name: `Plan for ${experience.name}`
              },
              target: {
                id: owner._id,
                type: 'User',
                name: owner.name || 'Curator'
              },
              reason: `${req.user.name} planned your curated experience "${experience.name}"`,
              metadata: {
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                requestPath: req.path,
                requestMethod: req.method
              },
              tags: ['curator_activity', 'experience_planned']
            });

            backendLogger.info('Curator activity logged for experience plan', {
              curatorId: owner._id.toString(),
              experienceId: experience._id.toString(),
              plannedByUserId: req.user._id.toString()
            });
          }
        } catch (activityErr) {
          backendLogger.warn('Failed to log curator activity', {
            error: activityErr.message,
            ownerId: ownerPermission._id.toString(),
            experienceId: experience._id.toString()
          });
        }
      }
    } catch (err) {
      backendLogger.error('Error in async post-creation tasks', {
        planId: plan._id.toString(),
        error: err.message
      }, err);
    }
  });
});

/**
 * Get all plans for a user with pagination support
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Items per page (default: 10, max: 50)
 * @query {boolean} paginate - Whether to paginate (default: false for backward compatibility)
 */
const getUserPlans = asyncHandler(async (req, res) => {
  const paginate = req.query.paginate === 'true';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const skip = (page - 1) * limit;

  // Include both owned plans AND collaborative plans (where user is a collaborator)
  const filter = {
    $or: [
      { user: req.user._id },
      { 'permissions._id': req.user._id, 'permissions.entity': 'user', 'permissions.type': { $in: ['collaborator', 'contributor'] } }
    ]
  };

  // Build base query
  let query = Plan.find(filter)
    .populate({
      path: 'user',
      select: 'name email photos default_photo_id'
    })
    .populate({
      path: 'experience',
      select: 'name destination photos default_photo_id',
      populate: {
        path: 'destination',
        select: 'name country'
      }
    })
    .populate({
      path: 'plan.details.notes.user',
      select: 'name email photos default_photo_id oauthProfilePhoto',
      populate: {
        path: 'photos',
        select: 'url caption'
      }
    })
    .sort({ updatedAt: -1 });

  if (paginate) {
    // Get total count and paginated results in parallel
    const [totalCount, plans] = await Promise.all([
      Plan.countDocuments(filter),
      query.skip(skip).limit(limit)
    ]);

    // Convert to JSON to ensure virtuals are included
    // Add isCollaborative flag to indicate if this is a shared plan
    // Filter notes based on visibility permissions
    const plansWithVirtuals = plans.map(plan => {
      const planJson = plan.toJSON();
      planJson.isCollaborative = plan.user._id.toString() !== req.user._id.toString();
      filterNotesByVisibility(planJson, req.user._id);
      return planJson;
    });

    return res.json({
      data: plansWithVirtuals,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        hasMore: skip + plansWithVirtuals.length < totalCount
      }
    });
  }

  // Non-paginated (backward compatible)
  const plans = await query;
  const plansWithVirtuals = plans.map(plan => {
    const planJson = plan.toJSON();
    planJson.isCollaborative = plan.user._id.toString() !== req.user._id.toString();
    filterNotesByVisibility(planJson, req.user._id);
    return planJson;
  });
  res.json(plansWithVirtuals);
});

/**
 * Get a specific plan by ID
 */
const getPlanById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, "Invalid plan ID", 400);
  }

  const plan = await Plan.findById(id)
    .populate({
      path: 'user',
      select: 'name email photos default_photo_id',
      populate: {
        path: 'photos',
        select: 'url caption'
      }
    })
    .populate({
      path: 'experience',
      select: 'name destination plan_items photos default_photo_id',
      populate: {
        path: 'destination',
        select: 'name country'
      }
    })
    .populate({
      path: 'plan.details.notes.user',
      select: 'name email photos default_photo_id oauthProfilePhoto',
      populate: {
        path: 'photos',
        select: 'url caption'
      }
    });

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Check if user has permission to view (owner, collaborator, or contributor)
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canView({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: "Insufficient permissions to view this plan",
      message: permCheck.reason
    });
  }

  // Filter notes based on visibility permissions
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Get all plans for a specific experience
 * Returns plans the current user can view
 * Optimized to use single query instead of N+1
 */
const getExperiencePlans = asyncHandler(async (req, res) => {
  const { experienceId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return errorResponse(res, null, "Invalid experience ID", 400);
  }

  // Single optimized query: get user's own plan OR plans where user is collaborator/owner
  const plans = await Plan.find({
    experience: experienceId,
    $or: [
      { user: req.user._id }, // User's own plan
      {
        'permissions': {
          $elemMatch: {
            '_id': req.user._id,
            'type': { $in: ['collaborator', 'owner'] }
          }
        }
      } // Plans where user is collaborator/owner
    ]
  })
  .populate({
    path: 'user',
    select: 'name email photos default_photo_id',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  })
  .populate({
    path: 'experience',
    select: 'name destination',
    populate: {
      path: 'destination',
      select: 'name country'
    }
  })
  .populate({
    path: 'plan.details.notes.user',
    select: 'name email photos default_photo_id oauthProfilePhoto',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  })
  .sort({ updatedAt: -1 });

  // OPTIMIZATION: Batch fetch all unique user IDs across all plans in ONE query
  // This replaces N queries (one per plan) with a single query
  const allUserIds = new Set();
  plans.forEach(plan => {
    if (plan.permissions && plan.permissions.length > 0) {
      plan.permissions
        .filter(p => p.entity === 'user')
        .forEach(p => allUserIds.add(p._id.toString()));
    }
  });

  // Single batch query for all users with .lean() for performance
  const allUsers = await User.find({ _id: { $in: Array.from(allUserIds) } })
    .select('name email photos default_photo_id')
    .populate('photos', 'url caption')
    .populate('default_photo_id', 'url caption')
    .lean()
    .exec();

  // Create user lookup map (O(1) access)
  const userMap = {};
  allUsers.forEach(u => {
    userMap[u._id.toString()] = {
      name: u.name,
      email: u.email,
      _id: u._id,
      photos: u.photos,
      default_photo_id: u.default_photo_id
    };
  });

  // Enhance all plans with user data (no async operations needed)
  const plansWithCollaborators = plans.map(plan => {
    const planObj = plan.toObject();

    if (planObj.permissions && planObj.permissions.length > 0) {
      planObj.permissions = planObj.permissions.map(p => {
        if (p.entity === 'user' && userMap[p._id.toString()]) {
          return {
            ...p,
            user: userMap[p._id.toString()]
          };
        }
        return p;
      });
    }
    // Filter notes based on visibility permissions
    filterNotesByVisibility(planObj, req.user._id);
    return planObj;
  });

  res.json(plansWithCollaborators);
});

/**
 * Check if user has a plan for a specific experience (lightweight)
 * Returns only plan ID and creation date - no populates
 * OPTIMIZATION: This avoids the expensive getUserPlans() call with nested populates
 */
const checkUserPlanForExperience = asyncHandler(async (req, res) => {
  const { experienceId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return errorResponse(res, null, "Invalid experience ID", 400);
  }

  // Find all plans where user is owner OR collaborator
  // Lean query with minimal fields - very fast
  const plans = await Plan.find({
    experience: experienceId,
    $or: [
      { user: req.user._id }, // User is owner
      { 'permissions._id': req.user._id, 'permissions.type': { $in: ['owner', 'collaborator'] } } // User has owner/collaborator permissions
    ]
  })
  .select('_id createdAt user')
  .lean();

  if (!plans || plans.length === 0) {
    return res.json({ 
      hasPlan: false, 
      plans: [] 
    });
  }

  // Transform plans to include isOwn flag
  const transformedPlans = plans.map(plan => ({
    _id: plan._id,
    createdAt: plan.createdAt,
    isOwn: plan.user.toString() === req.user._id.toString(),
    owner: plan.user
  }));

  // Ensure user's own plan is prioritized first if it exists
  transformedPlans.sort((a, b) => {
    if (a.isOwn && !b.isOwn) return -1;
    if (!a.isOwn && b.isOwn) return 1;
    // Secondary: newest first
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const ownPlan = transformedPlans.find(p => p.isOwn) || null;

  res.json({
    hasPlan: !!ownPlan,  // Only true if user has their OWN plan
    plans: transformedPlans,
    // ONLY return planId if user has their own plan (not collaborative)
    planId: ownPlan ? ownPlan._id : null,
    createdAt: ownPlan ? ownPlan.createdAt : null,
    // Explicit field for clients that prefer owner-only deletes
    ownPlanId: ownPlan ? ownPlan._id : null
  });
});

/**
 * Update a plan
 */
const updatePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, "Invalid plan ID", 400);
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return errorResponse(res, null, "Plan not found", 404);
  }

  // Check permissions - must be owner or collaborator
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return errorResponse(res, null, permCheck.reason || "Insufficient permissions to edit this plan", 403);
  }

  // Validate update fields
  const validateUpdate = (field, value) => {
    switch(field) {
      case 'planned_date':
        // Accept null (clearing the date), Date objects, ISO date strings, or numeric epoch timestamps
        if (value === null) return true;
        if (value instanceof Date) return true;
        if (typeof value === 'number') {
          return Number.isFinite(value);
        }
        if (typeof value === 'string') {
          // Allow empty-string which we treat as null (clearing the date)
          if (value.trim() === '') return true;
          const date = new Date(value);
          return !isNaN(date.getTime());
        }
        return false;
      case 'plan':
        return Array.isArray(value);
      case 'notes':
        return typeof value === 'string' || value === null;
      case 'currency':
        // Accept valid 3-letter currency code
        return typeof value === 'string' && value.trim().length === 3;
      default:
        return false;
    }
  };

  // If the request only updates `planned_date`, perform an atomic update to avoid
  // triggering full-document validation (e.g. GeoJSON fields) which can fail
  // when optional nested fields are absent. This lets clients PATCH/PUT just the
  // planned_date without causing unrelated validation errors.
  const requestedKeys = Object.keys(updates || {}).filter(k => k);
  const allowedForRequest = ['planned_date', 'plan', 'notes', 'currency'];
  const requestedAllowed = requestedKeys.filter(k => allowedForRequest.includes(k));
  if (requestedAllowed.length === 1 && requestedAllowed[0] === 'planned_date') {
    // Validate the planned_date value
    if (!validateUpdate('planned_date', updates.planned_date)) {
      return errorResponse(res, null, 'Invalid value for field: planned_date', 400);
    }

    // Normalize value into Date or null
    let normalized = null;
    if (updates.planned_date === null || updates.planned_date === '') {
      normalized = null;
    } else if (updates.planned_date instanceof Date) {
      normalized = updates.planned_date;
    } else if (typeof updates.planned_date === 'number' && Number.isFinite(updates.planned_date)) {
      normalized = new Date(updates.planned_date);
    } else if (typeof updates.planned_date === 'string') {
      const t = updates.planned_date.trim();
      normalized = t === '' ? null : new Date(t);
    }

    const previousState = plan.toObject();

    // Atomic update - do not run full document validators here to avoid GeoJSON errors
    const updated = await Plan.findByIdAndUpdate(
      plan._id,
      { $set: { planned_date: normalized } },
      { new: true }
    )
    .populate('experience', 'name destination photos default_photo_id')
    .populate({
      path: 'user',
      select: 'name email photos default_photo_id',
      populate: { path: 'photos', select: 'url caption' }
    });

    // Track update (non-blocking)
    trackUpdate({
      resource: updated,
      previousState,
      resourceType: 'Plan',
      actor: req.user,
      req,
      fieldsToTrack: ['planned_date'],
      reason: `Plan updated (planned_date)`
    });

    return res.json(updated);
  }

  // Capture previous state for activity tracking
  const previousState = plan.toObject();

  // Update allowed fields with validation
  const allowedUpdates = ['planned_date', 'plan', 'notes', 'currency'];
  const fieldsToTrack = [];
  for (const field of allowedUpdates) {
    if (updates[field] !== undefined) {
      if (!validateUpdate(field, updates[field])) {
        return errorResponse(res, null, `Invalid value for field: ${field}`, 400);
      }
      // Coerce empty strings for planned_date to null to avoid storing empty strings
      if (field === 'planned_date') {
        // Normalize several accepted formats into a Date or null
        if (updates[field] === '' || updates[field] === null) {
          plan[field] = null;
        } else if (updates[field] instanceof Date) {
          plan[field] = updates[field];
        } else if (typeof updates[field] === 'number' && Number.isFinite(updates[field])) {
          plan[field] = new Date(updates[field]);
        } else if (typeof updates[field] === 'string') {
          const trimmed = updates[field].trim();
          if (trimmed === '') {
            plan[field] = null;
          } else {
            plan[field] = new Date(trimmed);
          }
        } else {
          // Fallback: set to null to be safe
          plan[field] = null;
        }
      } else if (field === 'currency') {
        // Normalize currency to uppercase
        plan[field] = updates[field].trim().toUpperCase();
      } else {
        plan[field] = updates[field];
      }
      fieldsToTrack.push(field);
    }
  }

  await plan.save();

  const updatedPlan = await Plan.findById(plan._id)
    .populate('experience', 'name destination photos default_photo_id')
    .populate({
      path: 'user',
      select: 'name email photos default_photo_id',
      populate: {
        path: 'photos',
        select: 'url caption'
      }
    });

  // Track update (non-blocking)
  trackUpdate({
    resource: updatedPlan,
    previousState,
    resourceType: 'Plan',
    actor: req.user,
    req,
    fieldsToTrack,
    reason: `Plan updated`
  });

  // Broadcast plan update via WebSocket
  try {
    // Broadcast to both plan room and experience room
    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      payload: {
        plan: updatedPlan,
        planId: id.toString(),
        updatedFields: fieldsToTrack,
        userId: req.user._id.toString()
      }
    }, req.user._id.toString());

    // Also broadcast to experience room if experience ID is available
    const experienceId = updatedPlan.experience?._id || plan.experience;
    if (experienceId) {
      broadcastEvent('experience', experienceId.toString(), {
        type: 'plan:updated',
        payload: {
          plan: updatedPlan,
          planId: id.toString(),
          experienceId: experienceId.toString(),
          updatedFields: fieldsToTrack,
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    }
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast plan update', { error: wsErr.message });
  }

  res.json(updatedPlan);
});

/**
 * Delete a plan
 * Removes plan and contributor status from experience if applicable
 */
const deletePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, "Invalid plan ID", 400);
  }

  const plan = await Plan.findById(id)
    .select('user permissions experience')
    .populate('experience', 'name'); // Populate for activity logging

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Only owner can delete
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canDelete({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: "Only the plan owner can delete it",
      message: permCheck.reason
    });
  }

  // Track deletion (non-blocking) - must happen before deleteOne()
  trackDelete({
    resource: plan,
    resourceType: 'Plan',
    actor: req.user,
    req,
    reason: `Plan deleted`
  });

  // OPTIMIZATION 1: Parallel database operations instead of sequential
  // Delete plan and update experience permissions simultaneously
  const deletePromise = Plan.findByIdAndDelete(id);
  
  // OPTIMIZATION 2: Only fetch and update experience if user is NOT owner/collaborator
  // Most users are just contributors, so we can skip the experience query often
  let updateExperiencePromise = Promise.resolve();
  
  // Check if we need to remove contributor permission
  // We'll do this check without fetching the full experience first
  if (plan.experience) {
    updateExperiencePromise = (async () => {
      // Use a lean query with only the fields we need (much faster)
      const experience = await Experience.findById(plan.experience)
        .select('permissions user')
        .lean();

      if (experience) {
        // Check if user is NOT owner or collaborator
        const enforcer = getEnforcer({ Plan, Experience, Destination, User });
        const userRole = await enforcer.getUserRole(req.user._id, experience);
        const isOwnerOrCollaborator = userRole === 'owner' || userRole === 'collaborator';

        if (!isOwnerOrCollaborator) {
          // OPTIMIZATION 3: Use updateOne instead of find + save
          // This is a single atomic operation
          await Experience.updateOne(
            { _id: plan.experience },
            { 
              $pull: { 
                permissions: { 
                  entity: 'user',
                  _id: req.user._id,
                  type: 'contributor'
                }
              }
            }
          );
        }
      }
    })();
  }

  // OPTIMIZATION 4: Wait for both operations in parallel
  await Promise.all([deletePromise, updateExperiencePromise]);

  // Broadcast plan deletion via WebSocket
  try {
    // Broadcast to plan room
    broadcastEvent('plan', id.toString(), {
      type: 'plan:deleted',
      payload: {
        planId: id.toString(),
        userId: req.user._id.toString()
      }
    }, req.user._id.toString());

    // Also broadcast to experience room if experience ID is available
    const experienceId = plan.experience?._id || plan.experience;
    if (experienceId) {
      broadcastEvent('experience', experienceId.toString(), {
        type: 'plan:deleted',
        payload: {
          planId: id.toString(),
          experienceId: experienceId.toString(),
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    }
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast plan deletion', { error: wsErr.message });
  }

  res.json({ message: "Plan deleted successfully" });
});

/**
 * Add a collaborator to a plan
 */
const addCollaborator = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return errorResponse(res, null, "Invalid ID", 400);
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return errorResponse(res, null, "Plan not found", 404);
  }

  // Only owner can add collaborators
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  // Lightweight short-circuit: if the requester is the plan owner (plan.user), allow immediately.
  try {
    if (plan.user && plan.user.toString() === req.user._id.toString()) {
      // Owner detected - skip enforcer check
      backendLogger.debug('Add collaborator: short-circuit owner check passed', {
        planId: plan._id.toString(),
        ownerId: plan.user.toString(),
        actorId: req.user._id.toString()
      });
    } else {
      const permCheck = await enforcer.canManagePermissions({
        userId: req.user._id,
        resource: plan
      });

      if (!permCheck.allowed) {
        return errorResponse(res, null, permCheck.reason || "Only the plan owner can add collaborators", 403);
      }
    }
  } catch (err) {
    backendLogger.error('Error checking permissions for addCollaborator', { error: err?.message, stack: err?.stack });
    return errorResponse(res, err, 'Error checking permissions', 500);
  }

  // Check if user already has permission
  const existingPerm = plan.permissions.find(
    p => p.entity === 'user' && p._id.toString() === userId
  );

  if (existingPerm) {
    return res.status(400).json({ error: "User already has permissions on this plan" });
  }

  // Add collaborator using enforcer (SECURE)
  const result = await enforcer.addPermission({
    resource: plan,
    permission: {
      _id: userId,
      entity: 'user',
      type: 'collaborator'
    },
    actorId: req.user._id,
    reason: 'Collaborator added to plan',
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    }
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Permission saved by enforcer, no need to save again

  // Create activity records for BOTH users:
  // 1. Activity for the owner who added the collaborator
  // 2. Activity for the collaborator who was added
  // Also send an email asynchronously (do not block the API response on email success).
  try {
    // Fetch target user and experience details for the activity and email
    const [targetUser, experienceDoc] = await Promise.all([
      User.findById(userId).select('name email').lean(),
      Experience.findById(plan.experience).populate('destination', 'name').select('name destination').lean()
    ]);

    const ownerInfo = {
      _id: req.user._id,
      email: req.user.email || null,
      name: req.user.name || null,
      role: req.user.role || null
    };

    const collaboratorInfo = {
      _id: targetUser?._id || userId,
      email: targetUser?.email || null,
      name: targetUser?.name || null,
      role: 'regular_user'
    };

    const resourceLink = `/experiences/${experienceDoc?._id || plan.experience}#plan-${plan._id}`;

    // Activity 1: For the owner (shows "Added [user] as collaborator to [experience]")
    // Use allowed action enum values from Activity model ('permission_added' or 'collaborator_added')
    const ownerActivityData = {
      timestamp: new Date(),
      action: 'permission_added',
      actor: ownerInfo,
      resource: {
        id: plan._id,
        type: 'Plan',
        name: experienceDoc?.name || ''
      },
      target: {
        id: targetUser?._id || userId,
        type: 'User',
        name: targetUser?.name || ''
      },
      previousState: null,
      newState: {
        permissions: plan.permissions
      },
      reason: `Added ${targetUser?.name || 'a user'} as a collaborator to ${experienceDoc?.name || 'an experience'}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method,
        resourceLink
      },
      tags: ['collaboration', 'permission_grant'],
      status: 'success'
    };

    // Activity 2: For the collaborator (shows "You were added as a collaborator to [experience]")
    const collaboratorActivityData = {
      timestamp: new Date(),
      action: 'collaborator_added',
      actor: collaboratorInfo, // Actor is the collaborator so it shows in their feed
      resource: {
        id: plan._id,
        type: 'Plan',
        name: experienceDoc?.name || ''
      },
      target: {
        id: req.user._id,
        type: 'User',
        name: req.user.name || ''
      },
      previousState: null,
      newState: {
        permissions: plan.permissions
      },
      reason: `You were added as a collaborator to ${experienceDoc?.name || 'an experience'} by ${req.user.name || 'someone'}`,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestPath: req.path,
        requestMethod: req.method,
        resourceLink
      },
      tags: ['collaboration', 'permission_received', 'notification'],
      status: 'success'
    };

    // Log both activities
    backendLogger.info('Creating collaborator activities', {
      ownerActorId: ownerActivityData.actor._id.toString(),
      collaboratorActorId: collaboratorActivityData.actor._id.toString(),
      ownerAction: ownerActivityData.action,
      collaboratorAction: collaboratorActivityData.action
    });

    const [ownerLogResult, collaboratorLogResult] = await Promise.all([
      Activity.log(ownerActivityData),
      Activity.log(collaboratorActivityData)
    ]);

    if (!ownerLogResult.success) {
      backendLogger.error('Failed to log owner collaborator activity', { error: ownerLogResult.error, planId: plan._id, userId });
    } else {
      backendLogger.info('Logged owner collaborator activity', {
        activityId: ownerLogResult.activity._id,
        actorId: ownerLogResult.activity.actor._id.toString(),
        action: ownerLogResult.activity.action,
        timestamp: ownerLogResult.activity.timestamp,
        planId: plan._id,
        userId
      });
    }

    if (!collaboratorLogResult.success) {
      backendLogger.error('Failed to log collaborator activity', { error: collaboratorLogResult.error, planId: plan._id, userId });
    } else {
      backendLogger.info('Logged collaborator activity', {
        activityId: collaboratorLogResult.activity._id,
        actorId: collaboratorLogResult.activity.actor._id.toString(),
        action: collaboratorLogResult.activity.action,
        timestamp: collaboratorLogResult.activity.timestamp,
        planId: plan._id,
        userId
      });
    }

    // Send email asynchronously — do not await so API response is fast.
    (async () => {
      try {
        if (targetUser && targetUser.email) {
          const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
          const signupUrl = `${frontendBase}/experiences/${experienceDoc?._id || plan.experience}`;

          await sendCollaboratorInviteEmail({
            toEmail: targetUser.email,
            inviterName: req.user.name || 'A user',
            experienceName: experienceDoc?.name || '',
            destinationName: experienceDoc?.destination?.name || '',
            signupUrl
          });

          backendLogger.info('Collaborator invite email sent (async)', { to: targetUser.email, userId, planId: plan._id });
        } else {
          backendLogger.warn('No email address for collaborator; skipping invite email', { userId });
        }
      } catch (emailErr) {
        backendLogger.error('Failed to send collaborator invite email', { error: emailErr?.message, userId });
      }
    })();
  } catch (activityErr) {
    backendLogger.error('Error while creating collaborator activity or preparing email', { error: activityErr?.message, userId });
  }

  const updatedPlan = await Plan.findById(plan._id)
    .populate('experience', 'name photos default_photo_id')
    .populate({
      path: 'user',
      select: 'name email photos default_photo_id',
      populate: {
        path: 'photos',
        select: 'url caption'
      }
    });

  res.json(updatedPlan);
});

/**
 * Remove a collaborator from a plan
 */
const removeCollaborator = asyncHandler(async (req, res) => {
  const { id, userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Only owner can remove collaborators
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  try {
    if (plan.user && plan.user.toString() === req.user._id.toString()) {
      backendLogger.debug('Remove collaborator: short-circuit owner check passed', {
        planId: plan._id.toString(),
        ownerId: plan.user.toString(),
        actorId: req.user._id.toString()
      });
    } else {
      const permCheck = await enforcer.canManagePermissions({
        userId: req.user._id,
        resource: plan
      });

      if (!permCheck.allowed) {
        return res.status(403).json({
          error: "Only the plan owner can remove collaborators",
          message: permCheck.reason
        });
      }
    }
  } catch (err) {
    backendLogger.error('Error checking permissions for removeCollaborator', { error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Error checking permissions' });
  }

  // Remove collaborator using enforcer (SECURE)
  const result = await enforcer.removePermission({
    resource: plan,
    permissionId: userId,
    entityType: 'user',
    actorId: req.user._id,
    reason: 'Collaborator removed from plan',
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    }
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  await plan.save();

  res.json({ message: "Collaborator removed successfully" });
});

/**
 * Update a specific plan item within a plan
 * Accepts: complete, cost, planning_days, text, url, activity_type, location, lat, lng, address,
 *          scheduled_date, scheduled_time
 */
const updatePlanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const {
    complete, cost, planning_days, text, url, activity_type,
    location, lat, lng, address, scheduled_date, scheduled_time
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Debug logging for permissions
  backendLogger.info('COLLAB_DEBUG: Plan permissions check', {
    planId: id,
    userId: req.user._id.toString(),
    planOwnerId: plan.user?.toString ? plan.user.toString() : plan.user,
    permissionsCount: plan.permissions?.length || 0,
    permissions: plan.permissions?.map(p => ({
      _id: p._id?.toString ? p._id.toString() : p._id,
      entity: p.entity,
      type: p.type
    }))
  });

  // Check permissions - must be owner or collaborator
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  backendLogger.info('COLLAB_DEBUG: Permission check result', {
    planId: id,
    userId: req.user._id.toString(),
    allowed: permCheck.allowed,
    reason: permCheck.reason,
    role: permCheck.role
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: "Insufficient permissions to edit this plan",
      message: permCheck.reason
    });
  }

  // Find and update the plan item
  const planItem = plan.plan.id(itemId);

  if (!planItem) {
    return res.status(404).json({ error: "Plan item not found" });
  }

  // Track completion status change if it's being updated
  const wasComplete = planItem.complete;
  const willBeComplete = complete !== undefined ? complete : wasComplete;

  // If the request only updates allowable scalar item fields, perform an atomic
  // positional update to avoid validating other unrelated nested fields
  // (such as optional GeoJSON coordinates) which can cause validation failures.
  const requestedKeys = Object.keys(req.body || {}).filter(k => k);
  const allowedScalarKeys = ['complete', 'cost', 'planning_days', 'text', 'url', 'activity_type', 'scheduled_date', 'scheduled_time'];
  const locationKeys = ['location', 'lat', 'lng', 'address'];
  const allAllowedKeys = [...allowedScalarKeys, ...locationKeys];
  const onlyAllowed = requestedKeys.length > 0 && requestedKeys.every(k => allAllowedKeys.includes(k));

  if (onlyAllowed) {
    // Build $set object for atomic positional update
    const setObj = {};
    if (complete !== undefined) setObj['plan.$.complete'] = complete;
    if (cost !== undefined) setObj['plan.$.cost'] = cost;
    if (planning_days !== undefined) setObj['plan.$.planning_days'] = planning_days;
    if (text !== undefined) setObj['plan.$.text'] = text;
    if (url !== undefined) setObj['plan.$.url'] = url;
    if (scheduled_date !== undefined) setObj['plan.$.scheduled_date'] = scheduled_date;
    if (scheduled_time !== undefined) setObj['plan.$.scheduled_time'] = scheduled_time;

    // Validate and set activity_type - use full list from model enum
    if (activity_type !== undefined) {
      const validActivityTypes = [
        // Essentials
        'accommodation', 'transport', 'food', 'drinks', 'coffee',
        // Experiences
        'sightseeing', 'museum', 'nature', 'adventure', 'sports', 'entertainment',
        'wellness', 'tour', 'class', 'nightlife', 'religious', 'local',
        // Services
        'shopping', 'market', 'health', 'banking', 'communication', 'admin', 'laundry', 'rental',
        // Other
        'photography', 'meeting', 'work', 'rest', 'packing', 'checkpoint', 'custom',
        // Legacy
        'activity',
        null
      ];
      setObj['plan.$.activity_type'] = validActivityTypes.includes(activity_type) ? activity_type : null;
    }

    // Process location data - accept various formats and convert to standard structure
    let locationData = null;
    const hasLocationInput = location !== undefined || address !== undefined ||
      (typeof lat === 'number' && typeof lng === 'number');

    if (hasLocationInput) {
      if (location) {
        // Full location object provided - use sanitizeLocation for validation
        locationData = sanitizeLocation(location);

        // If location object has lat/lng at top level (alternative format), handle it
        if (!locationData && typeof location.lat === 'number' && typeof location.lng === 'number') {
          locationData = sanitizeLocation({
            address: location.address,
            geo: { type: 'Point', coordinates: [location.lng, location.lat] },
            city: location.city,
            state: location.state,
            country: location.country,
            postalCode: location.postalCode,
            placeId: location.placeId
          });
        }
      } else if (address || (typeof lat === 'number' && typeof lng === 'number')) {
        // Simple address or lat/lng provided at top level
        const geoCoords = (typeof lat === 'number' && typeof lng === 'number')
          ? { type: 'Point', coordinates: [lng, lat] }
          : null;
        locationData = sanitizeLocation({
          address: address || null,
          geo: geoCoords
        });
      }
      setObj['plan.$.location'] = locationData;
    }

    // Preserve previous state for tracking
    const previousState = plan.toObject();

    // Perform atomic update using the positional $ operator
    const updatedPlan = await Plan.findOneAndUpdate(
      { _id: plan._id, 'plan._id': itemId },
      { $set: setObj },
      { new: true }
    )
    .populate('experience', 'name')
    .populate({
      path: 'user',
      select: 'name email'
    });

    // If completion changed, track it
    if (complete !== undefined && wasComplete !== willBeComplete) {
      trackPlanItemCompletion({
        resource: updatedPlan,
        resourceType: 'Plan',
        actor: req.user,
        req,
        planItemId: itemId,
        completed: willBeComplete,
        reason: `Plan item ${willBeComplete ? 'completed' : 'marked incomplete'}`
      });
    }

    // Broadcast plan item update via WebSocket
    try {
      const updatedItem = updatedPlan.plan?.find(i => i._id?.toString() === itemId?.toString());
      broadcastEvent('plan', id.toString(), {
        type: 'plan:item:updated',
        payload: {
          planId: id.toString(),
          planItemId: itemId.toString(),
          planItem: updatedItem,
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast plan item update', { error: wsErr.message });
    }

    // Explicitly convert to JSON to ensure virtuals are included
    return res.json(updatedPlan.toJSON());
  }

  // Otherwise apply changes to the in-memory document and save (runs full validation)
  if (complete !== undefined) planItem.complete = complete;
  if (cost !== undefined) planItem.cost = cost;
  if (planning_days !== undefined) planItem.planning_days = planning_days;
  if (text !== undefined) planItem.text = text;
  if (url !== undefined) planItem.url = url;
  if (scheduled_date !== undefined) planItem.scheduled_date = scheduled_date;
  if (scheduled_time !== undefined) planItem.scheduled_time = scheduled_time;

  // Validate and set activity_type - use full list from model enum
  if (activity_type !== undefined) {
    const validActivityTypes = [
      // Essentials
      'accommodation', 'transport', 'food', 'drinks', 'coffee',
      // Experiences
      'sightseeing', 'museum', 'nature', 'adventure', 'sports', 'entertainment',
      'wellness', 'tour', 'class', 'nightlife', 'religious', 'local',
      // Services
      'shopping', 'market', 'health', 'banking', 'communication', 'admin', 'laundry', 'rental',
      // Other
      'photography', 'meeting', 'work', 'rest', 'packing', 'checkpoint', 'custom',
      // Legacy
      'activity',
      null
    ];
    planItem.activity_type = validActivityTypes.includes(activity_type) ? activity_type : null;
  }

  // Process location data for in-memory update
  const hasLocationInput = location !== undefined || address !== undefined ||
    (typeof lat === 'number' && typeof lng === 'number');

  if (hasLocationInput) {
    if (location) {
      // Full location object provided
      planItem.location = {
        address: location.address || null,
        geo: null,
        city: location.city || null,
        state: location.state || null,
        country: location.country || null,
        postalCode: location.postalCode || null,
        placeId: location.placeId || null
      };
      // Handle geo coordinates from location object
      if (location.geo && location.geo.coordinates) {
        planItem.location.geo = {
          type: 'Point',
          coordinates: location.geo.coordinates
        };
      } else if (typeof location.lat === 'number' && typeof location.lng === 'number') {
        planItem.location.geo = {
          type: 'Point',
          coordinates: [location.lng, location.lat] // GeoJSON uses [lng, lat]
        };
      }
    } else if (address || (typeof lat === 'number' && typeof lng === 'number')) {
      // Simple address or lat/lng provided at top level
      planItem.location = {
        address: address || null,
        geo: null,
        city: null,
        state: null,
        country: null,
        postalCode: null,
        placeId: null
      };
      if (typeof lat === 'number' && typeof lng === 'number') {
        planItem.location.geo = {
          type: 'Point',
          coordinates: [lng, lat] // GeoJSON uses [lng, lat]
        };
      }
    }
  }

  await plan.save();

  // Track plan item completion change (non-blocking)
  backendLogger.info('Plan item update completion tracking check', {
    planId: id,
    itemId,
    completeParam: complete,
    wasComplete,
    willBeComplete,
    shouldTrack: complete !== undefined && wasComplete !== willBeComplete,
    userId: req.user._id.toString()
  });

  if (complete !== undefined && wasComplete !== willBeComplete) {
    // Populate experience for activity logging
    await plan.populate('experience', 'name');

    backendLogger.info('Calling trackPlanItemCompletion', {
      planId: plan._id.toString(),
      experienceId: plan.experience?._id?.toString(),
      experienceName: plan.experience?.name,
      planItemId: itemId,
      completed: willBeComplete,
      actorId: req.user._id.toString(),
      actorName: req.user.name
    });

    trackPlanItemCompletion({
      resource: plan,
      resourceType: 'Plan',
      actor: req.user,
      req,
      planItemId: itemId,
      completed: willBeComplete,
      reason: `Plan item ${willBeComplete ? 'completed' : 'marked incomplete'}`
    });
  }

  // Broadcast plan item update via WebSocket
  try {
    broadcastEvent('plan', id.toString(), {
      type: 'plan:item:updated',
      payload: {
        planId: id.toString(),
        planItemId: itemId.toString(),
        planItem: planItem,
        userId: req.user._id.toString()
      }
    }, req.user._id.toString());
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast plan item update', { error: wsErr.message });
  }

  // Explicitly convert to JSON to ensure virtuals are included
  res.json(plan.toJSON());
});

/**
 * Get all collaborators for a plan
 * Returns array of user objects who are collaborators
 */
const getCollaborators = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid plan ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Check if user has permission to view (owner, collaborator, or contributor)
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canView({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: "Insufficient permissions to view this plan",
      message: permCheck.reason
    });
  }

  // Get all user collaborators (not owner, only collaborators)
  const collaboratorIds = plan.permissions
    .filter(p => p.entity === 'user' && p.type === 'collaborator')
    .map(p => p._id);

  if (collaboratorIds.length === 0) {
    return res.json([]);
  }

  // Fetch user details
  const collaborators = await User.find({ 
    _id: { $in: collaboratorIds } 
  }).select('_id name email photo photos default_photo_id');

  res.json(collaborators);
});

/**
 * Add a new plan item to a plan
 * Allows plan owners and collaborators to add items
 * Accepts location.address and location.geo (or lat/lng) and converts to GeoJSON
 */
const addPlanItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text, url, cost, planning_days, parent, photo, activity_type, location, lat, lng, address, plan_item_id } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid plan ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Check permissions - must be owner or collaborator
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: "Insufficient permissions to edit this plan",
      message: permCheck.reason
    });
  }

  // Process location data - accept various formats and convert to standard structure with validation
  let locationData = null;
  if (location) {
    // Full location object provided - use sanitizeLocation for validation
    locationData = sanitizeLocation(location);

    // If location object has lat/lng at top level (alternative format), handle it
    if (!locationData && typeof location.lat === 'number' && typeof location.lng === 'number') {
      locationData = sanitizeLocation({
        address: location.address,
        geo: { type: 'Point', coordinates: [location.lng, location.lat] },
        city: location.city,
        state: location.state,
        country: location.country,
        postalCode: location.postalCode,
        placeId: location.placeId
      });
    }
  } else if (address || (typeof lat === 'number' && typeof lng === 'number')) {
    // Simple address or lat/lng provided at top level
    const geoCoords = (typeof lat === 'number' && typeof lng === 'number')
      ? { type: 'Point', coordinates: [lng, lat] }
      : null;
    locationData = sanitizeLocation({
      address: address || null,
      geo: geoCoords
    });
  }

  // Validate activity_type if provided - use full list from model enum
  const validActivityTypes = [
    // Essentials
    'accommodation', 'transport', 'food', 'drinks', 'coffee',
    // Experiences
    'sightseeing', 'museum', 'nature', 'adventure', 'sports', 'entertainment',
    'wellness', 'tour', 'class', 'nightlife', 'religious', 'local',
    // Services
    'shopping', 'market', 'health', 'banking', 'communication', 'admin', 'laundry', 'rental',
    // Other
    'photography', 'meeting', 'work', 'rest', 'packing', 'checkpoint', 'custom',
    // Legacy
    'activity',
    null
  ];
  const resolvedActivityType = activity_type && validActivityTypes.includes(activity_type) ? activity_type : null;

  // Create new plan item (Mongoose will auto-generate _id)
  const newPlanItem = {
    plan_item_id: plan_item_id || new mongoose.Types.ObjectId(), // Use provided or generate new
    text,
    url,
    cost: cost || 0,
    planning_days: planning_days || 0,
    complete: false,
    parent: parent || null,
    photo: photo || null,
    activity_type: resolvedActivityType,
    location: locationData
  };

  plan.plan.push(newPlanItem);
  await plan.save();

  res.json(plan);
});

/**
 * Delete a plan item from a plan
 * Allows plan owners and collaborators to delete items
 * Also deletes any child items
 */
const deletePlanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Check permissions - must be owner or collaborator
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: "Insufficient permissions to edit this plan",
      message: permCheck.reason
    });
  }

  // Find the item to delete
  const itemToDelete = plan.plan.id(itemId);
  if (!itemToDelete) {
    return res.status(404).json({ error: "Plan item not found" });
  }

  // Get the plan_item_id to find children
  const parentPlanItemId = itemToDelete.plan_item_id || itemToDelete._id;

  // Remove the item
  plan.plan.pull(itemId);

  // Remove any children (items with this item as parent)
  plan.plan = plan.plan.filter(item =>
    !item.parent || item.parent.toString() !== parentPlanItemId.toString()
  );

  await plan.save();

  // Broadcast plan item deletion via WebSocket
  try {
    broadcastEvent('plan', id.toString(), {
      type: 'plan:item:deleted',
      payload: {
        planId: id.toString(),
        planItemId: itemId.toString(),
        userId: req.user._id.toString()
      }
    }, req.user._id.toString());
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast plan item deletion', { error: wsErr.message });
  }

  res.json(plan);
});

/**
 * Reorder plan items
 * Updates the order of plan items in the plan array
 */
const reorderPlanItems = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { plan: reorderedItems } = req.body;

  backendLogger.debug('Plan items reorder request received', {
    planId: id,
    itemCount: reorderedItems?.length,
    userId: req.user?._id?.toString()
  });

  // Validate plan ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    backendLogger.warn('Invalid plan ID format', { planId: id });
    return res.status(400).json({ error: "Invalid plan ID" });
  }

  // Validate reorderedItems
  if (!Array.isArray(reorderedItems)) {
    backendLogger.warn('Invalid plan items format - not an array', {
      planId: id,
      receivedType: typeof reorderedItems
    });
    return res.status(400).json({ error: "Plan items must be an array" });
  }

  // Find the plan
  const plan = await Plan.findById(id);

  if (!plan) {
    backendLogger.warn('Plan not found', { planId: id });
    return res.status(404).json({ error: "Plan not found" });
  }

  // Check permissions - must be owner or collaborator
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    backendLogger.warn('Insufficient permissions to reorder plan items', {
      planId: id,
      userId: req.user._id.toString(),
      reason: permCheck.reason
    });
    return res.status(403).json({
      error: "Insufficient permissions to reorder this plan",
      message: permCheck.reason
    });
  }

  // Validate that reordered items match existing items
  const existingIds = new Set(plan.plan.map(item => item._id.toString()));
  const reorderedIds = new Set(reorderedItems.map(item =>
    (item._id || item.plan_item_id).toString()
  ));

  // Check if all existing items are in reordered array
  if (existingIds.size !== reorderedIds.size) {
    backendLogger.warn('Reordered items count mismatch', {
      planId: id,
      existingCount: existingIds.size,
      reorderedCount: reorderedIds.size
    });
    return res.status(400).json({
      error: "Item count mismatch",
      message: "Reordered items must match existing items"
    });
  }

  // Check if all IDs match
  for (const id of existingIds) {
    if (!reorderedIds.has(id)) {
      backendLogger.warn('Reordered items contain unknown ID', {
        planId: id,
        unknownId: id
      });
      return res.status(400).json({
        error: "Invalid item ID",
        message: "Reordered items contain IDs not in original plan"
      });
    }
  }

  // Update the plan with reordered items
  plan.plan = reorderedItems;
  await plan.save();

  backendLogger.info('Plan items reordered successfully', {
    planId: id,
    itemCount: reorderedItems.length,
    userId: req.user._id.toString()
  });

  // Broadcast plan items reorder via WebSocket
  try {
    broadcastEvent('plan', id.toString(), {
      type: 'plan:item:reordered',
      payload: {
        planId: id.toString(),
        planItems: reorderedItems,
        userId: req.user._id.toString()
      }
    }, req.user._id.toString());
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast plan items reorder', { error: wsErr.message });
  }

  // Populate experience for response
  await plan.populate('experience');

  res.json(plan);
});

/**
 * Add a note to a plan item
 * Only owner, collaborators, and super admins can add notes
 * @param {string} visibility - 'private' (creator only) or 'contributors' (all collaborators)
 */
const addPlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { content, visibility = 'contributors' } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' });
  }

  // Validate visibility
  const validVisibility = ['private', 'contributors'];
  if (!validVisibility.includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility value. Must be "private" or "contributors"' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check: owner, collaborator, or super admin
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  // Find the plan item
  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  // Initialize details if not exists
  if (!planItem.details) {
    planItem.details = {
      notes: [],
      location: null,
      chat: [],
      photos: [],
      documents: []
    };
  }

  // Add note with visibility
  planItem.details.notes.push({
    user: req.user._id,
    content: content.trim(),
    visibility
  });

  await plan.save();

  // Populate user data for response (include photo fields for avatar display)
  await plan.populate({
    path: 'plan.details.notes.user',
    select: 'name email photos default_photo_id oauthProfilePhoto',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  });
  await plan.populate('experience', 'name');

  backendLogger.info('Note added to plan item', {
    planId: id,
    itemId,
    userId: req.user._id.toString(),
    noteCount: planItem.details.notes.length
  });

  // Log activity for note addition
  const addedNote = planItem.details.notes[planItem.details.notes.length - 1];

  // Get plan item name - prioritize snapshot text (what user actually has in their plan)
  // Only fall back to experience's plan_items if snapshot is completely empty (legacy data)
  // This avoids showing unfamiliar text if the original item was modified after planning
  let planItemName = planItem.text;
  if (!planItemName && planItem.plan_item_id && plan.experience?.plan_items) {
    const originalItem = plan.experience.plan_items.find(i =>
      i._id.toString() === planItem.plan_item_id.toString()
    );
    if (originalItem?.text) {
      planItemName = originalItem.text;
      backendLogger.debug('Note add: Plan item name resolved from experience (snapshot was empty)', {
        planItemId: planItem._id?.toString(),
        originalItemId: planItem.plan_item_id?.toString(),
        resolvedName: planItemName
      });
    }
  }
  planItemName = planItemName || 'Unnamed item';

  await Activity.log({
    action: 'plan_item_note_added',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemName
    },
    reason: `Added note to plan item "${planItemName}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    },
    newState: {
      noteId: addedNote._id,
      content: addedNote.content.substring(0, 100), // Store first 100 chars for preview
      noteCount: planItem.details.notes.length
    }
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Update a note on a plan item
 * Only the note author can update their own note
 * @param {string} visibility - 'private' (creator only) or 'contributors' (all collaborators)
 */
const updatePlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId, noteId } = req.params;
  const { content, visibility } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' });
  }

  // Validate visibility if provided
  if (visibility !== undefined) {
    const validVisibility = ['private', 'contributors'];
    if (!validVisibility.includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value. Must be "private" or "contributors"' });
    }
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  if (!planItem.details || !planItem.details.notes) {
    return res.status(404).json({ error: 'No notes found' });
  }

  const note = planItem.details.notes.id(noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  // Only the note author can update
  if (note.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'You can only update your own notes'
    });
  }

  note.content = content.trim();
  if (visibility !== undefined) {
    note.visibility = visibility;
  }
  await plan.save();

  // Populate user data for response (include photo fields for avatar display)
  await plan.populate({
    path: 'plan.details.notes.user',
    select: 'name email photos default_photo_id oauthProfilePhoto',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  });
  await plan.populate('experience', 'name');

  backendLogger.info('Note updated on plan item', {
    planId: id,
    itemId,
    noteId,
    userId: req.user._id.toString()
  });

  // Get plan item name - prioritize snapshot text (what user actually has in their plan)
  // Only fall back to experience's plan_items if snapshot is completely empty (legacy data)
  let planItemNameForUpdate = planItem.text;
  if (!planItemNameForUpdate && planItem.plan_item_id && plan.experience?.plan_items) {
    const originalItem = plan.experience.plan_items.find(i =>
      i._id.toString() === planItem.plan_item_id.toString()
    );
    if (originalItem?.text) {
      planItemNameForUpdate = originalItem.text;
      backendLogger.debug('Note update: Plan item name resolved from experience (snapshot was empty)', {
        planItemId: planItem._id?.toString(),
        originalItemId: planItem.plan_item_id?.toString(),
        resolvedName: planItemNameForUpdate
      });
    }
  }
  planItemNameForUpdate = planItemNameForUpdate || 'Unnamed item';

  // Log activity for note update
  await Activity.log({
    action: 'plan_item_note_updated',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemNameForUpdate
    },
    reason: `Updated note on plan item "${planItemNameForUpdate}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    },
    newState: {
      noteId: note._id,
      content: note.content.substring(0, 100) // Store first 100 chars for preview
    }
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Delete a note from a plan item
 * Only the note author can delete their own note
 */
const deletePlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId, noteId } = req.params;

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  if (!planItem.details || !planItem.details.notes) {
    return res.status(404).json({ error: 'No notes found' });
  }

  const note = planItem.details.notes.id(noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  // Only the note author can delete
  if (note.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'You can only delete your own notes'
    });
  }

  // Capture note content before deletion for activity log
  const deletedNoteContent = note.content;

  // Get plan item name - prioritize snapshot text (what user actually has in their plan)
  // Only fall back to experience's plan_items if snapshot is completely empty (legacy data)
  let planItemName = planItem.text;
  if (!planItemName && planItem.plan_item_id && plan.experience?.plan_items) {
    const originalItem = plan.experience.plan_items.find(i =>
      i._id.toString() === planItem.plan_item_id.toString()
    );
    if (originalItem?.text) {
      planItemName = originalItem.text;
      backendLogger.debug('Note delete: Plan item name resolved from experience (snapshot was empty)', {
        planItemId: planItem._id?.toString(),
        originalItemId: planItem.plan_item_id?.toString(),
        resolvedName: planItemName
      });
    }
  }
  planItemName = planItemName || 'Unnamed item';

  planItem.details.notes.pull(noteId);
  await plan.save();

  // Populate user data for response (include photo fields for avatar display)
  await plan.populate({
    path: 'plan.details.notes.user',
    select: 'name email photos default_photo_id oauthProfilePhoto',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  });
  await plan.populate('experience', 'name');

  backendLogger.info('Note deleted from plan item', {
    planId: id,
    itemId,
    noteId,
    userId: req.user._id.toString()
  });

  // Log activity for note deletion
  await Activity.log({
    action: 'plan_item_note_deleted',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemName
    },
    reason: `Deleted note from plan item "${planItemName}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    },
    previousState: {
      noteId: noteId,
      content: deletedNoteContent.substring(0, 100) // Store first 100 chars for preview
    }
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

// ============================================================================
// PLAN ITEM DETAILS (Transport, Parking, Discount, Documents, Photos)
// ============================================================================

/**
 * Valid detail types that can be added/updated/deleted
 * These map to the details subdocument fields in planItemSnapshotSchema
 */
const VALID_DETAIL_TYPES = ['transport', 'parking', 'discount', 'documents', 'photos'];

/**
 * Add a detail to a plan item
 * Handles transport, parking, discount, documents, and photos
 * @param {string} type - Type of detail: 'transport', 'parking', 'discount', 'documents', 'photos'
 * @param {object} data - Detail-specific data
 */
const addPlanItemDetail = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { type, data } = req.body;

  if (!type || !VALID_DETAIL_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Invalid detail type',
      message: `Type must be one of: ${VALID_DETAIL_TYPES.join(', ')}`
    });
  }

  if (!data) {
    return res.status(400).json({ error: 'Detail data is required' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check: owner, collaborator, or super admin
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  // Find the plan item
  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  // Initialize details if not exists
  if (!planItem.details) {
    planItem.details = {
      notes: [],
      chat: [],
      photos: [],
      documents: [],
      transport: null,
      parking: null,
      discount: null
    };
  }

  // Handle different detail types
  switch (type) {
    case 'transport':
      // Transport is a single object, not an array
      if (!data.mode) {
        return res.status(400).json({ error: 'Transport mode is required' });
      }
      planItem.details.transport = data;
      break;

    case 'parking':
      // Parking is a single object, not an array
      planItem.details.parking = data;
      break;

    case 'discount':
      // Discount is a single object, not an array
      planItem.details.discount = data;
      break;

    case 'documents':
      // Documents is an array - add new document reference
      if (!data.document) {
        return res.status(400).json({ error: 'Document ID is required' });
      }
      if (!mongoose.Types.ObjectId.isValid(data.document)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }
      planItem.details.documents.push({
        document: data.document,
        addedBy: req.user._id,
        addedAt: new Date(),
        displayName: data.displayName,
        contextNotes: data.contextNotes
      });
      break;

    case 'photos':
      // Photos is an array of ObjectIds - add new photo reference
      if (!data.photoId) {
        return res.status(400).json({ error: 'Photo ID is required' });
      }
      if (!mongoose.Types.ObjectId.isValid(data.photoId)) {
        return res.status(400).json({ error: 'Invalid photo ID' });
      }
      if (!planItem.details.photos.includes(data.photoId)) {
        planItem.details.photos.push(data.photoId);
      }
      break;
  }

  await plan.save();

  // Populate necessary fields for response
  await plan.populate('experience', 'name');
  if (type === 'documents') {
    await plan.populate({
      path: 'plan.details.documents.document',
      select: 'originalFilename mimeType s3Key status'
    });
    await plan.populate({
      path: 'plan.details.documents.addedBy',
      select: 'name email'
    });
  }
  if (type === 'photos') {
    await plan.populate({
      path: 'plan.details.photos',
      select: 'url caption'
    });
  }

  backendLogger.info('Detail added to plan item', {
    planId: id,
    itemId,
    detailType: type,
    userId: req.user._id.toString()
  });

  // Log activity
  const planItemName = planItem.text || 'Unnamed item';
  await Activity.log({
    action: 'plan_item_detail_added',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemName
    },
    reason: `Added ${type} detail to plan item "${planItemName}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method,
      detailType: type
    }
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.status(201).json(plan);
});

/**
 * Update a detail on a plan item
 * For single-object types (transport, parking, discount): updates the object
 * For array types (documents): updates specific entry by detailId
 */
const updatePlanItemDetail = asyncHandler(async (req, res) => {
  const { id, itemId, detailId } = req.params;
  const { type, data } = req.body;

  if (!type || !VALID_DETAIL_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Invalid detail type',
      message: `Type must be one of: ${VALID_DETAIL_TYPES.join(', ')}`
    });
  }

  if (!data) {
    return res.status(400).json({ error: 'Detail data is required' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  if (!planItem.details) {
    return res.status(404).json({ error: 'No details found on this plan item' });
  }

  // Handle different detail types
  switch (type) {
    case 'transport':
      if (!planItem.details.transport) {
        return res.status(404).json({ error: 'Transport detail not found' });
      }
      // Merge updates into existing transport
      Object.assign(planItem.details.transport, data);
      break;

    case 'parking':
      if (!planItem.details.parking) {
        return res.status(404).json({ error: 'Parking detail not found' });
      }
      Object.assign(planItem.details.parking, data);
      break;

    case 'discount':
      if (!planItem.details.discount) {
        return res.status(404).json({ error: 'Discount detail not found' });
      }
      Object.assign(planItem.details.discount, data);
      break;

    case 'documents':
      // Update specific document entry by detailId
      if (!detailId) {
        return res.status(400).json({ error: 'Detail ID required for updating documents' });
      }
      const docEntry = planItem.details.documents.id(detailId);
      if (!docEntry) {
        return res.status(404).json({ error: 'Document entry not found' });
      }
      if (data.displayName !== undefined) docEntry.displayName = data.displayName;
      if (data.contextNotes !== undefined) docEntry.contextNotes = data.contextNotes;
      break;

    case 'photos':
      // Photos are just ObjectIds - can't really "update" them, only add/remove
      return res.status(400).json({ error: 'Photos cannot be updated, only added or removed' });
  }

  await plan.save();

  // Populate for response
  await plan.populate('experience', 'name');
  if (type === 'documents') {
    await plan.populate({
      path: 'plan.details.documents.document',
      select: 'originalFilename mimeType s3Key status'
    });
    await plan.populate({
      path: 'plan.details.documents.addedBy',
      select: 'name email'
    });
  }

  backendLogger.info('Detail updated on plan item', {
    planId: id,
    itemId,
    detailId,
    detailType: type,
    userId: req.user._id.toString()
  });

  // Log activity
  const planItemName = planItem.text || 'Unnamed item';
  await Activity.log({
    action: 'plan_item_detail_updated',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemName
    },
    reason: `Updated ${type} detail on plan item "${planItemName}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method,
      detailType: type,
      detailId
    }
  });

  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Delete a detail from a plan item
 * For single-object types: sets to null
 * For array types: removes specific entry
 */
const deletePlanItemDetail = asyncHandler(async (req, res) => {
  const { id, itemId, detailId } = req.params;
  const { type } = req.body;

  if (!type || !VALID_DETAIL_TYPES.includes(type)) {
    return res.status(400).json({
      error: 'Invalid detail type',
      message: `Type must be one of: ${VALID_DETAIL_TYPES.join(', ')}`
    });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  if (!planItem.details) {
    return res.status(404).json({ error: 'No details found on this plan item' });
  }

  // Handle different detail types
  switch (type) {
    case 'transport':
      planItem.details.transport = null;
      break;

    case 'parking':
      planItem.details.parking = null;
      break;

    case 'discount':
      planItem.details.discount = null;
      break;

    case 'documents':
      if (!detailId) {
        return res.status(400).json({ error: 'Detail ID required for deleting documents' });
      }
      const docEntry = planItem.details.documents.id(detailId);
      if (!docEntry) {
        return res.status(404).json({ error: 'Document entry not found' });
      }
      planItem.details.documents.pull(detailId);
      break;

    case 'photos':
      if (!detailId) {
        return res.status(400).json({ error: 'Photo ID required for removing photos' });
      }
      const photoIndex = planItem.details.photos.findIndex(
        p => p.toString() === detailId
      );
      if (photoIndex === -1) {
        return res.status(404).json({ error: 'Photo not found in plan item' });
      }
      planItem.details.photos.splice(photoIndex, 1);
      break;
  }

  await plan.save();

  await plan.populate('experience', 'name');

  backendLogger.info('Detail deleted from plan item', {
    planId: id,
    itemId,
    detailId,
    detailType: type,
    userId: req.user._id.toString()
  });

  // Log activity
  const planItemName = planItem.text || 'Unnamed item';
  await Activity.log({
    action: 'plan_item_detail_deleted',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemName
    },
    reason: `Deleted ${type} detail from plan item "${planItemName}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method,
      detailType: type,
      detailId
    }
  });

  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Assign a plan item to a collaborator or owner
 * Only owner, collaborators, and super admins can assign items
 */
const assignPlanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return res.status(400).json({ error: 'assignedTo user ID is required' });
  }

  if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check: owner, collaborator, or super admin
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  // Diagnostic logging: plan permissions and assigned user's role
  backendLogger.info('ASSIGN_PLAN_ITEM_DEBUG: Plan details', {
    planId: plan._id.toString(),
    planUser: plan.user.toString(),
    experienceId: plan.experience.toString(),
    permissionsCount: plan.permissions?.length || 0,
    permissions: plan.permissions?.map(p => ({
      _id: p._id.toString(),
      entity: p.entity,
      type: p.type
    })),
    assignedTo,
    assignedBy: req.user._id.toString()
  });

  if (!permCheck.allowed) {
    backendLogger.warn('ASSIGN_PLAN_ITEM_DEBUG: Requesting user lacks permission', {
      userId: req.user._id.toString(),
      reason: permCheck.reason
    });
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  // Verify assignedTo user exists and has permission on plan
  const assignedUser = await User.findById(assignedTo);
  if (!assignedUser) {
    backendLogger.warn('ASSIGN_PLAN_ITEM_DEBUG: Assigned user not found', { assignedTo });
    return res.status(404).json({ error: 'Assigned user not found' });
  }

  // Verify assignedTo user is owner or collaborator
  // Use hasPermission() instead of canEdit() to skip email verification check
  // Email verification is for content creation, not for being assigned to tasks
  const assignedUserPermCheck = await enforcer.hasPermission({
    userId: assignedTo,
    resource: plan
  });

  backendLogger.info('ASSIGN_PLAN_ITEM_DEBUG: Assigned user permission check', {
    assignedTo,
    assignedToString: assignedTo.toString(),
    allowed: assignedUserPermCheck.allowed,
    reason: assignedUserPermCheck.reason,
    role: assignedUserPermCheck.role,
    fullCheck: assignedUserPermCheck
  });

  if (!assignedUserPermCheck.allowed) {
    backendLogger.warn('ASSIGN_PLAN_ITEM_DEBUG: Assigned user lacks permission', {
      assignedTo,
      reason: assignedUserPermCheck.reason
    });
    return res.status(403).json({
      error: 'Cannot assign to user',
      message: 'User must be owner or collaborator to be assigned plan items',
      debug: {
        permissions: plan.permissions,
        assignedTo,
        assignedUserPermCheck
      }
    });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  planItem.assignedTo = assignedTo;
  await plan.save();

  await plan.populate('plan.assignedTo', 'name email');
  await plan.populate('experience', 'name');

  backendLogger.info('Plan item assigned', {
    planId: id,
    itemId,
    assignedTo,
    assignedBy: req.user._id.toString()
  });

  res.json(plan);
});

/**
 * Unassign a plan item
 * Only owner, collaborators, and super admins can unassign items
 */
const unassignPlanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check: owner, collaborator, or super admin
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  planItem.assignedTo = null;
  await plan.save();

  await plan.populate('experience', 'name');

  backendLogger.info('Plan item unassigned', {
    planId: id,
    itemId,
    unassignedBy: req.user._id.toString()
  });

  res.json(plan);
});

// ============================================
// COST MANAGEMENT ENDPOINTS
// ============================================

/**
 * Add a cost entry to a plan
 * Only owner and collaborators can add costs
 */
const addCost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, cost, currency, category, date, plan_item, collaborator } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Cost title is required' });
  }

  if (cost === undefined || cost === null || isNaN(Number(cost))) {
    return res.status(400).json({ error: 'Valid cost amount is required' });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  // Validate plan_item exists in plan if provided
  if (plan_item) {
    if (!mongoose.Types.ObjectId.isValid(plan_item)) {
      return res.status(400).json({ error: 'Invalid plan item ID' });
    }
    const itemExists = plan.plan.some(item => item._id.toString() === plan_item.toString());
    if (!itemExists) {
      return res.status(400).json({ error: 'Plan item not found in this plan' });
    }
  }

  // Validate collaborator is a member of the plan if provided (using inherited permissions)
  if (collaborator) {
    if (!mongoose.Types.ObjectId.isValid(collaborator)) {
      return res.status(400).json({ error: 'Invalid collaborator ID' });
    }
    const isMember = await isPlanMember(plan, collaborator);
    if (!isMember) {
      return res.status(400).json({ error: 'Collaborator must be a member of this plan' });
    }
  }

  // Validate category if provided
  const validCategories = ['accommodation', 'transport', 'food', 'activities', 'equipment', 'other'];
  if (category && !validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const newCost = {
    title: title.trim(),
    description: description?.trim() || '',
    cost: Number(cost),
    currency: currency || 'USD',
    category: category || null,
    date: date ? new Date(date) : new Date(),
    plan_item: plan_item || null,
    plan: plan._id,
    collaborator: collaborator || null,
    created_at: new Date()
  };

  plan.costs.push(newCost);
  await plan.save();

  // Populate for response
  await plan.populate('experience', 'name');
  await plan.populate('costs.collaborator', 'name email');
  await plan.populate('user', 'name email');

  // Get the newly added cost (last one in the array) with its generated _id
  const addedCost = plan.costs[plan.costs.length - 1];

  // Get the plan item if one is specified
  let planItem = null;
  if (plan_item) {
    planItem = plan.plan.find(item => item._id.toString() === plan_item.toString());
  }

  // Gather all collaborators (owner + permission holders) for activity tracking
  const collaboratorIds = [
    plan.user._id || plan.user, // Plan owner
    ...plan.permissions
      .filter(p => p.entity === 'user' && (p.type === 'owner' || p.type === 'collaborator'))
      .map(p => p._id)
  ];

  // Remove duplicates and fetch user details
  const uniqueCollaboratorIds = [...new Set(collaboratorIds.map(id => id.toString()))];
  const collaborators = await User.find(
    { _id: { $in: uniqueCollaboratorIds } },
    { _id: 1, name: 1, email: 1 }
  ).lean();

  // Track the cost addition activity
  trackCostAdded({
    plan,
    cost: addedCost,
    planItem,
    actor: req.user,
    collaborators,
    req
  });

  backendLogger.info('Cost added to plan', {
    planId: id,
    costTitle: title,
    costAmount: cost,
    collaborator: collaborator || 'shared',
    planItem: plan_item || 'general',
    addedBy: req.user._id.toString()
  });

  res.status(201).json(plan);
});

/**
 * Get all costs for a plan with optional filters
 * Filters: collaborator, plan_item, dateFrom, dateTo
 */
const getCosts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { collaborator, plan_item, dateFrom, dateTo } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }

  const plan = await Plan.findById(id)
    .populate('costs.collaborator', 'name email photos default_photo_id')
    .populate('experience', 'name');

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canView({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  let costs = plan.costs || [];

  // Apply filters
  if (collaborator) {
    if (collaborator === 'shared') {
      costs = costs.filter(c => !c.collaborator);
    } else if (mongoose.Types.ObjectId.isValid(collaborator)) {
      costs = costs.filter(c => c.collaborator && c.collaborator._id.toString() === collaborator);
    }
  }

  if (plan_item) {
    if (plan_item === 'general') {
      costs = costs.filter(c => !c.plan_item);
    } else if (mongoose.Types.ObjectId.isValid(plan_item)) {
      costs = costs.filter(c => c.plan_item && c.plan_item.toString() === plan_item);
    }
  }

  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    if (!isNaN(fromDate.getTime())) {
      costs = costs.filter(c => new Date(c.created_at) >= fromDate);
    }
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    if (!isNaN(toDate.getTime())) {
      costs = costs.filter(c => new Date(c.created_at) <= toDate);
    }
  }

  res.json(costs);
});

/**
 * Update a cost entry
 * Only cost creator or plan owner can update
 */
const updateCost = asyncHandler(async (req, res) => {
  const { id, costId } = req.params;
  const { title, description, cost, currency, category, date, plan_item, collaborator } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(costId)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const costEntry = plan.costs.id(costId);
  if (!costEntry) {
    return res.status(404).json({ error: 'Cost not found' });
  }

  // Permission check - must be plan owner or collaborator
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  // Update fields if provided
  if (title !== undefined) costEntry.title = title.trim();
  if (description !== undefined) costEntry.description = description?.trim() || '';
  if (cost !== undefined) {
    if (isNaN(Number(cost))) {
      return res.status(400).json({ error: 'Invalid cost amount' });
    }
    costEntry.cost = Number(cost);
  }
  if (currency !== undefined) costEntry.currency = currency;

  // Validate and update category if provided
  if (category !== undefined) {
    if (category === null || category === '') {
      costEntry.category = null;
    } else {
      const validCategories = ['accommodation', 'transport', 'food', 'activities', 'equipment', 'other'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      costEntry.category = category;
    }
  }

  // Update date if provided
  if (date !== undefined) {
    costEntry.date = date ? new Date(date) : new Date();
  }

  // Validate and update plan_item if provided
  if (plan_item !== undefined) {
    if (plan_item === null) {
      costEntry.plan_item = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(plan_item)) {
        return res.status(400).json({ error: 'Invalid plan item ID' });
      }
      const itemExists = plan.plan.some(item => item._id.toString() === plan_item.toString());
      if (!itemExists) {
        return res.status(400).json({ error: 'Plan item not found in this plan' });
      }
      costEntry.plan_item = plan_item;
    }
  }

  // Validate and update collaborator if provided (using inherited permissions)
  if (collaborator !== undefined) {
    if (collaborator === null) {
      costEntry.collaborator = null;
    } else {
      if (!mongoose.Types.ObjectId.isValid(collaborator)) {
        return res.status(400).json({ error: 'Invalid collaborator ID' });
      }
      const isMember = await isPlanMember(plan, collaborator);
      if (!isMember) {
        return res.status(400).json({ error: 'Collaborator must be a member of this plan' });
      }
      costEntry.collaborator = collaborator;
    }
  }

  await plan.save();

  await plan.populate('experience', 'name');
  await plan.populate('costs.collaborator', 'name email');

  backendLogger.info('Cost updated', {
    planId: id,
    costId,
    updatedBy: req.user._id.toString()
  });

  res.json(plan);
});

/**
 * Delete a cost entry
 * Only plan owner or collaborator can delete
 */
const deleteCost = asyncHandler(async (req, res) => {
  const { id, costId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(costId)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const costEntry = plan.costs.id(costId);
  if (!costEntry) {
    return res.status(404).json({ error: 'Cost not found' });
  }

  // Permission check
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  plan.costs.pull(costId);
  await plan.save();

  backendLogger.info('Cost deleted', {
    planId: id,
    costId,
    deletedBy: req.user._id.toString()
  });

  res.json({ message: 'Cost deleted successfully' });
});

/**
 * Get cost summary for a plan
 * Returns aggregated cost data:
 * - totalCost
 * - costsByCollaborator: [{ user, total, costs }]
 * - costsByPlanItem: [{ item, total, costs }]
 * - sharedCosts: { total, costs }
 * - generalCosts: { total, costs } (costs not assigned to any plan item)
 * - perPersonSplit: [{ user, individualTotal, sharedPortion, grandTotal }]
 */
const getCostSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }

  const plan = await Plan.findById(id)
    .populate('costs.collaborator', 'name email photos default_photo_id')
    .populate('user', 'name email photos default_photo_id')
    .populate('experience', 'name');

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canView({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  const costs = plan.costs || [];

  // Calculate total cost
  const totalCost = costs.reduce((sum, c) => sum + (c.cost || 0), 0);

  // Get all collaborators including owner
  const collaboratorIds = plan.permissions
    .filter(p => p.entity === 'user')
    .map(p => p._id.toString());

  // Add owner if not in permissions
  if (!collaboratorIds.includes(plan.user._id.toString())) {
    collaboratorIds.unshift(plan.user._id.toString());
  }

  // Fetch all users for display
  const allUsers = await User.find({ _id: { $in: collaboratorIds } })
    .select('name email photos default_photo_id')
    .lean();

  const userMap = {};
  allUsers.forEach(u => {
    userMap[u._id.toString()] = u;
  });

  // Costs by collaborator
  const costsByCollaborator = [];
  const collaboratorCostMap = {};

  costs.forEach(c => {
    if (c.collaborator) {
      const collabId = c.collaborator._id ? c.collaborator._id.toString() : c.collaborator.toString();
      if (!collaboratorCostMap[collabId]) {
        collaboratorCostMap[collabId] = {
          collaborator: c.collaborator._id ? c.collaborator : userMap[collabId] || { _id: collabId, name: 'Unknown' },
          total: 0,
          costs: []
        };
      }
      collaboratorCostMap[collabId].total += c.cost || 0;
      collaboratorCostMap[collabId].costs.push(c);
    }
  });

  Object.values(collaboratorCostMap).forEach(entry => {
    costsByCollaborator.push(entry);
  });

  // Costs by plan item
  const costsByPlanItem = [];
  const itemCostMap = {};

  // Create a map of plan items for reference
  const planItemMap = {};
  plan.plan.forEach(item => {
    planItemMap[item._id.toString()] = {
      _id: item._id,
      text: item.text,
      cost: item.cost,
      complete: item.complete
    };
  });

  costs.forEach(c => {
    if (c.plan_item) {
      const itemId = c.plan_item.toString();
      if (!itemCostMap[itemId]) {
        itemCostMap[itemId] = {
          item: planItemMap[itemId] || { _id: itemId, text: 'Unknown Item' },
          total: 0,
          costs: []
        };
      }
      itemCostMap[itemId].total += c.cost || 0;
      itemCostMap[itemId].costs.push(c);
    }
  });

  Object.values(itemCostMap).forEach(entry => {
    costsByPlanItem.push(entry);
  });

  // Shared costs (no collaborator assigned)
  const sharedCostsList = costs.filter(c => !c.collaborator);
  const sharedCosts = {
    total: sharedCostsList.reduce((sum, c) => sum + (c.cost || 0), 0),
    costs: sharedCostsList
  };

  // General costs (no plan item assigned)
  const generalCostsList = costs.filter(c => !c.plan_item);
  const generalCosts = {
    total: generalCostsList.reduce((sum, c) => sum + (c.cost || 0), 0),
    costs: generalCostsList
  };

  // Costs by category
  const costsByCategory = [];
  const categoryCostMap = {};
  const categoryLabels = {
    accommodation: 'Accommodation',
    transport: 'Transport',
    food: 'Food & Dining',
    activities: 'Activities',
    equipment: 'Equipment',
    other: 'Other',
    uncategorized: 'Uncategorized'
  };

  costs.forEach(c => {
    const category = c.category || 'uncategorized';
    if (!categoryCostMap[category]) {
      categoryCostMap[category] = {
        category,
        label: categoryLabels[category] || category,
        total: 0,
        costs: []
      };
    }
    categoryCostMap[category].total += c.cost || 0;
    categoryCostMap[category].costs.push(c);
  });

  // Sort by total (descending) and add to array
  Object.values(categoryCostMap)
    .sort((a, b) => b.total - a.total)
    .forEach(entry => {
      costsByCategory.push(entry);
    });

  // Per person split calculation
  const numPeople = collaboratorIds.length || 1;
  const sharedPerPerson = sharedCosts.total / numPeople;

  const perPersonSplit = collaboratorIds.map(collabId => {
    const collaborator = userMap[collabId] || { _id: collabId, name: 'Unknown' };
    const individualCosts = collaboratorCostMap[collabId];
    const individualTotal = individualCosts ? individualCosts.total : 0;

    return {
      collaborator,
      individualTotal,
      sharedPortion: sharedPerPerson,
      grandTotal: individualTotal + sharedPerPerson
    };
  });

  res.json({
    planId: plan._id,
    experienceName: plan.experience?.name || 'Unknown Experience',
    totalCost,
    costCount: costs.length,
    currency: costs[0]?.currency || 'USD',
    costsByCollaborator,
    costsByPlanItem,
    costsByCategory,
    sharedCosts,
    generalCosts,
    perPersonShare: sharedPerPerson,
    perPersonSplit,
    collaboratorCount: numPeople
  });
});

// ============================================================================
// PINNED PLAN ITEM
// ============================================================================

/**
 * Pin a plan item (or unpin if already pinned)
 * Only one item can be pinned at a time per plan
 * PUT /api/plans/:id/items/:itemId/pin
 */
const pinPlanItem = asyncHandler(async (req, res) => {
  const { id: planId, itemId } = req.params;
  const userId = req.user._id;

  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(planId) || !mongoose.Types.ObjectId.isValid(itemId)) {
    return res.status(400).json({ error: 'Invalid plan or item ID' });
  }

  // Get the plan
  const plan = await Plan.findById(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Check edit permissions
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const canEdit = await enforcer.canEdit({ userId, resource: plan });
  if (!canEdit.allowed) {
    return res.status(403).json({ error: canEdit.reason || 'Not authorized to edit this plan' });
  }

  // Find the plan item
  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  // Toggle pin: if already pinned, unpin; otherwise pin
  const wasAlreadyPinned = plan.pinnedItemId?.toString() === itemId;
  plan.pinnedItemId = wasAlreadyPinned ? null : new mongoose.Types.ObjectId(itemId);

  await plan.save();

  backendLogger.info('Plan item pin toggled', {
    planId,
    itemId,
    action: wasAlreadyPinned ? 'unpinned' : 'pinned',
    userId: userId.toString()
  });

  // Broadcast event via WebSocket
  try {
    broadcastEvent('plan', planId.toString(), {
      type: 'plan:item:pinned',
      payload: {
        planId: planId.toString(),
        itemId: itemId.toString(),
        pinnedItemId: plan.pinnedItemId?.toString() || null,
        action: wasAlreadyPinned ? 'unpinned' : 'pinned',
        userId: userId.toString()
      }
    }, userId.toString());
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast pin event', { error: wsErr.message });
  }

  res.json({
    success: true,
    pinnedItemId: plan.pinnedItemId,
    action: wasAlreadyPinned ? 'unpinned' : 'pinned',
    message: wasAlreadyPinned ? 'Plan item unpinned' : 'Plan item pinned'
  });
});

/**
 * Unpin the currently pinned plan item
 * DELETE /api/plans/:id/pin
 */
const unpinPlanItem = asyncHandler(async (req, res) => {
  const { id: planId } = req.params;
  const userId = req.user._id;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    return res.status(400).json({ error: 'Invalid plan ID' });
  }

  // Get the plan
  const plan = await Plan.findById(planId);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Check edit permissions
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const canEdit = await enforcer.canEdit({ userId, resource: plan });
  if (!canEdit.allowed) {
    return res.status(403).json({ error: canEdit.reason || 'Not authorized to edit this plan' });
  }

  const previousPinnedId = plan.pinnedItemId;
  plan.pinnedItemId = null;
  await plan.save();

  backendLogger.info('Plan item unpinned', {
    planId,
    previousPinnedId: previousPinnedId?.toString(),
    userId: userId.toString()
  });

  // Broadcast event via WebSocket
  try {
    broadcastEvent('plan', planId.toString(), {
      type: 'plan:item:pinned',
      payload: {
        planId: planId.toString(),
        pinnedItemId: null,
        previousPinnedId: previousPinnedId?.toString() || null,
        action: 'unpinned',
        userId: userId.toString()
      }
    }, userId.toString());
  } catch (wsErr) {
    backendLogger.warn('[WebSocket] Failed to broadcast unpin event', { error: wsErr.message });
  }

  res.json({
    success: true,
    pinnedItemId: null,
    message: 'Plan item unpinned'
  });
});

module.exports = {
  createPlan,
  getUserPlans,
  getPlanById,
  getExperiencePlans,
  pinPlanItem,
  unpinPlanItem,
  checkUserPlanForExperience,
  updatePlan,
  reorderPlanItems,
  deletePlan,
  addCollaborator,
  removeCollaborator,
  updatePlanItem,
  getCollaborators,
  addPlanItem,
  deletePlanItem,
  addPlanItemNote,
  updatePlanItemNote,
  deletePlanItemNote,
  // Plan item details (transport, parking, discount, documents, photos)
  addPlanItemDetail,
  updatePlanItemDetail,
  deletePlanItemDetail,
  assignPlanItem,
  unassignPlanItem,
  // Cost management
  addCost,
  getCosts,
  updateCost,
  deleteCost,
  getCostSummary
};
