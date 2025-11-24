const Plan = require("../../models/plan");
const Experience = require("../../models/experience");
const Destination = require("../../models/destination");
const User = require("../../models/user");
const Photo = require("../../models/photo");
const permissions = require("../../utilities/permissions");
const { getEnforcer } = require("../../utilities/permission-enforcer");
const { asyncHandler } = require("../../utilities/controller-helpers");
const backendLogger = require("../../utilities/backend-logger");
const mongoose = require("mongoose");
const Activity = require('../../models/activity');
const { sendCollaboratorInviteEmail } = require('../../utilities/email-service');
const { trackCreate, trackUpdate, trackDelete, trackPlanItemCompletion } = require('../../utilities/activity-tracker');

/**
 * Create a new plan for an experience
 * Initializes plan with snapshot of current experience plan items
 */
const createPlan = asyncHandler(async (req, res) => {
  const { experienceId } = req.params;
  const { planned_date } = req.body;

  backendLogger.debug('Plan creation request received', {
    experienceId,
    planned_date,
    userId: req.user?._id?.toString(),
    hasUser: !!req.user,
    requestMethod: req.method,
    requestPath: req.path
  });

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    backendLogger.warn('Invalid experience ID format', { experienceId });
    return res.status(400).json({ error: "Invalid experience ID" });
  }

  if (!req.user || !req.user._id) {
    backendLogger.warn('Plan creation attempted without authentication', {
      hasUser: !!req.user,
      hasUserId: !!(req.user?._id)
    });
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
    backendLogger.warn('Invalid user ID format', { userId: req.user._id });
    return res.status(400).json({ error: "Invalid user ID" });
  }

  // Check if experience exists
  backendLogger.debug('Looking up experience', { experienceId });
  const experience = await Experience.findById(experienceId);
  if (!experience) {
    backendLogger.warn('Experience not found', { experienceId });
    return res.status(404).json({ error: "Experience not found" });
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
    return res.status(409).json({
      error: "Plan already exists for this experience",
      message: "You already have a plan for this experience. Use the checkmark button to view it.",
      planId: existingPlan._id
    });
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
    parent: item.parent
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

  const plan = await Plan.create({
    experience: experienceId,
    user: req.user._id,
    planned_date: normalizedPlannedDate,
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
  res.status(201).json(quickPopulatedPlan);

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
    } catch (err) {
      backendLogger.error('Error in async post-creation tasks', {
        planId: plan._id.toString(),
        error: err.message
      }, err);
    }
  });
});

/**
 * Get all plans for a user
 */
const getUserPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ user: req.user._id })
    .populate({
      path: 'experience',
      select: 'name destination photos default_photo_id',
      populate: {
        path: 'destination',
        select: 'name country'
      }
    })
    .sort({ updatedAt: -1 });

  // Explicitly convert to JSON to ensure virtuals are included
  const plansWithVirtuals = plans.map(plan => plan.toJSON());
  res.json(plansWithVirtuals);
});

/**
 * Get a specific plan by ID
 */
const getPlanById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid plan ID" });
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
    return res.status(400).json({ error: "Invalid experience ID" });
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
    return res.status(400).json({ error: "Invalid experience ID" });
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
      default:
        return false;
    }
  };

  // If the request only updates `planned_date`, perform an atomic update to avoid
  // triggering full-document validation (e.g. GeoJSON fields) which can fail
  // when optional nested fields are absent. This lets clients PATCH/PUT just the
  // planned_date without causing unrelated validation errors.
  const requestedKeys = Object.keys(updates || {}).filter(k => k);
  const allowedForRequest = ['planned_date', 'plan', 'notes'];
  const requestedAllowed = requestedKeys.filter(k => allowedForRequest.includes(k));
  if (requestedAllowed.length === 1 && requestedAllowed[0] === 'planned_date') {
    // Validate the planned_date value
    if (!validateUpdate('planned_date', updates.planned_date)) {
      return res.status(400).json({ error: 'Validation error', message: 'Invalid value for field: planned_date' });
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
  const allowedUpdates = ['planned_date', 'plan', 'notes'];
  const fieldsToTrack = [];
  for (const field of allowedUpdates) {
    if (updates[field] !== undefined) {
      if (!validateUpdate(field, updates[field])) {
        return res.status(400).json({ 
          error: "Validation error",
          message: `Invalid value for field: ${field}` 
        });
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

  res.json(updatedPlan);
});

/**
 * Delete a plan
 * Removes plan and contributor status from experience if applicable
 */
const deletePlan = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid plan ID" });
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

  res.json({ message: "Plan deleted successfully" });
});

/**
 * Add a collaborator to a plan
 */
const addCollaborator = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const plan = await Plan.findById(id);

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
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
        return res.status(403).json({
          error: "Only the plan owner can add collaborators",
          message: permCheck.reason
        });
      }
    }
  } catch (err) {
    backendLogger.error('Error checking permissions for addCollaborator', { error: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Error checking permissions' });
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
 */
const updatePlanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { complete, cost, planning_days } = req.body;

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
  const allowedScalarKeys = ['complete', 'cost', 'planning_days'];
  const onlyAllowed = requestedKeys.length > 0 && requestedKeys.every(k => allowedScalarKeys.includes(k));

  if (onlyAllowed) {
    // Build $set object for atomic positional update
    const setObj = {};
    if (complete !== undefined) setObj['plan.$.complete'] = complete;
    if (cost !== undefined) setObj['plan.$.cost'] = cost;
    if (planning_days !== undefined) setObj['plan.$.planning_days'] = planning_days;

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

    // Explicitly convert to JSON to ensure virtuals are included
    return res.json(updatedPlan.toJSON());
  }

  // Otherwise apply changes to the in-memory document and save (runs full validation)
  if (complete !== undefined) planItem.complete = complete;
  if (cost !== undefined) planItem.cost = cost;
  if (planning_days !== undefined) planItem.planning_days = planning_days;

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
 */
const addPlanItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text, url, cost, planning_days, parent, photo } = req.body;

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

  // Create new plan item (Mongoose will auto-generate _id)
  const newPlanItem = {
    plan_item_id: new mongoose.Types.ObjectId(), // Generate new ID for reference
    text,
    url,
    cost: cost || 0,
    planning_days: planning_days || 0,
    complete: false,
    parent: parent || null,
    photo: photo || null
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

  // Populate experience for response
  await plan.populate('experience');

  res.json(plan);
});

/**
 * Add a note to a plan item
 * Only owner, collaborators, and super admins can add notes
 */
const addPlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' });
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

  // Add note
  planItem.details.notes.push({
    user: req.user._id,
    content: content.trim()
  });

  await plan.save();

  // Populate user data for response
  await plan.populate('plan.details.notes.user', 'name email');
  await plan.populate('experience', 'name');

  backendLogger.info('Note added to plan item', {
    planId: id,
    itemId,
    userId: req.user._id.toString(),
    noteCount: planItem.details.notes.length
  });

  // Log activity for note addition
  const addedNote = planItem.details.notes[planItem.details.notes.length - 1];
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
      name: `Plan for ${plan.experience?.name || 'Unknown Experience'}`
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItem.name || planItem.experience_name || 'Unnamed Item'
    },
    reason: `Added note to plan item "${planItem.name || planItem.experience_name || 'Unnamed Item'}"`,
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

  res.json(plan);
});

/**
 * Update a note on a plan item
 * Only the note author can update their own note
 */
const updatePlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId, noteId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' });
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
  await plan.save();

  await plan.populate('plan.details.notes.user', 'name email');
  await plan.populate('experience', 'name');

  backendLogger.info('Note updated on plan item', {
    planId: id,
    itemId,
    noteId,
    userId: req.user._id.toString()
  });

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

  planItem.details.notes.pull(noteId);
  await plan.save();

  await plan.populate('plan.details.notes.user', 'name email');
  await plan.populate('experience', 'name');

  backendLogger.info('Note deleted from plan item', {
    planId: id,
    itemId,
    noteId,
    userId: req.user._id.toString()
  });

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

module.exports = {
  createPlan,
  getUserPlans,
  getPlanById,
  getExperiencePlans,
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
  assignPlanItem,
  unassignPlanItem
};
