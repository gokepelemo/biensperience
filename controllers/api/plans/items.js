/**
 * Plan-item CRUD: add/update/delete/reorder/pin/unpin/assign/unassign.
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


const updatePlanItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const {
    complete, cost, planning_days, text, url, activity_type,
    location, lat, lng, address, scheduled_date, scheduled_time,
    photos, visibility
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
  // Support both subdocument _id and plan_item_id (BienBot uses experience plan item IDs)
  let planItem = plan.plan.id(itemId);
  if (!planItem) {
    planItem = plan.plan.find(i => i.plan_item_id?.toString() === itemId?.toString());
  }

  if (!planItem) {
    return res.status(404).json({ error: "Plan item not found" });
  }

  // Use the actual subdocument _id for positional queries (itemId may be plan_item_id)
  const subdocId = planItem._id;

  // Scheduling policy: only root (parent) items may be scheduled.
  // Child items must follow their parent in Timeline grouping.
  // Allow clearing legacy child schedules by setting values to null.
  const isChildItem = Boolean(planItem.parent);
  const isSettingScheduleOnChild = isChildItem && (
    (scheduled_date !== undefined && scheduled_date !== null) ||
    (scheduled_time !== undefined && scheduled_time !== null)
  );

  if (isSettingScheduleOnChild) {
    return res.status(400).json({
      error: 'Child plan items cannot be scheduled. Schedule the parent item instead.'
    });
  }

  // Track completion status change if it's being updated
  const wasComplete = planItem.complete;
  const willBeComplete = complete !== undefined ? complete : wasComplete;

  // If the request only updates allowable scalar item fields, perform an atomic
  // positional update to avoid validating other unrelated nested fields
  // (such as optional GeoJSON coordinates) which can cause validation failures.
  const requestedKeys = Object.keys(req.body || {}).filter(k => k);
  const allowedScalarKeys = ['complete', 'cost', 'planning_days', 'text', 'url', 'activity_type', 'scheduled_date', 'scheduled_time', 'visibility'];
  const locationKeys = ['location', 'lat', 'lng', 'address'];
  const arrayKeys = ['photos'];
  const allAllowedKeys = [...allowedScalarKeys, ...locationKeys, ...arrayKeys];
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

    // Validate and set visibility
    if (visibility !== undefined) {
      const validVisibilities = ['public', 'plan_only'];
      setObj['plan.$.visibility'] = validVisibilities.includes(visibility) ? visibility : 'plan_only';
    }

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

    // Process photos array - validate ObjectIds and store references
    if (photos !== undefined) {
      if (Array.isArray(photos)) {
        // Validate all photo IDs are valid ObjectIds
        const validPhotoIds = photos.filter(id => mongoose.Types.ObjectId.isValid(id));
        setObj['plan.$.photos'] = validPhotoIds.map(id => new mongoose.Types.ObjectId(id));
        backendLogger.debug('Setting plan item photos', {
          planId: id,
          itemId,
          photoCount: validPhotoIds.length
        });
      } else if (photos === null) {
        // Allow clearing photos
        setObj['plan.$.photos'] = [];
      }
    }

    // Preserve previous state for tracking
    const previousState = plan.toObject();

    // Perform atomic update using the positional $ operator
    const updatedPlan = await Plan.findOneAndUpdate(
      { _id: plan._id, 'plan._id': subdocId },
      { $set: setObj },
      { new: true }
    )
    .populate('experience', 'name')
    .populate({
      path: 'user',
      select: 'name email'
    });

    if (!updatedPlan) {
      return res.status(404).json({ error: 'Plan item not found' });
    }

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
      const updatedItem = updatedPlan.plan?.find(i => i._id?.toString() === subdocId.toString());
      broadcastEvent('plan', id.toString(), {
        type: 'plan:item:updated',
        payload: {
          planId: id.toString(),
          planItemId: subdocId.toString(),
          planItem: updatedItem,
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (wsErr) {
      backendLogger.warn('[WebSocket] Failed to broadcast plan item update', { error: wsErr.message });
    }

    // Log visibility change activity for the experience feed
    if (visibility !== undefined && visibility !== planItem.visibility) {
      setImmediate(async () => {
        try {
          const experienceId = updatedPlan.experience?._id || updatedPlan.experience;
          const updatedItem = updatedPlan.plan?.find(i => i._id?.toString() === subdocId.toString());
          if (visibility === 'public') {
            const itemUser = await User.findById(req.user._id).select('preferences.profileVisibility name email').lean();
            if (itemUser?.preferences?.profileVisibility !== 'private') {
              await Activity.log({
                action: 'plan_item_visibility_changed',
                actor: { _id: req.user._id, name: req.user.name, email: req.user.email },
                resource: { id: experienceId, type: 'Experience', name: updatedPlan.experience?.name || 'Unknown' },
                target: { id: itemId, type: 'PlanItem', name: updatedItem?.text || 'Unnamed item' },
                reason: `${req.user.name} shared "${updatedItem?.text || 'a plan item'}" publicly`,
                metadata: {
                  experienceId: experienceId?.toString?.() || String(experienceId),
                  planId: id.toString(),
                  visibility: 'public'
                },
                tags: ['experience_feed', 'visibility_changed']
              });

              // Broadcast to experience room so activity tab updates in real time
              broadcastEvent('experience', experienceId?.toString?.() || String(experienceId), {
                type: 'experience:activity:new',
                payload: {
                  experienceId: experienceId?.toString?.() || String(experienceId),
                  action: 'plan_item_visibility_changed',
                  actorName: req.user.name
                }
              }, req.user._id.toString());
            }
          }
        } catch (err) {
          backendLogger.warn('Failed to log visibility change activity', { error: err.message });
        }
      });
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
  if (visibility !== undefined) {
    const validVisibilities = ['public', 'plan_only'];
    planItem.visibility = validVisibilities.includes(visibility) ? visibility : 'plan_only';
  }

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

  // Process photos array for in-memory update
  if (photos !== undefined) {
    if (Array.isArray(photos)) {
      // Validate all photo IDs are valid ObjectIds
      const validPhotoIds = photos.filter(id => mongoose.Types.ObjectId.isValid(id));
      planItem.photos = validPhotoIds.map(id => new mongoose.Types.ObjectId(id));
      backendLogger.debug('Setting plan item photos (in-memory)', {
        planId: id,
        itemId,
        photoCount: validPhotoIds.length
      });
    } else if (photos === null) {
      // Allow clearing photos
      planItem.photos = [];
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

  // Enforce configurable max nesting level.
  // Definition: root items have depth 0; a direct child has depth 1; etc.
  // Adding a child under `parent` creates a new item at depth (depth(parent) + 1).
  const maxNestingLevelRaw = process.env.PLAN_ITEM_MAX_NESTING_LEVEL || process.env.VITE_PLAN_ITEM_MAX_NESTING_LEVEL;
  const maxNestingLevelParsed = parseInt(maxNestingLevelRaw, 10);
  const maxNestingLevel = Number.isFinite(maxNestingLevelParsed) && maxNestingLevelParsed >= 0 ? maxNestingLevelParsed : 1;

  if (parent) {
    if (maxNestingLevel === 0) {
      return res.status(400).json({ error: 'Plan item nesting is disabled (max nesting level is 0)' });
    }

    const parentIdStr = parent.toString();

    if (!mongoose.Types.ObjectId.isValid(parentIdStr)) {
      return res.status(400).json({ error: 'Invalid parent plan item ID' });
    }

    const findPlanItemByAnyId = (idStr) => {
      return (plan.plan || []).find(item => {
        const primaryId = item?.plan_item_id || item?._id;
        if (primaryId && primaryId.toString() === idStr) return true;
        return item?._id && item._id.toString() === idStr;
      }) || null;
    };

    const parentItem = findPlanItemByAnyId(parentIdStr);

    if (!parentItem) {
      return res.status(400).json({ error: 'Parent plan item not found in this plan' });
    }

    // Compute depth of the parent by walking up its parent chain.
    const visited = new Set();
    let parentDepth = 0;
    let cursor = parentItem;

    while (cursor?.parent) {
      const cursorId = (cursor.plan_item_id || cursor._id)?.toString() || null;
      if (cursorId) {
        if (visited.has(cursorId)) {
          return res.status(400).json({ error: 'Invalid plan item hierarchy (cycle detected)' });
        }
        visited.add(cursorId);
      }

      parentDepth += 1;
      if (parentDepth > 50) {
        return res.status(400).json({ error: 'Invalid plan item hierarchy (excessive nesting)' });
      }

      const nextParentId = cursor.parent.toString();
      const nextParent = findPlanItemByAnyId(nextParentId);
      if (!nextParent) {
        return res.status(400).json({ error: 'Invalid plan item hierarchy (missing parent)' });
      }
      cursor = nextParent;
    }

    if (parentDepth >= maxNestingLevel) {
      return res.status(400).json({
        error: `Cannot add a child item deeper than max nesting level ${maxNestingLevel}`
      });
    }
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
    planId: planId.toString(),
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
    planId: planId.toString(),
    pinnedItemId: null,
    message: 'Plan item unpinned'
  });
});

/**
 * Approve an access request via one-click token (no auth required)
 * GET /api/plans/:id/access-requests/approve-by-token?token=xxx
 *
 * The token is sent in the plan owner's email. It acts as authentication.
 * On success, redirects to the plan page. On failure, redirects with error param.
 */

module.exports = {
  updatePlanItem,
  addPlanItem,
  deletePlanItem,
  reorderPlanItems,
  assignPlanItem,
  unassignPlanItem,
  pinPlanItem,
  unpinPlanItem,
};
