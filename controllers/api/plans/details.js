/**
 * Plan-item details: transport, parking, discount, documents, photos, accommodation.
 *
 * Pure relocation from controllers/api/plans.js (bd #97c6).
 * Imports + helper signatures unchanged.
 */

const Plan = require("../../../models/plan");
const Experience = require("../../../models/experience");
const Destination = require("../../../models/destination");
const User = require("../../../models/user");
const Photo = require("../../../models/photo");
const permissions = require("../../../utilities/permissions");
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


// PLAN ITEM DETAILS (Transport, Parking, Discount, Documents, Photos)
// ============================================================================

/**
 * Valid detail types that can be added/updated/deleted
 * These map to the details subdocument fields in planItemSnapshotSchema
 */
const VALID_DETAIL_TYPES = ['transport', 'parking', 'discount', 'documents', 'photos', 'accommodation'];

const DETAIL_TYPE_ALIASES = {
  // UI types -> canonical backend detail types
  flight: { type: 'transport', mode: 'flight' },
  train: { type: 'transport', mode: 'train' },
  cruise: { type: 'transport', mode: 'cruise' },
  ferry: { type: 'transport', mode: 'ferry' },
  bus: { type: 'transport', mode: 'bus' },
  hotel: { type: 'accommodation' },
  accommodation: { type: 'accommodation' }
};

const pickDefined = (obj, keys) => {
  const out = {};
  if (!obj) return out;
  keys.forEach((key) => {
    if (obj[key] !== undefined) out[key] = obj[key];
  });
  return out;
};

const normalizeTransportDataForMode = (modeRaw, data) => {
  const mode = String(modeRaw || '').trim();
  const baseKeys = [
    'vendor',
    'trackingNumber',
    'country',
    'departureTime',
    'arrivalTime',
    'departureLocation',
    'arrivalLocation',
    'status',
    'transportNotes'
  ];

  const normalized = {
    mode,
    ...pickDefined(data, baseKeys)
  };

  const dataObj = data || {};

  if (mode === 'flight') {
    const flightKeys = ['terminal', 'gate', 'arrivalTerminal', 'arrivalGate'];
    const fromNested = pickDefined(dataObj.flight, flightKeys);
    const fromTop = pickDefined(dataObj, flightKeys);
    normalized.flight = {
      ...fromNested,
      ...fromTop
    };
  }

  if (mode === 'train') {
    const trainKeys = ['platform', 'carriageNumber'];
    const fromNested = pickDefined(dataObj.train, trainKeys);
    const fromTop = pickDefined(dataObj, trainKeys);
    normalized.train = {
      ...fromNested,
      ...fromTop
    };
  }

  if (mode === 'cruise') {
    const cruiseKeys = ['deck', 'shipName', 'embarkationPort', 'disembarkationPort'];
    const fromNested = pickDefined(dataObj.cruise, cruiseKeys);
    const fromTop = pickDefined(dataObj, cruiseKeys);
    normalized.cruise = {
      ...fromNested,
      ...fromTop
    };
  }

  if (mode === 'ferry') {
    const ferryKeys = ['deck', 'shipName', 'embarkationPort', 'disembarkationPort'];
    const fromNested = pickDefined(dataObj.ferry, ferryKeys);
    const fromTop = pickDefined(dataObj, ferryKeys);
    normalized.ferry = {
      ...fromNested,
      ...fromTop
    };
  }

  if (mode === 'bus') {
    const busKeys = ['stopName'];
    const fromNested = pickDefined(dataObj.bus, busKeys);
    const fromTop = pickDefined(dataObj, busKeys);
    normalized.bus = {
      ...fromNested,
      ...fromTop
    };
  }

  return normalized;
};

const normalizeDetailTypeAndData = ({ type, data }) => {
  const rawType = String(type || '').trim();
  const alias = DETAIL_TYPE_ALIASES[rawType];

  if (rawType === 'transport') {
    const mode = data?.mode;
    return {
      type: 'transport',
      data: mode ? normalizeTransportDataForMode(mode, data) : data
    };
  }

  if (!alias) {
    return { type: rawType, data };
  }

  if (alias.type === 'transport') {
    const mode = alias.mode;
    return {
      type: 'transport',
      data: normalizeTransportDataForMode(mode, { ...(data || {}), mode })
    };
  }

  return { type: alias.type, data };
};

/**
 * Add a detail to a plan item
 * Handles transport, parking, discount, documents, and photos
 * @param {string} type - Type of detail: 'transport', 'parking', 'discount', 'documents', 'photos'
 * @param {object} data - Detail-specific data
 */

const addPlanItemDetail = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { type: rawType, data: rawData } = req.body;
  const { type, data } = normalizeDetailTypeAndData({ type: rawType, data: rawData });

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
      discount: null,
      accommodation: null
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

    case 'accommodation':
      // Accommodation is a single object, not an array
      planItem.details.accommodation = data;
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

  // Real-time sync: broadcast full plan update + a granular detail event.
  try {
    const version = Date.now();
    const experienceId = plan.experience?._id || plan.experience;

    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      version,
      payload: {
        planId: id.toString(),
        experienceId: experienceId?.toString ? experienceId.toString() : experienceId,
        plan,
        action: 'detail_added',
        version
      }
    }, req.user._id.toString());

    broadcastEvent('plan', id.toString(), {
      type: 'plan:item:detail:added',
      version,
      payload: {
        planId: id.toString(),
        itemId: itemId.toString(),
        detailType: type,
        data: plan,
        action: 'detail_added',
        version
      }
    }, req.user._id.toString());
  } catch (e) {
    // Non-fatal
  }

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

  // Log photo-specific activity for the experience activity feed
  // Only if the plan item visibility is 'public' and user has a public profile
  if (type === 'photos' && planItem.visibility === 'public') {
    try {
      const experienceId = plan.experience?._id || plan.experience;
      const photoUploader = await User.findById(req.user._id).select('preferences.profileVisibility name email').lean();
      if (photoUploader?.preferences?.profileVisibility !== 'private') {
        await Activity.log({
          action: 'plan_item_photo_added',
          actor: {
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email
          },
          resource: {
            id: experienceId,
            type: 'Experience',
            name: plan.experience?.name || 'Unknown Experience'
          },
          target: {
            id: itemId,
            type: 'PlanItem',
            name: planItemName
          },
          reason: `${req.user.name} added a photo to "${planItemName}"`,
          metadata: {
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestPath: req.path,
            requestMethod: req.method,
            experienceId: experienceId?.toString ? experienceId.toString() : String(experienceId),
            planId: plan._id.toString(),
            photoId: data.photoId
          },
          tags: ['experience_feed', 'plan_item_photo']
        });

        // Broadcast to experience room so activity tab updates in real time
        broadcastEvent('experience', experienceId?.toString ? experienceId.toString() : String(experienceId), {
          type: 'experience:activity:new',
          payload: {
            experienceId: experienceId?.toString ? experienceId.toString() : String(experienceId),
            action: 'plan_item_photo_added',
            actorName: req.user.name
          }
        }, req.user._id.toString());
      }
    } catch (feedErr) {
      backendLogger.warn('Failed to log plan_item_photo_added activity for feed', { error: feedErr.message });
    }
  }

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
  const { type: rawType, data: rawData } = req.body;
  const { type, data } = normalizeDetailTypeAndData({ type: rawType, data: rawData });

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
      // Merge updates into existing transport, then normalize into mode-specific schema
      {
        const existing = planItem.details.transport?.toObject ? planItem.details.transport.toObject() : planItem.details.transport;
        const merged = { ...(existing || {}), ...(data || {}) };
        if (!merged.mode) {
          return res.status(400).json({ error: 'Transport mode is required' });
        }
        planItem.details.transport = normalizeTransportDataForMode(merged.mode, merged);
      }
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

    case 'accommodation':
      if (!planItem.details.accommodation) {
        return res.status(404).json({ error: 'Accommodation detail not found' });
      }
      Object.assign(planItem.details.accommodation, data);
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

  // Real-time sync: broadcast full plan update + a granular detail event.
  try {
    const version = Date.now();
    const experienceId = plan.experience?._id || plan.experience;

    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      version,
      payload: {
        planId: id.toString(),
        experienceId: experienceId?.toString ? experienceId.toString() : experienceId,
        plan,
        action: 'detail_updated',
        version
      }
    }, req.user._id.toString());

    broadcastEvent('plan', id.toString(), {
      type: 'plan:item:detail:updated',
      version,
      payload: {
        planId: id.toString(),
        itemId: itemId.toString(),
        detailId: detailId?.toString ? detailId.toString() : detailId,
        detailType: type,
        data: plan,
        action: 'detail_updated',
        version
      }
    }, req.user._id.toString());
  } catch (e) {
    // Non-fatal
  }

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
  const { type: rawType } = req.body;
  const { type } = normalizeDetailTypeAndData({ type: rawType, data: {} });

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

    case 'accommodation':
      planItem.details.accommodation = null;
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

  // Real-time sync: broadcast full plan update + a granular detail event.
  try {
    const version = Date.now();
    const experienceId = plan.experience?._id || plan.experience;

    broadcastEvent('plan', id.toString(), {
      type: 'plan:updated',
      version,
      payload: {
        planId: id.toString(),
        experienceId: experienceId?.toString ? experienceId.toString() : experienceId,
        plan,
        action: 'detail_deleted',
        version
      }
    }, req.user._id.toString());

    broadcastEvent('plan', id.toString(), {
      type: 'plan:item:detail:deleted',
      version,
      payload: {
        planId: id.toString(),
        itemId: itemId.toString(),
        detailId: detailId?.toString ? detailId.toString() : detailId,
        detailType: type,
        data: plan,
        action: 'detail_deleted',
        version
      }
    }, req.user._id.toString());
  } catch (e) {
    // Non-fatal
  }

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

module.exports = {
  addPlanItemDetail,
  updatePlanItemDetail,
  deletePlanItemDetail,
};
