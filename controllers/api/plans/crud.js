/**
 * Plan CRUD handlers (create/read/update/delete + experience-scoped lookups + scheduled deletion).
 *
 * Pure relocation from controllers/api/plans.js (bd #97c6).
 * Imports + helper signatures unchanged.
 */

const Plan = require("../../../models/plan");
const Experience = require("../../../models/experience");
const Destination = require("../../../models/destination");
const User = require("../../../models/user");
const Photo = require("../../../models/photo");
const permissions = require("../../../utilities/permission-enforcer");
const { getEnforcer } = require("../../../utilities/permission-enforcer");
const { asyncHandler, successResponse, errorResponse, validateObjectId } = require("../../../utilities/controller-helpers");
const backendLogger = require("../../../utilities/backend-logger");
const mongoose = require("mongoose");
const Activity = require('../../../models/activity');
const { sendCollaboratorInviteEmail, sendPlanAccessRequestEmail } = require('../../../utilities/email-service');
const { sendIfAllowed, notifyUser } = require('../../../utilities/notifications');

const { trackCreate, trackUpdate, trackDelete, trackPlanItemCompletion, trackCostAdded } = require('../../../utilities/activity-tracker');
const { hasFeatureFlag, hasFeatureFlagInContext, FEATURE_FLAG_CONTEXT } = require('../../../utilities/feature-flags');
const { broadcastEvent, sendEventToUser } = require('../../../utilities/websocket-server');
const {
  upsertMessagingChannel,
  getStreamServerClient,
  syncChannelMembers
} = require('../../../utilities/stream-chat');
const { insufficientPermissionsError } = require('../../../utilities/error-responses');
const crypto = require('crypto');
const planUnplanQueue = require('../../../utilities/plan-unplan-queue');
const { updateExperienceSignals, refreshSignalsAndAffinity } = require('../../../utilities/hidden-signals');

const { sanitizeLocation, filterNotesByVisibility, isPlanMember } = require('./_shared');



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
    },
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      photos: req.user.photos
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
      // Race guard: this block runs async after we responded.
      // If the user immediately "unplans" (deletes the plan), we must not add
      // contributor permissions back onto the experience.
      const planStillExists = await Plan.exists({ _id: plan._id });
      if (!planStillExists) {
        backendLogger.debug('Skipping async plan side-effects: plan already deleted', {
          planId: plan._id?.toString(),
          experienceId: experience?._id?.toString(),
          userId: req.user?._id?.toString()
        });
        return;
      }

      // Recompute content signals for the experience now that a new plan exists.
      // Fire-and-forget — updateExperienceSignals never throws.
      updateExperienceSignals(experienceId);

      const enforcer = getEnforcer({ Plan, Experience, Destination, User });
      const userRole = await enforcer.getUserRole(req.user._id, experience);

      // Only add as contributor if user has no existing role (SECURE)
      if (!userRole) {
        // Re-check: plan may have been deleted while async work was in-flight.
        const planStillExistsBeforePermission = await Plan.exists({ _id: plan._id });
        if (!planStillExistsBeforePermission) {
          backendLogger.debug('Skipping contributor permission add: plan deleted during async processing', {
            planId: plan._id?.toString(),
            experienceId: experience?._id?.toString(),
            userId: req.user?._id?.toString()
          });
          return;
        }

        // Track creation first (returnActivity: true) so we can link the auto-contributor
        // permission grant as a child activity — keeping it off the personal dashboard feed.
        const planWithExperience = {
          ...plan.toObject(),
          experience: {
            _id: experience._id,
            name: experience.name
          }
        };
        const parentActivity = await trackCreate({
          resource: planWithExperience,
          resourceType: 'Plan',
          actor: req.user,
          req,
          reason: `Plan created for experience "${experience.name}"`,
          returnActivity: true
        });

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
          allowSelfContributor: true,
          parentActivityId: parentActivity?._id || null
        });
      } else {
        // No contributor permission to grant; just track plan creation.
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
      }

      // Log experience_planned activity for the experience activity feed
      // Only if user's profile is public
      try {
        const planCreator = await User.findById(req.user._id).select('preferences.profileVisibility name email').lean();
        if (planCreator?.preferences?.profileVisibility !== 'private') {
          await Activity.log({
            action: 'experience_planned',
            actor: {
              _id: req.user._id,
              name: req.user.name,
              email: req.user.email
            },
            resource: {
              id: experience._id,
              type: 'Experience',
              name: experience.name
            },
            target: {
              id: plan._id,
              type: 'Plan',
              name: `Plan for ${experience.name}`
            },
            reason: `${req.user.name} is planning this experience`,
            metadata: {
              ipAddress: req.ip,
              userAgent: req.get('user-agent'),
              requestPath: req.path,
              requestMethod: req.method,
              experienceId: experience._id.toString(),
              planId: plan._id.toString()
            },
            tags: ['experience_feed', 'experience_planned']
          });

          // Broadcast to experience room so activity tab updates in real time
          broadcastEvent('experience', experience._id.toString(), {
            type: 'experience:activity:new',
            payload: {
              experienceId: experience._id.toString(),
              action: 'experience_planned',
              actorName: req.user.name
            }
          }, req.user._id.toString());
        }
      } catch (feedActivityErr) {
        backendLogger.warn('Failed to log experience_planned activity', {
          error: feedActivityErr.message,
          experienceId: experience._id.toString()
        });
      }

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
  // Note: Super admins do NOT get to see all plans in dropdown - only their own and collaborative ones
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
      select: 'name email photos oauthProfilePhoto photo',
      populate: {
        path: 'photos.photo',
        select: 'url caption'
      }
    })
    .populate({
      path: 'experience',
      select: 'name destination photos',
      populate: {
        path: 'destination',
        select: 'name country'
      }
    })
    .populate({
      path: 'plan.details.notes.user',
      select: 'name email photos oauthProfilePhoto',
      populate: {
        path: 'photos.photo',
        select: 'url caption'
      }
    })
    .sort({ updatedAt: -1 });

  if (paginate) {
    // Get total counts and paginated results in parallel
    // We need separate counts for owned vs shared plans for filter badges
    const ownedFilter = { user: req.user._id };
    const sharedFilter = {
      user: { $ne: req.user._id },
      'permissions._id': req.user._id,
      'permissions.entity': 'user',
      'permissions.type': { $in: ['collaborator', 'contributor'] }
    };

    const [totalCount, totalOwnedCount, totalSharedCount, plans] = await Promise.all([
      Plan.countDocuments(filter),
      Plan.countDocuments(ownedFilter),
      Plan.countDocuments(sharedFilter),
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
        totalOwnedCount,
        totalSharedCount,
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
      select: 'name email photos oauthProfilePhoto photo',
      populate: {
        path: 'photos.photo',
        select: 'url caption'
      }
    })
    .populate({
      path: 'experience',
      select: 'name destination plan_items photos',
      populate: {
        path: 'destination',
        select: 'name country'
      }
    })
    .populate({
      path: 'plan.details.notes.user',
      select: 'name email photos oauthProfilePhoto',
      populate: {
        path: 'photos.photo',
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
    return res
      .status(403)
      .json(
        insufficientPermissionsError('contributor', 'none', {
          resourceType: 'plan',
          resourceId: id,
          reason: permCheck.reason
        })
      );
  }

  // Filter notes based on visibility permissions
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
  const planExperienceId = plan.experience?._id?.toString();
  if (planExperienceId) {
    setImmediate(() =>
      refreshSignalsAndAffinity(
        planExperienceId,
        req.user._id.toString(),
        null  // experience.signals.computed_at not loaded here; treat as unknown → always refresh
      )
    );
  }
});

/**
 * Request access to a plan the current user cannot view
 * POST /api/plans/:id/access-requests
 *
 * Access requests are now embedded in the Plan document (plan.accessRequests)
 * for lightweight queries without a separate collection.
 */

const getExperiencePlans = asyncHandler(async (req, res) => {
  const { experienceId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return errorResponse(res, null, "Invalid experience ID", 400);
  }

  // Single optimized query: get user's own plan OR plans where user is collaborator/owner
  // Note: Super admins do NOT get to see all plans in dropdown - only their own and collaborative ones
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
    select: 'name email photos oauthProfilePhoto photo',
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
    select: 'name email photos oauthProfilePhoto',
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
    .select('name email photos oauthProfilePhoto photo')
    .populate('photos.photo', 'url caption')
    .lean()
    .exec();

  // Create user lookup map (O(1) access)
  const userMap = {};
  allUsers.forEach(u => {
    userMap[u._id.toString()] = {
      name: u.name,
      email: u.email,
      _id: u._id,
      photos: u.photos
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
  // Note: Super admins do NOT get special access here - only their own and collaborative plans
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
    .populate('experience', 'name destination photos')
    .populate({
      path: 'user',
      select: 'name email photos oauthProfilePhoto photo',
      populate: { path: 'photos.photo', select: 'url caption' }
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

    // Check whether to offer item date shift
    const oldDate = previousState.planned_date;
    const newDate = updated.planned_date;

    if (oldDate && newDate) {
      const diffMs = new Date(newDate).getTime() - new Date(oldDate).getTime();
      if (diffMs !== 0) {
        const scheduledCount = (updated.plan || []).filter(
          item => !item.parent && item.scheduled_date
        ).length;

        if (scheduledCount > 0) {
          const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
          try {
            broadcastEvent('plan', id.toString(), {
              type: 'plan:updated',
              payload: { plan: updated.toObject(), planId: id.toString(), updatedFields: ['planned_date'], userId: req.user._id.toString() }
            }, req.user._id.toString());
          } catch (_) {}
          return res.json({
            ...updated.toObject(),
            _shift_meta: {
              scheduled_items_count: scheduledCount,
              date_diff_days: diffDays,
              date_diff_ms: diffMs,
              old_date: oldDate,
              new_date: newDate
            }
          });
        }
      }
    }

    try {
      broadcastEvent('plan', id.toString(), {
        type: 'plan:updated',
        payload: { plan: updated.toObject(), planId: id.toString(), updatedFields: ['planned_date'], userId: req.user._id.toString() }
      }, req.user._id.toString());
    } catch (_) {}
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
    .populate('experience', 'name destination photos')
    .populate({
      path: 'user',
      select: 'name email photos oauthProfilePhoto photo',
      populate: {
        path: 'photos.photo',
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
      const experienceId = plan.experience?._id || plan.experience;

      // Use a lean query with only the fields we need (much faster)
      const experience = await Experience.findById(experienceId)
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
            { _id: experienceId },
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

  // Recompute content signals now that one fewer plan exists for this experience.
  // Fire-and-forget — runs after response is sent; updateExperienceSignals never throws.
  const deletedPlanExperienceId = plan.experience?._id || plan.experience;
  if (deletedPlanExperienceId) {
    setImmediate(() => updateExperienceSignals(deletedPlanExperienceId));
  }
});

/**
 * Add a collaborator to a plan
 */

const getPlanPreview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  const plan = await Plan.findById(id)
    .select('experience user')
    .populate({ path: 'experience', select: 'name' })
    .populate({ path: 'user', select: 'name' });

  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  return successResponse(res, {
    planId: plan._id,
    experienceName: plan.experience?.name || 'an experience',
    ownerFirstName: plan.user?.name?.split(' ')[0] || 'Someone',
    experienceId: plan.experience?._id
  });
});

// ============================================================================
// MEMBER LOCATION MANAGEMENT
// Each plan member (owner or collaborator) may record their travel origin and
// an optional travel cost estimate. This information is stored in the
// `member_locations` array (one entry per user, upserted by user ID).
// ============================================================================

/**
 * Set or update the calling user's travel origin on a plan.
 * Any plan member (owner or collaborator) may call this for themselves.
 *
 * PUT /api/plans/:id/member-location
 * Body: { location: { address, city, country, ... }, travel_cost_estimate?, currency? }
 */

const scheduleDeletePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse(res, null, 'Invalid plan ID', 400);
  }

  const plan = await Plan.findById(id)
    .select('user permissions experience')
    .populate('experience', 'name');

  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  // Only the plan owner may schedule its deletion.
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canDelete({ userId: req.user._id, resource: plan });
  if (!permCheck.allowed) {
    return res.status(403).json({ error: 'Only the plan owner can delete it', message: permCheck.reason });
  }

  // Capture the experience ID now so the timer closure has it.
  const experienceId = plan.experience?._id || plan.experience;
  const actorId = req.user._id.toString();

  // Define the actual deletion work that runs when the timer fires.
  const executeDelete = async (planId) => {
    const target = await Plan.findById(planId)
      .select('user permissions experience')
      .populate('experience', 'name');

    if (!target) return; // Already deleted — nothing to do.

    // Track deletion (non-blocking)
    trackDelete({
      resource: target,
      resourceType: 'Plan',
      actor: { _id: actorId },
      reason: 'Plan deleted via deferred unplan',
    });

    const deletePromise = Plan.findByIdAndDelete(planId);
    const expId = target.experience?._id || target.experience;

    let updateExpPromise = Promise.resolve();
    if (expId) {
      updateExpPromise = (async () => {
        const exp = await Experience.findById(expId).select('permissions user').lean();
        if (!exp) return;
        const enforcer2 = getEnforcer({ Plan, Experience, Destination, User });
        const userRole = await enforcer2.getUserRole(actorId, exp);
        if (userRole !== 'owner' && userRole !== 'collaborator') {
          await Experience.updateOne(
            { _id: expId },
            { $pull: { permissions: { entity: 'user', _id: actorId, type: 'contributor' } } }
          );
        }
      })();
    }

    await Promise.all([deletePromise, updateExpPromise]);

    try {
      broadcastEvent('plan', planId.toString(), {
        type: 'plan:deleted',
        payload: { planId: planId.toString(), userId: actorId }
      }, actorId);
      if (expId) {
        broadcastEvent('experience', expId.toString(), {
          type: 'plan:deleted',
          payload: { planId: planId.toString(), experienceId: expId.toString(), userId: actorId }
        }, actorId);
      }
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast deferred plan deletion', { error: wsErr.message });
    }
  };

  const { token, expiresAt } = planUnplanQueue.scheduleDelete(
    id,
    actorId,
    executeDelete
  );

  return successResponse(res, { token, expiresAt }, 'Plan deletion scheduled');
});

/**
 * Cancel a previously scheduled plan deletion (undo).
 *
 * DELETE /api/plans/scheduled/:token
 * Response: { cancelled: true }
 */

const cancelScheduledDeletePlan = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token || typeof token !== 'string' || token.length > 64) {
    return errorResponse(res, null, 'Invalid token', 400);
  }

  const cancelled = planUnplanQueue.cancelDelete(token, req.user._id.toString());

  if (!cancelled) {
    // The window may have already expired and the delete fired — treat
    // gracefully so the client doesn't surface a confusing error.
    return res.status(404).json({ success: false, error: 'Token not found or already expired' });
  }

  return successResponse(res, { cancelled: true }, 'Plan deletion cancelled');
});


module.exports = {
  createPlan,
  getUserPlans,
  getPlanById,
  getExperiencePlans,
  checkUserPlanForExperience,
  updatePlan,
  deletePlan,
  getPlanPreview,
  scheduleDeletePlan,
  cancelScheduledDeletePlan,
};
