/**
 * Plan-item cost entries and summary reports.
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


const addCost = asyncHandler(async (req, res) => {
  // Validation enforced by addCostSchema (see plans.schemas.js).
  // The `isNaN(Number(cost))` guard below is retained because the schema only
  // enforces `cost` is a number-or-string, not that the string is parseable.
  const { id } = req.params;
  const { title, description, cost, currency, category, date, plan_item, collaborator } = req.body;

  if (isNaN(Number(cost))) {
    return res.status(400).json({ error: 'Valid cost amount is required' });
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
  // (ObjectId format already enforced by addCostSchema)
  if (plan_item) {
    const itemExists = plan.plan.some(item => item._id.toString() === plan_item.toString());
    if (!itemExists) {
      return res.status(400).json({ error: 'Plan item not found in this plan' });
    }
  }

  // Validate collaborator is a member of the plan if provided
  // (ObjectId format already enforced by addCostSchema)
  if (collaborator) {
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

  // Real-time sync: notify all clients in the plan room.
  try {
    const version = Date.now();
    const experienceId = plan.experience?._id || plan.experience;
    const costObj = addedCost && typeof addedCost.toObject === 'function' ? addedCost.toObject() : addedCost;

    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      version,
      payload: {
        planId: id.toString(),
        experienceId: experienceId?.toString ? experienceId.toString() : experienceId,
        plan,
        action: 'cost_added',
        version
      }
    }, req.user._id.toString());

    broadcastEvent('plan', id.toString(), {
      type: 'plan:cost_added',
      version,
      payload: {
        planId: id.toString(),
        cost: costObj,
        version
      }
    }, req.user._id.toString());
  } catch (e) {
    // Non-fatal: do not block cost creation on broadcast failures
  }

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
    .populate('costs.collaborator', 'name email photos')
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
  // Validation enforced by updateCostSchema (see plans.schemas.js).
  const { id, costId } = req.params;
  const { title, description, cost, currency, category, date, plan_item, collaborator } = req.body;

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
  // (ObjectId format already enforced by updateCostSchema)
  if (plan_item !== undefined) {
    if (plan_item === null) {
      costEntry.plan_item = null;
    } else {
      const itemExists = plan.plan.some(item => item._id.toString() === plan_item.toString());
      if (!itemExists) {
        return res.status(400).json({ error: 'Plan item not found in this plan' });
      }
      costEntry.plan_item = plan_item;
    }
  }

  // Validate and update collaborator if provided
  // (ObjectId format already enforced by updateCostSchema)
  if (collaborator !== undefined) {
    if (collaborator === null) {
      costEntry.collaborator = null;
    } else {
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

  // Real-time sync: notify all clients in the plan room.
  try {
    const version = Date.now();
    const updatedCost = plan.costs?.id(costId);
    const experienceId = plan.experience?._id || plan.experience;

    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      version,
      payload: {
        planId: id.toString(),
        experienceId: experienceId?.toString ? experienceId.toString() : experienceId,
        plan,
        action: 'cost_updated',
        version
      }
    }, req.user._id.toString());

    broadcastEvent('plan', id.toString(), {
      type: 'plan:cost_updated',
      version,
      payload: {
        planId: id.toString(),
        costId: costId.toString(),
        cost: updatedCost && typeof updatedCost.toObject === 'function' ? updatedCost.toObject() : updatedCost,
        version
      }
    }, req.user._id.toString());
  } catch (e) {
    // Non-fatal
  }

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

  // Real-time sync: notify all clients in the plan room.
  try {
    const version = Date.now();
    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      version,
      payload: {
        planId: id.toString(),
        plan,
        action: 'cost_deleted',
        version
      }
    }, req.user._id.toString());

    broadcastEvent('plan', id.toString(), {
      type: 'plan:cost_deleted',
      version,
      payload: {
        planId: id.toString(),
        costId: costId.toString(),
        version
      }
    }, req.user._id.toString());
  } catch (e) {
    // Non-fatal
  }

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
    .populate({
      path: 'costs.collaborator',
      select: 'name email photos oauthProfilePhoto photo',
      populate: {
        path: 'photos.photo',
        select: 'url caption'
      }
    })
    .populate({
      path: 'user',
      select: 'name email photos oauthProfilePhoto photo',
      populate: {
        path: 'photos.photo',
        select: 'url caption'
      }
    })
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
    .select('name email photos oauthProfilePhoto photo')
    .populate('photos.photo', 'url caption')
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

module.exports = {
  addCost,
  getCosts,
  updateCost,
  deleteCost,
  getCostSummary,
};
