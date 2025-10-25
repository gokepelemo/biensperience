const Plan = require("../../models/plan");
const Experience = require("../../models/experience");
const Destination = require("../../models/destination");
const User = require("../../models/user");
const permissions = require("../../utilities/permissions");
const { asyncHandler } = require("../../utilities/controller-helpers");
const backendLogger = require("../../utilities/backend-logger");
const mongoose = require("mongoose");

/**
 * Create a new plan for an experience
 * Initializes plan with snapshot of current experience plan items
 */
const createPlan = asyncHandler(async (req, res) => {
  const { experienceId } = req.params;
  const { planned_date } = req.body;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(experienceId)) {
    return res.status(400).json({ error: "Invalid experience ID" });
  }

  if (!req.user || !req.user._id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  // Check if experience exists
  const experience = await Experience.findById(experienceId);
  if (!experience) {
    return res.status(404).json({ error: "Experience not found" });
  }

  // Check if user already has a plan for this experience
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
  const plan = await Plan.create({
    experience: experienceId,
    user: req.user._id,
    planned_date: planned_date || null, // Allow null - user can set date later
    plan: planSnapshot,
    permissions: [{
      _id: req.user._id,
      entity: 'user',
      type: 'owner',
      granted_by: req.user._id
    }]
  });

  // Add user as contributor to experience if not already owner/collaborator
  const isOwner = permissions.isOwner(req.user, experience);
  const isCollaborator = await permissions.isCollaborator(req.user._id, experience, { Experience, Destination });
  
  if (!isOwner && !isCollaborator) {
    // Check if already a contributor
    const isContributor = experience.permissions.some(
      p => p.entity === 'user' && p._id.toString() === req.user._id.toString() && p.type === 'contributor'
    );
    
    if (!isContributor) {
      experience.permissions.push({
        _id: req.user._id,
        entity: 'user',
        type: 'contributor',
        granted_by: req.user._id,
        granted_at: new Date()
      });
      await experience.save();
    }
  }

  const populatedPlan = await Plan.findById(plan._id)
    .populate('experience', 'name destination')
    .populate({
      path: 'user',
      select: 'name email photo photos default_photo_index',
      populate: {
        path: 'photo',
        select: 'url caption'
      }
    });

  res.status(201).json(populatedPlan);
});

/**
 * Get all plans for a user
 */
const getUserPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ user: req.user._id })
    .populate('experience', 'name destination photo photos default_photo_index')
    .populate({
      path: 'experience',
      populate: {
        path: 'destination',
        select: 'name country'
      }
    })
    .sort({ updatedAt: -1 });

  res.json(plans);
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
    .populate('experience', 'name destination plan_items')
    .populate({
      path: 'user',
      select: 'name email photo photos default_photo_index',
      populate: {
        path: 'photo',
        select: 'url caption'
      }
    })
    .populate({
      path: 'experience',
      populate: {
        path: 'destination',
        select: 'name country'
      }
    });

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Check if user has permission to view (owner, collaborator, or contributor)
  const canView = (plan.user.toString() === req.user._id.toString()) || 
                  permissions.hasDirectPermission(plan, req.user._id, 'collaborator') ||
                  permissions.hasDirectPermission(plan, req.user._id, 'contributor');
  
  if (!canView) {
    return res.status(403).json({ error: "Insufficient permissions to view this plan" });
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
    select: 'name email photo photos default_photo_index',
    populate: {
      path: 'photo',
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

  // Manually populate collaborator user data in permissions array
  const plansWithCollaborators = await Promise.all(plans.map(async (plan) => {
    const planObj = plan.toObject();
    if (planObj.permissions && planObj.permissions.length > 0) {
      const userPermissions = planObj.permissions.filter(p => p.entity === 'user');
      const userIds = userPermissions.map(p => p._id);
      const users = await User.find({ _id: { $in: userIds } })
        .select('name email photo photos default_photo_index')
        .populate('photo', 'url caption');
      
      // Create a map for quick lookup
      const userMap = {};
      users.forEach(u => {
        userMap[u._id.toString()] = { 
          name: u.name, 
          email: u.email, 
          _id: u._id,
          photo: u.photo,
          photos: u.photos,
          default_photo_index: u.default_photo_index
        };
      });
      
      // Enhance permissions with user data
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
  }));

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

  res.json({ 
    hasPlan: true, 
    plans: transformedPlans,
    // Legacy compatibility - return first plan's data
    planId: transformedPlans[0]._id,
    createdAt: transformedPlans[0].createdAt
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
  const canEdit = permissions.isOwner(req.user, plan) || permissions.hasDirectPermission(plan, req.user._id, 'collaborator');
  if (!canEdit) {
    return res.status(403).json({ error: "Insufficient permissions to edit this plan" });
  }

  // Validate update fields
  const validateUpdate = (field, value) => {
    switch(field) {
      case 'planned_date':
        // Accept Date objects or ISO date strings
        if (value instanceof Date) return true;
        if (typeof value === 'string') {
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

  // Update allowed fields with validation
  const allowedUpdates = ['planned_date', 'plan', 'notes'];
  for (const field of allowedUpdates) {
    if (updates[field] !== undefined) {
      if (!validateUpdate(field, updates[field])) {
        return res.status(400).json({ 
          error: "Validation error",
          message: `Invalid value for field: ${field}` 
        });
      }
      plan[field] = updates[field];
    }
  }

  await plan.save();

  const updatedPlan = await Plan.findById(plan._id)
    .populate('experience', 'name destination')
    .populate({
      path: 'user',
      select: 'name email photo photos default_photo_index',
      populate: {
        path: 'photo',
        select: 'url caption'
      }
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

  const plan = await Plan.findById(id).select('user permissions experience');

  if (!plan) {
    return res.status(404).json({ error: "Plan not found" });
  }

  // Only owner can delete
  if (!permissions.isOwner(req.user, plan)) {
    return res.status(403).json({ error: "Only the plan owner can delete it" });
  }

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
        const isOwnerOrCollaborator = 
          permissions.isOwner(req.user, experience) || 
          permissions.hasDirectPermission(experience, req.user._id, 'collaborator');
        
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
  if (!permissions.isOwner(req.user, plan)) {
    return res.status(403).json({ error: "Only the plan owner can add collaborators" });
  }

  // Check if user already has permission
  const existingPerm = plan.permissions.find(
    p => p.entity === 'user' && p._id.toString() === userId
  );

  if (existingPerm) {
    return res.status(400).json({ error: "User already has permissions on this plan" });
  }

  plan.permissions.push({
    _id: userId,
    entity: 'user',
    type: 'collaborator',
    granted_by: req.user._id,
    granted_at: new Date()
  });

  await plan.save();

  const updatedPlan = await Plan.findById(plan._id)
    .populate('experience', 'name')
    .populate({
      path: 'user',
      select: 'name email photo photos default_photo_index',
      populate: {
        path: 'photo',
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
  if (!permissions.isOwner(req.user, plan)) {
    return res.status(403).json({ error: "Only the plan owner can remove collaborators" });
  }

  plan.permissions = plan.permissions.filter(
    p => !(p.entity === 'user' && p._id.toString() === userId && p.type === 'collaborator')
  );

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

  // Check permissions - must be owner or collaborator
  const canEdit = (plan.user.toString() === req.user._id.toString()) || permissions.hasDirectPermission(plan, req.user._id, 'collaborator');
  if (!canEdit) {
    return res.status(403).json({ error: "Insufficient permissions to edit this plan" });
  }

  // Find and update the plan item
  const planItem = plan.plan.id(itemId);

  if (!planItem) {
    return res.status(404).json({ error: "Plan item not found" });
  }

  if (complete !== undefined) planItem.complete = complete;
  if (cost !== undefined) planItem.cost = cost;
  if (planning_days !== undefined) planItem.planning_days = planning_days;

  await plan.save();

  res.json(plan);
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
  const canView = (plan.user.toString() === req.user._id.toString()) || 
                  permissions.hasDirectPermission(plan, req.user._id, 'collaborator') ||
                  permissions.hasDirectPermission(plan, req.user._id, 'contributor');
  
  if (!canView) {
    return res.status(403).json({ error: "Insufficient permissions to view this plan" });
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
  }).select('_id name email photo photos default_photo_index');

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
  const canEdit = (plan.user.toString() === req.user._id.toString()) || permissions.hasDirectPermission(plan, req.user._id, 'collaborator');
  if (!canEdit) {
    return res.status(403).json({ error: "Insufficient permissions to edit this plan" });
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
  const canEdit = (plan.user.toString() === req.user._id.toString()) || permissions.hasDirectPermission(plan, req.user._id, 'collaborator');
  if (!canEdit) {
    return res.status(403).json({ error: "Insufficient permissions to edit this plan" });
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

module.exports = {
  createPlan,
  getUserPlans,
  getPlanById,
  getExperiencePlans,
  checkUserPlanForExperience,
  updatePlan,
  deletePlan,
  addCollaborator,
  removeCollaborator,
  updatePlanItem,
  getCollaborators,
  addPlanItem,
  deletePlanItem
};
